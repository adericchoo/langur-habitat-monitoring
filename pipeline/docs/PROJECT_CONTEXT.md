# CODEX CONTEXT — Langur Habitat Monitoring Pipeline

Read this file first when continuing the project from another laptop or Codex
session.

## Project

This repository supports a Google Earth Engine pipeline and a frontend for
Delacour's langur / SVW habitat monitoring. The GEE work produces screening
layers and metrics for habitat, forest condition, disturbance, geology, karst
context, fragmentation, risk and reports.

## Current branch contribution

Branch: `base-pipeline-setup`

This branch adds only the public-safe base environment and documentation:

- `pipeline/python/README.md`
- `pipeline/python/requirements.txt`
- `pipeline/python/requirements-optional-geemap.txt`
- `pipeline/python/test_ee_connection.py`
- `pipeline/.vscode/settings.json`
- `pipeline/docs/STEP_BY_STEP_MODEL_FLOW.md`
- `pipeline/docs/MODEL_RESEARCH_AND_RESTART.md`

The Python environment itself is not committed. Every laptop must create its
own `.venv` locally.

## First reading order

1. Read this file.
2. Read `pipeline/python/README.md`.
3. Read `pipeline/docs/STEP_BY_STEP_MODEL_FLOW.md`.
4. Read `pipeline/docs/MODEL_RESEARCH_AND_RESTART.md`.
5. Read the existing repository `pipeline/gee/HANDOFF.md` and
   `pipeline/gee/README.md`.

## Base environment setup

From the repository root:

```powershell
cd pipeline
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python\requirements.txt
```

If PowerShell blocks activation, use the interpreter directly rather than
changing the execution policy:

```powershell
.\.venv\Scripts\python.exe --version
```

Authenticate Earth Engine through the authorised Google account. Store the
Cloud project ID locally as an environment variable; do not commit it to a
public file:

```powershell
$env:GEE_PROJECT_ID="<authorised-project-id>"
.\.venv\Scripts\earthengine.exe authenticate
.\.venv\Scripts\python.exe python\test_ee_connection.py
```

The test reads only the public AlphaEarth catalog and does not train models,
load private assets or export data.

## What is complete

- 2025 Sentinel-2 baseline exports were completed in the authorised GEE work.
- Historical Landsat screening exists for the planned five-year years:
  2000, 2005, 2010, 2015, 2020 and 2025.
- Public historical time-series template exists for 1985–2025.
- Training polygons were drawn privately and saved as an Earth Engine asset.
- Random Forest, CART, Gradient Tree Boosting and SVM prototypes were tested.
- The model-research brief and clean restart plan are documented.
- The local VS Code base environment is prepared; model packages and local
  model scripts are intentionally deferred.

## What is not complete

- Training polygons still need a date/year and subtype audit.
- Independent spatial validation polygons are still needed.
- Previous random-pixel metrics should not be treated as final validation.
- 2025 labels must not be silently paired with 2024 AlphaEarth predictors.
- The clean model comparison has not yet been rerun with one shared spatial
  validation design.
- Quarry false-positive/false-negative policy needs to be applied consistently.
- Historical annual classification maps still need validation and metadata.
- Fragmentation, policy matching and report-generation outputs remain pending.

## Immediate next action

Do not run another model first. Audit the private training polygons:

```text
polygon_id
class
reference_year
imagery_date
label_confidence
site_id
quarry_subtype
```

Then draw separate validation polygons that are not used for training. Keep
nearby polygons from the same site in the same spatial group.

## Model restart plan

Use one shared preparation script and identical data for every algorithm.
Internally remap labels to:

```text
0 = Quarry
1 = Forest
2 = Agriculture
3 = Other
```

Run in this order:

1. Random Forest baseline.
2. Gradient Tree Boosting.
3. Linear SVM.
4. RBF SVM.
5. Cosine minimum-distance.
6. CART and KNN as secondary baselines.

Record the confusion matrix, macro-F1, per-class precision/recall, forest and
quarry FP/FN, overfitting gap, spatial-fold performance and classified area.

Do not interpret Earth Engine `PROBABILITY` as quarry probability. Use
`MULTIPROBABILITY` only for classifiers that support it, and verify the class
array order before extracting scores. KNN does not support the same
class-specific multiprobability workflow.

## Target-year rule

Use separate experiments:

```text
2024 comparison:
AlphaEarth 2024 + labels verified for 2024

2025 operational map:
2025 Sentinel predictors + labels verified for 2025
```

Do not claim that a 2025 quarry or clearing label is perfectly represented by
a 2024 embedding.

## Quarry policy

The project intentionally prioritises low quarry false positives so quarry-
related forest loss is not exaggerated. Keep both the raw four-class map and a
strict high-confidence quarry mask. Describe the latter as:

```text
Conservative lower-bound screening estimate; not a confirmed quarry inventory
or confirmed habitat loss.
```

## Privacy rules

Never commit:

- private Earth Engine asset IDs;
- precise langur areas or historical sightings;
- raw training/validation geometries;
- sensitive exports;
- authentication tokens or service-account files.

Use local ignored configuration for private project IDs and authorised assets.
The public repository is documentation and public-safe scaffolding only.

## Definition of done for the next handoff

- Labels have documented reference years and subtypes.
- Training and spatial validation polygons are separate.
- All models use the same samples and spatial folds.
- Forest and quarry FP/FN values are reported.
- The selected model is justified by accuracy, stability and policy fit.
- Annual exports have source, date-window, scale and CRS metadata.
- No private data appears in the public branch.
