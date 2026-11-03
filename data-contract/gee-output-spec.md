# GEE output specification

This is the minimum contract between the GEE pipeline and the web frontend.

## Spatial outputs

| Output | Type | Meaning |
| --- | --- | --- |
| `current_true_colour` | rendered GeoTIFF | presentation basemap only |
| `current_indices` | multi-band GeoTIFF | blue, green, red, NIR, SWIR1, SWIR2, NDVI, NDMI, MSAVI, BSI |
| `historical_change` | GeoTIFF | preliminary vegetation-change screening |
| `karst_likelihood_v1` | integer GeoTIFF | classes 1–4, geology/terrain screening |
| `habitat_class_<year>` | integer GeoTIFF | validated only after labelled reference data exist |
| `habitat_loss_<start>_<end>` | GeoTIFF | class transition/loss screening |

## Summary tables

CSV summaries should include `metric`, `value`, `unit`, `year_start`,
`year_end`, `study_area`, `source_script`, and `limitations`.

## Conventions

- GeoTIFFs use the project-approved CRS, scale and region recorded with the
  export metadata.
- Class rasters use integer codes and must include a legend.
- Probability rasters use values from 0 to 1 and must not be described as
  confirmed locations.
- All sensitive geometry stays in access-controlled storage.

## Frontend consumption appendix

The sections above are the authoritative contract. This appendix records the
*exact* values the web frontend reads today, so a pipeline output can replace
sample data with **no frontend code change**. These are hard dependencies: a
mismatched `metric` string or GeoJSON property renders a blank card or an
unpainted layer.

### Join key

The frontend groups summary rows into a "site" by **`study_area`**. The same
site must use a byte-identical `study_area` string across every table that
references it (e.g. a site's loss rows and its fragmentation rows must agree).
`study_area` is the join key; treat it as a stable identifier, not prose.

### Summary tables — `metric` keys per step

Each row is a full contract row (all 8 columns). The frontend keys on the
`metric` string:

| Step | Status | `metric` values | `unit` |
| --- | --- | --- | --- |
| Habitat loss | produced | `habitat_remaining`, `habitat_lost`, `core_habitat`, `quarry_footprint` | `ha` |
| | | `loss_rate` | `%/yr` |
| | | `driver_mining`, `driver_farming`, `driver_other` (should sum to ~100) | `%` |
| Fragmentation | upstream TODO | `effective_mesh_size`, `core_area` | `ha` |
| | | `num_patches` | `patches` |
| | | `largest_patch_index` | `%` |
| | | `edge_density` | `m/ha` |
| Habitat risk | upstream TODO | `composite_risk`, `exposure`, `sensitivity` (0–1) | `score` |

### Spatial layers — GeoJSON properties

The browser currently reads **coarsened GeoJSON FeatureCollections** (raster →
PMTiles is a later export step and not yet wired). Each layer's map paint and
legend key on a single property; emit that property with exactly these values:

| Layer | Geometry | Keyed property → allowed values |
| --- | --- | --- |
| Habitat | Polygon | — (rendered as one class) |
| Protected areas | Polygon | — |
| Drivers | Point | `kind` → `quarry`, `clearing` |
| Corridors | LineString | `status` → `intact`, `partial`, `lost` |
| Habitat risk | Polygon | `riskLevel` → `high`, `med`, `low` |

A `label` string property on each feature is used for captions; keep it
public-safe (no precise place names that imply exact locations).

### Classification ownership (open decision)

Habitat risk needs a per-site class **`level`** (`high` | `med` | `low`) for the
sidebar cards, in addition to the `composite_risk` score rows. Corridors
likewise need a `status` class. Decide upstream whether the pipeline emits the
class directly, or emits only the 0–1 score and the frontend applies the
thresholds — the cutoffs are a domain call, not a UI one. Until resolved, the
frontend sample carries both the score and a pre-computed class.
