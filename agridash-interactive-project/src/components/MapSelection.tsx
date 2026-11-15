import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Circle,
  Marker,
  Popup,
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
  CheckCircle2,
  Plus,
  X,
  ArrowRight,
} from 'lucide-react';
// @ts-ignore
import 'leaflet/dist/leaflet.css';
import {
  addOrSelectFieldFromMap,
  getMyFarmMultiFieldState,
  getSelectedMapFields,
  getStableParcelId,
  MAX_MY_FARM_FIELDS,
  MyFarmFieldSlot,
  MyFarmMultiFieldState,
  removeSelectedFieldSlot,
  saveMyFarmMultiFieldState,
} from '../services/riskAndFarmStore';

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
  onFarmSelect?: (farm: any) => void;
  onDoneSelection?: () => void;
  onBackToDashboard?: () => void;
  onContinueWithoutFarm?: () => void;
}

const AMES: Location = {
  lat: 42.0308,
  lng: -93.6319,
};

const RADII = [10, 25, 50];

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
      { duration: 1.0 }
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
    click(event: any) {
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
      dataHasFeatures(envData)
    ) {
      return { collection: envData };
    }
  }

  const iowaUrl = `https://services3.arcgis.com/g6eV2CrSSwCZj8Mc/arcgis/rest/services/NASS_Crop_Sequence_Boundaries_2024/FeatureServer/0/query?where=STATEFIPS%3D%2719%27&outFields=*&f=geojson&resultRecordCount=200`;
  const iowaRes = await fetch(iowaUrl, { signal });
  if (!iowaRes.ok) {
    throw new Error(`USDA ArcGIS service returned status ${iowaRes.status}.`);
  }
  const iowaData = await iowaRes.json();
  if (dataHasFeatures(iowaData)) {
    const firstCenter = getFeatureCenter(iowaData.features[0]);
    return {
      collection: iowaData,
      suggestedCenter: firstCenter ?? undefined,
    };
  }

  throw new Error('No Iowa USDA field boundaries returned by ArcGIS service.');
}

function dataHasFeatures(data: any): boolean {
  return (
    data?.type === 'FeatureCollection' &&
    Array.isArray(data.features) &&
    data.features.length > 0
  );
}

