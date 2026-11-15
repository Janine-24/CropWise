
import React from "react";
import {
  CloudSun,
  CloudRain,
  Wind,
  Droplets,
  RefreshCw,
  MapPin,
  AlertCircle,
  CalendarDays,
} from "lucide-react";

import {
  Day,
  Place,
  PLACES,
  useWeather,
} from "./useWeather";

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
  const rainy = /rain|storm|snow|shower/i.test(description);

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
  return (
    <label className="flex items-center gap-2 text-sm">
      <MapPin size={17} className="text-green-700" />

      <select
        value={place.name}
        onChange={(event) => {
          const selected = PLACES.find(
            (item) => item.name === event.target.value
          );
          if (selected) onChange(selected);
        }}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 outline-none focus:ring-2 focus:ring-green-200"
      >
        {PLACES.map((item) => (
          <option key={item.name} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>

      <span className="text-xs text-gray-400">
        Iowa, USA
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
  const { weather, loading, error, refresh } =
    useWeather(place);

  const today = weather?.days[0];

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-green-700">
            Today's Forecast
          </p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">
            {place.name}, Iowa
          </h3>
        </div>

        <button
          onClick={refresh}
          title="Refresh weather"
          className="rounded-full bg-gray-50 p-2 hover:bg-green-50"
        >
          <RefreshCw
            size={17}
            className={`text-green-700 ${
              loading ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {today ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-semibold text-gray-900">
                {display(today.high, "°C")}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Forecast high
              </p>

              <p className="text-sm text-gray-600">
                Low {display(today.low, "°C")}
              </p>
            </div>

            <div className="flex flex-col items-center max-w-32 text-center">
              <WeatherIcon
                description={today.description}
                size={43}
              />
              <p className="text-xs text-gray-600 mt-2">
                {today.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-gray-100 mt-5 pt-4 text-center">
            <div>
              <Droplets
                size={18}
                className="mx-auto text-blue-500"
              />
              <p className="text-sm font-semibold mt-1">
                {display(today.humidity, "%")}
              </p>
              <p className="text-xs text-gray-400">
                Humidity
              </p>
            </div>

            <div>
              <CloudRain
                size={18}
                className="mx-auto text-blue-500"
              />
              <p className="text-sm font-semibold mt-1">
                {display(today.rain, "%")}
              </p>
              <p className="text-xs text-gray-400">
                Rain Chance
              </p>
            </div>

            <div>
              <Wind
                size={18}
                className="mx-auto text-gray-500"
              />
              <p className="text-sm font-semibold mt-1">
                {display(today.wind, " mph")}
              </p>
              <p className="text-xs text-gray-400">
                Wind
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="py-8 text-sm text-gray-500">
          {loading
            ? "Loading NOAA forecast..."
            : "Weather unavailable"}
        </p>
      )}

      {error && (
        <div className="flex gap-2 text-xs text-amber-700 mt-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={onOpen}
        className="w-full text-left border-t border-gray-100 mt-5 pt-4 text-sm font-semibold text-green-700 hover:text-green-900"
      >
        View Next 7 Days →
      </button>

      <p className="text-xs text-gray-400 mt-3">
        NOAA Forecast ·{" "}
        {weather
          ? `Updated ${new Date(
              weather.updatedAt
            ).toLocaleString()}`
          : "Waiting for data"}
      </p>
    </div>
  );
}

function DayCard({ day }: { day: Day }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={16} className="text-green-700" />
        <p className="font-semibold text-gray-800">
          {formatDate(day.date)}
        </p>
      </div>

      <WeatherIcon
        description={day.description}
        size={36}
      />

      <p className="text-sm text-gray-500 mt-3 min-h-10">
        {day.description}
      </p>

      <p className="text-xl font-semibold text-gray-900 mt-3">
        {display(day.high, "°C")}
      </p>

      <p className="text-sm text-gray-400">
        Low {display(day.low, "°C")}
      </p>

      <div className="border-t border-gray-100 mt-4 pt-4 space-y-3 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Rain Chance</span>
          <b>{display(day.rain, "%")}</b>
        </div>

        <div className="flex justify-between">
          <span>Humidity</span>
          <b>{display(day.humidity, "%")}</b>
        </div>

        <div className="flex justify-between">
          <span>Wind</span>
          <b>{display(day.wind, " mph")}</b>
        </div>
      </div>
    </div>
  );
}

export function WeatherPage({
  place,
  onChange,
}: {
  place: Place;
  onChange: (place: Place) => void;
}) {
  const { weather, loading, error, refresh } =
    useWeather(place);

  const today = weather?.days[0];

  return (
    <main className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar ml-5 mr-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-green-700">
            WEATHER & ENVIRONMENT
          </p>

          <h1 className="text-3xl font-semibold text-gray-900 mt-1">
            Iowa Weather Forecast
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            Today and the next 7 days
          </p>
        </div>

        <PlaceSelect place={place} onChange={onChange} />
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-green-900 to-emerald-700 p-7 text-white mb-7">
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-sm text-green-100">
              Today's Forecast · {place.name}
            </p>

            <h2 className="text-5xl font-semibold mt-4">
              {display(today?.high, "°C")}
            </h2>

            <p className="text-sm text-green-100 mt-3">
              Low {display(today?.low, "°C")}
            </p>

            <p className="text-sm mt-2">
              {today?.description ??
                "Waiting for NOAA forecast"}
            </p>
          </div>

          <CloudSun
            size={70}
            className="text-amber-200"
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-7 pt-5 border-t border-white/20">
          <div>
            <CloudRain size={19} />
            <p className="text-xs text-green-100 mt-2">
              Rain Chance
            </p>
            <p className="font-semibold mt-1">
              {display(today?.rain, "%")}
            </p>
          </div>

          <div>
            <Droplets size={19} />
            <p className="text-xs text-green-100 mt-2">
              Humidity
            </p>
            <p className="font-semibold mt-1">
              {display(today?.humidity, "%")}
            </p>
          </div>

          <div>
            <Wind size={19} />
            <p className="text-xs text-green-100 mt-2">
              Wind Speed
            </p>
            <p className="font-semibold mt-1">
              {display(today?.wind, " mph")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">
          Next 7 Days
        </h2>

        <button
          onClick={refresh}
          className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-amber-700">
          {error}
          {weather
            ? " — Showing previously saved forecast."
            : ""}
        </p>
      )}

      {!weather && (
        <div className="rounded-2xl bg-white p-8 text-gray-500">
          {loading
            ? "Connecting to NOAA weather service..."
            : "Forecast unavailable. Please try again."}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {weather?.days.slice(1, 8).map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-7 mb-7">
        Source: NOAA National Weather Service. Forecast
        values are predictions, not live station
        observations. Rain chance is not rainfall amount.
        The last forecast date may contain incomplete data.
        {weather &&
          ` Last retrieved: ${new Date(
            weather.updatedAt
          ).toLocaleString()}.`}
      </p>
    </main>
  );
}
