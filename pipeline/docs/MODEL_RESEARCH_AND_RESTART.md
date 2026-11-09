# Model research brief and clean restart plan

**Prepared:** 10 November 2026

This document is for Perplexity, teammates, or a future Codex session. It
explains the model experiments, the known calculation problems, and a clean
way to restart the comparison without deleting the old work.

## Recommendation

Yes, restart the model comparison from scratch. Keep the previous scripts for
traceability, but create a clean versioned baseline. Previous results mixed
random-pixel validation, class-specific and overall probabilities, and different
class-index conventions. That makes the numbers difficult to compare.

The restart should use one shared dataset, one shared split, one shared spatial
validation design and one shared metric table. Only the algorithm and its
documented hyperparameters should change.

## Perplexity review: decisions adopted

The external review identified several issues that should be resolved before
new model runs:

1. **Separate prediction targets.** The four-class model is a land-cover or
   surface-disturbance model. It must not be presented as a limestone, karst or
   confirmed habitat classifier. Geological evidence, karst-likelihood and
   potential habitat should remain separate layers.
2. **Resolve the date mismatch.** The current polygons were associated with
   2025 conditions, while the common AlphaEarth baseline is 2024. A 2025 quarry
   or clearing may not exist in a 2024 embedding. Use independently verified
   2024 labels for a 2024 comparison, or use 2025 Sentinel predictors for a
   2025 operational map.
3. **Audit quarry labels.** Record whether “quarry” includes active excavation,
   spoil, roads, stockpiles, abandoned workings, natural cliffs or other exposed
   rock. Add hard-negative polygons for bright roofs, dry soil, natural rock,
   roads and construction.
4. **Prioritise spatial validation over adding many algorithms.** Keep all pixels
   from one site/polygon in the same fold, reserve untouched sites for final
   assessment, and use the same holdout sites for every model.
5. **Add only targeted challengers.** The most useful additions are linear SVM,
   cosine minimum-distance and a quarry-first hierarchical model. Local Extra
   Trees, logistic regression, XGBoost and LightGBM can follow later.

These are design recommendations, not evidence that any model is better yet.

## Project data and labels

The private training asset is kept in the authorised GEE project and is not
listed in this public repository.

```text
<private Earth Engine training-polygon asset>
```

The existing polygon property uses codes 1–4:

| Existing code | Meaning |
|---:|---|
| 1 | Quarry / disturbed rock |
| 2 | Forest / likely habitat |
| 3 | Agriculture / plantation |
| 4 | Other land cover |

For the clean restart, remap internally to consecutive model labels 0–3:

| Model code | Meaning |
|---:|---|
| 0 | Quarry |
| 1 | Forest |
| 2 | Agriculture |
| 3 | Other |

Google's Earth Engine classification guidance recommends consecutive integer
labels starting at 0. Keep the original code in a separate field if needed,
but use the 0–3 field for training and confusion-matrix indexing.

Use AlphaEarth annual embeddings as the common Model A predictor set:

```text
GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL
```

Filter the ImageCollection by year and location, mosaic the tiles, and use
bands `A00` through `A63`. The annual AlphaEarth layers currently available
for this work go through 2024.

## Models: completed, planned and purpose

| Model | Status | What it does | Why compare it |
|---|---|---|---|
| Random Forest | Completed baseline | Trains many decision trees and combines their votes. | Strong, robust general-purpose baseline with variable importance. |
| CART | Completed | Trains one interpretable decision tree. | Simple explanation baseline; exposes instability/overfitting. |
| Gradient Tree Boosting | Completed | Builds trees sequentially, correcting previous errors. | Tests a stronger boosted-tree approach. GEE Smile implementation, not XGBoost or LightGBM. |
| RBF SVM | Completed; quarry calculation being repaired | Finds nonlinear class boundaries using an RBF kernel. | Useful high-dimensional comparison for AlphaEarth embeddings. |
| KNN | Planned/partially attempted | Assigns a class by the majority of nearby labelled samples. | Simple distance-based comparison; sensitive to scaling and `k`. |
| XGBoost | Later local experiment | Regularised gradient boosting. | Strong tabular baseline outside built-in GEE models. |
| LightGBM | Later local experiment | Efficient gradient boosting. | Useful if local exported samples become large. |
| Extra Trees | Later local experiment | Highly randomised tree ensemble. | Additional tree-ensemble comparison. |
| CNN/neural network | Not yet justified | Learns spatial features from image tiles. | Requires substantially more labels and tile-based validation. |

