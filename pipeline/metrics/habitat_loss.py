"""Habitat-loss metrics from two land-cover classification rasters (2017, 2025).

Everything derives from one per-pixel 2017->2025 class cross-tabulation, computed
inside each study-area polygon. Emits the exact summary rows the frontend's
Habitat-loss step reads (see data-contract/gee-output-spec.md): one 8-column row
per metric per study_area, plus an "All regions (overall)" rollup.

SCREENING, NOT PROOF. A class transition is *suspected* loss, not field-verified.

"Habitat" is the KARST-FOREST class (class 2) of the v2 6-class legend — the
dedicated langur-habitat class, confirmed from the GEE author's legend (no longer
a forest proxy). The method is class-agnostic: only the CLASS_NAMES / HABITAT_CLASS
/ driver map below encode the legend, so a legend change stays local to them.

Inputs are LOCAL and gitignored (rasters + study-area geometry); the CSV output is
aggregated (hectares + public area names) and is the publishable tier.

Two tracks are produced (--target both, the default): HABITAT = karst forest
(class 2 = langur habitat) and FOREST = plain forest (class 1). Each is written to
its own CSV, {track}_loss_{ys}_{ye}.csv, under --outdir. 1<->2 (karst<->plain
forest) transitions count as neither loss nor gain for either track, so the two
numbers never contaminate each other.

Usage (from repo root, inside the venv with requirements.txt installed):
    python -I pipeline/metrics/habitat_loss.py \
        --r2017 docs/classification_v2_2017.tif \
        --r2025 docs/classification_v2_2025.tif \
        --areas data/study_areas/habitat_areas.geojson \
        --outdir pipeline/metrics/outputs            # --target habitat|forest|both
Defaults match those paths, so bare `python -I pipeline/metrics/habitat_loss.py`
writes both tracks. The inputs are the single-band class extracts of the v2 GEE
export (band 1, class 0 = nodata); not the raw multi-band langur_v2_*.tif.

For a different pair of epochs, pass the rasters AND their years so the output is
labelled correctly and loss_rate uses the right span:
    python -I pipeline/metrics/habitat_loss.py \
        --r2017 docs/classification_v2_2020.tif --year-start 2020 \
        --r2025 docs/classification_v2_2030.tif --year-end   2030
The --r2017/--r2025 flag names are just the two input slots (start/end); the
--year-* flags set what the data actually represents.
"""
from __future__ import annotations

import argparse
import csv
import json
import os

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom

# --- Configuration (domain calls — tune with SVW) ---------------------------

# v2 GEE export, confirmed 6-class discrete legend (band 1 of langur_v2_*, as
# extracted to the single-band classification_v2_*.tif where class 0 = nodata).
# Same legend the patch/corridor scripts use. NOTE: this is NOT the stale 4-class
# scheme — class 2 is karst forest here, and quarry moved from 1 to 3.
CLASS_NAMES = {
    0: "nodata", 1: "forest", 2: "karst_forest", 3: "quarry",
    4: "agriculture", 5: "urban", 6: "other",
}

# Two forest-type classes exist in the v2 legend: plain forest (1) and karst
# forest (2). The script runs ONE per "track": HABITAT measures the karst-forest
# class (2 = langur habitat, confirmed from the GEE author's legend), FOREST
# measures plain forest (1). HABITAT_CLASS stays the default target so the existing
# contract/metric names are unchanged.
HABITAT_CLASS = 2   # karst forest = langur habitat — the 'habitat' track's target
FOREST_CLASS = 1    # plain forest — the 'forest' track's target
TRACKS = {"habitat": HABITAT_CLASS, "forest": FOREST_CLASS}

# Both tree-cover classes. A transition BETWEEN them (1<->2) is just the fuzzy
# karst/non-karst boundary being re-drawn between two cloudy snapshots — NOT a
# durable change on the ground — and it churns both ways in near-equal volume. So
# 1<->2 counts as neither loss nor gain for EITHER track: loss is only a forest
# class converting to a HARD (non-forest) class, and gain is the reverse. This is
# what keeps the forest (1) and habitat (2) numbers from contaminating each other.
FOREST_CLASSES = {1, 2}

