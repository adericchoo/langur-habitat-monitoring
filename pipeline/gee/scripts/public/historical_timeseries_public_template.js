// ============================================================
// PUBLIC HISTORICAL TIME-SERIES TEMPLATE
// Delacour's langur habitat-monitoring project
//
// Public-safe example: uses only public Landsat collections and a
// coarse placeholder study area. Replace studyArea locally for an
// authorised analysis. Do not add private langur assets here.
//
// This is a screening template, not a validated habitat classifier.
// ============================================================

// Coarse northern Vietnam placeholder. Replace locally with an
// authorised study boundary; do not commit sensitive geometries.
var studyArea = ee.Geometry.Rectangle([104.8, 19.5, 106.8, 21.5]);

var years = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025];
var analysisScale = 30;
var analysisCrs = 'EPSG:32648';

Map.centerObject(studyArea, 8);

function maskLandsat(image) {
  image = ee.Image(image);
  var qa = image.select('QA_PIXEL');
  var saturation = image.select('QA_RADSAT');
  var clear = qa.bitwiseAnd(1 << 0).eq(0)
    .and(qa.bitwiseAnd(1 << 1).eq(0))
    .and(qa.bitwiseAnd(1 << 2).eq(0))
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 4).eq(0))
    .and(qa.bitwiseAnd(1 << 5).eq(0))
    .and(saturation.eq(0));
  return image.updateMask(clear);
}

function standardise57(image) {
  return ee.Image(image)
    .select(
      ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'],
      ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'])
    .multiply(0.0000275).add(-0.2)
    .copyProperties(image, image.propertyNames());
}

function standardise89(image) {
  return ee.Image(image)
    .select(
      ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
      ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'])
    .multiply(0.0000275).add(-0.2)
    .copyProperties(image, image.propertyNames());
}

function collectionForYear(year) {
  year = ee.Number(year);
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');

  var landsat5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filterBounds(studyArea).filterDate(start, end)
    .map(maskLandsat).map(standardise57);

  var landsat7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
    .filterBounds(studyArea).filterDate(start, end)
    .map(maskLandsat).map(standardise57);

  var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(studyArea).filterDate(start, end)
    .map(maskLandsat).map(standardise89);

  var landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
    .filterBounds(studyArea).filterDate(start, end)
    .map(maskLandsat).map(standardise89);

  // Merge all sensors so years with limited coverage can still be inspected.
  return landsat5.merge(landsat7).merge(landsat8).merge(landsat9);
}

function makeYearRecord(year) {
  year = ee.Number(year);
  var collection = collectionForYear(year);
  var composite = collection.median().clip(studyArea);

  var ndvi = composite.normalizedDifference(['nir', 'red']).rename('ndvi');
  var ndmi = composite.normalizedDifference(['nir', 'swir1']).rename('ndmi');
  var msavi = composite.expression(
    '(2 * NIR + 1 - sqrt((2 * NIR + 1) ** 2 - 8 * (NIR - RED))) / 2',
    {NIR: composite.select('nir'), RED: composite.select('red')})
    .rename('msavi');
  var bsi = composite.expression(
    '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))',
    {
      SWIR1: composite.select('swir1'),
      RED: composite.select('red'),
      NIR: composite.select('nir'),
      BLUE: composite.select('blue')
    }).rename('bsi');

  var stats = ee.Image.cat(ndvi, ndmi, msavi, bsi).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: studyArea,
    scale: analysisScale,
    crs: analysisCrs,
    maxPixels: 1e10
  });

  return ee.Feature(null, {
    year: year,
    scene_count: collection.size(),
    mean_ndvi: stats.get('ndvi'),
    mean_ndmi: stats.get('ndmi'),
    mean_msavi: stats.get('msavi'),
    mean_bsi: stats.get('bsi'),
    note: 'Public screening template; not a validated habitat label.'
  });
}

var timeSeriesSummary = ee.FeatureCollection(years.map(makeYearRecord));
print('Public historical time-series summary', timeSeriesSummary);
print('Years requested', years);
print('Study area is a coarse public placeholder', studyArea);

// Display one selected year for inspection. Change this value locally.
var displayYear = 2025;
var displayCollection = collectionForYear(displayYear);
var displayComposite = displayCollection.median().clip(studyArea);
Map.addLayer(
  displayComposite,
  {bands: ['red', 'green', 'blue'], min: 0.02, max: 0.30, gamma: 1.15},
  'Public template true colour ' + displayYear,
  true
);

Export.table.toDrive({
  collection: timeSeriesSummary,
  description: 'public_historical_timeseries_summary_1985_2025',
  folder: 'Earth Engine Exports',
  fileNamePrefix: 'public_historical_timeseries_summary_1985_2025',
  fileFormat: 'CSV'
});

print('Public historical time-series template complete.');
print('All values are screening summaries, not confirmed habitat measurements.');
