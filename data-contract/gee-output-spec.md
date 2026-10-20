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
