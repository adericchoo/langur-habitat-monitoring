"""Landscape fragmentation metrics from one land-cover classification raster.

Emits the exact summary rows the frontend's Fragmentation step reads (see
data-contract/gee-output-spec.md): one 8-column row per metric per study_area,
plus an "All regions (overall)" rollup. Join key `study_area` is written
byte-identical to habitat_loss.py's, so a site's loss and fragmentation cards agree.

Metrics, per study area (a single-year snapshot of the habitat = karst-forest class):
  num_patches          NP   — distinct cored habitat fragments (Part A definition)
  effective_mesh_size  MESH — Sigma(area_i^2) / landscape_area  (connectivity proxy)
  largest_patch_index  LPI  — 100 * largest patch area / landscape area  (%)
  edge_density         ED   — habitat/non-habitat edge length / landscape area (m/ha)
  core_area                 — habitat eroded inward by EDGE_DEPTH_M (interior, ha)

SCREENING, NOT PROOF — all derived from the land-cover classification, not field work.

"Habitat" is the KARST-FOREST class (HABITAT_CLASS=2, v2 legend, = langur habitat).
Patches mirror habitat_patches.py (P1 mask -> P2 denoise -> P3 8-label -> P4 require a
core), so num_patches reconciles with the patch artifact; core_area is computed the
same way as habitat_loss.py's core_habitat (raw habitat eroded), so the two agree.

Inputs are LOCAL and gitignored (raster + study-area geometry); the CSV output is
aggregated (hectares, counts, public area names) — the publishable tier, review first.

Usage (repo root, inside the venv):
    python -I pipeline/metrics/fragmentation_metrics.py \
        --raster docs/classification_v2_2025.tif --year 2025 \
        --areas  data/study_areas/habitat_areas.geojson \
        --out    pipeline/metrics/outputs/fragmentation_2025.csv
Defaults match those paths. --min-ha mirrors Part A P5 (0 keeps every cored patch).
"""
from __future__ import annotations

import argparse
import csv
import json
import os

import numpy as np
import rasterio
from rasterio.features import geometry_mask, rasterize, shapes
from rasterio.warp import transform_geom

# --- Shared with habitat_patches.py / habitat_loss.py — keep in sync -----------
HABITAT_CLASS = 2   # 2 = karst forest = langur habitat (v2 legend, confirmed)
EDGE_DEPTH_M = 100  # core erosion depth; == habitat_loss core_habitat / corridors core
CONNECTIVITY = 8    # P3 — decided
BACKGROUND = 0      # nodata / outside study area — excluded from landscape area

OVERALL_NAME = "All regions (overall)"

LIMITATIONS = (
    "Screening product: landscape metrics from a single-year land-cover "
    "classification, not field-verified. Habitat = karst-forest class. Patches use "
    "the Part A definition (1px denoise, 8-connected, >=1 core pixel after 100 m "
    "erosion); num_patches is per study area, so a fragment split by a polygon "
    "boundary is counted in each. Edge density counts only habitat/non-habitat "
    "borders inside the landscape (the study-area boundary and nodata are not edge), "
    "so it is conservative near arbitrary polygon edges. Single snapshot — no trend."
)

UNITS = {
    "effective_mesh_size": "ha", "num_patches": "patches",
    "largest_patch_index": "%", "edge_density": "m/ha", "core_area": "ha",
}
# Emission order mirrors the frontend card order (mesh, patches, lpi, edge, core).
METRIC_ORDER = ["effective_mesh_size", "num_patches", "largest_patch_index",
                "edge_density", "core_area"]


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


def area_mask_for(geom_lonlat, ds):
    """Boolean mask (raster grid) of pixels inside one study-area geometry."""
    geom = transform_geom("EPSG:4326", ds.crs.to_string(), geom_lonlat)
    return geometry_mask([geom], out_shape=(ds.height, ds.width),
                         transform=ds.transform, invert=True)