export default function MapSelection({
  onFarmSelect,
  onDoneSelection,
  onBackToDashboard,
  onContinueWithoutFarm,
}: MapSelectionProps) {
  const [multiState, setMultiState] = useState<MyFarmMultiFieldState>(() =>
    getMyFarmMultiFieldState()
  );
  const selectedFields = useMemo(
    () => getSelectedMapFields(multiState),
    [multiState]
  );

  const [search, setSearch] = useState('');
  const [center, setCenter] = useState<Location>(() => {
    const active = selectedFields.find(
      (f) => f.fieldId === multiState.activeFieldId
    );
    if (active && active.latitude !== null && active.longitude !== null) {
      return { lat: active.latitude, lng: active.longitude };
    }
    return AMES;
  });
  const [radius, setRadius] = useState(25);

  const [fields, setFields] = useState<FarmCollection | null>(null);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [pinnedPoint, setPinnedPoint] = useState<Location | null>(null);

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
              setDataSourceLabel('Iowa USDA GeoJSON');
              loadedLocal = true;
            }
          }
        } catch {
          // Proceed to USDA ArcGIS fallback
        }

        if (!loadedLocal) {
          const { collection } = await fetchUsdaArcGisFieldsForIowa(
            AMES.lat,
            AMES.lng,
            25,
            controller.signal
          );
          setFields(collection);
          setDataSourceLabel('USDA NASS CSB 2024');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setFields(null);
          setError(
            'USDA parcel polygons unavailable offline; you can still click any point on the map to add point-based field coordinates.'
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

  // Set of selected parcelIds for fast styling
  const selectedParcelMap = useMemo(() => {
    const map = new Map<string, MyFarmFieldSlot>();
    for (const slot of selectedFields) {
      if (slot.parcelId) {
        map.set(slot.parcelId, slot);
      }
    }
    return map;
  }, [selectedFields]);

  const handleAddParcelFeature = (feature: FarmFeature) => {
    const farmCenter = getFeatureCenter(feature) || center;
    const props = feature.properties || {};
    const enriched = {
      ...feature,
      properties: {
        ...props,
        Field_ID: props.Field_ID || props.CSBID || props.OBJECTID,
        Crop_Name: props.Crop_Name || props.Crop || 'USDA Parcel',
        Acres: props.Acres || props.CSBACRES,
      },
      location: {
        lat: farmCenter.lat,
        lon: farmCenter.lng,
      },
    };

    const result = addOrSelectFieldFromMap(enriched);
    setMultiState(result.state);
    setError('');

    if (result.status === 'limit-reached') {
      setStatusNotice(
        `Maximum of ${MAX_MY_FARM_FIELDS} fields selected. Remove a field first to add another.`
      );
    } else if (result.status === 'already-selected') {
      setStatusNotice(`"${result.slot.fieldName}" is now set as your active field.`);
    } else {
      setStatusNotice(
        `Added "${result.slot.fieldName}" (${
          getSelectedMapFields(result.state).length
        }/${MAX_MY_FARM_FIELDS} selected).`
      );
    }

    if (onFarmSelect) {
      onFarmSelect(enriched);
    }
  };

  const handleAddQuickIowaParcel = () => {
    // Pick the first unselected parcel in filteredFields so repeated clicks add distinct parcels!
    const pool = filteredFields.length > 0 ? filteredFields : fields?.features ?? [];
    if (pool.length === 0) {
      setError('No USDA parcels loaded in range. Click "Add Point Field" to add current coordinates.');
      return;
    }

    const nextUnselected =
      pool.find((feat) => {
        const fc = getFeatureCenter(feat) || center;
        const pid = getStableParcelId(feat, fc.lat, fc.lng);
        return !selectedParcelMap.has(pid);
      }) ?? pool[0];

    handleAddParcelFeature(nextUnselected);
  };

  const handleAddPointLocation = (lat: number, lng: number, customLabel?: string) => {
    const pointFeature = {
      type: 'Feature' as const,
      properties: {
        Field_ID:
          customLabel ||
          `Point Field (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`,
      },
      geometry: null,
      location: {
        lat,
        lon: lng,
      },
    };

    const result = addOrSelectFieldFromMap(pointFeature);
    setMultiState(result.state);
    setError('');

    if (result.status === 'limit-reached') {
      setStatusNotice(
        `Maximum of ${MAX_MY_FARM_FIELDS} fields reached. Remove a field to add another.`
      );
    } else {
      setStatusNotice(
        `Added point field "${result.slot.fieldName}" (real farm boundary polygon unavailable at this point).`
      );
    }

    if (onFarmSelect) {
      onFarmSelect(pointFeature);
    }
  };

  const handleSetActiveField = (fieldId: string) => {
    const target = selectedFields.find((f) => f.fieldId === fieldId);
    if (!target) return;
    const next = saveMyFarmMultiFieldState({
      ...multiState,
      activeFieldId: fieldId,
    });
    setMultiState(next);
    if (target.latitude !== null && target.longitude !== null) {
      setCenter({ lat: target.latitude, lng: target.longitude });
    }
  };

  const handleRemoveField = (fieldId: string) => {
    const next = removeSelectedFieldSlot(fieldId);
    setMultiState(next);
    setStatusNotice('Removed field from My Fields.');
  };

  const handleFinishToDashboard = () => {
    if (onDoneSelection) {
      onDoneSelection();
      return;
    }
    if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;

    setSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({
        format: 'json',
        q: query,
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
      const result = results[0];

      if (!result) {
        throw new Error('Location not found. Try Ames, Iowa or click the map.');
      }

      const lat = Number(result.lat);
      const lng = Number(result.lon);

      setCenter({ lat, lng });
      setPinnedPoint({ lat, lng });
    } catch (err: any) {
      setError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setError('');
    setCenter({ lat, lng });
    setPinnedPoint({ lat, lng });
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
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCenter({ lat, lng });
        setPinnedPoint({ lat, lng });
        setSearching(false);
      },
      () => {
        setError('Unable to get GPS location. Search or click the map instead.');
        setSearching(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  function styleFeature(feature: any) {
    const fc = getFeatureCenter(feature) || center;
    const pid = getStableParcelId(feature, fc.lat, fc.lng);
    const matchedSlot = selectedParcelMap.get(pid);

    if (matchedSlot) {
      const isActive = matchedSlot.fieldId === multiState.activeFieldId;
      return isActive
        ? {
            color: '#b45309',
            weight: 3.5,
            fillColor: '#f59e0b',
            fillOpacity: 0.55,
          }
        : {
            color: '#0369a1',
            weight: 2.5,
            fillColor: '#38bdf8',
            fillOpacity: 0.45,
          };
    }

    return {
      color: '#15803d',
      weight: 1,
      fillColor: '#4ade80',
      fillOpacity: 0.3,
    };
  }

  function onEachFeature(feature: FarmFeature, layer: L.Layer) {
    const properties = feature.properties || {};
    const acres = Number(properties.CSBACRES ?? properties.Acres);
    const hectares = Number.isFinite(acres) && acres > 0
      ? `${(acres * 0.404686).toFixed(2)} ha`
      : 'Area N/A';

    const fc = getFeatureCenter(feature) || center;
    const pid = getStableParcelId(feature, fc.lat, fc.lng);
    const existingSlot = selectedParcelMap.get(pid);
    const parcelCode = properties.CSBID ?? properties.Field_ID ?? 'Parcel';

    const container = document.createElement('div');
    container.style.minWidth = '190px';

    const title = document.createElement('div');
    title.textContent = `USDA Parcel ${parcelCode}`;
    title.style.fontWeight = '700';
    title.style.fontSize = '14px';
    title.style.marginBottom = '4px';

    const meta = document.createElement('div');
    meta.textContent = `${hectares} · (${fc.lat.toFixed(4)}°, ${fc.lng.toFixed(4)}°)`;
    meta.style.fontSize = '12px';
    meta.style.color = '#4b5563';

    const button = document.createElement('button');
    button.textContent = existingSlot
      ? existingSlot.fieldId === multiState.activeFieldId
        ? 'Active in My Fields'
        : 'Set as Active Field'
      : `Add to My Fields (${selectedFields.length}/${MAX_MY_FARM_FIELDS})`;
    button.setAttribute('data-testid', 'leaflet-popup-select-farm-btn');
    button.style.width = '100%';
    button.style.padding = '8px 10px';
    button.style.marginTop = '10px';
    button.style.background = existingSlot ? '#0369a1' : '#15803d';
    button.style.color = 'white';
    button.style.borderRadius = '8px';
    button.style.fontWeight = '600';
    button.style.fontSize = '12px';
    button.style.cursor = 'pointer';

    button.onclick = () => {
      handleAddParcelFeature(feature);
    };

    container.appendChild(title);
    container.appendChild(meta);
    container.appendChild(button);

    if (existingSlot) {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove from My Fields';
      removeBtn.style.width = '100%';
      removeBtn.style.padding = '6px 10px';
      removeBtn.style.marginTop = '6px';
      removeBtn.style.background = '#fee2e2';
      removeBtn.style.color = '#b91c1c';
      removeBtn.style.borderRadius = '8px';
      removeBtn.style.fontWeight = '600';
      removeBtn.style.fontSize = '11px';
      removeBtn.style.cursor = 'pointer';
      removeBtn.onclick = () => {
        handleRemoveField(existingSlot.fieldId);
      };
      container.appendChild(removeBtn);
    }

    layer.bindPopup(container);
  }

  const pointSelectedFields = selectedFields.filter((f) => !f.geometry);

  return (
    <div
      data-testid="iowa-map-selection-page"
      className="relative w-full h-screen bg-gray-100 overflow-hidden font-sans"
    >
      {/* Top Compact Map Control & Multi-Field Selection Tray */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-5xl">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 border border-gray-100 flex flex-col gap-3">
          {/* Row 1: Title, Search, Locate, Done / Continue Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="text-green-800 font-bold text-base flex items-center gap-1.5 mr-1">
              <MapPin className="w-5 h-5 text-green-700" />
              <span>Select Farm Fields</span>
            </div>

            <form
              onSubmit={handleSearch}
              className="flex-1 min-w-[200px] bg-gray-50 rounded-xl px-3.5 py-2 flex items-center border border-gray-200"
            >
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <input
                type="text"
                data-testid="map-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search city, county or coordinates..."
                className="bg-transparent outline-none w-full text-xs text-gray-800"
              />
              <button
                type="submit"
                disabled={searching}
                className="text-green-700 font-semibold text-xs ml-2 cursor-pointer"
              >
                Search
              </button>
            </form>

            <button
              type="button"
              onClick={handleLocate}
              disabled={searching}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Locate</span>
            </button>

            {selectedFields.length > 0 ? (
              <button
                type="button"
                data-testid="map-done-view-dashboard-btn"
                onClick={handleFinishToDashboard}
                className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Done · View Dashboard ({selectedFields.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              (onContinueWithoutFarm || onBackToDashboard) && (
                <button
                  type="button"
                  data-testid="map-continue-without-farm-btn"
                  onClick={onContinueWithoutFarm ?? onBackToDashboard}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Continue Without Farm
                </button>
              )
            )}
          </div>

          {/* Row 2: Radius, Quick Add Parcel / Point Controls & Parcel Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-gray-500">Radius:</span>
              {RADII.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadius(value)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    radius === value
                      ? 'bg-green-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {value} km
                </button>
              ))}

              {(filteredFields.length > 0 ||
                (fields?.features?.length ?? 0) > 0) && (
                <button
                  type="button"
                  data-testid="map-select-iowa-parcel-btn"
                  disabled={selectedFields.length >= MAX_MY_FARM_FIELDS}
                  onClick={handleAddQuickIowaParcel}
                  className="px-3 py-1 rounded-lg font-semibold bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 flex items-center gap-1 cursor-pointer ml-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add USDA Parcel</span>
                </button>
              )}

              <button
                type="button"
                data-testid="map-confirm-location-btn"
                disabled={selectedFields.length >= MAX_MY_FARM_FIELDS}
                onClick={() =>
                  handleAddPointLocation(
                     (pinnedPoint ?? center).lat,
                    (pinnedPoint ?? center).lng
                  )
                }
                className="px-3 py-1 rounded-lg font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  Add Point ({(pinnedPoint ?? center).lat.toFixed(2)}°,{' '}
                  {(pinnedPoint ?? center).lng.toFixed(2)}°)
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span
                data-testid="map-selected-fields-counter"
                className="px-2.5 py-1 rounded-lg bg-green-50 text-green-900 border border-green-200 font-semibold"
              >
                Selected: {selectedFields.length} / {MAX_MY_FARM_FIELDS}
              </span>
              <span
                data-testid="map-farms-found-badge"
                className="text-gray-500 font-medium"
              >
                {loading || searching ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  `${filteredFields.length.toLocaleString()} parcels in view${
                    dataSourceLabel ? ` · ${dataSourceLabel}` : ''
                  }`
                )}
              </span>
            </div>
          </div>

          {/* Row 3: Selected Fields Chips (Active Switcher + Individual Remove) */}
          {selectedFields.length > 0 && (
            <div
              data-testid="map-selected-fields-tray"
              className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2"
            >
              <span className="text-[11px] font-semibold text-gray-500">
                My Fields:
              </span>
              {selectedFields.map((slot) => {
                const isActive = slot.fieldId === multiState.activeFieldId;
                return (
                  <div
                    key={slot.fieldId}
                    data-testid={`map-selected-chip-${slot.fieldId}`}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      isActive
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : 'bg-blue-50/70 border-blue-200 text-blue-900'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSetActiveField(slot.fieldId)}
                      className="flex items-center gap-1 cursor-pointer"
                      title="Click to make active field"
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          isActive ? 'text-amber-600' : 'text-blue-600'
                        }`}
                      />
                      <span>{slot.fieldName}</span>
                      {slot.areaHa !== null && slot.areaHa !== undefined && (
                        <span className="text-[10px] opacity-75">
                          ({slot.areaHa} ha)
                        </span>
                      )}
                      {!slot.geometry && (
                        <span className="text-[10px] opacity-75">
                          (Point)
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      data-testid={`map-remove-chip-${slot.fieldId}`}
                      onClick={() => handleRemoveField(slot.fieldId)}
                      title="Remove field"
                      className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {(statusNotice || error) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {statusNotice && (
                <span className="text-green-800 font-medium">{statusNotice}</span>
              )}
              {error && <span className="text-amber-800 font-medium">{error}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Leaflet Map */}
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

        <MapClickListener onMapClick={handleMapClick} />

        {/* Pinned map click marker */}
        {pinnedPoint && (
          <Marker
            position={[pinnedPoint.lat, pinnedPoint.lng]}
            icon={markerIcon}
          >
            <Popup>
              <div className="text-xs space-y-1.5">
                <p className="font-bold text-gray-900">
                  Selected Coordinates ({pinnedPoint.lat.toFixed(4)}°,{' '}
                  {pinnedPoint.lng.toFixed(4)}°)
                </p>
                <p className="text-gray-500">
                  Real parcel boundary polygons are unavailable outside USDA-mapped fields; saved as a verified coordinate point.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleAddPointLocation(pinnedPoint.lat, pinnedPoint.lng)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-green-700 text-white font-semibold cursor-pointer"
                >
                  Add Point to My Fields
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Markers for point-based selected fields */}
        {pointSelectedFields.map((slot) =>
          slot.latitude !== null && slot.longitude !== null ? (
            <Marker
              key={slot.fieldId}
              position={[slot.latitude, slot.longitude]}
              icon={markerIcon}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-gray-900">{slot.fieldName}</p>
                  <p className="text-gray-600">
                    {slot.latitude.toFixed(4)}°, {slot.longitude.toFixed(4)}°
                  </p>
                  <p className="text-amber-700">
                    Point selection (parcel boundary unavailable)
                  </p>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}

        <Circle
          center={[center.lat, center.lng]}
          radius={radius * 1000}
          pathOptions={{
            color: '#16a34a',
            weight: 1.5,
            fillOpacity: 0.02,
          }}
        />

        {fields && (
          <GeoJSON
            key={`${center.lat}-${center.lng}-${radius}-${fields.features.length}-${multiState.activeFieldId}-${selectedFields.length}`}
            data={filteredGeoJSON as any}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
