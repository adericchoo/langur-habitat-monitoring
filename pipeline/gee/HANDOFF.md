# Langur Habitat Monitoring — Current GEE Handoff

**Updated:** 17 November 2026  
**Project stage:** Week 10 — validation, metrics, risk/report preparation  
**Audience:** A teammate continuing from another laptop

This document records what has been completed, what is currently running, known
issues, and the next safe actions. Current maps remain screening products until
SVW and independent reference data validate them.

## 1. Project purpose

The pipeline combines Sentinel-2, Landsat, AlphaEarth embeddings, geology,
terrain and training polygons to produce:

- habitat/land-cover classification;
- historical change summaries from the 1980s onward;
- quarry and forest-loss screening;
- fragmentation, connectivity and risk metrics;
- frontend-ready map layers and report inputs.

The public repository contains only public-safe templates and documentation.
Private GEE assets, precise langur locations and raw validation data remain in
the authorised Earth Engine project.

## 2. Timeline position

### W6 — baseline and segmentation

Completed:

- Sentinel-2 baseline and cloud masking.
- NDVI, NDMI, MSAVI and BSI layers.
- AlphaEarth annual embedding baseline with 64 bands (`A00`–`A63`).
- First Random Forest, CART, Gradient Tree Boosting and SVM prototypes.

Still needed:

- Final training/validation polygon quality review.
- A validated first segmentation layer.

### W7 — historical years and ground truth

Completed or available:

- Public historical template for 1985, 1990, 1995, 2000, 2005, 2010, 2015,
  2020 and 2025.
- Private Landsat 2000–2025 screening workflows.
- Five-year export plan: 2000, 2005, 2010, 2015, 2020 and 2025.
- 2025 Sentinel-2 exports.

Still needed:

- Complete and verify the agreed historical exports.
- Create independent polygon-level validation data.
- Record collection, date window, scale, projection and scene counts.

### W8 — policy and metric framework

Still needed:

- Habitat-loss area, net loss, rate and change-matrix definitions.
- Policy evidence bank and policy-to-metric matching framework.
- Documented formulas, thresholds, assumptions and limitations.

### W9 — fragmentation and reports

Still needed:

- Fragmentation/connectivity and corridor metrics.
- Least-cost corridor method, if reference data supports it.
- Report-generation data contract, templates and algorithm.

### W10 — current focus

Current priorities:

1. Freeze and validate the training data.
2. Compare models using the same evaluation protocol.
3. Define risk and report outputs.
4. Prepare frontend-ready layer names, palettes, units and metadata.

## 3. Training polygons

The original private asset is retained as the V1 backup:

`delacour_langur_training_polygons_2025_v1`

A new V2 asset export completed successfully on 17 November 2026:

`delacour_langur_training_polygons_2025_v2`

The V2 imports are:

| Code | Class | Intended meaning |
|---:|---|---|
| 1 | Quarry | Exposed excavation, benches, spoil or disturbed rock |
| 2 | Forest | Forest / likely habitat |
| 3 | Agriculture | Agriculture or plantation |
| 4 | Other | Clearly non-quarry natural or bare land |
| 5 | Roads | Roads and transport surfaces |
| 6 | Buildings | Buildings and built-up surfaces |

The six Geometry Import names must be exactly:

`Quarries`, `Forests`, `Agriculture`, `Other`, `Roads`, `Buildings`

Quarry polygons should cover only visible disturbed extraction surfaces, not
the whole mountain. Roads, buildings, dry fields and natural limestone are
important hard negatives. If a class is missing from the asset, retrain only
after adding valid polygons for that class.

Keep a separate spatial validation polygon set. Do not use the validation
polygons for training.

## 4. Current RF V2 design

The updated Random Forest script is:

`RF_V2_six_class_full_coverage.js`

It uses:

- AlphaEarth 2024 annual embeddings (64 bands);
- Sentinel-2 2025 cloud-masked predictors;
- 2024 then 2023 Sentinel fallback where needed;
- six raw Sentinel bands plus NDVI, NDMI, MSAVI and BSI;
- 74 predictor bands in total;
- a maximum of 500 sampled pixels per class;
- 300-tree Random Forest with `variablesPerSplit: 8`;
- held-out testing and five-fold cross-validation;
- forest and quarry binary confusion matrices;
- class areas in square metres and hectares;
- six-class map palette and legend.

