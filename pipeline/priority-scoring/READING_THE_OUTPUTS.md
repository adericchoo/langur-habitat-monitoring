# Reading the priority outputs

This guide explains what the scorer's outputs mean, how to read a single row,
and why the numbers come out the way they do. It stands on its own; for the
exact formulas behind each number, and for how to change weights, anchors or
indicators, see [CALCULATIONS.md](CALCULATIONS.md).

## What the priority score measures

The score answers one question: **if someone can attend to only a few places,
which ones would do the most conservation good right now?**

That is a different question from "where has the most change happened". The
biggest patch of loss is often the least urgent, because the damage there is
already done. So:

- A hill that has already been quarried away, with no forest or langurs left
  near it, scores **low**, however large the cleared area.
- A small new patch cutting into forest next to a confirmed langur group
  scores **high**, even though its area is small.

## The three files

| file | read it when | contents |
| --- | --- | --- |
| `priority-areas.csv` | you want the ranked list | `hotspot_id`, `site_id`, `priority`, `reasons` |
| `priority-areas.json` | you're building the dashboard or policy step | the same ranking, with provenance, a per-site summary and structured reasons |
| `hotspots-scored.csv` | you need to check or defend a result | every dimension read, the tier, the action and the missing indicators per hotspot |

All three come from one scorer run and agree row for row. None of them
contain coordinates; `hotspot_id` links back to the patch geometry in
`hotspots-scoring-input.csv`, which stays local because it does.

## Reading one row

An example from the first run (2017 → 2025 classifications):

```
HS-2025-003  tam-diep-forest-nb  64.7  P1  act
reasons:    adjacent forest at risk (0.91); expansion rate (1.00); area cleared (1.00)
dimensions: threat 0.683, value 0.76, exposure 0.792, governance 0.3
```

Read it in this order:

1. **Tier and action first** (`P1`, `act`). This is the call: report it now.
2. **Reasons second.** The three things that pushed it up most: a large
   area cleared, fast expansion, and plenty of forest still next to it.
3. **Dimensions third**, to see the whole picture. Threat, value and exposure
   are all fairly strong. Governance is weak (0.3) because the patch lies
   outside any protected area, which means less legal leverage. That weakness
   pulls the score down but does not cancel the others.
4. **The priority number last.** Use it to sort within a tier. A gap of a
   point or two between patches means nothing.

## The priority number

```
priority = 100 × threat^0.30 × value^0.30 × exposure^0.25 × governance^0.15
```

Each dimension read is between 0 and 1. The weights are in
`priority_config.yaml`.

**Why the dimensions are multiplied together rather than added.** A
priority has to hold up on all four at once: something is happening, what
remains is worth saving, more is about to go, and someone can act. Under a
weighted sum, one extreme dimension could carry a patch into the top tier on
its own. Under multiplication, a near-zero in any dimension drags the whole
score down. This is the mechanism that keeps fully quarried hills out of the
top tier.

A floor of 0.05 stops a single zero from wiping a score out entirely, so
patches that fail one condition can still be ranked against each other.

**Why the numbers mean the same thing from run to run.** Every raw measure is
converted to 0–1 against fixed anchors in physical units (hectares, metres,
years), never against the current batch's minimum and maximum. A quiet year
therefore produces low scores, and its biggest patch stays where its own
numbers put it. The anchors were calibrated once against the first real
table (config v0.6) and are meant to stay fixed; changing one breaks
comparisons with earlier runs.

## Tiers and actions

| tier | threshold | action | meaning |
| --- | --- | --- | --- |
| P1 | priority ≥ 60 | `act` | report to SVW / the provincial authority now |
| P2 | priority ≥ 40 | `watch` | include in the next field round |
| P3 | below 40 | `log` | record, no action |
| any | site historically occupied but unsurveyed, threat ≥ 0.5 | `survey_gap` | the site needs a langur survey before anyone can judge the loss |
| unscored | a dimension has fewer than half its indicators | `insufficient_data` | not enough evidence to score |

**Why tiers and not a ranked list.** The data cannot support the claim that
a 73.4 beats a 71.8. Tiers say what the evidence can support. Within a tier,
treat the order as rough.

**Why the thresholds are fixed numbers.** A tier defined as "the top 10%"
would always contain something, even in a year with no real threats.

**Why confidence does not appear.** Detections pass the classifier's
confidence check before they reach the scorer. Multiplying the score by
confidence would quietly bury real threats in cloudy or poorly labelled
areas, which is exactly where data is worst and risk may be highest.