# Hard (non-forest) destination class -> contract driver metric. Only three drivers
# exist in the contract, so: quarry=mining, agriculture=farming, urban + water/other
# = other. Applies to both tracks (loss destinations are the same hard classes).
DRIVER_OF_CLASS = {
    3: "driver_mining",    # -> quarry
    4: "driver_farming",   # -> agriculture
    5: "driver_other",     # -> urban
    6: "driver_other",     # -> other / water
}

# The quarry footprint metric reads this class's end-year extent directly.
QUARRY_CLASS = 3

YEAR_START, YEAR_END = 2017, 2025
EDGE_DEPTH_M = 100  # core-habitat erosion depth; keep == fragmentation core_area

BACKGROUND = 0  # nodata / outside-AOI value, excluded from every metric
REAL_CLASSES = [c for c in CLASS_NAMES if c != BACKGROUND]
# Durable loss/gain destinations: real classes that are NOT forest (so the sibling
# forest class is automatically excluded for whichever track we run). == driver map.
HARD_CLASSES = [c for c in REAL_CLASSES if c not in FOREST_CLASSES]

LIMITATIONS = (
    "Screening product: per-pixel class-transition estimate from the 2017 and 2025 "
    "v2 land-cover rasters (6-class), not field-verified. Habitat = karst forest "
    "(class 2), the dedicated langur-habitat class. habitat_lost is GROSS "
    "habitat->non-habitat (any other class, including karst-forest->forest); regain "
    "is reported separately (forest_gain) and the smaller classes carry "
    "classification noise, so gross loss over-states durable change. Two epochs "
    "only, so loss_rate is a two-point rate with no trend."
)

OVERALL_NAME = "All regions (overall)"


# --- Core computation -------------------------------------------------------

def binary_erosion(mask, iterations):
    """4-connected binary erosion by `iterations` pixels (city-block), NumPy only.

    A pixel survives only if it and all four orthogonal neighbours are set;
    out-of-bounds counts as unset, so the patch erodes inward from every edge.
    Equivalent to scipy.ndimage.binary_erosion with the default cross element.
    """
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


def area_mask_for(geom_lonlat, ds):
    """Boolean mask (raster grid) of pixels inside one study-area geometry."""
    geom = transform_geom("EPSG:4326", ds.crs.to_string(), geom_lonlat)
    # invert=True -> True where inside the geometry.
    return geometry_mask([geom], out_shape=(ds.height, ds.width),
                         transform=ds.transform, invert=True)


