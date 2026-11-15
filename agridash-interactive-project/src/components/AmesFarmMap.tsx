
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { fetchUsdaArcGisFieldsForIowa } from "./MapSelection";
// @ts-ignore

import "leaflet/dist/leaflet.css";

type Location = {
  lat: number;
  lng: number;
};

interface AmesFarmMapProps {
  center?: Location;
  onFarmSelect?: (farm: any) => void;
}

const AMES = {
  lat: 42.0308,
  lng: -93.6319,
};

const RADII = [10, 25, 50];

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function getPoints(geometry: any): number[][] {
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return geometry.coordinates.flat();
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat(2);
  }

  return [];
}

function isWithinRadius(
  feature: any,
  center: Location,
  radius: number
) {
  const points = getPoints(feature.geometry);

  return points.some(([lng, lat]) =>
    distanceKm(
      center.lat,
      center.lng,
      lat,
      lng
    ) <= radius
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
    map.setView(
      [center.lat, center.lng],
      radius <= 10 ? 12 : 10
    );
  }, [map, center.lat, center.lng, radius]);

  return null;
}

export default function AmesFarmMap({
  center = AMES,
  onFarmSelect,
}: AmesFarmMapProps) {
  const [fields, setFields] = useState<any>(null);
  const [radius, setRadius] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadFields() {
      try {
        setLoading(true);
        setError("");

        let loadedLocal = false;
        try {
          const response = await fetch(
            "/data/ames_fields.geojson",
            { signal: controller.signal }
          );
          const contentType = response.headers.get("content-type") || "";
          if (response.ok && contentType.includes("json")) {
            const data = await response.json();
            if (
              data?.type === "FeatureCollection" &&
              Array.isArray(data.features)
            ) {
              setFields(data);
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
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setFields(null);
          setError(
            "Local /data/ames_fields.geojson is unavailable and live USDA ArcGIS service could not be reached."
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

    return fields.features.filter((feature: any) =>
      isWithinRadius(feature, center, radius)
    );
  }, [fields, center.lat, center.lng, radius]);

  const filteredGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection",
      features: filteredFields,
    }),
    [filteredFields]
  );

  const totalHectares = useMemo(() => {
    return filteredFields.reduce(
      (total: number, feature: any) => {
        const acres = Number(
          feature.properties?.CSBACRES || 0
        );

        return total + acres * 0.404686;
      },
      0
    );
  }, [filteredFields]);

  function onEachFeature(feature: any, layer: L.Layer) {
    const p = feature.properties || {};

    const acres = Number(p.CSBACRES);
    const hectares = Number.isFinite(acres)
      ? (acres * 0.404686).toFixed(2)
      : "N/A";

    const container = document.createElement("div");
    container.style.minWidth = "190px";

    const heading = document.createElement("h3");
    heading.textContent = "Agricultural Field";
    heading.style.fontWeight = "bold";
    heading.style.fontSize = "16px";
    container.appendChild(heading);

    const details = document.createElement("div");
    details.textContent =
      `Field ID: ${p.CSBID ?? "N/A"} | ` +
      `Area: ${hectares} ha`;
    container.appendChild(details);

    const button = document.createElement("button");
    button.textContent = "Select this Farm";
    button.style.background = "#16a34a";
    button.style.color = "white";
    button.style.padding = "10px 14px";
    button.style.borderRadius = "10px";
    button.style.marginTop = "12px";
    button.style.width = "100%";
    button.style.cursor = "pointer";

    button.onclick = () => {
      const bounds = (layer as L.Polygon).getBounds();
      const farmCenter = bounds.getCenter();

      onFarmSelect?.({
        ...feature,
        location: {
          lat: farmCenter.lat,
          lon: farmCenter.lng,
        },
      });
    };

    container.appendChild(button);

    layer.bindPopup(container);
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <h2 className="text-xl font-bold">
          Agricultural Field Selection
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          USDA Crop Sequence Boundaries
        </p>

        <div className="flex gap-3 mt-4">
          {RADII.map((value) => (
            <button
              key={value}
              onClick={() => setRadius(value)}
              className={`px-4 py-2 rounded-full ${
                radius === value
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {value} km
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm">
          {loading && "Loading agricultural fields..."}

          {error && (
            <p className="text-red-600">{error}</p>
          )}

          {!loading && !error && (
            <>
              <p>
                <b>{filteredFields.length.toLocaleString()}</b>
                {" "}Fields Found
              </p>

              <p>
                <b>{totalHectares.toFixed(2)}</b>
                {" "}Total Hectares
              </p>
            </>
          )}
        </div>
      </div>

      <div className="h-[600px] rounded-2xl overflow-hidden">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            center={center}
            radius={radius}
          />

          <Circle
            center={[center.lat, center.lng]}
            radius={radius * 1000}
            pathOptions={{
              color: "#16a34a",
              weight: 2,
              fillOpacity: 0.03,
            }}
          />

          <GeoJSON
            key={`${center.lat}-${center.lng}-${radius}`}
            data={filteredGeoJSON as any}
            style={{
              color: "#15803d",
              weight: 1,
              fillColor: "#4ade80",
              fillOpacity: 0.3,
            }}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Current field dataset covers the Ames area only.
        Other Iowa locations require additional field data.
      </p>
    </div>
  );
}