## Model explanations

### Random Forest

Random Forest is the primary baseline. It handles nonlinear relationships and
many correlated predictor bands reasonably well. It can still overfit clustered
training polygons. Its variable importance is diagnostic, not proof that a
band causes the class.

Earth Engine constructor: `ee.Classifier.smileRandomForest`.

### CART

CART is one tree with recursive splits. It is easy to explain to a client but
can change substantially when a few samples change. It is useful as a simple
baseline, not necessarily the final model.

Earth Engine constructor: `ee.Classifier.smileCart`.

### Gradient Tree Boosting

Boosting trains trees sequentially. Later trees focus on earlier mistakes. It
can model complex interactions but requires controlled tree count, learning
rate, sampling rate and maximum nodes.

Earth Engine constructor: `ee.Classifier.smileGradientTreeBoost`.

This is Smile Gradient Tree Boosting, not XGBoost or LightGBM.

### RBF SVM

SVM finds a margin between classes. The RBF kernel supports nonlinear boundaries
and can work well for moderate samples with many features. It is sensitive to
`gamma`, `cost`, scaling and sample selection.

Earth Engine constructor: `ee.Classifier.libsvm` with `C_SVC` and `RBF`.

Important: Earth Engine `PROBABILITY` means probability that the overall
classification is correct. It does not mean quarry probability. Use
`MULTIPROBABILITY` for a binary SVM and explicitly extract the quarry class
array element.

### KNN

KNN predicts from nearby labelled samples. It is intuitive but sensitive to
feature scaling, distance metric, sample density and the value of `k`.

Earth Engine's KNN supports `PROBABILITY` but not `MULTIPROBABILITY`. Therefore
do not apply the SVM/RF class-specific quarry probability calculation to KNN.
Use raw KNN classification metrics or implement a clearly labelled external
confidence method.

### Additional high-priority challengers

#### Linear SVM

Use a linear kernel with a small controlled cost search, for example 0.1, 1,
10 and 100. If it performs similarly to the RBF SVM on unseen sites, the
simpler model may be preferable.

#### Cosine minimum-distance classifier

Use this as a deliberately simple embedding-space baseline. Its purpose is to
measure how much improvement the more complex algorithms provide over similarity
to class prototypes. It is diagnostic, not expected to be the final model.

#### Quarry-first hierarchical model

Test a two-stage pipeline only after the four-class benchmark is stable:

1. Quarry/disturbance versus non-quarry.
2. Forest/agriculture/other within the non-quarry subset.
3. Evaluate the complete end-to-end map on the same spatial holdout.

Do not judge it only by the first-stage quarry detector; first-stage errors can
propagate into the final classes.

## Shared experimental protocol

Every model must use the same:

1. Polygon asset version.
2. Internal class remapping.
3. AlphaEarth predictor year and band order.
4. Per-class sampling cap and balance.
5. Random seed.
6. Train/test split.
7. Spatial holdout design.
8. Scale, extent and projection.
9. Confusion-matrix class order.
10. Quarry threshold-selection rule.

Do not compare models if these inputs change.

## Clean data preparation

1. Load the private official SVW range.
2. Load the saved training polygon asset.
3. Remap labels 1–4 to model labels 0–3.
4. Rasterise the class labels.
5. Use `stratifiedSample()` with a fixed maximum, such as 500 pixels per class.
6. Use `geometries: false` unless geometry is needed for spatial validation.
7. Create both a random held-out split and a separate polygon/spatial holdout.

Unrestricted `sampleRegions()` caused the previous “User memory limit exceeded”
error because it attempted to load every 10 m pixel inside large polygons.

## Evaluation metrics

Use rows as actual/reference classes and columns as predicted classes.

For a selected positive class:

