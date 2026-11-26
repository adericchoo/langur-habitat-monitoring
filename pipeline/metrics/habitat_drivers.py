"""Derive driver blobs (quarry, agriculture) from the land-cover classification.

The spatial version of Step 01's "loss by driver" sidebar: group driver-class
pixels into blobs, attribute each to a study-area region, size the growth over the
window, and score an auto-confidence. Retargets the Part-A patch pipeline
(habitat_patches.py: mask -> denoise -> 8-connected components -> per-label area)
onto the driver classes, CLIPPED to the study-area regions so a blob is the
quarry / cropland footprint *inside* a region (a pressure on that region), not the
whole landscape (agriculture is a landscape-wide class).

v2 6-class legend (single-band classification_v2_*.tif): 3 = quarry, 4 = agriculture.

Per blob: areaHa (end-year extent), deltaHa (pixels new since the start year),
confidence {score, label} (size + compactness, an auto screening score), regionId
(the registry region id it falls in), verified=false (seam for a future verified
state). Geometry is coarsened (Douglas-Peucker). Emits the exact GeoJSON the
frontend reads (web/src/types/drivers.ts): a FeatureCollection of Polygons.

SCREENING, NOT PROOF — a blob is an auto-flagged footprint from land cover, not a
field-verified site. SENSITIVE OUTPUT: driver geometry near habitat is a threat
location (same tier as patches/corridors) — written under gitignored paths, never
committed/published. See CLAUDE.md / SECURITY.md.

Usage (repo root, inside the venv with pipeline/metrics/requirements.txt):
    python -I pipeline/metrics/habitat_drivers.py \
        --r-end   docs/classification_v2_2025.tif --year-end   2025 \
        --r-start docs/classification_v2_2017.tif --year-start 2017 \
        --areas   data/study_areas/habitat_areas.geojson \
        --out     pipeline/metrics/outputs/drivers_2025.geojson
Defaults match those paths. Stage the result to web/public/data/drivers.json
(gitignored) for the frontend.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.warp import transform_geom

# v2 legend driver classes.
DRIVER_CLASSES = {"quarry": 3, "agriculture": 4}
CONNECTIVITY = 8

# Study-area name -> registry region id (web/src/regions/registry.ts). The join key
# the frontend scopes blobs on.
REGION_ID_BY_NAME = {
    "Pu Luong Karst": "pu-luong",
    "Cuc Phuong": "cuc-phuong",
    "Hoa Lu / Trang An": "hoa-lu-trang-an",
    "Tam Diep": "tam-diep",
    "Huong Son – Lac Thuy": "huong-son-lac-thuy",  # en-dash
    "Kim Bang": "kim-bang",
    "Van Long NR – Dong Tam": "van-long-dong-tam",  # en-dash
}

# Auto-confidence: blend of size (saturating) and compactness (core fraction).
SIZE_SAT_HA = 25.0  # a blob this big saturates the size term
HIGH, MODERATE = 0.66, 0.40  # score -> label cuts


def grow_regions(region_raster, buffer_px):
    """Grassfire-grow the region ids into unassigned (0) pixels for `buffer_px`
    steps, so each pixel within the buffer takes its NEAREST region id (fronts meet
    at the midline). This forms a per-region CATCHMENT, so a driver footprint on a
    region's edge / just outside it (e.g. a quarry eating into habitat from the
    boundary) is still attributed to that region. Bounded to the region bbox + pad
    for speed."""
    if buffer_px <= 0:
        return region_raster
    strict = region_raster > 0
    rows = np.where(strict.any(axis=1))[0]
    cols = np.where(strict.any(axis=0))[0]
    if rows.size == 0:
        return region_raster
    pad = buffer_px + 2
    r0, r1 = max(0, rows[0] - pad), min(region_raster.shape[0], rows[-1] + pad + 1)
    c0, c1 = max(0, cols[0] - pad), min(region_raster.shape[1], cols[-1] + pad + 1)
    cat = region_raster[r0:r1, c0:c1].copy()
    for _ in range(buffer_px):
        empty = cat == 0
        nb = np.zeros_like(cat)
        nb[:-1, :] = np.maximum(nb[:-1, :], cat[1:, :])
        nb[1:, :] = np.maximum(nb[1:, :], cat[:-1, :])
        nb[:, :-1] = np.maximum(nb[:, :-1], cat[:, 1:])
        nb[:, 1:] = np.maximum(nb[:, 1:], cat[:, :-1])
        grow = empty & (nb > 0)
        if not grow.any():
            break
        cat[grow] = nb[grow]
    out = np.zeros_like(region_raster)
    out[r0:r1, c0:c1] = cat
    return out


def binary_erosion(mask, iterations):
    """4-connected binary erosion (mirrors habitat_patches.py)."""
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
    m = mask
    for _ in range(iterations):
        d = m.copy()
        d[1:, :] |= m[:-1, :]
        d[:-1, :] |= m[1:, :]
        d[:, 1:] |= m[:, :-1]
        d[:, :-1] |= m[:, 1:]
        m = d
    return m


def douglas_peucker(points, tol):
    """Simplify an open polyline (list of (x,y)) to tolerance `tol` (same units)."""
    if len(points) < 3:
        return points
    x1, y1 = points[0]
    x2, y2 = points[-1]
    dx, dy = x2 - x1, y2 - y1
    seg2 = dx * dx + dy * dy
    dmax, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if seg2 == 0:
            d = ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        else:
            t = ((px - x1) * dx + (py - y1) * dy) / seg2
            t = max(0.0, min(1.0, t))
            d = ((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2) ** 0.5
        if d > dmax:
            dmax, idx = d, i
    if dmax <= tol:
        return [points[0], points[-1]]
    left = douglas_peucker(points[: idx + 1], tol)
    right = douglas_peucker(points[idx:], tol)
    return left[:-1] + right


def simplify_ring(ring, tol):
    """Simplify a closed ring; keep it closed and >= 4 points (a valid polygon)."""
    simp = douglas_peucker(ring, tol)
    if len(simp) < 4:
        return ring
    if simp[0] != simp[-1]:
        simp.append(simp[0])
    return simp


def coarsen_geometry(geom, tol):
    rings = geom["coordinates"]
    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [[list(p) for p in simplify_ring([tuple(p) for p in r], tol)] for r in rings]}
    # MultiPolygon
    return {
        "type": "MultiPolygon",
        "coordinates": [[[list(p) for p in simplify_ring([tuple(p) for p in r], tol)] for r in poly] for poly in rings],
    }


def centroid_lonlat(geom):
    """Rough centroid (mean of the first exterior ring) for a lon/lat polygon."""
    coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
    pts = coords[:-1] or coords
    return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]


def confidence_for(area_ha, core_frac):
    score = 0.5 * core_frac + 0.5 * min(1.0, area_ha / SIZE_SAT_HA)
    label = "High" if score >= HIGH else "Moderate" if score >= MODERATE else "Low"
    return round(float(score), 2), label


def majority_region(labels, catchment, n, k):
    """Per blob label, the region id holding the most of its pixels — the catchment
    used as a MEMBERSHIP test, not a clip. 0 when the blob overlaps no region's
    catchment (then it is dropped). `k` = max region index."""
    flat_lab, flat_cat = labels.ravel(), catchment.ravel()
    sel = (flat_lab > 0) & (flat_cat > 0)
    key = flat_lab[sel].astype(np.int64) * (k + 1) + flat_cat[sel]
    counts = np.bincount(key)
    out = np.zeros(n + 1, dtype=np.int32)
    best = np.zeros(n + 1, dtype=np.int64)
    for kv in np.nonzero(counts)[0]:
        lab_i, cat_i = int(kv // (k + 1)), int(kv % (k + 1))
        if counts[kv] > best[lab_i]:
            best[lab_i], out[lab_i] = counts[kv], cat_i
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--r-end", default="docs/classification_v2_2025.tif")
    ap.add_argument("--r-start", default="docs/classification_v2_2017.tif")
    ap.add_argument("--areas", default="data/study_areas/habitat_areas.geojson")
    ap.add_argument("--year-start", type=int, default=2017)
    ap.add_argument("--year-end", type=int, default=2025)
    ap.add_argument("--min-ha", type=float, default=2.0, help="drop blobs below this (speckle)")
    ap.add_argument("--quarry-open-px", type=int, default=1,
                    help="morphological opening radius (px) for quarries (light denoise; "
                         "the quarry class is a connected belt here, not separable by opening)")
    ap.add_argument("--catchment-m", type=float, default=500.0,
                    help="buffer (m) added around each region so edge/adjacent driver "
                         "footprints are attributed to it (0 = strict inside-region only)")
    ap.add_argument("--simplify-m", type=float, default=30.0, help="Douglas-Peucker tolerance (m)")
    ap.add_argument("--out", default="pipeline/metrics/outputs/drivers_2025.geojson")
    args = ap.parse_args()

    t0 = time.time()
    log = lambda m: print(f"[{time.time() - t0:5.1f}s] {m}", flush=True)
    sys.setrecursionlimit(1_000_000)  # staircase rings can be long for D-P recursion

    with rasterio.open(args.r_end) as de, rasterio.open(args.r_start) as ds:
        if de.shape != ds.shape or de.transform != ds.transform or de.crs != ds.crs:
            raise SystemExit("start/end rasters must share grid + CRS")
        px_w, px_h = de.res
        px_area_ha = abs(px_w * px_h) / 10_000.0
        transform, crs = de.transform, de.crs.to_string()
        tol_deg = args.simplify_m / 111_320.0
        log(f"raster {de.width}x{de.height}  {abs(px_w):g} m  px={px_area_ha:g} ha")
        end = de.read(1)
        start = ds.read(1)

    # Burn region ids (1..N) from the study areas; keep only in-region pixels.
    with open(args.areas, encoding="utf-8") as f:
        areas = json.load(f)["features"]
    regions = []  # (idx, name, registry_id)
    burn = []
    for i, feat in enumerate(areas, start=1):
        name = feat["properties"]["name"]
        rid = REGION_ID_BY_NAME.get(name)
        if not rid:
            log(f"  WARN: no registry id for study area {name!r} — skipped")
            continue
        regions.append((i, name, rid))
        # Study areas are EPSG:4326; rasterize needs them in the raster CRS.
        burn.append((transform_geom("EPSG:4326", crs, feat["geometry"]), i))
    region_raster = rasterize(burn, out_shape=end.shape, transform=transform, fill=0, dtype=np.int32)
    buffer_px = round(args.catchment_m / abs(px_w))
    catchment = grow_regions(region_raster, buffer_px)  # region ids + nearest-region buffer
    in_catchment = catchment > 0
    id_by_index = {i: rid for i, _n, rid in regions}
    log(f"regions burned: {len(regions)}  catchment ({args.catchment_m:g} m / {buffer_px} px) "
        f"pixels: {int(in_catchment.sum()):,}")

    features = []
    counters = {}
    for kind, cls in DRIVER_CLASSES.items():
        # Quarries are OBJECTS: blob the whole connected footprint (true rim); the
        # catchment is only a membership test (attribution). Agriculture is a ZONE:
        # clip it to the catchment (a landscape-wide class would otherwise be one
        # giant blob) — the frontend draws that clipped edge soft, not as a boundary.
        clip = kind == "agriculture"
        mask = (end == cls) & in_catchment if clip else (end == cls)
        if not mask.any():
            log(f"{kind}: no pixels")
            continue
        # Opening (erode->dilate, radius `open_px`) severs thin pixel bridges so a
        # ridge of speckle doesn't weld separate quarries into one belt; closing (1 px)
        # fills pinholes. Quarries (objects) get the larger opening; agriculture (zone,
        # already clipped) keeps a light 1 px touch.
        open_px = 1 if clip else max(1, args.quarry_open_px)
        opened = binary_dilation(binary_erosion(mask, open_px), open_px)
        cleaned = binary_erosion(binary_dilation(opened, 1), 1)
        core = binary_erosion(cleaned, 1)  # 1-px core => compactness proxy

        src = cleaned.astype(np.uint8)
        geoms = [g for g, _v in shapes(src, mask=cleaned, connectivity=CONNECTIVITY, transform=transform)]
        n = len(geoms)
        if n == 0:
            log(f"{kind}: 0 blobs after denoise")
            continue
        labels = rasterize(((g, i) for i, g in enumerate(geoms, start=1)),
                           out_shape=end.shape, transform=transform, fill=0, dtype=np.int32)
        area_px = np.bincount(labels.ravel(), minlength=n + 1)
        core_px = np.bincount(labels[core].ravel(), minlength=n + 1)
        new_px = np.bincount(labels[start != cls].ravel(), minlength=n + 1)  # new since start year
        # Attribute each blob to the region catchment it overlaps most (membership
        # test). A whole quarry crossing the catchment edge still maps to its region;
        # a blob touching no catchment (0) is dropped below.
        lab_region = majority_region(labels, catchment, n, len(areas))

        # In-region (STRICT polygon) portion of each blob — the part that counts as
        # the region's habitat-loss quarry footprint, distinct from the whole-object
        # areaHa. A quarry can be a huge object whose rim is mostly OUTSIDE the habitat.
        pix_lab = labels.ravel()
        pix_breg = lab_region[pix_lab]  # the attributed region of each pixel's blob
        in_strict = (pix_lab > 0) & (pix_breg > 0) & (region_raster.ravel() == pix_breg)
        in_strict_px = np.bincount(pix_lab[in_strict], minlength=n + 1)

        kept = 0
        for idx in range(1, n + 1):
            area_ha = area_px[idx] * px_area_ha
            if area_ha < args.min_ha:
                continue
            rid = id_by_index.get(int(lab_region[idx]))
            if not rid:
                continue
            core_frac = (core_px[idx] / area_px[idx]) if area_px[idx] else 0.0
            score, clabel = confidence_for(area_ha, core_frac)
            geom = coarsen_geometry(transform_geom(crs, "EPSG:4326", geoms[idx - 1]), tol_deg)
            counters[kind] = counters.get(kind, 0) + 1
            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "id": f"{kind[0]}-{rid}-{counters[kind]}",
                    "driver": kind,
                    "areaHa": round(float(area_ha), 1),  # whole-object footprint
                    "regionAreaHa": round(float(in_strict_px[idx] * px_area_ha), 1),  # part inside the region (habitat-loss)
                    "deltaHa": round(float(new_px[idx] * px_area_ha), 1),
                    "window": [args.year_start, args.year_end],
                    "confidence": {"score": score, "label": clabel},
                    "verified": False,
                    "regionId": rid,
                },
            })
            kept += 1
        log(f"{kind}: {kept} blobs kept (>= {args.min_ha} ha) of {n}")

    fc = {"type": "FeatureCollection",
          "name": f"driver_blobs {args.year_start}-{args.year_end}",
          "features": features}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)

    # Per region x driver summary (counts + ha) — the aggregated, reviewable view.
    print("\n  region                      quarry(n/ha)     agri(n/ha)")
    for _i, name, rid in regions:
        q = [ft for ft in features if ft["properties"]["regionId"] == rid and ft["properties"]["driver"] == "quarry"]
        a = [ft for ft in features if ft["properties"]["regionId"] == rid and ft["properties"]["driver"] == "agriculture"]
        qha = sum(ft["properties"]["areaHa"] for ft in q)
        aha = sum(ft["properties"]["areaHa"] for ft in a)
        print(f"  {name:<26} {len(q):>3}/{qha:>8,.0f}   {len(a):>3}/{aha:>8,.0f}")
    log(f"wrote {len(features)} driver blobs -> {args.out}")
    print("\nSENSITIVE geometry — local only, do not commit/publish (see CLAUDE.md / SECURITY.md).")


if __name__ == "__main__":
    main()
