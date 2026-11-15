import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Circle,
  Marker,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Search,
  Navigation,
  MapPin,
  Loader2,
  ArrowLeft,
  Info,
  CheckCircle2,
} from 'lucide-react';
// @ts-ignore
import 'leaflet/dist/leaflet.css';

type Location = {
  lat: number;
  lng: number;
};

type FarmFeature = {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: any;
};

type FarmCollection = {
  type: 'FeatureCollection';
  features: FarmFeature[];
};

interface MapSelectionProps {
  onFarmSelect: (farm: any) => void;
  onBackToDashboard?: () => void;
}

const AMES: Location = {
  lat: 42.0308,
  lng: -93.6319,
};

const RADII = [10, 25, 50];

// Approximate Iowa bounds for preliminary validation.
// These bounds are NOT an exact state boundary.
function isNearIowa(lat: number, lng: number) {
  return lat >= 40.3 && lat <= 43.6 && lng >= -96.7 && lng <= -90.0;
}

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function getPoints(geometry: any): number[][] {
  if (!geometry) return [];

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat();
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2);
  }

  return [];
}

function getFeatureCenter(feature: FarmFeature): Location | null {
  const points = getPoints(feature.geometry);

  if (!points.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
}

function isWithinRadius(
  feature: FarmFeature,
  center: Location,
  radius: number
) {
  const points = getPoints(feature.geometry);

  const vertexInside = points.some(
    ([lng, lat]) => distanceKm(center.lat, center.lng, lat, lng) <= radius
  );

  if (vertexInside) return true;

  const farmCenter = getFeatureCenter(feature);

  if (!farmCenter) return false;

  return (
    distanceKm(center.lat, center.lng, farmCenter.lat, farmCenter.lng) <= radius
  );
}

function MapController({
  center,
  radius,
}: {
  center: Location;
  radius: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(
      [center.lat, center.lng],
      radius === 10 ? 12 : radius === 25 ? 11 : 10,
      { duration: 1.2 }
    );
  }, [map, center.lat, center.lng, radius]);

  return null;
}