```text
TP = actual positive and predicted positive
TN = actual negative and predicted negative
FP = actual negative but predicted positive
FN = actual positive but predicted negative

Accuracy  = (TP + TN) / (TP + TN + FP + FN)
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * Precision * Recall / (Precision + Recall)
```

Use safe division. If a denominator is zero, report “not defined/no predicted
positives” rather than allowing the dashboard to fail.

### Forest interpretation

- Forest false positive: non-forest labelled forest; risks overstating habitat.
- Forest false negative: forest missed; risks understating habitat.
- Forest recall: how much known forest was detected.
- Forest precision: how much mapped forest is actually forest in the reference.

### Quarry interpretation

- Quarry false positive: non-quarry labelled quarry; risks exaggerating quarry
  area and quarry-related forest loss.
- Quarry false negative: quarry missed; creates an underestimate.

The project intentionally prioritises low quarry false positives. The
conservative quarry map may therefore omit real quarry pixels.

### Other metrics

```text
Overfitting gap = training accuracy - held-out validation accuracy
```

A large positive gap suggests overfitting. A negative gap is possible when the
held-out set is easier, but it should be investigated.

Five-fold cross-validation reports stability across folds. Random folds may
still be optimistic when neighbouring pixels are spatially correlated.

## Previous calculation problems to fix

1. SVM initially treated `PROBABILITY` as quarry probability. This was wrong.
2. KNN cannot use the same `MULTIPROBABILITY` quarry method.
3. Previous scripts used class codes 1–4 directly; restart internally with 0–3.
4. Random pixel splits can place neighbouring pixels in both train and test.
5. Large polygon sampling exceeded the GEE user-memory limit.
6. Dashboard values showed “Unavailable” when a metric divided by zero or a
   server-side evaluation failed.
7. High accuracy may reflect easy or clustered polygons rather than general
   performance across the SVW range.

## Recommended restart order

1. Freeze the polygon asset and class definitions.
2. Build one shared memory-safe sampling script.
3. Run Random Forest as the reference baseline.
4. Run CART using the same samples.
5. Run Gradient Tree Boosting using the same samples.
6. Run SVM with corrected `MULTIPROBABILITY` quarry handling.
7. Run KNN using raw classification metrics only.
8. Draw separate validation polygons in different locations.
9. Re-run every model on the same spatial/polygon holdout.
10. Select a model using accuracy, stability, map plausibility, forest metrics
    and quarry false-positive policy—not accuracy alone.

## Research prompt for Perplexity

> Research supervised land-cover classification for 10 m satellite or embedding
> predictors with small labelled polygon datasets. Compare Random Forest, CART,
> gradient tree boosting, RBF SVM, KNN, XGBoost, LightGBM, Extra Trees and
> neural networks. Focus on spatial autocorrelation, polygon-level validation,
> data leakage, class imbalance, probability calibration, false positives,
> false negatives, overfitting and conservative quarry detection. The four
> classes are quarry, forest, agriculture and other. The policy objective is
> to minimise quarry false positives so quarry-related forest loss is not
> exaggerated. Recommend a defensible comparison protocol and identify which
> models can run in Earth Engine versus local Python/GPU. Use primary
> documentation and peer-reviewed sources, and flag assumptions.

## Recommended authoritative references

- [Earth Engine supervised classification](https://developers.google.com/earth-engine/guides/classification)
- [Earth Engine Random Forest](https://developers.google.com/earth-engine/apidocs/ee-classifier-smilerandomforest)
- [Earth Engine SVM](https://developers.google.com/earth-engine/apidocs/ee-classifier-libsvm)
- [Earth Engine Gradient Tree Boost](https://developers.google.com/earth-engine/apidocs/ee-classifier-smilegradienttreeboost)
- [Earth Engine KNN](https://developers.google.com/earth-engine/apidocs/ee-classifier-smileknn)
- [Earth Engine output modes](https://developers.google.com/earth-engine/apidocs/ee-classifier-setoutputmode)
- [AlphaEarth annual dataset](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL)
- [scikit-learn data leakage pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)

## Bottom line

Starting again is sensible. Preserve the old work, but establish one clean
baseline with 0–3 labels, capped sampling, safe metric calculations, spatial
validation and the conservative quarry policy documented above.