The earlier `variablesPerSplit: 0` setting was invalid and has been corrected
to 8. The conservative quarry BSI threshold now has a safe fallback so an
empty percentile dictionary does not break the map layer.

Before accepting any run, confirm the console reports non-zero samples for all
six classes and inspect the confusion matrix.

## 5. Required evaluation outputs

For every model record:

- multiclass confusion matrix;
- overall test accuracy and Kappa;
- producer accuracy/recall by class;
- consumer accuracy/precision by class;
- forest recall, precision and F1;
- forest false positives and false negatives;
- quarry recall, precision and F1;
- quarry false positives and false negatives;
- training accuracy, validation accuracy and overfitting gap;
- five-fold mean accuracy and standard deviation;
- classified area by class.

Interpretation:

- Forest false positive: non-forest mapped as forest, which can overstate
  habitat extent.
- Forest false negative: real forest missed, which can understate habitat.
- Quarry false positive: non-quarry mapped as quarry, which can exaggerate
  quarry-related forest loss.
- Quarry false negative: real quarry missed, which underestimates quarry area.

The project intentionally uses a conservative quarry estimate: high precision
is preferred over high recall so quarry-driven forest loss is not exaggerated.
Report both the raw predicted quarry area and the stricter conservative area.

## 6. Model comparison plan

Completed or prototyped:

- Random Forest — main baseline.
- CART — interpretable single tree.
- Gradient Tree Boosting — Smile gradient boosting in GEE, not XGBoost or
  LightGBM.
- SVM — nonlinear margin-based comparison; quarry probability handling still
  needs final QA.

Planned or optional local comparisons:

- KNN;
- Extra Trees;
- XGBoost;
- LightGBM;
- CatBoost.

All comparisons must use the same polygons, predictors, random seed, split and
validation method. Do not select a model using random-pixel accuracy alone;
use spatial/polygon-level validation and inspect the map visually.

## 7. Earth Engine quota issue

The project recently entered noncommercial restricted mode after exceeding its
monthly compute quota. This is an Earth Engine project quota issue, not a
training-data failure. Existing completed assets remain available. Restricted
mode can still run tasks, but with lower throughput.

Until quota is available again:

- avoid repeated full-range RF runs;
- temporarily remove five-fold cross-validation;
- reduce tree count to 100–150 for diagnostics;
- test on a smaller region first;
- separate map classification from area summaries;
- use local VS Code only after exporting the required predictor/sample data.

Calling Earth Engine through the Python API still uses Earth Engine project
compute. A local GPU helps only for data and models already downloaded locally.

## 8. Public repository and local setup

The public GitHub repository is:

`https://github.com/adericchoo/langur-habitat-monitoring`

The continuation environment is under:

`D:\AIforgood x SUTD\Pipeline`

The public-safe pipeline contains:

- `pipeline/python/` — Earth Engine connection test and requirements;
- `pipeline/gee/scripts/public/` — public historical template;
- `pipeline/gee/HANDOFF.md` — this handoff;
- `pipeline/docs/` — project context, model research and step-by-step flow;
- `data-contract/` and `web/` — frontend-facing structure.

Do not commit private asset IDs, precise sightings, raw training polygons,
private exports or sensitive screenshots.

## 9. Immediate next actions

1. Run the corrected RF V2 script only once quota allows.
2. Confirm six-class sample counts and the RF confusion matrices.
3. Save the RF summary values and map screenshot.
4. Create independent validation polygons.
5. Run the same evaluation protocol for CART, Gradient Boosting and SVM.
6. Freeze the selected model and document the reason for selection.
7. Define fragmentation, corridor, risk and report-generation outputs.
8. Complete the historical five-year exports and metadata table.
9. Prepare the frontend data contract and cached report payload.

## 10. Handoff rule

No current layer should be described as confirmed habitat, confirmed quarry,
confirmed karst or confirmed forest loss without SVW/reference validation.
