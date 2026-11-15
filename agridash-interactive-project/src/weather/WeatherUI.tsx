import React, { useState } from "react";
import {
  CloudSun,
  CloudRain,
  Wind,
  Droplets,
  RefreshCw,
  MapPin,
  AlertCircle,
  CalendarDays,
  Clock,
  Globe,
} from "lucide-react";

import {
  Day,
  HourlyForecastPoint,
  Place,
  PLACES,
  useWeather,
  isLikelyUSCoordinate,
} from "./useWeather";
import { getSharedFarmLocationState } from "../data/decisionPlannerData";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function display(
  value: number | null | undefined,
  suffix = ""
) {
  return value == null ? "—" : `${value}${suffix}`;
}

function WeatherIcon({
  description,
  size = 32,
}: {
  description: string;
  size?: number;
}) {
  const rainy = /rain|storm|snow|shower|drizzle|thunder/i.test(description);

  return rainy ? (
    <CloudRain size={size} className="text-blue-500" />
  ) : (
    <CloudSun size={size} className="text-amber-500" />
  );
}

export function PlaceSelect({
  place,
  onChange,
}: {
  place: Place;
  onChange: (place: Place) => void;
}) {
  const isPreset = PLACES.some(
    (item) =>
      Math.abs(item.lat - place.lat) < 0.001 &&
      Math.abs(item.lon - place.lon) < 0.001
  );

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <MapPin size={17} className="text-green-700" />

      <select
        data-testid="weather-place-select"
        value={isPreset ? place.name : "__custom__"}
        onChange={(event) => {
          const selected = PLACES.find(
            (item) => item.name === event.target.value
          );
          if (selected) onChange(selected);
        }}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 outline-none focus:ring-2 focus:ring-green-200 cursor-pointer"
      >
        {!isPreset && (
          <option value="__custom__">
            {place.name} ({place.lat.toFixed(2)}°, {place.lon.toFixed(2)}°)
          </option>
        )}
        {PLACES.map((item) => (
          <option key={item.name} value={item.name}>
            {item.name} — {item.region ?? "USA"}
          </option>
        ))}
      </select>

      <span className="text-xs text-gray-500 font-medium">
        {place.region ??
          `${place.lat.toFixed(3)}°, ${place.lon.toFixed(3)}°`}
      </span>
    </label>
  );
}