def metrics_in_mask(a, b, mask, px_area_ha, pixel_m, years=YEAR_END - YEAR_START,
                    target=HABITAT_CLASS):
    """All loss metrics for the forest class `target`, over the masked pixels.

    a, b: 2D start / end class arrays. `years` is the span between the two epochs
    and is the denominator of loss_rate. `target` is the forest class measured
    (HABITAT_CLASS or FOREST_CLASS); the OTHER forest class is a sibling whose
    1<->2 churn is excluded from loss and gain (see HARD_CLASSES). Returns a dict
    metric -> value. Metric keys keep their contract names regardless of target.
    """
    av = a[mask].astype(np.int64)
    bv = b[mask].astype(np.int64)
    counts = np.bincount(av * 10 + bv, minlength=(max(CLASS_NAMES) + 1) * 10 + 1)

    def c(i, j):  # pixels that went class i (2017) -> class j (2025)
        return int(counts[i * 10 + j])

    T = target
    target_2017_px = sum(c(T, j) for j in REAL_CLASSES + [BACKGROUND])  # extent of T in 2017
    target_2025_px = sum(c(i, T) for i in REAL_CLASSES + [BACKGROUND])  # extent of T in 2025

    # Durable loss: target -> a HARD (non-forest) class. Gain: hard class -> target.
    # The sibling forest class is not in HARD_CLASSES, so 1<->2 is excluded both ways.
    loss_by_dest = {d: c(T, d) for d in HARD_CLASSES}
    gross_loss_px = sum(loss_by_dest.values())
    gain_px = sum(c(s, T) for s in HARD_CLASSES)

    habitat_2017_ha = target_2017_px * px_area_ha
    lost_ha = gross_loss_px * px_area_ha
    loss_rate = (lost_ha / habitat_2017_ha / years * 100) if habitat_2017_ha > 0 else 0.0

    quarry_ha = sum(c(i, QUARRY_CLASS) for i in REAL_CLASSES + [BACKGROUND]) * px_area_ha

    # core_habitat: erode the 2025 target patch inward by EDGE_DEPTH_M.
    habitat_2025_2d = (b == T) & mask
    iters = max(1, round(EDGE_DEPTH_M / pixel_m))
    core_px = int(binary_erosion(habitat_2025_2d, iters).sum())

    out = {
        "habitat_remaining": round(target_2025_px * px_area_ha, 1),
        "habitat_lost": round(lost_ha, 1),
        "loss_rate": round(loss_rate, 2),
        "quarry_footprint": round(quarry_ha, 1),
        "core_habitat": round(core_px * px_area_ha, 1),
        "forest_gain": round(gain_px * px_area_ha, 1),
    }
    out.update(_driver_shares(loss_by_dest, gross_loss_px))
    return out


def _driver_shares(loss_by_dest, gross_loss_px):
    """Driver percentages of gross loss, rounded to whole % summing to 100."""
    keys = list(dict.fromkeys(DRIVER_OF_CLASS.values()))  # stable, deduped
    raw = {k: 0.0 for k in keys}
    if gross_loss_px > 0:
        for dest, px in loss_by_dest.items():
            k = DRIVER_OF_CLASS.get(dest)
            if k:
                raw[k] += 100.0 * px / gross_loss_px
    rounded = {k: int(round(v)) for k, v in raw.items()}
    drift = 100 - sum(rounded.values())
    if any(raw.values()) and drift:  # push rounding remainder onto the largest share
        rounded[max(raw, key=raw.get)] += drift
    return rounded


# --- Row assembly / IO ------------------------------------------------------

UNITS = {
    "habitat_remaining": "ha", "habitat_lost": "ha", "core_habitat": "ha",
    "quarry_footprint": "ha", "forest_gain": "ha", "loss_rate": "%/yr",
    "driver_mining": "%", "driver_farming": "%", "driver_other": "%",
}
# Emission order per study area.
METRIC_ORDER = [
    "habitat_remaining", "habitat_lost", "loss_rate", "quarry_footprint",
    "core_habitat", "driver_mining", "driver_farming", "driver_other", "forest_gain",
]


def rows_for(study_area, metrics, year_start, year_end, source_script):
    for m in METRIC_ORDER:
        yield {
            "metric": m, "value": metrics[m], "unit": UNITS[m],
            "year_start": year_start, "year_end": year_end,
            "study_area": study_area, "source_script": source_script,
            "limitations": LIMITATIONS,
        }


CSV_COLS = ["metric", "value", "unit", "year_start", "year_end",
            "study_area", "source_script", "limitations"]


def _print_row(label, m):
    print(f"{label:<26} {m['habitat_remaining']:>9,.0f} {m['habitat_lost']:>8,.0f} "
          f"{m['loss_rate']:>6.2f} {m['quarry_footprint']:>7,.0f} "
          f"{m['core_habitat']:>8,.0f} {m['forest_gain']:>8,.0f}  "
          f"{m['driver_mining']:>3}/{m['driver_farming']:>3}/{m['driver_other']:>3}")


