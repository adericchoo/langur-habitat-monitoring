"""Habitat-loss metrics from two land-cover classification rasters (2017, 2025).

Everything derives from one per-pixel 2017->2025 class cross-tabulation, computed
inside each study-area polygon. Emits the exact summary rows the frontend's
Habitat-loss step reads (see data-contract/gee-output-spec.md): one 8-column row
per metric per study_area, plus an "All regions (overall)" rollup.

SCREENING, NOT PROOF. A class transition is *suspected* loss, not field-verified.

"Habitat" is the FOREST class for now, as a proxy, until the pipeline produces a
dedicated langur-habitat class (which will overlap forest). When it lands, only
HABITAT_CLASS below changes — the method is identical.

Inputs are LOCAL and gitignored (rasters + study-area geometry); the CSV output is
aggregated (hectares + public area names) and is the publishable tier.

Usage (from repo root, inside the venv with requirements.txt installed):
    python -I pipeline/metrics/habitat_loss.py \
        --r2017 docs/classification_2017.tif \
        --r2025 docs/classification_2025.tif \
        --areas data/study_areas/habitat_areas.geojson \
        --out   pipeline/metrics/outputs/habitat_loss_2017_2025.csv
Defaults match those paths, so bare `python -I pipeline/metrics/habitat_loss.py`
works from the repo root.

For a different pair of epochs, pass the rasters AND their years so the output is
labelled correctly and loss_rate uses the right span:
    python -I pipeline/metrics/habitat_loss.py \
        --r2017 docs/classification_2020.tif --year-start 2020 \
        --r2025 docs/classification_2030.tif --year-end   2030
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

CLASS_NAMES = {0: "background", 1: "quarry", 2: "forest", 3: "agriculture", 4: "urbanisation"}

# Which class counts as habitat. Forest proxy for now; swap to the dedicated
# langur-habitat code when the pipeline emits it. Single source of truth.
HABITAT_CLASS = 2

# Destination class -> contract driver metric, when habitat converts to it.
# forest->quarry = mining, forest->agriculture = farming, forest->urbanisation = other.
DRIVER_OF_CLASS = {1: "driver_mining", 3: "driver_farming", 4: "driver_other"}

# The quarry footprint metric reads this class's 2025 extent directly.
QUARRY_CLASS = 1

YEAR_START, YEAR_END = 2017, 2025
EDGE_DEPTH_M = 100  # core-habitat erosion depth; keep == fragmentation core_area

BACKGROUND = 0  # mask / outside-AOI value, excluded from every metric
REAL_CLASSES = [c for c in CLASS_NAMES if c != BACKGROUND]

LIMITATIONS = (
    "Screening product: per-pixel class-transition estimate from 2017 and 2025 "
    "land-cover rasters, not field-verified. Habitat = forest proxy (dedicated "
    "langur-habitat class pending). habitat_lost is GROSS forest->non-forest; "
    "forest regain is reported separately (forest_gain) and the smaller classes "
    "carry classification noise, so gross loss over-states durable change. Two "
    "epochs only, so loss_rate is a two-point rate with no trend."
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


def metrics_in_mask(a, b, mask, px_area_ha, pixel_m, years=YEAR_END - YEAR_START):
    """All habitat-loss metrics for the pixels where `mask` is True.

    a, b: 2D start / end class arrays. `years` is the span between the two
    epochs and is the denominator of loss_rate. Returns a dict metric -> value.
    """
    av = a[mask].astype(np.int64)
    bv = b[mask].astype(np.int64)
    counts = np.bincount(av * 10 + bv, minlength=(max(CLASS_NAMES) + 1) * 10 + 1)

    def c(i, j):  # pixels that went class i (2017) -> class j (2025)
        return int(counts[i * 10 + j])

    H = HABITAT_CLASS
    habitat_2017_px = sum(c(H, j) for j in REAL_CLASSES + [BACKGROUND])
    habitat_2025_px = sum(c(i, H) for i in REAL_CLASSES + [BACKGROUND])

    # Gross loss: habitat -> a different *real* class. Gain: real class -> habitat.
    loss_by_dest = {d: c(H, d) for d in REAL_CLASSES if d != H}
    gross_loss_px = sum(loss_by_dest.values())
    gain_px = sum(c(s, H) for s in REAL_CLASSES if s != H)

    habitat_2017_ha = habitat_2017_px * px_area_ha
    lost_ha = gross_loss_px * px_area_ha
    loss_rate = (lost_ha / habitat_2017_ha / years * 100) if habitat_2017_ha > 0 else 0.0

    quarry_ha = sum(c(i, QUARRY_CLASS) for i in REAL_CLASSES + [BACKGROUND]) * px_area_ha

    # core_habitat: erode the 2025 habitat patch inward by EDGE_DEPTH_M.
    habitat_2025_2d = (b == H) & mask
    iters = max(1, round(EDGE_DEPTH_M / pixel_m))
    core_px = int(binary_erosion(habitat_2025_2d, iters).sum())

    out = {
        "habitat_remaining": round(habitat_2025_px * px_area_ha, 1),
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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--r2017", default="docs/classification_2017.tif")
    ap.add_argument("--r2025", default="docs/classification_2025.tif")
    ap.add_argument("--areas", default="data/study_areas/habitat_areas.geojson")
    ap.add_argument("--out", default="pipeline/metrics/outputs/habitat_loss_2017_2025.csv")
    ap.add_argument("--year-start", type=int, default=YEAR_START,
                    help="epoch of --r2017; labels the output and sets the loss_rate denominator")
    ap.add_argument("--year-end", type=int, default=YEAR_END,
                    help="epoch of --r2025; must be greater than --year-start")
    args = ap.parse_args()

    year_start, year_end = args.year_start, args.year_end
    if year_end <= year_start:
        raise SystemExit(f"--year-end ({year_end}) must be greater than --year-start ({year_start}).")
    years = year_end - year_start
    source_script = f"habitat_loss_{year_start}_{year_end}"

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

        all_rows = []
        union = np.zeros((ds.height, ds.width), dtype=bool)
        print(f"{'study_area':<26} {'remain':>9} {'lost':>8} {'rate':>6} "
              f"{'quarry':>7} {'core':>8} {'gain':>8}  drivers(mine/farm/other)")
        for feat in features:
            name = feat["properties"]["name"]
            mask = area_mask_for(feat["geometry"], ds)
            union |= mask
            m = metrics_in_mask(a, b, mask, px_area_ha, pixel_m, years)
            all_rows.extend(rows_for(name, m, year_start, year_end, source_script))
            print(f"{name:<26} {m['habitat_remaining']:>9,.0f} {m['habitat_lost']:>8,.0f} "
                  f"{m['loss_rate']:>6.2f} {m['quarry_footprint']:>7,.0f} "
                  f"{m['core_habitat']:>8,.0f} {m['forest_gain']:>8,.0f}  "
                  f"{m['driver_mining']:>3}/{m['driver_farming']:>3}/{m['driver_other']:>3}")

        overall = metrics_in_mask(a, b, union, px_area_ha, pixel_m, years)
        # "Overall" first, matching the frontend sample ordering.
        all_rows = list(rows_for(OVERALL_NAME, overall, year_start, year_end, source_script)) + all_rows
        print(f"{OVERALL_NAME:<26} {overall['habitat_remaining']:>9,.0f} "
              f"{overall['habitat_lost']:>8,.0f} {overall['loss_rate']:>6.2f} "
              f"{overall['quarry_footprint']:>7,.0f} {overall['core_habitat']:>8,.0f} "
              f"{overall['forest_gain']:>8,.0f}  "
              f"{overall['driver_mining']:>3}/{overall['driver_farming']:>3}/{overall['driver_other']:>3}")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    cols = ["metric", "value", "unit", "year_start", "year_end",
            "study_area", "source_script", "limitations"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(all_rows)
    print(f"\nWrote {len(all_rows)} rows -> {args.out}")


if __name__ == "__main__":
    main()