def metrics_in_mask(classes, mask, px_area_ha, pixel_m, min_ha):
    """The five fragmentation metrics for the pixels where `mask` is True."""
    iters = max(1, round(EDGE_DEPTH_M / pixel_m))

    land = mask & (classes != BACKGROUND)        # real land = MESH/LPI/ED denominator
    landscape_ha = int(land.sum()) * px_area_ha

    habitat = (classes == HABITAT_CLASS) & mask  # raw habitat in the area
    # P2 denoise: open (erode->dilate) then close (dilate->erode), 1 px
    clean = binary_dilation(binary_erosion(habitat, 1), 1)
    clean = binary_erosion(binary_dilation(clean, 1), 1)

    # core_area: raw habitat eroded inward by EDGE_DEPTH_M (matches habitat_loss).
    core_ha = int(binary_erosion(habitat, iters).sum()) * px_area_ha

    # Edge density: habitat/non-habitat borders INSIDE the landscape only.
    nonhab = land & ~clean
    edges = (np.count_nonzero(clean[1:, :] & nonhab[:-1, :])
             + np.count_nonzero(clean[:-1, :] & nonhab[1:, :])
             + np.count_nonzero(clean[:, 1:] & nonhab[:, :-1])
             + np.count_nonzero(clean[:, :-1] & nonhab[:, 1:]))
    edge_density = (edges * pixel_m / landscape_ha) if landscape_ha > 0 else 0.0

    # Patches (P3 label -> P4 require a core -> P5 min size), on the denoised mask.
    if clean.any():
        geoms = [g for g, _ in shapes(clean.astype(np.uint8), mask=clean,
                                      connectivity=CONNECTIVITY)]
        n = len(geoms)
        labels = rasterize(((g, i) for i, g in enumerate(geoms, start=1)),
                           out_shape=classes.shape, fill=0, dtype=np.int32)
        area_px = np.bincount(labels.ravel(), minlength=n + 1)
        core_px = np.bincount(labels[binary_erosion(clean, iters)].ravel(),
                              minlength=n + 1)
        areas_ha = area_px[1:] * px_area_ha
        kept = (core_px[1:] > 0) & (areas_ha >= min_ha)
        patch_areas = areas_ha[kept]
    else:
        patch_areas = np.array([], dtype=float)

    num_patches = int(patch_areas.size)
    if landscape_ha > 0 and num_patches:
        mesh = float((patch_areas ** 2).sum()) / landscape_ha
        lpi = 100.0 * float(patch_areas.max()) / landscape_ha
    else:
        mesh = lpi = 0.0

    return {
        "effective_mesh_size": round(mesh, 1),
        "num_patches": num_patches,
        "largest_patch_index": round(lpi, 2),
        "edge_density": round(edge_density, 1),
        "core_area": round(core_ha, 1),
    }


def rows_for(study_area, metrics, year_start, year_end, source_script):
    for m in METRIC_ORDER:
        yield {
            "metric": m, "value": metrics[m], "unit": UNITS[m],
            "year_start": year_start, "year_end": year_end,
            "study_area": study_area, "source_script": source_script,
            "limitations": LIMITATIONS,
        }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raster", default="docs/classification_v2_2025.tif")
    ap.add_argument("--areas", default="data/study_areas/habitat_areas.geojson")
    ap.add_argument("--out", default="pipeline/metrics/outputs/fragmentation_2025.csv")
    ap.add_argument("--year", type=int, default=2025,
                    help="snapshot year the raster represents; labels year_start=year_end")
    ap.add_argument("--min-ha", type=float, default=0.0,
                    help="P5 minimum patch size in hectares; 0 keeps every cored patch")
    args = ap.parse_args()

    year = args.year
    source_script = f"fragmentation_metrics_{year}"

    with rasterio.open(args.raster) as ds:
        classes = ds.read(1)
        px_w, px_h = ds.res
        px_area_ha = abs(px_w * px_h) / 10_000.0
        pixel_m = abs(px_w)

        with open(args.areas, encoding="utf-8") as f:
            features = json.load(f)["features"]

        all_rows = []
        union = np.zeros((ds.height, ds.width), dtype=bool)
        print(f"{'study_area':<26} {'NP':>5} {'MESH(ha)':>10} {'LPI(%)':>7} "
              f"{'ED(m/ha)':>9} {'core(ha)':>9}")
        for feat in features:
            name = feat["properties"]["name"]
            mask = area_mask_for(feat["geometry"], ds)
            union |= mask
            m = metrics_in_mask(classes, mask, px_area_ha, pixel_m, args.min_ha)
            all_rows.extend(rows_for(name, m, year, year, source_script))
            print(f"{name:<26} {m['num_patches']:>5,} {m['effective_mesh_size']:>10,.0f} "
                  f"{m['largest_patch_index']:>7.1f} {m['edge_density']:>9.1f} "
                  f"{m['core_area']:>9,.0f}")

        overall = metrics_in_mask(classes, union, px_area_ha, pixel_m, args.min_ha)
        all_rows = list(rows_for(OVERALL_NAME, overall, year, year, source_script)) + all_rows
        print(f"{OVERALL_NAME:<26} {overall['num_patches']:>5,} "
              f"{overall['effective_mesh_size']:>10,.0f} {overall['largest_patch_index']:>7.1f} "
              f"{overall['edge_density']:>9.1f} {overall['core_area']:>9,.0f}")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    cols = ["metric", "value", "unit", "year_start", "year_end",
            "study_area", "source_script", "limitations"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nWrote {len(all_rows)} rows -> {args.out}")

    # Sibling JSON of the same contract rows — the frontend B4 loader's input
    # (copy into web/public/data/ to surface in the app; see useMetricSites).
    json_out = os.path.splitext(args.out)[0] + ".json"
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump(all_rows, f)
    print(f"Wrote {len(all_rows)} rows -> {json_out}")
    print("Aggregated tier (counts/hectares + public names) — review before publishing.")


if __name__ == "__main__":
    main()
