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

The scorer writes three files into the folder of its output path:

| file | for | contents |
| --- | --- | --- |
| `priority-areas.csv` | people | ranked: `hotspot_id`, `site_id`, `priority`, `reasons` |
| `priority-areas.json` | dashboard, policy bank | the same ranking plus provenance and a per-site summary |
| `hotspots-scored.csv` | audit, sensitivity analysis | every dimension read per hotspot |

The `hotspot_id` is what lets someone in the field find the specific patch.

**New to the outputs?** [READING_THE_OUTPUTS.md](READING_THE_OUTPUTS.md) explains how to read a row, what the tiers and reasons mean, and why the scores come out the way they do, including the limits of the current two-date run.

`priority-areas.json` (`schema: priority-areas/v1`) has three parts:
- `provenance`: config version and hash, whether weights were elicited, build run ids, weights and tier thresholds
- `summary`: counts by tier and action, and per site the number of hotspots per tier and the top-ranked hotspot
- `hotspots`: one object per hotspot, in rank order, with `rank`, `priority`, `tier`, `action`, structured `reasons` (`indicator`, `dimension`, `label`, `value`), the four `dimensions` reads and `missing_indicators`

Like the CSVs, it contains no coordinates.

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

## Dashboard export

`risk_summary.py` collapses the scorer's per-patch output to one card per
site for the dashboard's Habitat risk step: each site is read through its
most urgent patch, whose four dimension reads, priority and tier become the
card's dimensions, 0-1 score and High/Med/Low band. Confidence is the share
of the scorer's indicators present for that patch, reported separately from
the score, with "verify first" set for historically-occupied but unsurveyed
sites. The file carries no coordinates. The dashboard reads a committed copy
at `web/src/results/risk-dashboard-2025.json`; to update it, copy a new
run's `outputs/risk-dashboard.json` over that file.

```bash
python risk_summary.py outputs/hotspots-scored.csv outputs/hotspots-scoring-input.csv
```

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

## Langur evidence: best record, weighted by reliability

Each hotspot is paired with the record that gives the strongest evidence
nearby, not simply the nearest one: the record maximising
`reliability x exp(-distance / d0)`, with `d0` read from
`priority_config.yaml` so the builder and scorer agree. The scorer then
discounts "closeness to a langur record" by that record's reliability
(drone/transect 1.0, direct observation 0.9, listening 0.6, interview 0.3,
self-flagged uncertain location 0.2).

Taking the nearest record would let a weak record close by mask a strong one
just behind it. On the first real run, Kim Bang's largest patch had an
interview report 45 m away and a direct observation 252 m away; nearest-only
pushed it out of P1, best-evidence keeps it there on the stronger record.

## Config calibration (v0.6)

The value-function anchors were calibrated on 23 Nov 2026 against the first
real hotspot table. Under the original anchors, `e_adjacent_ha` saturated at
1.0 for 93% of rows and `v_remaining_ha` for 44%, so every reason string read
"(1.00)" and scores compressed into 30-60. Changes: `e_adjacent_ha` x0 5 /
xsat 150 ha; `v_remaining_ha` x0 500 / xsat 25,000 ha; `e_edge_frac`
clamp [0, 0.05]. Result: scores spread 25-65, tiers 2 P1 / 31 P2 / 150 P3.
Treat these anchors as fixed from here: changing one breaks comparability
with earlier runs.

Known issues in two-date mode, both resolved once yearly classifications exist:
- `t_area_ha` and `t_rate_ha_yr` are perfectly collinear (rate = area / 8),
  so patch size counts twice in Threat. Dropping either pushes Threat below
  the 50% coverage rule.
- Every patch has `t_first_year = 2017`, so recency reads 0.05 for all rows
  and caps every threat read at 0.683. Ranking order is unaffected, but all
  scores sit lower (the top patch would be 72.5, not 64.7), so tier counts
  are conservative.

Scope: patches within 1,000 m of one of the 7 current DL areas (strict
"inside" would drop the quarry faces advancing on a site from just outside
its boundary — the exact threat this list exists to rank).

`g_iucn_cat` emits only the vocabulary `priority_config.yaml` knows
(`II`, `V`, `Not Reported`, `none`); WDPA values like `Not Applicable`
(Trang An WHS) and `IV` map to `Not Reported` so the governance read never
collapses on vocabulary alone.
