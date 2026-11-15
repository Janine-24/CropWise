import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Plus } from 'lucide-react';
// @ts-ignore
import 'leaflet/dist/leaflet.css';
import { MyFarmFieldSlot } from '../services/riskAndFarmStore';

const previewMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const DEFAULT_MAP_CENTER: [number, number] = [42.0308, -93.6319];

function extractGeometryLatLngs(geometry: any): [number, number][] {
  if (!geometry) return [];
  const rawPts =
    geometry.type === 'Polygon'
      ? geometry.coordinates.flat()
      : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat(2)
      : [];

  const coords: [number, number][] = [];
  for (const pt of rawPts) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords.push([lat, lng]);
      }
    }
  }
  return coords;
}

function MultiFieldBoundsFitter({
  selectedFields,
  activeFieldId,
}: {
  selectedFields: MyFarmFieldSlot[];
  activeFieldId: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedFields.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, 11);
      return;
    }

    const allPoints: [number, number][] = [];
    for (const slot of selectedFields) {
      const polyPts = extractGeometryLatLngs(slot.geometry);
      if (polyPts.length > 0) {
        allPoints.push(...polyPts);
      } else if (slot.latitude !== null && slot.longitude !== null) {
        allPoints.push([slot.latitude, slot.longitude]);
      }
    }

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 14);
      return;
    }

    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [map, selectedFields, activeFieldId]);

  return null;
}

export interface FarmMapPreviewProps {
  selectedFields: MyFarmFieldSlot[];
  activeFieldId: string;
  onSelectField?: (fieldId: string) => void;
  onOpenFullMap?: () => void;
}

const FarmMapPreview: React.FC<FarmMapPreviewProps> = ({
  selectedFields,
  activeFieldId,
  onSelectField,
  onOpenFullMap,
}) => {
  const activeField =
    selectedFields.find((f) => f.fieldId === activeFieldId) ??
    selectedFields[0] ??
    null;

  const initialCenter: [number, number] =
    activeField &&
    activeField.latitude !== null &&
    activeField.longitude !== null
      ? [activeField.latitude, activeField.longitude]
      : DEFAULT_MAP_CENTER;

  return (
    <div
      data-testid="dashboard-farm-map-preview"
      className="relative w-full h-full rounded-3xl overflow-hidden"
    >
      <MapContainer
        center={initialCenter}
        zoom={selectedFields.length > 0 ? 13 : 11}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ZoomControl position="bottomright" />

        <MultiFieldBoundsFitter
          selectedFields={selectedFields}
          activeFieldId={activeFieldId}
        />

        {selectedFields.map((slot) => {
          const isActive = slot.fieldId === activeFieldId;
          const hasPoly =
            (slot.geometry?.type === 'Polygon' ||
              slot.geometry?.type === 'MultiPolygon') &&
            Array.isArray(slot.geometry?.coordinates);

          return (
            <React.Fragment key={slot.fieldId}>
              {hasPoly && (
                <GeoJSON
                  key={`poly-${slot.fieldId}-${isActive ? 'active' : 'idle'}`}
                  data={
                    {
                      type: 'Feature',
                      properties: { fieldId: slot.fieldId, name: slot.fieldName },
                      geometry: slot.geometry,
                    } as any
                  }
                  style={{
                    color: isActive ? '#b45309' : '#15803d',
                    weight: isActive ? 3.5 : 2,
                    fillColor: isActive ? '#f59e0b' : '#22c55e',
                    fillOpacity: isActive ? 0.5 : 0.3,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (onSelectField) onSelectField(slot.fieldId);
                    },
                  }}
                />
              )}

              {slot.latitude !== null && slot.longitude !== null && (
                <Marker
                  position={[slot.latitude, slot.longitude]}
                  icon={previewMarkerIcon}
                  eventHandlers={{
                    click: () => {
                      if (onSelectField) onSelectField(slot.fieldId);
                    },
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-gray-900">{slot.fieldName}</p>
                      <p className="text-gray-600">
                        {slot.latitude.toFixed(4)}°, {slot.longitude.toFixed(4)}°
                      </p>
                      {slot.areaHa !== null && slot.areaHa !== undefined ? (
                        <p className="text-green-700 font-medium">
                          USDA Area: {slot.areaHa} ha
                        </p>
                      ) : (
                        <p className="text-gray-500">
                          Point coordinates (parcel boundary unavailable)
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Top-Right Action Button */}
      <div className="absolute top-4 right-4 z-[400]">
        {onOpenFullMap && (
          <button
            type="button"
            data-testid="dashboard-open-full-map-btn"
            onClick={onOpenFullMap}
            className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {selectedFields.length > 0 ? 'Add / Edit Fields' : 'Select Your Farm'}
            </span>
          </button>
        )}
      </div>

      {/* Bottom-Left Compact Active Field Pill */}
      <div
        data-testid="dashboard-map-status-pill"
        className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-sm border border-gray-200 text-xs flex items-center gap-2 max-w-[75%]"
      >
        <MapPin className="w-4 h-4 text-green-700 flex-shrink-0" />
        <span className="font-medium text-gray-800 truncate">
          {activeField &&
          activeField.latitude !== null &&
          activeField.longitude !== null
            ? `Active: ${activeField.fieldName} (${activeField.latitude.toFixed(
                4
              )}°, ${activeField.longitude.toFixed(4)}°) · ${
                selectedFields.length
              } field${selectedFields.length === 1 ? '' : 's'} selected`
            : 'No farm selected — Click "Select Your Farm" to choose parcels on map'}
        </span>
      </div>
    </div>
  );
};

export default FarmMapPreview;