def run_track(track, target, a, b, masks, union, px_area_ha, pixel_m,
              years, year_start, year_end, out_path):
    """Compute one track (habitat=class 2 or forest=class 1) for every study area
    plus the union rollup, print the table, and write the contract CSV.

    `masks` is [(name, bool mask)]; `union` is their OR. Returns the row count.
    """
    source_script = f"{track}_loss_{year_start}_{year_end}"
    print(f"\n=== {track.upper()} track (target class {target} = "
          f"{CLASS_NAMES[target]}) ===")
    print(f"{'study_area':<26} {'remain':>9} {'lost':>8} {'rate':>6} "
          f"{'quarry':>7} {'core':>8} {'gain':>8}  drivers(mine/farm/other)")

    region_rows = []
    for name, mask in masks:
        m = metrics_in_mask(a, b, mask, px_area_ha, pixel_m, years, target=target)
        region_rows.extend(rows_for(name, m, year_start, year_end, source_script))
        _print_row(name, m)

    overall = metrics_in_mask(a, b, union, px_area_ha, pixel_m, years, target=target)
    _print_row(OVERALL_NAME, overall)
    # "Overall" first, matching the frontend sample ordering.
    all_rows = list(rows_for(OVERALL_NAME, overall, year_start, year_end, source_script)) + region_rows

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"Wrote {len(all_rows)} rows -> {out_path}")

    # Sibling JSON (same contract rows) for the frontend B4 loader (useMetricSites),
    # mirroring fragmentation_metrics.py. Staged under web/public/data/ (gitignored).
    json_out = os.path.splitext(out_path)[0] + ".json"
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump(all_rows, f)
    print(f"Wrote {len(all_rows)} rows -> {json_out}")
    return len(all_rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--r2017", default="docs/classification_v2_2017.tif")
    ap.add_argument("--r2025", default="docs/classification_v2_2025.tif")
    ap.add_argument("--areas", default="data/study_areas/habitat_areas.geojson")
    ap.add_argument("--target", choices=["habitat", "forest", "both"], default="both",
                    help="which forest class to measure: habitat=karst forest "
                         "(class 2), forest=plain forest (class 1), or both (default)")
    ap.add_argument("--outdir", default="pipeline/metrics/outputs",
                    help="directory for the per-track CSVs ({track}_loss_{ys}_{ye}.csv)")
    ap.add_argument("--year-start", type=int, default=YEAR_START,
                    help="epoch of --r2017; labels the output and sets the loss_rate denominator")
    ap.add_argument("--year-end", type=int, default=YEAR_END,
                    help="epoch of --r2025; must be greater than --year-start")
    args = ap.parse_args()

    year_start, year_end = args.year_start, args.year_end
    if year_end <= year_start:
        raise SystemExit(f"--year-end ({year_end}) must be greater than --year-start ({year_start}).")
    years = year_end - year_start
    tracks = list(TRACKS) if args.target == "both" else [args.target]

    with rasterio.open(args.r2017) as d17, rasterio.open(args.r2025) as d25:
        if (d17.crs != d25.crs or d17.transform != d25.transform
                or d17.shape != d25.shape):
            raise SystemExit("Rasters are not pixel-aligned; co-register before running.")
        a = d17.read(1)
        b = d25.read(1)
        px_w, px_h = d25.res
        px_area_ha = abs(px_w * px_h) / 10_000.0
        pixel_m = abs(px_w)
        ds = d25  # grid reference for masking

        with open(args.areas, encoding="utf-8") as f:
            features = json.load(f)["features"]

        # Build each study-area mask once; both tracks reuse them.
        masks = [(feat["properties"]["name"], area_mask_for(feat["geometry"], ds))
                 for feat in features]
        union = np.zeros((ds.height, ds.width), dtype=bool)
        for _, mask in masks:
            union |= mask

        for track in tracks:
            out_path = os.path.join(args.outdir, f"{track}_loss_{year_start}_{year_end}.csv")
            run_track(track, TRACKS[track], a, b, masks, union, px_area_ha,
                      pixel_m, years, year_start, year_end, out_path)


if __name__ == "__main__":
    main()
