# Timeline status — GEE and project work

**Status date:** 22 October 2026  
**Scope:** W6–W14 plan supplied by the project team

This document records what is complete, what is in progress and what remains.
It is a planning status, not a claim that screening products are validated
habitat maps.

## At a glance

The GEE work is approximately at **late W6 / beginning of W7**. The W6
Sentinel-2 exports are complete. The next dependency is labelled training and
validation polygons for the first prototype classifier.

## Week-by-week status

### W6 — baseline map and first segmentation

**Completed**

- 2025 Sentinel-2 source and cloud-masked composites were produced.
- True-colour basemap was exported.
- NDVI, NDMI, MSAVI and BSI were exported as GeoTIFFs.
- Raw Sentinel-2 bands were exported for internal analysis.
- Official SVW range, geology and preliminary condition layers were inspected.
- Export destination is the Google Drive folder `Earth Engine Exports`.

**Remaining**

- Draw prototype training polygons for five land-cover classes.
- Draw separate validation polygons.
- Train and display the first baseline segmentation/classifier map.
- Record export metadata and limitations for the frontend handoff.

### W7 — per-year exports and ground truth

**Completed or available**

- Historical Landsat screening exists for 2000–2025.
- A public-safe historical template covers 1985–2025.
- 09A/09B/09C screening outputs provide initial change evidence.

**Remaining**

- Produce consistent per-year records, primarily for 2000, 2005, 2010,
  2015, 2020 and 2025.
- Complete training and independent validation samples.
- Train, fine-tune and compare the classifier across years.
- Produce initial habitat-loss, area-change and confidence summaries.

### W8 — policy bank and habitat-loss metrics

**Available**

- Initial habitat-loss and consensus-priority screening metrics exist.
- A shared output/data contract has been documented.

**Remaining**

- Finalise area, net-loss, rate and change-matrix definitions.
- Build the policy evidence bank and matching framework.
- Confirm the frontend layer schema, units, palettes and metadata.

### W9 — reports, fragmentation and corridors

**Available**

- The report/user-journey concept and map workflow are defined.
- 09C identifies screening priority areas.

**Remaining**

- Calculate fragmentation and connectivity metrics.
- Define and test corridor/least-cost analysis if reference data supports it.
- Build the report-generation framework.
- Wire approved loss and fragmentation outputs into frontend staging.

### W10 — risk and integration

**Available**

- Preliminary karst, terrain and AlphaEarth risk-related screening layers exist.

**Remaining**

- Define a transparent, validated risk-score method.
- Combine risk, policy and report data in the clickable frontend workflow.
- Clearly label all unvalidated layers as screening outputs.

### W11 — final data handoff

**Remaining**

- Freeze the final approved dataset and version information.
- Reconcile numbers between GEE exports, summaries and frontend data.
- Cache policy/report data for the frontend.
- Complete the data and methods handoff.

### W12 — validation, methods and deployment

**Remaining**

- Complete independent validation and the methods write-up.
- Produce figures for slides and reporting.
- Deploy the frontend for content, responsive and interaction QA.

### W13 — rush week and QA

**Remaining**

- Run end-to-end QA on desktop and mobile.
- Check accessibility, layer labels, missing-data handling and report output.
- Perform a final privacy review and fix presentation issues.

### W14 — presentation

**Remaining**

- Present the validated project and clearly explain screening limitations,
  uncertainty and recommended next steps.

## Current next action

The next GEE action is:

```text
Draw training polygons
→ draw separate validation polygons
→ train the first prototype classifier
→ validate and document it
```

## Important interpretation rule

Current GEE products are screening products. They are not confirmed langur
habitat, confirmed karst, confirmed quarry activity or definitive forest-loss
labels until SVW-reviewed reference data and independent validation support
those claims.
