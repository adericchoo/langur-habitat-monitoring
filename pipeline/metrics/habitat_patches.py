"""Form discrete habitat patches from one land-cover classification raster.

Part A of the corridor method (see corridor-method.md): turn the forest-class
pixel blanket into a clean set of habitat patches (polygons with area + core),
which Part B then connects with corridors. Deterministic from a single .tif.

Pipeline (P-steps mirror corridor-method.md):
  P1  habitat mask      forest class (== HABITAT_CLASS) from the end-year raster
  P2  denoise           morphological open then close (1px) — kill speckle/pinholes
  P3  label             8-connected components  (connectivity=8)  [DECIDED: 8]
  P4  require a core     keep a patch only if >=1 pixel survives the 100 m erosion
  P5  minimum size      drop patches below --min-ha  [OPEN: default 0 = no filter]
  P6  attributes        area_ha, core_ha, centroid (lon/lat) per surviving patch

SCREENING, NOT PROOF — patches are a class-based estimate, not field-verified.

SENSITIVE OUTPUT: the patch polygons are precise habitat geometry. The GeoJSON is
written under pipeline/metrics/outputs/ (gitignored). Local/dev visualisation only;
never commit or publish the raw geometry. See CLAUDE.md.

Usage (repo root, inside the venv):
    python -I pipeline/metrics/habitat_patches.py \
        --raster docs/classification_2025.tif \
        --out    pipeline/metrics/outputs/habitat_patches_2025.geojson
Defaults match those paths. --min-ha filters P5; 0 keeps every cored patch.
"""
from __future__ import annotations

import argparse
import json
import os
import time

import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.warp import transform_geom

# Shared with pipeline/metrics/habitat_loss.py — keep in sync (single source there).
HABITAT_CLASS = 2      # forest proxy for langur habitat
EDGE_DEPTH_M = 100     # core erosion depth; == habitat_loss core_habitat / fragmentation core
CONNECTIVITY = 8       # P3 — decided
SIZE_CLASSES_HA = [0.5, 1, 2, 5, 10, 25, 50, 100, 500, 1000]


def binary_erosion(mask, iterations):
    """4-connected binary erosion by `iterations` px (mirrors habitat_loss.py)."""
    m = mask
    for _ in range(iterations):
        e = m.copy()
        e[1:, :] &= m[:-1, :]
        e[:-1, :] &= m[1:, :]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        e[0, :] = e[-1, :] = e[:, 0] = e[:, -1] = False
        m = e
    return m


def binary_dilation(mask, iterations):
    """4-connected binary dilation by `iterations` px (denoise twin of erosion)."""
    m = mask
    for _ in range(iterations):
        d = m.copy()
        d[1:, :] |= m[:-1, :]
        d[:-1, :] |= m[1:, :]
        d[:, 1:] |= m[:, :-1]
        d[:, :-1] |= m[:, 1:]
        m = d
    return m


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raster", default="docs/classification_2025.tif")
    ap.add_argument("--out", default="pipeline/metrics/outputs/habitat_patches_2025.geojson")
    ap.add_argument("--min-ha", type=float, default=0.0,
                    help="P5 minimum patch size in hectares; 0 keeps every cored patch")
    args = ap.parse_args()

    t0 = time.time()

    def log(msg):
        print(f"[{time.time() - t0:5.1f}s] {msg}", flush=True)

    with rasterio.open(args.raster) as ds:
        px_w, px_h = ds.res
        px_area_ha = abs(px_w * px_h) / 10_000.0
        iters = max(1, round(EDGE_DEPTH_M / abs(px_w)))
        transform = ds.transform
        crs = ds.crs.to_string()
        log(f"raster {ds.width}x{ds.height}  {abs(px_w):g} m  "
            f"px={px_area_ha:g} ha  core-erosion={iters} px")
        a = ds.read(1)

    # P1 — habitat mask
    forest = a == HABITAT_CLASS
    del a
    log(f"P1 forest pixels: {int(forest.sum()):,} ({forest.sum() * px_area_ha:,.0f} ha)")

    # P2 — denoise: open (erode->dilate) then close (dilate->erode), 1 px
    cleaned = binary_dilation(binary_erosion(forest, 1), 1)   # open
    cleaned = binary_erosion(binary_dilation(cleaned, 1), 1)  # close
    log(f"P2 denoised forest pixels: {int(cleaned.sum()):,}")
    del forest

    # P4 — core mask (computed now; applied per-patch after labelling)
    core = binary_erosion(cleaned, iters)
    log(f"P4 core pixels (survive {EDGE_DEPTH_M} m erosion): {int(core.sum()):,}")

    # P3 — 8-connected components -> polygons. shapes over a disjoint mask yields
    # exactly one polygon per connected component.
    src = cleaned.astype(np.uint8)
    geoms = [geom for geom, _val in
             shapes(src, mask=cleaned, connectivity=CONNECTIVITY, transform=transform)]
    n = len(geoms)
    log(f"P3 candidate patches (8-connected, after denoise): {n:,}")

    # Burn an id per component so area/core can be tallied per label.
    labels = rasterize(
        ((g, i) for i, g in enumerate(geoms, start=1)),
        out_shape=cleaned.shape, transform=transform, fill=0, dtype=np.int32,
    )
    del cleaned, src

    area_px = np.bincount(labels.ravel(), minlength=n + 1)
    area_ha = area_px * px_area_ha
    core_px = np.bincount(labels[core].ravel(), minlength=n + 1)
    del labels, core

    ids = np.arange(1, n + 1)
    has_core = core_px[1:] > 0                      # P4
    big_enough = area_ha[1:] >= args.min_ha         # P5
    kept = has_core & big_enough

    log(f"P4 patches with a core: {int(has_core.sum()):,} of {n:,}")
    log(f"P5 kept (core AND >= {args.min_ha} ha): {int(kept.sum()):,}")

    # --- Size-class distribution of the cored patches (helps pick --min-ha) -----
    cored_areas = area_ha[1:][has_core]
    print("\n  size-class distribution of cored patches (pick a --min-ha from this):")
    print(f"  {'>= ha':>8} {'count':>8} {'total ha':>12}")
    for thr in SIZE_CLASSES_HA:
        sel = cored_areas >= thr
        print(f"  {thr:>8g} {int(sel.sum()):>8,} {cored_areas[sel].sum():>12,.0f}")
    if cored_areas.size:
        top = np.sort(cored_areas)[::-1][:5]
        print(f"\n  largest cored patches (ha): {', '.join(f'{v:,.0f}' for v in top)}")
        print(f"  total cored habitat: {cored_areas.sum():,.0f} ha")

    # --- P6 — write kept patches as GeoJSON (reprojected to lon/lat) ------------
    features = []
    for idx in ids[kept]:
        g = transform_geom(crs, "EPSG:4326", geoms[idx - 1])
        features.append({
            "type": "Feature",
            "geometry": g,
            "properties": {
                "id": int(idx),
                "area_ha": round(float(area_ha[idx]), 2),
                "core_ha": round(float(core_px[idx] * px_area_ha), 2),
            },
        })
    fc = {"type": "FeatureCollection",
          "name": f"habitat_patches (min_ha={args.min_ha}, connectivity={CONNECTIVITY})",
          "features": features}

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(fc, f)
    log(f"wrote {len(features):,} patches -> {args.out}")
    print("\nSENSITIVE geometry — local only, do not commit/publish (see CLAUDE.md).")


if __name__ == "__main__":
    main()
