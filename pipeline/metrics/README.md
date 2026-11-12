# Habitat-loss metrics

Turns two land-cover classification rasters (2017 and 2025) into the summary
metrics the frontend's **Habitat loss** step reads. One script, one output CSV.

**Screening, not proof.** Every number is a *suspected* class transition from
satellite classification, not a field-verified measurement. Keep the hedged
language in the UI.

## Inputs (all local, gitignored — never committed)

| Input | Default path | Notes |
| --- | --- | --- |
| 2017 classes | `docs/classification_2017.tif` | `uint8`, EPSG:32648, 10 m |
| 2025 classes | `docs/classification_2025.tif` | must be pixel-aligned with 2017 |
| Study areas | `data/study_areas/habitat_areas.geojson` | lon/lat polygons; clip boundaries only |

**Class legend** (confirmed with the data team): `0` background/mask (excluded),
`1` quarry, `2` forest, `3` agriculture, `4` urbanisation.

> **Habitat = forest, for now.** A dedicated langur-habitat class (which overlaps
> forest) is coming from the pipeline. When it lands, change **`HABITAT_CLASS`**
> in `habitat_loss.py` to its code — nothing else. The method is identical because
> habitat is just "the class we treat as habitat" in the cross-tabulation.

## Method

Everything derives from one per-pixel **2017→2025 class cross-tabulation**,
computed inside each study-area polygon (and over their union for "All regions").

Per study area:

- **`habitat_remaining`** (ha) — forest area in 2025.
- **`habitat_lost`** (ha) — **gross** forest → non-forest (any other real class).
- **`forest_gain`** (ha) — non-forest → forest. Reported *alongside* loss, never
  netted silently (see caveats).
- **`loss_rate`** (%/yr) — `habitat_lost / forest_2017 / 8 × 100` (8 = 2025−2017).
  Two-point rate; no trend line is possible from two epochs.
- **`quarry_footprint`** (ha) — quarry-class area in 2025.
- **`core_habitat`** (ha) — 2025 forest eroded inward by `EDGE_DEPTH_M` (100 m);
  keep this depth identical to the fragmentation step's core so they reconcile.
- **`driver_mining / driver_farming / driver_other`** (%) — each gross-loss pixel
  attributed to what it *became*: quarry→mining, agriculture→farming,
  urbanisation→other. Shares of gross loss, rounded to whole % summing to 100.

Area of anything = pixel count × pixel area (0.01 ha at 10 m).

## Run

```bash
python -m venv .venv && .venv/Scripts/activate   # Windows; use source .venv/bin/activate elsewhere
pip install -r pipeline/metrics/requirements.txt
python -I pipeline/metrics/habitat_loss.py        # defaults to the paths above
```

Output → `pipeline/metrics/outputs/habitat_loss_2017_2025.csv` (gitignored until a
human reviews it). Columns: `metric, value, unit, year_start, year_end,
study_area, source_script, limitations` — the exact contract in
`data-contract/gee-output-spec.md`. `study_area` is the join key and is written
byte-identical to the geometry's `name`.

## Caveats (carried into the CSV `limitations` field)

- **Screening only** — suspected transitions, not confirmed loss.
- **Forest proxy** — "habitat" is forest until the dedicated class exists.
- **Gross vs net** — `habitat_lost` is gross forest clearing; because the smaller
  classes carry classification noise (forest↔agriculture can swap both ways),
  gross loss over-states *durable* change. `forest_gain` is published so the gap
  is visible. On a net basis, loss inside the karst study areas is small.
- **Two epochs** — 2017 and 2025 only; `loss_rate` is a straight two-point rate.
- **Edge erosion** uses 4-connected city-block distance (NumPy), approximating a
  disk; it also erodes at the study-area boundary, so `core_habitat` is slightly
  conservative near arbitrary polygon edges.

## Security

The rasters and study-area polygons are **local, gitignored** inputs (the polygon
tier was deliberately removed from the public repo). The CSV output is the
**aggregated, publishable** tier — hectares and publicly-known area names, no
geometry. Review before committing/publishing it.
