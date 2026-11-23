# priority-scoring

Step 4 of the pipeline: turn classifier outputs into a ranked, explainable
list of quarry hotspots. Two scripts, one contract:

```
classification rasters ─┐
DL records shapefiles  ─┼→ build_hotspots.py → hotspots-scoring-input.csv → score_priority.py → priority-areas.csv
WDPA / site polygons   ─┘       (4a: collate)        (the contract)            (4b: score)         + hotspots-scored.csv (audit)
```

- `build_hotspots.py` (4a) does all the geospatial work: vectorises
  forest→quarry change patches (≥0.5 ha, 8-connected), joins every context
  layer as per-patch measurements, and writes one CSV row per hotspot in raw
  physical units (ha, m, years). No scoring here.
- `score_priority.py` (4b) reads only that CSV plus `priority_config.yaml`:
  fixed-anchor value functions, within-dimension means, weighted geometric
  mean across T/V/E/G, tiers P1/P2/P3. Re-running with new weights takes
  seconds and never touches a raster.

The full design rationale lives in the team's framework doc
(hotspot-priority-scoring-framework).

## Running it

```bash
pip install -r requirements.txt

python build_hotspots.py \
  --class-early "<SVW data>/classifications/classification_2017.tif" --year-early 2017 \
  --class-late  "<SVW data>/classifications/classification_2025.tif" --year-late  2025 \
  --pack "<path to>/DL records" \
  --out  outputs/hotspots-scoring-input.csv

python score_priority.py outputs/hotspots-scoring-input.csv outputs/priority-areas.csv
```

Inputs are the AIFG `DL records` shapefile pack and the classification
rasters from the GEE exports (`SVW data/classifications/`). **None of that
data, and none of the outputs, belong in this repository** — hotspot rows
carry precise quarry coordinates, and the repo policy (SECURITY.md) keeps
precise location data out of git. `outputs/` is gitignored accordingly.

## Classification raster encoding

Verified empirically (langur records fall on class 2; class 1 forms the
Kim Bang / Van Long quarry belts; class 3 sits on karst ridgetops; class 4
is the lowland agricultural matrix):

| value | class |
| --- | --- |
| 0 | outside AOI / masked |
| 1 | quarry |
| 2 | karst forest |
| 3 | bare rock |
| 4 | other (agriculture, villages, water) |

If a future export changes this encoding, update `CLASS_*` at the top of
`build_hotspots.py`.

## Two-date mode: known limitations

With only 2017 and 2025 classified, the builder states its gaps rather than
hiding them (each row's `incomplete_fields` lists them):

- `t_first_year` is the interval start (2017) for every patch — recency is
  uninformative until yearly classifications exist.
- `t_rate_ha_yr` is the mean over the 8-year interval.
- `t_accel` / `t_persist_years` are empty (`t_accel_source =
  dropped_insufficient_history`); the scorer renormalises over what exists.
- `s_*` (epoch archive), `v_canopy_frac`, `e_connect_critical`,
  `g_unlicensed`, `g_access_km`, and all `c_*` columns are empty pending
  their upstream inputs.

Scope: patches within 1,000 m of one of the 7 current DL areas (strict
"inside" would drop the quarry faces advancing on a site from just outside
its boundary — the exact threat this list exists to rank).

`g_iucn_cat` emits only the vocabulary `priority_config.yaml` knows
(`II`, `V`, `Not Reported`, `none`); WDPA values like `Not Applicable`
(Trang An WHS) and `IV` map to `Not Reported` so the governance read never
collapses on vocabulary alone.
