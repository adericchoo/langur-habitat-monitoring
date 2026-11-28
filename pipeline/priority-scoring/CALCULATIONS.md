# How the priority score is calculated — and how to change it

This is the maintainer's reference for step 4 (priority scoring). It gives
every formula the code implements, where each number comes from, and the exact
places to touch when something needs changing. It assumes you have read the
[README](README.md) (what the step is and how to run it); see
[READING_THE_OUTPUTS.md](READING_THE_OUTPUTS.md) for how to interpret the
results.

Everything below is implemented in two files:

| File | Role |
| --- | --- |
| `build_hotspots.py` (step 4a) | geospatial work → one CSV row per hotspot, in raw physical units |
| `score_priority.py` (step 4b) | pure arithmetic on that CSV, driven entirely by `priority_config.yaml` |

The split is deliberate: re-scoring with new weights or anchors reruns 4b only
(seconds, no raster work), and the scoring logic can be checked against a CSV
by hand.

---

## Step 4a — what each measurement is

`build_hotspots.py` vectorises change and joins context. Per hotspot (all raw
units; normalisation happens only in 4b):

- **Patch delineation.** Pixels that were karst forest (class 2) in the early
  raster and quarry (class 1) in the late one, grouped 8-connected, kept at
  ≥ 0.5 ha. A patch touching the raster edge is flagged `truncated` and scored
  on its observed extent.
- **Scope.** Patches intersecting one of the 7 current DL areas or within
  1,000 m of one. Strict "inside" would drop the quarry faces advancing on a
  site from just outside its boundary — the exact threat this list ranks.
- **Threat (`t_*`).** `t_area_ha` is patch area; `t_rate_ha_yr` is area over
  the interval length; `t_first_year` is the interval start (see the README's
  two-date limitations); `t_accel` / `t_persist_years` are empty until yearly
  classifications exist.
- **Value (`v_*`).** `v_remaining_ha` is karst-forest area remaining on the
  parent site in the late raster. `v_langur_dist_m`, `record_reliability` and
  the record year come from the **best record nearby**: the record maximising
  `reliability × exp(−distance / d0)`, with `d0` read from
  `priority_config.yaml` so builder and scorer agree. `v_occupancy` and
  `v_site_last_record_year` are per-site facts from the DL record pack;
  `v_irrepl` is the per-site table at the top of `build_hotspots.py`, for SVW
  to overwrite.
- **Exposure (`e_*`).** `e_adjacent_ha` is late-raster forest within 250 m of
  the patch; `e_edge_frac` is the share of the parent site's perimeter within
  100 m of it.
- **Governance (`g_*`).** Spatial joins against the WDPA polygons:
  inside / buffer / outside, designation, IUCN category (mapped onto the
  vocabulary the config knows — anything else becomes `Not Reported`).

Anything the data cannot support is left **empty**, never guessed, and listed
in the row's `incomplete_fields`.

## Step 4b — from raw units to a score

### 1. Normalise each indicator to 0–1

Each indicator passes through the value function named for it in
`priority_config.yaml`. The `kind` field selects the formula
(`apply_fn` in `score_priority.py`); `x` is the raw value:

| kind | formula | used for |
| --- | --- | --- |
| `identity` | `v = clip(x, 0, 1)` | values already on 0–1 (`v_irrepl`, `v_canopy_frac`, `record_reliability`) |
| `invert` | `v = clip(1 − x, 0, 1)` | "lower is better" 0–1 values (none currently) |
| `satlog` | `v = min(1, ln(1 + x/x0) / ln(1 + xsat/x0))` | areas and rates. Rises steeply from `x0` (the smallest value that counts) and reaches 1.0 at `xsat` (beyond which more is no more urgent) |
| `decay` | `v = exp(−x / d0)` | distances. `d0` is the distance at which the value falls to 1/e ≈ 0.37 |
| `clamp` | `v = clip((x − lo) / (hi − lo), 0, 1)` | linear rescaling between two anchors |
| `piecewise` | linear interpolation between `points: [[x, v], …]`, flat beyond the ends | curves with a judged shape, such as recency |

Two indicators are special:

- `t_recency_years` and `v_evidence_years` are computed as `run_year` minus
  the year column before the function is applied.
- `v_langur_dist_m` is normalised by `decay`, then **multiplied by the
  record's reliability** (itself passed through `record_reliability`):
  closeness to an interview report counts for less than the same closeness to
  a drone-confirmed group. A missing reliability leaves proximity unchanged.

Ordinal indicators (`v_occupancy`, `g_protected`, `g_designation`,
`g_iucn_cat`, `e_connect_critical`) are looked up directly in the `ordinals`
maps. `g_unlicensed` is read as a bare 0/1. An empty cell normalises to
"missing", never to zero.

### 2. Average within each dimension

Each dimension read is the **plain mean of its indicators that have data**,
equally weighted:

```
D_dim = mean(v_i for present indicators i)
```

A missing indicator therefore neither scores as zero nor gets invented — the
dimension renormalises over what exists, and the gap is listed in
`missing_indicators`. If **fewer than half** of a dimension's indicators are
present (`min_dimension_coverage: 0.5`), the dimension read is refused and the
whole row becomes `unscored` / `insufficient_data`: a read resting on one
surviving indicator would be noise dressed as a number.

One adjustment follows the mean: a site that is `historical_unsurveyed` has
its value read floored at `occupancy_floor` (0.45). Three of the seven sites
have no post-2015 records, almost certainly because nobody has surveyed them
recently; without the floor, "no recent records" would silently read as
"nothing worth saving".