function MapClickListener({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export async function fetchUsdaArcGisFieldsForIowa(
  lat: number,
  lng: number,
  radiusKm: number,
  signal?: AbortSignal
): Promise<{ collection: FarmCollection; suggestedCenter?: Location }> {
  const degLat = radiusKm / 111.0;
  const degLng = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

  const xmin = lng - degLng;
  const ymin = lat - degLat;
  const xmax = lng + degLng;
  const ymax = lat + degLat;

  const envelopeUrl = `https://services3.arcgis.com/g6eV2CrSSwCZj8Mc/arcgis/rest/services/NASS_Crop_Sequence_Boundaries_2024/FeatureServer/0/query?where=1%3D1&geometry=${xmin},${ymin},${xmax},${ymax}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson&resultRecordCount=500`;
  const envRes = await fetch(envelopeUrl, { signal });
  if (envRes.ok) {
    const envData = await envRes.json();
    if (
      envData?.type === 'FeatureCollection' &&
      Array.isArray(envData.features) &&
      envData.features.length > 0
    ) {
      return { collection: envData };
    }
  }

  // Query real Iowa STATEFIPS='19' features from USDA NASS Crop Sequence Boundaries 2024 FeatureServer
  const iowaUrl = `https://services3.arcgis.com/g6eV2CrSSwCZj8Mc/arcgis/rest/services/NASS_Crop_Sequence_Boundaries_2024/FeatureServer/0/query?where=STATEFIPS%3D%2719%27&outFields=*&f=geojson&resultRecordCount=200`;
  const iowaRes = await fetch(iowaUrl, { signal });
  if (!iowaRes.ok) {
    throw new Error(`USDA ArcGIS service returned status ${iowaRes.status}.`);
  }
  const iowaData = await iowaRes.json();
  if (
    iowaData?.type === 'FeatureCollection' &&
    Array.isArray(iowaData.features) &&
    iowaData.features.length > 0
  ) {
    const firstCenter = getFeatureCenter(iowaData.features[0]);
    return {
      collection: iowaData,
      suggestedCenter: firstCenter ?? undefined,
    };
  }

  throw new Error('No Iowa USDA field boundaries returned by ArcGIS service.');
}

export default function MapSelection({
  onFarmSelect,
  onBackToDashboard,
}: MapSelectionProps) {
  const [search, setSearch] = useState('');
  const [center, setCenter] = useState<Location>(AMES);
  const [radius, setRadius] = useState(25);

  const [fields, setFields] = useState<FarmCollection | null>(null);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Attempt local /data/ames_fields.geojson first; if unavailable, query real USDA ArcGIS service. Never fabricate polygons.
  useEffect(() => {
    const controller = new AbortController();

    async function loadFields() {
      try {
        setLoading(true);
        setError('');

        let loadedLocal = false;
        try {
          const response = await fetch('/data/ames_fields.geojson', {
            signal: controller.signal,
          });
          const contentType = response.headers.get('content-type') || '';
          if (response.ok && contentType.includes('json')) {
            const data = await response.json();
            if (
              data?.type === 'FeatureCollection' &&
              Array.isArray(data.features)
            ) {
              setFields(data);
              setDataSourceLabel('Local Ames GeoJSON');
              loadedLocal = true;
            }
          }
        } catch {
          // Proceed to real USDA ArcGIS fallback
        }

        if (!loadedLocal) {
          const { collection } = await fetchUsdaArcGisFieldsForIowa(
            AMES.lat,
            AMES.lng,
            25,
            controller.signal
          );
          setFields(collection);
          setDataSourceLabel('USDA NASS Crop Sequence Boundaries (ArcGIS Live)');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setFields(null);
          setError(
            'Local /data/ames_fields.geojson is not present in the repository and the live USDA ArcGIS service could not be reached. Map navigation and radius controls remain active.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadFields();

    return () => controller.abort();
  }, []);

  // Filter locally by selected location and radius.
  const filteredFields = useMemo(() => {
    if (!fields) return [];

    return fields.features.filter((feature) =>
      isWithinRadius(feature, center, radius)
    );
  }, [fields, center.lat, center.lng, radius]);

  const filteredGeoJSON = useMemo<FarmCollection>(
    () => ({
      type: 'FeatureCollection',
      features: filteredFields,
    }),
    [filteredFields]
  );

  const totalHectares = useMemo(() => {
    return filteredFields.reduce((total, feature) => {
      const acres = Number(
        feature.properties?.CSBACRES || feature.properties?.Acres || 0
      );
      return total + acres * 0.404686;
    }, 0);
  }, [filteredFields]);

  // Center on loaded USDA Iowa parcels when Ames local file is absent
  const handleLoadIowaParcels = async () => {
    setLoading(true);
    setError('');
    try {
      const { collection, suggestedCenter } = await fetchUsdaArcGisFieldsForIowa(
        center.lat,
        center.lng,
        radius
      );
      setFields(collection);
      setDataSourceLabel('USDA NASS Crop Sequence Boundaries (ArcGIS Live)');
      if (suggestedCenter) {
        setCenter(suggestedCenter);
        setSearched(true);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'USDA ArcGIS service is currently unavailable. No fabricated parcels are shown.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Select an active real USDA parcel from filteredFields (or loaded fields)
  const handleSelectActiveIowaParcel = () => {
    const feature = filteredFields[0] || fields?.features?.[0];
    if (!feature) {
      setError(
        'No real USDA parcel is currently loaded to select. Click "Load Iowa USDA Parcels" first.'
      );
      return;
    }
    const farmCenter = getFeatureCenter(feature) || center;
    const props = feature.properties || {};
    onFarmSelect({
      ...feature,
      properties: {
        ...props,
        Field_ID: props.Field_ID || props.CSBID || props.OBJECTID,
        Crop_Name: props.Crop_Name || props.Crop || 'USDA 2024 Crop',
        Acres: props.Acres || props.CSBACRES,
      },
      location: {
        lat: farmCenter.lat,
        lon: farmCenter.lng,
      },
    });
  };

  // Search only within Iowa, USA.
  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();

    const query = search.trim();
    if (!query) return;

    setSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({
        format: 'json',
        q: `${query}, Iowa, USA`,
        countrycodes: 'us',
        limit: '5',
        addressdetails: '1',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Location search unavailable.');
      }

      const results = await response.json();

      const result = results.find((item: any) => {
        const state = item.address?.state;
        return state === 'Iowa';
      });

      if (!result) {
        throw new Error(
          'Location not found in Iowa. Try Ames or Des Moines.'
        );
      }

      const lat = Number(result.lat);
      const lng = Number(result.lon);

      setCenter({ lat, lng });
      setSearched(true);
    } catch (err: any) {
      setError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(lat: number, lng: number) {
    if (!isNearIowa(lat, lng)) {
      setError('Please select a location within Iowa, USA.');
      return;
    }

    setError('');
    setCenter({ lat, lng });
    setSearched(true);
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setError('Browser geolocation is unavailable.');
      return;
    }

    setSearching(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        selectLocation(position.coords.latitude, position.coords.longitude);
        setSearching(false);
      },
      () => {
        setError('Unable to get GPS location. Search an Iowa city instead.');
        setSearching(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  function onEachFeature(feature: FarmFeature, layer: L.Layer) {
    const properties = feature.properties || {};

    const acres = Number(properties.CSBACRES ?? properties.Acres);
    const hectares = Number.isFinite(acres)
      ? (acres * 0.404686).toFixed(2)
      : 'N/A';

    const container = document.createElement('div');
    container.style.minWidth = '210px';

    const title = document.createElement('h3');
    title.textContent = 'Agricultural Field';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '16px';
    title.style.marginBottom = '8px';

    const id = document.createElement('p');
    id.textContent = `Field ID: ${
      properties.CSBID ?? properties.Field_ID ?? 'N/A'
    }`;

    const area = document.createElement('p');
    area.textContent = `Area: ${hectares} ha`;

    const button = document.createElement('button');
    button.textContent = 'Select this Farm';
    button.setAttribute('data-testid', 'leaflet-popup-select-farm-btn');
    button.style.width = '100%';
    button.style.padding = '10px';
    button.style.marginTop = '12px';
    button.style.background = '#16a34a';
    button.style.color = 'white';
    button.style.borderRadius = '10px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';

    button.onclick = () => {
      const bounds = (layer as L.Polygon).getBounds();
      const farmCenter = bounds.getCenter();

      onFarmSelect({
        ...feature,
        location: {
          lat: farmCenter.lat,
          lon: farmCenter.lng,
        },
      });
    };

    container.appendChild(title);
    container.appendChild(id);
    container.appendChild(area);
    container.appendChild(button);

    layer.bindPopup(container);
  }

  return (
    <div
      data-testid="iowa-map-selection-page"
      className="relative w-full h-screen bg-gray-100 overflow-hidden font-sans"
    >
      {/* Top Control & Search Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[94%] max-w-4xl">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {onBackToDashboard && (
              <button
                type="button"
                data-testid="map-back-to-dashboard-btn"
                onClick={onBackToDashboard}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            )}

            <div className="text-green-700 font-extrabold text-base md:text-lg flex items-center gap-2 whitespace-nowrap">
              <MapPin className="w-5 h-5" />
              Select Farm Location
            </div>

            <form
              onSubmit={handleSearch}
              className="flex-1 w-full bg-gray-50 rounded-xl px-4 py-2 flex items-center border border-gray-200"
            >
              <Search className="w-4 h-4 text-gray-400 mr-2" />

              <input
                type="text"
                data-testid="map-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Iowa city, ZIP code or address..."
                className="bg-transparent outline-none w-full text-sm"
              />

              <button
                type="submit"
                disabled={searching}
                className="text-green-700 font-bold text-xs ml-2 cursor-pointer"
              >
                Search
              </button>
            </form>

            <button
              type="button"
              onClick={handleLocate}
              disabled={searching}
              className="bg-green-100 text-green-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-green-200 cursor-pointer flex-shrink-0"
            >
              <Navigation className="w-4 h-4" />
              Auto Locate
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Search Radius:</span>

              {RADII.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadius(value)}
                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${
                    radius === value
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {value} km
                </button>
              ))}

              <button
                type="button"
                data-testid="map-load-iowa-parcels-btn"
                onClick={handleLoadIowaParcels}
                className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                Load Iowa USDA Parcels
              </button>

              {(filteredFields.length > 0 || (fields?.features?.length ?? 0) > 0) && (
                <button
                  type="button"
                  data-testid="map-select-iowa-parcel-btn"
                  onClick={handleSelectActiveIowaParcel}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-green-700 text-white hover:bg-green-800 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Select Active Iowa USDA Parcel</span>
                </button>
              )}
            </div>

            <div
              data-testid="map-farms-found-badge"
              className="text-xs font-bold text-green-700"
            >
              {loading || searching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                <>
                  {filteredFields.length.toLocaleString()} Farms Found ·{' '}
                  {totalHectares.toFixed(1)} ha
                  {dataSourceLabel ? ` (${dataSourceLabel})` : ''}
                </>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {!loading && !error && filteredFields.length === 0 && (
            <p className="text-xs text-amber-700">
              No fields in the currently loaded radius ({center.lat.toFixed(2)}°,{' '}
              {center.lng.toFixed(2)}°). Click &quot;Load Iowa USDA Parcels&quot; to
              center on active USDA NASS Iowa polygons, or add local{' '}
              <code>/data/ames_fields.geojson</code>.
            </p>
          )}

          {/* Regional Coverage & NASA Global Capability Disclosure Note */}
          <div
            data-testid="iowa-regional-coverage-note"
            className="bg-amber-50/90 border border-amber-200/80 rounded-xl px-3 py-2 text-[11px] text-amber-950 flex items-start gap-2 leading-snug"
          >
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Regional Parcel Coverage Note: </span>
              CropWise currently integrates USDA agricultural parcel mapping for
              Iowa as our regional demonstration dataset. Farmers in other
              locations can enter coordinates to explore NASA POWER historical
              climate data and preliminary crop-rotation scenarios, while wider
              farm-boundary integration and local agronomic validation remain
              future work.
            </div>
          </div>
        </div>
      </div>

      {/* One Map Only */}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ZoomControl position="bottomright" />

        <MapController center={center} radius={radius} />

        <MapClickListener onMapClick={selectLocation} />

        {searched && (
          <Marker position={[center.lat, center.lng]} icon={markerIcon} />
        )}

        <Circle
          center={[center.lat, center.lng]}
          radius={radius * 1000}
          pathOptions={{
            color: '#16a34a',
            weight: 2,
            fillOpacity: 0.025,
          }}
        />

        {fields && (
          <GeoJSON
            key={`${center.lat}-${center.lng}-${radius}-${fields.features.length}`}
            data={filteredGeoJSON as any}
            style={{
              color: '#15803d',
              weight: 1,
              fillColor: '#4ade80',
              fillOpacity: 0.35,
            }}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