## Reasons

Each row lists the three indicators that contributed most to its score. The
number in brackets is that indicator's 0–1 reading: `(1.00)` means the raw
value is at or beyond its saturation anchor.

Expect two patterns:

- **Rows near the top** are explained by what is happening at the patch:
  area cleared, expansion rate, adjacent forest at risk.
- **Rows near the bottom** are explained by site-level facts: occupancy
  status, irreplaceability of the population, how recent the site evidence
  is. These are small patches inside valuable sites; the site keeps them on
  the list, but there is little happening at the patch itself.

Because site-level facts are the same for every patch in a site, the same
reasons repeat down a site's rows. That is expected.

## The four dimensions

| dimension | question | indicators (raw → 0–1) |
| --- | --- | --- |
| **Threat** | Is something happening here, and is it getting worse? | area cleared, expansion rate, acceleration, how recently it appeared, years it has persisted |
| **Value** | Is what remains here worth protecting? | forest remaining at the site, tall-canopy share, closeness to a langur record (discounted by how reliable that record is), how recent the site's evidence is, occupancy status, irreplaceability |
| **Exposure** | How much more is about to go? | forest within 250 m of the patch, share of the site's edge affected, connectivity at stake |
| **Governance** | Can anyone do something about it? | inside / near / outside a protected area, type of protection, IUCN category, licence status, reachability |

Two rules shape the value dimension:

- **No recent records means "unsurveyed".** Pu Luong, Cuc Phuong and Hoa
  Lu/Trang An have no langur records since 2015. The likeliest reason is that
  nobody has surveyed them recently; the records can't show the langurs are
  gone. So these sites get a value floor of 0.45, and can trigger
  `survey_gap`.
- **Evidence is weighted by quality.** Each patch is paired with the record
  that gives the strongest evidence nearby: a drone count or direct sighting
  counts for more than an interview report at the same distance.

Governance reads cluster at a few values because they are built from
categories: 0.3 outside any protected area, 0.4 in a protected area's 1 km
buffer, 0.8 inside a nature reserve, 0.9 inside the Trang An World Heritage
Site. In the first run, 122 of the 183 hotspots read 0.3.

## Missing indicators

`missing_indicators` lists what had no data for that row. The dimension is
then averaged over the indicators that do exist, so a gap neither scores as
zero nor gets silently invented. If more than half of a dimension is missing,
the row is `unscored`.

In the current run, these are missing for every row, each for a known reason:

| missing | waiting on |
| --- | --- |
| acceleration, years persisted | yearly classifications 2018–2024 |
| tall-canopy share | canopy clustering |
| connectivity at stake | the connectivity analysis |
| licence status | a licensed-quarry list from SVW or the provincial authority |
| reachability | ranger station / road locations from SVW |

## Provenance

The JSON's `provenance` block (and matching columns in the audit CSV) record
which config and build produced the result:

- `config_version` and `scoring_config_hash`: change either and scores may
  shift; compare runs only when these match.
- `weights_elicited: false` means **the dimension weights are placeholders**.
  They should be replaced by weights from AI for Good / SVW through swing
  weighting before any result is presented as their priorities.
- `build_run_ids`: which build of the input table was scored.

## What the current run can and cannot support

The first run uses two classified years, 2017 and 2025. That limits what the
scores can claim.

**Recency is uninformative and lowers every score.** With two dates, the
change can only be placed somewhere between 2017 and 2025, so every patch is
recorded as first appearing in 2017. "How recently it appeared" therefore
reads 0.05 for all 183 patches, which caps every threat read at 0.683. The
ranking order is unaffected, since every patch takes the same penalty, but
all scores sit lower than they otherwise would: the top patch would score
72.5 instead of 64.7. This is a large part of why only two patches reach P1.
Treat tier counts from this run as conservative.

**Patch size counts twice.** Expansion rate is area divided by eight years,
so the two threat indicators carry the same information. Both issues resolve
once yearly classifications exist.

**Other limits:**
- Only patches within 1 km of the seven current langur areas are scored.
- The scorer inherits every error in the land-cover classification.
- Quarrying is the only threat the classifier can see. SVW's 2023 survey
  notes also record goat and cattle grazing and forest-product collection at
  langur locations; none of that appears here.
- The scores have not been validated. The planned check is to give SVW a
  sample of hotspots blind, ask them to tier them, and compare.

Present these results as a working ranking from provisional weights and
two-date data. That claim holds.
