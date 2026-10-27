import Map from 'react-map-gl/maplibre'

// Placeholder regional basemap (MapLibre demotiles, no API key). Centred
// coarsely on northern Vietnam — deliberately regional, with NO precise site
// or langur locations (see SECURITY.md). Real layers + map tokens + Montserrat
// labels arrive in C2/C4.
export default function MapStage() {
  return (
    <Map
      initialViewState={{ longitude: 105.8, latitude: 20.9, zoom: 6 }}
      mapStyle="https://demotiles.maplibre.org/style.json"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