### 3. Combine the four dimensions — weighted geometric mean

```
priority = 100 × Π_d  max(D_d, ε) ^ W_d
```

with `ε = epsilon_floor` (0.05) and weights `W_d` from `dimension_weights`
(threat 0.30, value 0.30, exposure 0.25, governance 0.15; the four sum to 1).

Multiplication rather than addition is the core design decision: a priority
has to hold up on all four dimensions at once — something is happening, what
remains is worth saving, more is about to go, and someone can act. Under a
weighted sum one extreme dimension could carry a patch into the top tier on
its own; under the geometric mean a near-zero anywhere drags the whole score
down. This is the mechanism that keeps fully quarried hills out of the top
tier. The ε floor stops a literal zero annihilating the score entirely, so
patches failing one condition can still be ranked against each other.

**Worked example** (HS-2025-003 from the first real run):
threat 0.683, value 0.760, exposure 0.792, governance 0.300 →

```
priority = 100 × 0.683^0.30 × 0.760^0.30 × 0.792^0.25 × 0.300^0.15 = 64.7
```

The weak governance read (outside any protected area) pulls the score down
without cancelling the other three — exactly the intended behaviour.

### 4. Tier and action

| condition | tier | action |
| --- | --- | --- |
| priority ≥ 60 (`tier_thresholds.P1`) | P1 | `act` |
| priority ≥ 40 (`tier_thresholds.P2`) | P2 | `watch` |
| otherwise | P3 | `log` |
| site `historical_unsurveyed` **and** threat read ≥ 0.5 | (keeps its tier) | `survey_gap` — overrides the tier's action |
| any dimension below coverage | unscored | `insufficient_data` |

Thresholds are fixed numbers, never percentiles: a tier defined as "the top
10%" would always contain something, even in a year with no real threats.

### 5. Reasons

Each row's `reasons` are the three indicators with the largest contribution
to the composite, where an indicator's contribution is

```
contribution_i = (W_dim / n_present_in_dim) × v_i
```

— its normalised value times the share of its dimension's weight it actually
carries. The bracketed number in the output is `v_i` itself, so `(1.00)`
means the raw value is at or beyond its saturation anchor.

### 6. Provenance

Every output row carries `scoring_config_hash` (first 8 hex chars of the
SHA-256 of `priority_config.yaml` as a file — any edit changes it),
`build_run_id` from the 4a run that made the input, and the
`weights_elicited` flag. Compare two runs only when their hashes match. The
JSON's `provenance` block repeats these plus the weights and thresholds used.

Both scripts are deterministic: the same input CSV and config give
byte-identical outputs (the JSON's `generated_at` timestamp aside).

---

## Making changes

### Change the dimension weights

Edit `dimension_weights` in `priority_config.yaml` (keep the sum at 1) and
rerun 4b. The current weights are **placeholders** (`weights_elicited:
false`): the intended replacement is swing weighting with SVW / AI for Good —
describe a hotspot at its worst on all four dimensions, ask which single
dimension they would fix first (100 points), score the remaining swings
relative to it, normalise. When elicited weights go in, set
`weights_elicited: true` and record the date and participants in the config's
`note`.

### Change a value-function anchor

Edit the entry under `value_functions`. **This breaks comparability with
every earlier run** — the config hash changes, and scores move for reasons
that have nothing to do with the ground. The anchors were calibrated once
against the first real table (v0.6, see the README) and are meant to stay
fixed; recalibrate only if a new input regime saturates or zeroes an
indicator for most rows, bump `config_version`, and say so in the config's
`note` the way the v0.6 entries do.

### Add a new indicator

1. **4a:** compute the raw measurement in `build_hotspots.py` and add the
   column to the output CSV. Raw physical units only; empty when unknown.
2. **Config:** add a `value_functions` entry (or an `ordinals` map) and a
   human-readable `indicator_labels` entry — the labels are what appear in
   `reasons`.
3. **4b:** add one line to the right dimension in `build_indicators()` in
   `score_priority.py`, following the pattern of its neighbours.

The coverage rule, renormalisation, reasons and outputs all pick the new
indicator up automatically. Nothing else changes.

### Add vocabulary to an ordinal

Add the key and its 0–1 value to the right `ordinals` map. An unknown key
currently reads as missing, so a new WDPA designation, say, is better mapped
explicitly than left to fall through (see the `g_iucn_cat` note in the
README: unexpected WDPA values are mapped to `Not Reported` in 4a for this
reason).

### Add a change class

New change classes come from the classifier via 4a. The scorer passes
`change_class` through untouched, but the **policy bank** refuses to run on a
class that has no `drivers` entry in `policy-bank/policy_config.yaml` — add
the mapping there (see the policy bank README).

### Check a change did what you meant

There is no separate test suite for the scorer; its checks are determinism
and the audit file. After any change:

1. Rerun 4b on the same input twice — outputs must be byte-identical.
2. Diff `hotspots-scored.csv` against the previous run: every score movement
   should be explainable by the change you made.
3. Rerun the policy bank's tests (`python -m pytest pipeline/policy-bank`),
   which exercise the scorer's output contract end to end on the sample data.

### What NOT to change casually

- **Anchors and thresholds** — comparability, above.
- **The geometric mean, the ε floor, the coverage rule** — these are the
  design commitments (non-compensatory scoring, honest missing-data handling)
  the whole framework rests on.
- **Adding a confidence multiplier.** Detection confidence is gated upstream
  at the classifier on purpose: multiplying priority by confidence would
  quietly bury real threats in cloudy or poorly labelled areas, which is
  exactly where data is worst and risk may be highest.