export function WeatherPanel({
  place,
  onOpen,
}: {
  place: Place;
  onOpen: () => void;
}) {
  const { weather, loading, error, refresh } = useWeather(place);

  const today = weather?.days[0];
  const windUnit = today?.windUnit ?? "km/h";

  return (
    <div
      data-testid="weather-panel-card"
      className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold tracking-wider uppercase text-green-700">
              Today&apos;s Forecast
            </p>
            {weather && (
              <span
                data-testid="weather-panel-provider-badge"
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  weather.providerId === "noaa"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {weather.providerId === "noaa" ? "NOAA NWS" : "Open-Meteo"}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">
            {place.name}
            {place.region ? `, ${place.region.split(",")[0]}` : ""}
          </h3>
          <p className="text-[11px] text-gray-400">
            {place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°
            {weather?.timezone ? ` · ${weather.timezone}` : ""}
          </p>
        </div>

        <button
          type="button"
          data-testid="weather-panel-refresh-btn"
          onClick={refresh}
          title="Refresh weather"
          className="rounded-full bg-gray-50 p-2 hover:bg-green-50 cursor-pointer"
        >
          <RefreshCw
            size={17}
            className={`text-green-700 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {today ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div
                data-testid="weather-panel-today-high"
                className="text-4xl font-semibold text-gray-900"
              >
                {display(today.high, "°C")}
              </div>

              <p className="text-xs text-gray-500 mt-2">Forecast high</p>

              <p className="text-sm text-gray-600">
                Low {display(today.low, "°C")}
              </p>
            </div>

            <div className="flex flex-col items-center max-w-32 text-center">
              <WeatherIcon description={today.description} size={43} />
              <p className="text-xs text-gray-600 mt-2">{today.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-gray-100 mt-5 pt-4 text-center">
            <div>
              <Droplets size={18} className="mx-auto text-blue-500" />
              <p className="text-sm font-semibold mt-1">
                {display(today.humidity, "%")}
              </p>
              <p className="text-xs text-gray-400">Humidity</p>
            </div>

            <div>
              <CloudRain size={18} className="mx-auto text-blue-500" />
              <p className="text-sm font-semibold mt-1">
                {display(today.rain, "%")}
              </p>
              <p className="text-xs text-gray-400">
                Rain Prob.
                {weather?.supportsRainfallAmount && today.rainfallMm !== null
                  ? ` (${today.rainfallMm}mm)`
                  : ""}
              </p>
            </div>

            <div>
              <Wind size={18} className="mx-auto text-gray-500" />
              <p className="text-sm font-semibold mt-1">
                {display(today.wind, ` ${windUnit}`)}
              </p>
              <p className="text-xs text-gray-400">Wind</p>
            </div>
          </div>
        </>
      ) : (
        <div className="py-6 text-sm text-gray-500">
          {loading ? (
            <span>Loading live forecast...</span>
          ) : (
            <div className="flex flex-col gap-2">
              <span>Weather forecast unavailable.</span>
              <button
                type="button"
                onClick={refresh}
                className="self-start px-3 py-1 rounded-lg bg-green-800 text-white text-xs font-semibold hover:bg-green-700 cursor-pointer"
              >
                Retry Forecast
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          data-testid="weather-panel-error"
          className="flex items-start justify-between gap-2 text-xs text-amber-700 mt-3 bg-amber-50 p-2.5 rounded-xl border border-amber-200"
        >
          <div className="flex gap-1.5">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="text-amber-900 font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <button
        type="button"
        data-testid="weather-panel-open-page-btn"
        onClick={onOpen}
        className="w-full text-left border-t border-gray-100 mt-5 pt-4 text-sm font-semibold text-green-700 hover:text-green-900 cursor-pointer"
      >
        View Hourly &amp; Next 7 Days →
      </button>

      <p className="text-[11px] text-gray-400 mt-2.5">
        {weather ? (
          <>
            {weather.source} · Updated{" "}
            {new Date(weather.updatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </>
        ) : (
          "Waiting for forecast provider..."
        )}
      </p>
    </div>
  );
}

function DayCard({
  day,
  supportsRainfallAmount,
}: {
  day: Day;
  supportsRainfallAmount: boolean;
}) {
  return (
    <div
      data-testid={`weather-day-card-${day.date}`}
      className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={16} className="text-green-700" />
        <p className="font-semibold text-gray-800 text-sm">
          {formatDate(day.date)}
        </p>
      </div>

      <WeatherIcon description={day.description} size={34} />

      <p className="text-xs text-gray-500 mt-2.5 min-h-8">
        {day.description}
      </p>

      <p className="text-xl font-semibold text-gray-900 mt-2">
        {display(day.high, "°C")}
      </p>

      <p className="text-xs text-gray-400">Low {display(day.low, "°C")}</p>

      <div className="border-t border-gray-100 mt-3 pt-3 space-y-2 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Rain Probability</span>
          <b>{display(day.rain, "%")}</b>
        </div>

        <div className="flex justify-between">
          <span>Rainfall Amount</span>
          <b>
            {supportsRainfallAmount
              ? display(day.rainfallMm, " mm")
              : "N/A (NOAA)"}
          </b>
        </div>

        <div className="flex justify-between">
          <span>Humidity</span>
          <b>{display(day.humidity, "%")}</b>
        </div>

        <div className="flex justify-between">
          <span>Wind</span>
          <b>{display(day.wind, ` ${day.windUnit || "km/h"}`)}</b>
        </div>
      </div>
    </div>
  );
}

function HourlyStrip({
  hourly,
  supportsRainfallAmount,
  timezone,
}: {
  hourly: HourlyForecastPoint[];
  supportsRainfallAmount: boolean;
  timezone: string;
}) {
  if (!hourly.length) return null;

  return (
    <section
      data-testid="weather-hourly-section"
      className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-green-700" />
          <h2 className="text-base font-semibold text-gray-900">
            Hourly Forecast (Next 12 Hours)
          </h2>
        </div>
        <span className="text-xs text-gray-500">
          Local Timezone: <b>{timezone}</b>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-2.5">
        {hourly.slice(0, 12).map((pt, idx) => (
          <div
            key={`${pt.timeIso}-${idx}`}
            className="rounded-2xl bg-gray-50 border border-gray-100 p-3 flex flex-col items-center text-center justify-between gap-1.5"
          >
            <span className="text-[11px] font-semibold text-gray-700">
              {pt.hourLabel}
            </span>
            <WeatherIcon description={pt.description} size={22} />
            <span className="text-sm font-bold text-gray-900">
              {display(pt.tempC, "°C")}
            </span>
            <span className="text-[10px] text-blue-700 font-medium">
              {display(pt.rainProbability, "%")} prob
            </span>
            {supportsRainfallAmount && pt.rainfallMm !== null && (
              <span className="text-[10px] text-emerald-700 font-medium">
                {pt.rainfallMm} mm
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              {display(pt.windKmh, " km/h")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WeatherPage({
  place,
  onChange,
}: {
  place: Place;
  onChange: (place: Place) => void;
}) {
  const { weather, loading, error, refresh } = useWeather(place);
  const [customLat, setCustomLat] = useState(String(place.lat));
  const [customLon, setCustomLon] = useState(String(place.lon));
  const [customName, setCustomName] = useState(place.name);
  const [coordError, setCoordError] = useState<string | null>(null);

  const today = weather?.days[0];
  const sharedMyFarmLoc = getSharedFarmLocationState().verifiedLocation;

  const handleSelectQuickPlace = (target: Place) => {
    setCoordError(null);
    setCustomLat(String(target.lat));
    setCustomLon(String(target.lon));
    setCustomName(target.name);
    onChange(target);
  };

  const handleApplyCustomPlace = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = Number(customLat.trim());
    const lonNum = Number(customLon.trim());
    if (
      !Number.isFinite(latNum) ||
      latNum < -90 ||
      latNum > 90 ||
      !Number.isFinite(lonNum) ||
      lonNum < -180 ||
      lonNum > 180
    ) {
      setCoordError(
        "Enter valid latitude (-90 to 90) and longitude (-180 to 180)."
      );
      return;
    }
    setCoordError(null);
    const label = customName.trim() || `Custom (${latNum.toFixed(2)}°, ${lonNum.toFixed(2)}°)`;
    onChange({
      name: label,
      region: isLikelyUSCoordinate(latNum, lonNum) ? "US Coordinate" : "Global Coordinate",
      lat: Number(latNum.toFixed(4)),
      lon: Number(lonNum.toFixed(4)),
      isUS: isLikelyUSCoordinate(latNum, lonNum),
    });
  };

  const quickBenchmarks: Place[] = [
    PLACES[0], // Ames, Iowa, USA
    PLACES[1], // Putrajaya, Malaysia
    PLACES[2], // London, United Kingdom
  ];

  return (
    <main
      data-testid="weather-forecast-page"
      className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar ml-5 mr-5 pb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-green-700 uppercase">
            WEATHER &amp; AGRO-METEOROLOGY
          </p>

          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mt-1">
            Global &amp; US Farm Weather Forecast
          </h1>

          <p className="text-xs md:text-sm text-gray-500 mt-1">
            NOAA National Weather Service for US locations with automatic Open-Meteo Global fallback
          </p>
        </div>

        <PlaceSelect place={place} onChange={handleSelectQuickPlace} />
      </div>

      {/* Quick Global Benchmark Switcher + My Farm Sync + Custom Coordinate Bar */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Globe size={15} className="text-green-700" />
              <span>Verified Benchmark Locations:</span>
            </span>
            {quickBenchmarks.map((bm) => {
              const active =
                Math.abs(bm.lat - place.lat) < 0.01 &&
                Math.abs(bm.lon - place.lon) < 0.01;
              return (
                <button
                  key={bm.name}
                  type="button"
                  data-testid={`weather-benchmark-${bm.name.toLowerCase()}`}
                  onClick={() => handleSelectQuickPlace(bm)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-green-800 text-white shadow-sm"
                      : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-green-50"
                  }`}
                >
                  {bm.name}, {bm.region}
                </button>
              );
            })}

            {sharedMyFarmLoc && (
              <button
                type="button"
                data-testid="weather-use-my-farm-coords-btn"
                onClick={() =>
                  handleSelectQuickPlace({
                    name: sharedMyFarmLoc.label.split("—")[0].trim(),
                    region: "My Farm Verified Location",
                    lat: sharedMyFarmLoc.latitude,
                    lon: sharedMyFarmLoc.longitude,
                    isUS: isLikelyUSCoordinate(
                      sharedMyFarmLoc.latitude,
                      sharedMyFarmLoc.longitude
                    ),
                  })
                }
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
              >
                Use My Farm ({sharedMyFarmLoc.latitude.toFixed(2)}°,{" "}
                {sharedMyFarmLoc.longitude.toFixed(2)}°)
              </button>
            )}
          </div>
        </div>

        <form
          onSubmit={handleApplyCustomPlace}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end pt-2 border-t border-gray-100 text-xs"
        >
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Location Label
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Putrajaya"
              className="w-full px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-800"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Latitude (-90 to 90)
            </label>
            <input
              type="text"
              data-testid="weather-custom-lat-input"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              placeholder="e.g. 2.9264"
              className="w-full px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-800"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Longitude (-180 to 180)
            </label>
            <input
              type="text"
              data-testid="weather-custom-lon-input"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              placeholder="e.g. 101.6964"
              className="w-full px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-800"
            />
          </div>
          <button
            type="submit"
            data-testid="weather-apply-coords-btn"
            className="px-4 py-1.5 rounded-xl bg-green-800 text-white font-semibold hover:bg-green-700 cursor-pointer h-[32px]"
          >
            Load Forecast
          </button>
        </form>

        {coordError && (
          <p className="text-xs text-red-600 font-medium">{coordError}</p>
        )}
      </div>

      {/* Hero Today Card */}
      <div className="rounded-3xl bg-gradient-to-br from-green-900 to-emerald-700 p-6 md:p-7 text-white mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-green-100">
                Today&apos;s Forecast · <b>{place.name}</b> ({place.lat.toFixed(4)}°,{" "}
                {place.lon.toFixed(4)}°)
              </p>
              {weather && (
                <span
                  data-testid="weather-page-provider-badge"
                  className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-semibold border border-white/20"
                >
                  Provider: {weather.source}
                </span>
              )}
            </div>

            <h2
              data-testid="weather-page-today-high"
              className="text-5xl font-semibold mt-4"
            >
              {display(today?.high, "°C")}
            </h2>

            <p className="text-sm text-green-100 mt-2">
              Low {display(today?.low, "°C")} · Timezone:{" "}
              <b>{weather?.timezone ?? "Resolving..."}</b>
            </p>

            <p
              data-testid="weather-page-today-description"
              className="text-sm mt-2 font-medium"
            >
              {today?.description ??
                (loading ? "Loading live weather forecast..." : "Forecast unavailable")}
            </p>

            {weather?.fallbackReason && (
              <p
                data-testid="weather-fallback-notice"
                className="text-xs text-emerald-100/90 mt-2 bg-black/20 px-3 py-1.5 rounded-xl inline-block"
              >
                {weather.fallbackReason}
              </p>
            )}
          </div>

          <CloudSun size={68} className="text-amber-200" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/20">
          <div>
            <CloudRain size={19} />
            <p className="text-xs text-green-100 mt-1.5">Rain Probability</p>
            <p className="font-semibold mt-0.5">{display(today?.rain, "%")}</p>
          </div>

          <div>
            <CloudRain size={19} />
            <p className="text-xs text-green-100 mt-1.5">
              Daily Rainfall Amount
            </p>
            <p className="font-semibold mt-0.5">
              {weather?.supportsRainfallAmount
                ? display(today?.rainfallMm, " mm")
                : "Not provided by NOAA"}
            </p>
          </div>

          <div>
            <Droplets size={19} />
            <p className="text-xs text-green-100 mt-1.5">Humidity</p>
            <p className="font-semibold mt-0.5">
              {display(today?.humidity, "%")}
            </p>
          </div>

          <div>
            <Wind size={19} />
            <p className="text-xs text-green-100 mt-1.5">Wind Speed</p>
            <p className="font-semibold mt-0.5">
              {display(today?.wind, ` ${today?.windUnit || "km/h"}`)}
            </p>
          </div>
        </div>
      </div>

      {/* Hourly Forecast Strip */}
      {weather && weather.hourly && weather.hourly.length > 0 && (
        <HourlyStrip
          hourly={weather.hourly}
          supportsRainfallAmount={weather.supportsRainfallAmount}
          timezone={weather.timezone}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          7-Day Outlook ({place.name})
        </h2>

        <button
          type="button"
          data-testid="weather-page-refresh-btn"
          onClick={refresh}
          className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50 border border-gray-200 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh Forecast
        </button>
      </div>

      {error && (
        <div
          data-testid="weather-page-error"
          className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center justify-between gap-3"
        >
          <span>
            {error}
            {weather ? " — Showing cached forecast." : ""}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-1 rounded-xl bg-amber-800 text-white text-xs font-semibold cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {!weather && (
        <div className="rounded-2xl bg-white p-8 text-gray-500 border border-gray-100">
          {loading
            ? "Connecting to weather forecast service..."
            : "Forecast unavailable. Click Refresh Forecast to try again."}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {weather?.days.slice(1, 8).map((day) => (
          <DayCard
            key={day.date}
            day={day}
            supportsRainfallAmount={weather.supportsRainfallAmount}
          />
        ))}
      </div>

      <p
        data-testid="weather-attribution-footer"
        className="text-xs text-gray-500 mt-6 mb-4 bg-white p-4 rounded-2xl border border-gray-100"
      >
        <b>Provider Attribution:</b> {weather?.source ?? "NOAA / Open-Meteo"}.{" "}
        {weather?.supportsRainfallAmount
          ? "Open-Meteo provides both precipitation probability (%) and quantitative daily/hourly rainfall totals (mm)."
          : "NOAA forecastHourly provides precipitation probability (%) only; quantitative rainfall (mm) is not fabricated."}{" "}
        {weather &&
          `Forecast timestamp: ${new Date(weather.updatedAt).toLocaleString()} (Timezone: ${weather.timezone}).`}
      </p>
    </main>
  );
}
