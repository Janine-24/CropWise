
import { useCallback, useEffect, useState } from "react";

export type Place = {
  name: string;
  lat: number;
  lon: number;
};

export const PLACES: Place[] = [
  { name: "Ames", lat: 42.0308, lon: -93.6319 },
  { name: "Des Moines", lat: 41.5868, lon: -93.625 },
  { name: "Iowa City", lat: 41.6611, lon: -91.5302 },
  { name: "Cedar Rapids", lat: 41.9779, lon: -91.6656 },
  { name: "Waterloo", lat: 42.4928, lon: -92.3426 },
  { name: "Sioux City", lat: 42.4999, lon: -96.4003 },
  { name: "Davenport", lat: 41.5236, lon: -90.5776 },
  { name: "Council Bluffs", lat: 41.2619, lon: -95.8608 },
  { name: "Dubuque", lat: 42.5006, lon: -90.6646 },
  { name: "Fort Dodge", lat: 42.4975, lon: -94.168 },
  { name: "Mason City", lat: 43.1536, lon: -93.201 },
  { name: "Burlington", lat: 40.8075, lon: -91.1129 },
  { name: "Ottumwa", lat: 41.02, lon: -92.4113 },
  { name: "Marshalltown", lat: 42.0495, lon: -92.908 },
  { name: "Spencer", lat: 43.1414, lon: -95.1444 },
  { name: "Pella", lat: 41.4081, lon: -92.9163 },
];

export type Day = {
  date: string;
  high: number | null;
  low: number | null;
  rain: number | null;
  humidity: number | null;
  wind: number | null;
  description: string;
};

export type Weather = {
  days: Day[];
  updatedAt: string;
  source: string;
};

const TIMEZONE = "America/Chicago";
const CACHE_DURATION = 3 * 60 * 60 * 1000;

function iowaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function nextDates(): string[] {
  const today = iowaDate(new Date());
  const start = new Date(`${today}T12:00:00Z`);

  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;

  return Math.round(
    values.reduce((total, value) => total + value, 0) /
      values.length
  );
}

function toCelsius(value: number): number {
  return Math.round(((value - 32) * 5) / 9);
}

function getHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date)
  );
}

async function getJSON(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA API error: ${response.status}`);
  }

  return response.json();
}

export async function loadWeather(
  place: Place
): Promise<Weather> {
  const coordinates =
    `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;

  const points = await getJSON(
    `https://api.weather.gov/points/${coordinates}`
  );

  const hourlyURL = points.properties?.forecastHourly;

  if (!hourlyURL) {
    throw new Error("No hourly forecast URL returned by NOAA.");
  }

  const forecast = await getJSON(hourlyURL);
  const periods = forecast.properties?.periods;

  if (!Array.isArray(periods) || !periods.length) {
    throw new Error("No weather forecast available.");
  }

  const dates = nextDates();

  const days: Day[] = dates.map((date) => {
    const records = periods.filter(
      (period: any) =>
        iowaDate(new Date(period.startTime)) === date
    );

    const temperatures = records
      .map((period: any) => numeric(period.temperature))
      .filter((value: number | null): value is number =>
        value !== null
      );

    const temperaturesC = temperatures.map(toCelsius);

    const rainValues = records
      .map((period: any) =>
        numeric(period.probabilityOfPrecipitation?.value)
      )
      .filter((value: number | null): value is number =>
        value !== null
      );

    const humidityValues = records
      .map((period: any) =>
        numeric(period.relativeHumidity?.value)
      )
      .filter((value: number | null): value is number =>
        value !== null
      );

    const windValues = records
      .map((period: any) => {
        const match = String(period.windSpeed ?? "").match(
          /[\d.]+/
        );
        return match ? Number(match[0]) : null;
      })
      .filter((value: number | null): value is number =>
        value !== null
      );

    const daytime =
      records.find((period: any) => {
        const hour = getHour(new Date(period.startTime));
        return hour >= 10 && hour <= 16;
      }) ?? records[0];

    return {
      date,
      high: temperaturesC.length
        ? Math.max(...temperaturesC)
        : null,
      low: temperaturesC.length
        ? Math.min(...temperaturesC)
        : null,
      rain: rainValues.length
        ? Math.max(...rainValues)
        : null,
      humidity: average(humidityValues),
      wind: average(windValues),
      description:
        daytime?.shortForecast ?? "Forecast unavailable",
    };
  });

  return {
    days,
    updatedAt: new Date().toISOString(),
    source: "NOAA National Weather Service",
  };
}

export function useWeather(place: Place) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (force = false) => {
      const key =
        `fieldshift-weather-${place.lat.toFixed(4)}` +
        `-${place.lon.toFixed(4)}`;

      const cached = localStorage.getItem(key);
      let oldWeather: Weather | null = null;

      if (cached) {
        try {
          oldWeather = JSON.parse(cached);
          if (oldWeather) setWeather(oldWeather);

          const valid =
            oldWeather &&
            Date.now() -
              new Date(oldWeather.updatedAt).getTime() <
              CACHE_DURATION &&
            oldWeather.days[0]?.date === iowaDate(new Date());

          if (!force && valid) {
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(key);
        }
      }

      setLoading(true);
      setError("");

      try {
        const result = await loadWeather(place);
        setWeather(result);
        localStorage.setItem(key, JSON.stringify(result));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Weather service unavailable"
        );
      } finally {
        setLoading(false);
      }
    },
    [place.lat, place.lon]
  );

  useEffect(() => {
    setWeather(null);
    setLoading(true);
    refresh();

    const timer = window.setInterval(() => {
      refresh();
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    weather,
    loading,
    error,
    refresh: () => refresh(true),
  };
}
