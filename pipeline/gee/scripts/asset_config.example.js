// Copy this file to asset_config.local.js for authorised local GEE work.
// asset_config.local.js is ignored and must never be committed.

var ASSETS = {
  officialRange: 'YOUR_PRIVATE_OFFICIAL_RANGE_ASSET',
  currentLangurAreas: 'YOUR_PRIVATE_CURRENT_LANGUR_AREAS_ASSET',
  protectedAreas: 'YOUR_PROTECTED_AREAS_ASSET',
  historicalSightings: 'YOUR_PRIVATE_HISTORICAL_RECORDS_ASSET',
  wokam: 'YOUR_WOKAM_ASSET',
  glim: 'YOUR_GLIM_ASSET'
};

// Public catalog collections are safe to reference in scripts, subject to
// Earth Engine terms and the method documentation.
var COLLECTIONS = {
  sentinel2: 'COPERNICUS/S2_SR_HARMONIZED',
  sentinel2CloudProbability: 'COPERNICUS/S2_CLOUD_PROBABILITY',
  copernicusDem: 'COPERNICUS/DEM/GLO30',
  alphaEarthAnnual: 'GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL'
};
