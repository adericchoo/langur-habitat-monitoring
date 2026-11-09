# Step-by-step model and pipeline flow

**Project:** Delacour's langur / SVW habitat monitoring  
**Purpose:** Explain what to do next from the current base environment

## Phase 1 — Freeze and document inputs

1. Keep the existing training asset as a backup.
2. Keep the current RF, CART, Gradient Boosting and SVM scripts as history.
3. Use these internal model labels:

```text
0 = Quarry / disturbed rock
1 = Forest
2 = Agriculture / plantation
3 = Other
```

4. Separate the year-specific experiments:

```text
2024 comparison:
AlphaEarth 2024 + labels verified for 2024

2025 operational map:
2025 Sentinel-2 predictors + labels verified for 2025
```

Do not assume 2025 labels and 2024 AlphaEarth are perfectly date-matched.

## Phase 2 — Audit the training polygons

For every polygon, record:

```text
class
reference_year
imagery_date
label_confidence
site_id
polygon_id
subtype
```

For quarry polygons, specify whether each is:

- active excavation;
- spoil or stockpile;
- quarry road;
- abandoned quarry;
- natural exposed limestone;
- other disturbed rock.

If natural cliffs are mixed into the quarry class, separate them before model
comparison.

## Phase 3 — Draw validation polygons

Draw new polygons that are not used for training. Include:

- forest interiors;
- forest edges;
- plantations;
- agriculture;
- natural limestone;
- quarry surfaces;
- quarry-like non-quarry surfaces;
- roads;
- settlements;
- bare soil;
- construction areas.

Keep nearby polygons from the same site in the same validation group.

## Phase 4 — Build one shared data-preparation script

The shared script must:

1. Load the official SVW range.
2. Load the saved polygon asset.
3. Remap classes from 1–4 to 0–3.
4. Load the selected predictor year.
5. Sample a fixed maximum per class.
6. Use the same random seed and band order.
7. Create training, tuning and final spatial-holdout groups.
8. Print class counts and missing-data checks.

This preparation must be identical for every model.

## Phase 5 — Run the clean Random Forest baseline

Start with Random Forest and record:

- confusion matrix;
- overall accuracy;
- Kappa;
- macro-F1;
- forest precision, recall and F1;
- forest false positives and false negatives;
- quarry precision, recall and F1;
- quarry false positives and false negatives;
- training accuracy;
- validation accuracy;
- overfitting gap;
- cross-validation mean and standard deviation;
- classified area by class.

Do not select a final model from random-pixel accuracy alone.

## Phase 6 — Compare other models

Run the same data through:

1. Gradient Tree Boosting
2. Linear SVM
3. RBF SVM
4. Cosine minimum-distance
5. CART
6. KNN

Keep the same polygons, predictors, split, validation sites, metrics, map
palette and quarry policy for every model.

KNN should not use the same class-specific probability workflow because its
Earth Engine output modes differ.

## Phase 7 — Tune only the strongest models

After the first comparison, tune only the best two or three models.

Suggested tuning:

- Random Forest: tree count, leaf size and variables per split;
- Gradient Boosting: tree count, shrinkage and maximum nodes;
- SVM: cost and gamma.

Use spatial validation folds for tuning.

## Phase 8 — Apply the quarry policy

The project wants a conservative quarry estimate:

1. Keep the raw four-class map.
2. Create a separate high-confidence quarry mask.
3. Prefer low quarry false positives.
4. Accept that quarry false negatives may increase.
5. Report raw predicted quarry area and conservative quarry area.
6. Label the result:

```text
Conservative lower-bound screening estimate;
not a confirmed quarry inventory or confirmed habitat loss.
```

## Phase 9 — Test predictor improvements

Do not change the model and predictor stack simultaneously.

```text
F0 = AlphaEarth only
F1 = AlphaEarth + terrain
F2 = AlphaEarth + seasonal Sentinel-2
F3 = AlphaEarth + Sentinel-1 radar
F4 = Sentinel-1 + Sentinel-2 + terrain, without AlphaEarth
```

This identifies whether an improvement comes from the algorithm or from extra
predictors.

## Phase 10 — Produce historical maps

The first consistent years are:

```text
2000
2005
2010
2015
2020
2025
```

For every year, produce:

- true-colour basemap;
- NDVI;
- NDMI;
- MSAVI;
- BSI;
- scene count;
- cloud and quality information;
- summary CSV.

Classify each year only after documenting the relationship between predictor
year and reference-label year.

## Phase 11 — Keep final products separate

The frontend should receive separate layers:

1. Land-cover classification
2. Forest condition/change
3. Quarry/disturbance screening
4. Geological carbonate evidence
5. Karst-likelihood screening
6. Potential limestone-forest habitat
7. Fragmentation/connectivity
8. Risk score

Do not merge geology, land cover and habitat occupancy into one unexplained AI
class.

## Phase 12 — Build W8–W9 metrics and reports

After the model is stable:

- define habitat-loss area;
- define net loss;
- define annual rate;
- calculate change matrices;
- calculate fragmentation;
- calculate connectivity and corridors;
- build the policy matching framework;
- create report templates;
- connect pinned map figures to report sections.

## Immediate next task

```text
Audit the existing 18 training polygons
→ decide the reference year
→ add quarry subtypes and site IDs
→ draw separate validation polygons
```

Only after this should the clean Random Forest baseline be run.
