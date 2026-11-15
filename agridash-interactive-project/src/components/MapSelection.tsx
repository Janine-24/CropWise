
import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Circle,
  Marker,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Search,
  Navigation,
  MapPin,
  Loader2,
} from "lucide-react";
// @ts-ignore
import "leaflet/dist/leaflet.css";

type Location = {
  lat: number;
  lng: number;
};

type FarmFeature = {
  type: "Feature";
  properties: Record<string, any>;
  geometry: any;
};

type FarmCollection = {
  type: "FeatureCollection";
  features: FarmFeature[];
};

interface MapSelectionProps {
  onFarmSelect: (farm: any) => void;
}

const AMES: Location = {
  lat: 42.0308,
  lng: -93.6319,
};

const RADII = [10, 25, 50];

// Approximate Iowa bounds for preliminary validation.
// These bounds are NOT an exact state boundary.
function isNearIowa(lat: number, lng: number) {
  return (
    lat >= 40.3 &&
    lat <= 43.6 &&
    lng >= -96.7 &&
    lng <= -90.0
  );
}

const markerIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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

  const vertexInside = points.some(([lng, lat]) =>
    distanceKm(
      center.lat,
      center.lng,
      lat,
      lng
    ) <= radius
  );

  if (vertexInside) return true;

  const farmCenter = getFeatureCenter(feature);

  if (!farmCenter) return false;

  return (
    distanceKm(
      center.lat,
      center.lng,
      farmCenter.lat,
      farmCenter.lng
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

export default function MapSelection({
  onFarmSelect,
}: MapSelectionProps) {
  const [search, setSearch] = useState("");
  const [center, setCenter] = useState<Location>(AMES);
  const [radius, setRadius] = useState(25);

  const [fields, setFields] = useState<FarmCollection | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Load the same GeoJSON used by AmesFarmMap.
  useEffect(() => {
    const controller = new AbortController();

    async function loadFields() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/data/ames_fields.geojson",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Farm data loading failed: ${response.status}`
          );
        }

        const data = await response.json();

        if (
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          throw new Error("Invalid GeoJSON file.");
        }

        setFields(data);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Cannot load farm data.");
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

  // Filter locally by selected location.
  const filteredFields = useMemo(() => {
    if (!fields) return [];

    return fields.features.filter((feature) =>
      isWithinRadius(feature, center, radius)
    );
  }, [fields, center.lat, center.lng, radius]);

  const filteredGeoJSON = useMemo<FarmCollection>(
    () => ({
      type: "FeatureCollection",
      features: filteredFields,
    }),
    [filteredFields]
  );

  const totalHectares = useMemo(() => {
    return filteredFields.reduce((total, feature) => {
      const acres = Number(
        feature.properties?.CSBACRES || 0
      );

      return total + acres * 0.404686;
    }, 0);
  }, [filteredFields]);

  // Search only within Iowa, USA.
  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();

    const query = search.trim();

    if (!query) return;

    setSearching(true);
    setError("");

    try {
      const params = new URLSearchParams({
        format: "json",
        q: `${query}, Iowa, USA`,
        countrycodes: "us",
        limit: "5",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Location search unavailable.");
      }

      const results = await response.json();

      const result = results.find((item: any) => {
        const state = item.address?.state;
        return state === "Iowa";
      });

      if (!result) {
        throw new Error(
          "Location not found in Iowa. Try Ames or Des Moines."
        );
      }

      const lat = Number(result.lat);
      const lng = Number(result.lon);

      setCenter({ lat, lng });
      setSearched(true);
    } catch (err: any) {
      setError(err.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(lat: number, lng: number) {
    if (!isNearIowa(lat, lng)) {
      setError(
        "Please select a location within Iowa, USA."
      );
      return;
    }

    setError("");
    setCenter({ lat, lng });
    setSearched(true);
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setError("Browser geolocation is unavailable.");
      return;
    }

    setSearching(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        selectLocation(
          position.coords.latitude,
          position.coords.longitude
        );
        setSearching(false);
      },
      () => {
        setError(
          "Unable to get GPS location. Search an Iowa city instead."
        );
        setSearching(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  function onEachFeature(
    feature: FarmFeature,
    layer: L.Layer
  ) {
    const properties = feature.properties || {};

    const acres = Number(properties.CSBACRES);
    const hectares = Number.isFinite(acres)
      ? (acres * 0.404686).toFixed(2)
      : "N/A";

    const container = document.createElement("div");
    container.style.minWidth = "210px";

    const title = document.createElement("h3");
    title.textContent = "Agricultural Field";
    title.style.fontWeight = "bold";
    title.style.fontSize = "16px";
    title.style.marginBottom = "8px";

    const id = document.createElement("p");
    id.textContent =
      `Field ID: ${properties.CSBID ?? "N/A"}`;

    const area = document.createElement("p");
    area.textContent = `Area: ${hectares} ha`;

    const button = document.createElement("button");
    button.textContent = "Select this Farm";
    button.style.width = "100%";
    button.style.padding = "10px";
    button.style.marginTop = "12px";
    button.style.background = "#16a34a";
    button.style.color = "white";
    button.style.borderRadius = "10px";
    button.style.fontWeight = "bold";
    button.style.cursor = "pointer";

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
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden font-sans">

      {/* Search Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-[92%] max-w-4xl">

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-gray-100">

          <div className="flex flex-col md:flex-row items-center gap-3">

            <div className="text-green-700 font-extrabold text-lg flex items-center gap-2 whitespace-nowrap">
              <MapPin className="w-5 h-5" />
              Select Farm Location
            </div>

            <form
              onSubmit={handleSearch}
              className="flex-1 w-full bg-gray-50 rounded-xl px-4 py-2.5 flex items-center border border-gray-200"
            >
              <Search className="w-5 h-5 text-gray-400 mr-2" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search Iowa city, ZIP code or address..."
                className="bg-transparent outline-none w-full text-sm"
              />

              <button
                type="submit"
                disabled={searching}
                className="text-green-700 font-bold text-sm ml-2"
              >
                Search
              </button>
            </form>

            <button
              onClick={handleLocate}
              disabled={searching}
              className="bg-green-100 text-green-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-green-200"
            >
              <Navigation className="w-4 h-4" />
              Auto Locate
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Search Radius:
              </span>

              {RADII.map((value) => (
                <button
                  key={value}
                  onClick={() => setRadius(value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                    radius === value
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {value} km
                </button>
              ))}
            </div>

            <div className="text-xs font-bold text-green-700">
              {loading || searching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                <>
                  {filteredFields.length.toLocaleString()}
                  {" "}Farms Found
                  {" · "}
                  {totalHectares.toFixed(1)} ha
                </>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600">
              {error}
            </p>
          )}

          {!loading && !error && filteredFields.length === 0 && (
            <p className="mt-3 text-xs text-amber-700">
              No fields in the currently loaded Ames-area dataset.
              Other Iowa locations require additional GeoJSON data.
            </p>
          )}
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

        <MapController
          center={center}
          radius={radius}
        />

        <MapClickListener
          onMapClick={selectLocation}
        />

        {searched && (
          <Marker
            position={[center.lat, center.lng]}
            icon={markerIcon}
          />
        )}

        <Circle
          center={[center.lat, center.lng]}
          radius={radius * 1000}
          pathOptions={{
            color: "#16a34a",
            weight: 2,
            fillOpacity: 0.025,
          }}
        />

        {fields && (
          <GeoJSON
            key={`${center.lat}-${center.lng}-${radius}`}
            data={filteredGeoJSON as any}
            style={{
              color: "#15803d",
              weight: 1,
              fillColor: "#4ade80",
              fillOpacity: 0.35,
            }}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
