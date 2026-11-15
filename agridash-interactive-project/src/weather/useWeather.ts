import { useCallback, useEffect, useState } from "react";

export type Place = {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  isUS?: boolean;
};

export const PLACES: Place[] = [
  { name: "Ames", region: "Iowa, USA", country: "US", lat: 42.0308, lon: -93.6319, isUS: true },
  { name: "Putrajaya", region: "Putrajaya, Malaysia", country: "MY", lat: 2.9264, lon: 101.6964, isUS: false },
  { name: "London", region: "United Kingdom", country: "GB", lat: 51.5074, lon: -0.1278, isUS: false },
  { name: "Des Moines", region: "Iowa, USA", country: "US", lat: 41.5868, lon: -93.625, isUS: true },
  { name: "Iowa City", region: "Iowa, USA", country: "US", lat: 41.6611, lon: -91.5302, isUS: true },
  { name: "Cedar Rapids", region: "Iowa, USA", country: "US", lat: 41.9779, lon: -91.6656, isUS: true },
  { name: "Waterloo", region: "Iowa, USA", country: "US", lat: 42.4928, lon: -92.3426, isUS: true },
  { name: "Sioux City", region: "Iowa, USA", country: "US", lat: 42.4999, lon: -96.4003, isUS: true },
  { name: "Davenport", region: "Iowa, USA", country: "US", lat: 41.5236, lon: -90.5776, isUS: true },
  { name: "Council Bluffs", region: "Iowa, USA", country: "US", lat: 41.2619, lon: -95.8608, isUS: true },
  { name: "Dubuque", region: "Iowa, USA", country: "US", lat: 42.5006, lon: -90.6646, isUS: true },
  { name: "Fort Dodge", region: "Iowa, USA", country: "US", lat: 42.4975, lon: -94.168, isUS: true },
  { name: "Mason City", region: "Iowa, USA", country: "US", lat: 43.1536, lon: -93.201, isUS: true },
  { name: "Burlington", region: "Iowa, USA", country: "US", lat: 40.8075, lon: -91.1129, isUS: true },
  { name: "Ottumwa", region: "Iowa, USA", country: "US", lat: 41.02, lon: -92.4113, isUS: true },
  { name: "Marshalltown", region: "Iowa, USA", country: "US", lat: 42.0495, lon: -92.908, isUS: true },
  { name: "Spencer", region: "Iowa, USA", country: "US", lat: 43.1414, lon: -95.1444, isUS: true },
  { name: "Pella", region: "Iowa, USA", country: "US", lat: 41.4081, lon: -92.9163, isUS: true },
];

export type HourlyForecastPoint = {
  timeIso: string;
  hourLabel: string;
  tempC: number | null;
  rainProbability: number | null;
  rainfallMm: number | null; // Only populated when supported by provider (Open-Meteo)
  humidity: number | null;
  windKmh: number | null;
  description: string;
};

export type Day = {
  date: string;
  high: number | null;
  low: number | null;
  rain: number | null; // Precipitation probability (%)
  rainfallMm: number | null; // Daily precipitation sum (mm) when supported by provider
  humidity: number | null;
  wind: number | null; // Wind speed in km/h
  windUnit: string;
  description: string;
};

export type WeatherProviderId = "noaa" | "open-meteo";

export type Weather = {
  days: Day[];
  hourly: HourlyForecastPoint[];
  updatedAt: string;
  source: string;
  providerId: WeatherProviderId;
  timezone: string;
  supportsRainfallAmount: boolean;
  fallbackReason?: string;
  placeName?: string;
  latitude: number;
  longitude: number;
};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WEATHER_CACHE_VERSION = "v2";

function formatLocalDateInZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "";

    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatHourLabelInZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

function getHourInZone(date: Date, timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date)
    );
  } catch {
    return date.getUTCHours();
  }
}

function nextDatesForZone(timeZone: string): string[] {
  const today = formatLocalDateInZone(new Date(), timeZone);
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
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

function toCelsius(fahrenheit: number): number {
  return Math.round(((fahrenheit - 32) * 5) / 9);
}

function mphToKmh(mph: number): number {
  return Math.round(mph * 1.60934);
}

export function isLikelyUSCoordinate(lat: number, lon: number): boolean {
  // Continental US, Alaska, Hawaii, Puerto Rico bounding check
  const inConus = lat >= 24.0 && lat <= 50.0 && lon >= -125.0 && lon <= -66.0;
  const inAlaska = lat >= 51.0 && lat <= 71.5 && lon >= -170.0 && lon <= -129.0;
  const inHawaii = lat >= 18.5 && lat <= 22.5 && lon >= -161.0 && lon <= -154.0;
  const inPR = lat >= 17.5 && lat <= 18.6 && lon >= -67.5 && lon <= -65.0;
  return inConus || inAlaska || inHawaii || inPR;
}

export function wmoCodeToDescription(code: number | null): string {
  if (code === null) return "Condition unavailable";
  switch (code) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Foggy conditions";
    case 51:
    case 53:
    case 55:
      return "Light to moderate drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
      return "Slight rain";
    case 63:
      return "Moderate rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
    case 73:
    case 75:
    case 77:
      return "Snow fall";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with hail";
    default:
      return "Variable cloudiness";
  }
}

async function getNoaaJSON(url: string): Promise<any> {
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

export async function loadNoaaWeather(place: Place): Promise<Weather> {
  const coordinates = `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
  const points = await getNoaaJSON(
    `https://api.weather.gov/points/${coordinates}`
  );

  const hourlyURL = points.properties?.forecastHourly;
  const timeZone: string =
    points.properties?.timeZone || "America/Chicago";

  if (!hourlyURL) {
    throw new Error("No hourly forecast URL returned by NOAA.");
  }

  const forecast = await getNoaaJSON(hourlyURL);
  const periods = forecast.properties?.periods;

  if (!Array.isArray(periods) || !periods.length) {
    throw new Error("No weather forecast periods returned by NOAA.");
  }

  const hourly: HourlyForecastPoint[] = periods.slice(0, 24).map((period: any) => {
    const startDate = new Date(period.startTime);
    const rawTemp = numeric(period.temperature);
    const tempUnit = String(period.temperatureUnit || "F").toUpperCase();
    const tempC =
      rawTemp === null
        ? null
        : tempUnit === "C"
        ? Math.round(rawTemp)
        : toCelsius(rawTemp);

    const windMatch = String(period.windSpeed ?? "").match(/[\d.]+/);
    const windMph = windMatch ? Number(windMatch[0]) : null;

    return {
      timeIso: String(period.startTime),
      hourLabel: formatHourLabelInZone(startDate, timeZone),
      tempC,
      rainProbability: numeric(period.probabilityOfPrecipitation?.value),
      rainfallMm: null, // NOAA forecastHourly provides probability (%), not quantitative mm
      humidity: numeric(period.relativeHumidity?.value),
      windKmh: windMph !== null ? mphToKmh(windMph) : null,
      description: String(period.shortForecast ?? "Forecast unavailable"),
    };
  });

  const dates = nextDatesForZone(timeZone);

  const days: Day[] = dates.map((date) => {
    const records = periods.filter(
      (period: any) =>
        formatLocalDateInZone(new Date(period.startTime), timeZone) === date
    );

    const temperaturesC = records
      .map((period: any) => {
        const t = numeric(period.temperature);
        if (t === null) return null;
        const unit = String(period.temperatureUnit || "F").toUpperCase();
        return unit === "C" ? Math.round(t) : toCelsius(t);
      })
      .filter((v: number | null): v is number => v !== null);

    const rainValues = records
      .map((period: any) =>
        numeric(period.probabilityOfPrecipitation?.value)
      )
      .filter((v: number | null): v is number => v !== null);

    const humidityValues = records
      .map((period: any) => numeric(period.relativeHumidity?.value))
      .filter((v: number | null): v is number => v !== null);

    const windKmhValues = records
      .map((period: any) => {
        const match = String(period.windSpeed ?? "").match(/[\d.]+/);
        return match ? mphToKmh(Number(match[0])) : null;
      })
      .filter((v: number | null): v is number => v !== null);

    const daytime =
      records.find((period: any) => {
        const hour = getHourInZone(new Date(period.startTime), timeZone);
        return hour >= 10 && hour <= 16;
      }) ?? records[0];

    return {
      date,
      high: temperaturesC.length ? Math.max(...temperaturesC) : null,
      low: temperaturesC.length ? Math.min(...temperaturesC) : null,
      rain: rainValues.length ? Math.max(...rainValues) : null,
      rainfallMm: null,
      humidity: average(humidityValues),
      wind: average(windKmhValues),
      windUnit: "km/h",
      description: daytime?.shortForecast ?? "Forecast unavailable",
    };
  });

  return {
    days,
    hourly,
    updatedAt: new Date().toISOString(),
    source: "NOAA National Weather Service",
    providerId: "noaa",
    timezone: timeZone,
    supportsRainfallAmount: false,
    placeName: place.name,
    latitude: place.lat,
    longitude: place.lon,
  };
}

export async function loadOpenMeteoWeather(
  place: Place,
  fallbackReason?: string
): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    hourly:
      "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "8",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  const data = await response.json();
  const timeZone: string = data.timezone || "UTC";

  const hourlyTimes: string[] = Array.isArray(data.hourly?.time)
    ? data.hourly.time
    : [];
  const hourlyTemps: unknown[] = data.hourly?.temperature_2m ?? [];
  const hourlyHum: unknown[] = data.hourly?.relative_humidity_2m ?? [];
  const hourlyProb: unknown[] = data.hourly?.precipitation_probability ?? [];
  const hourlyPrecip: unknown[] = data.hourly?.precipitation ?? [];
  const hourlyCode: unknown[] = data.hourly?.weather_code ?? [];
  const hourlyWind: unknown[] = data.hourly?.wind_speed_10m ?? [];

  // Find current hour index or start at 0
  const nowDatePrefix = formatLocalDateInZone(new Date(), timeZone);
  const nowHour = getHourInZone(new Date(), timeZone);
  const currentPrefix = `${nowDatePrefix}T${String(nowHour).padStart(2, "0")}`;
  let startIdx = hourlyTimes.findIndex((t) => String(t).startsWith(currentPrefix));
  if (startIdx < 0) startIdx = 0;

  const hourly: HourlyForecastPoint[] = hourlyTimes
    .slice(startIdx, startIdx + 24)
    .map((timeStr, offset) => {
      const idx = startIdx + offset;
      const tVal = numeric(hourlyTemps[idx]);
      const pProb = numeric(hourlyProb[idx]);
      const pMm = numeric(hourlyPrecip[idx]);
      const hum = numeric(hourlyHum[idx]);
      const wind = numeric(hourlyWind[idx]);
      const wCode = numeric(hourlyCode[idx]);
      const hourPart = String(timeStr).slice(11, 16) || "00:00";

      return {
        timeIso: String(timeStr),
        hourLabel: hourPart,
        tempC: tVal !== null ? Math.round(tVal) : null,
        rainProbability: pProb !== null ? Math.round(pProb) : null,
        rainfallMm: pMm !== null ? Number(pMm.toFixed(1)) : null,
        humidity: hum !== null ? Math.round(hum) : null,
        windKmh: wind !== null ? Math.round(wind) : null,
        description: wmoCodeToDescription(wCode),
      };
    });

  const dailyDates: string[] = Array.isArray(data.daily?.time)
    ? data.daily.time
    : [];
  const dailyMax: unknown[] = data.daily?.temperature_2m_max ?? [];
  const dailyMin: unknown[] = data.daily?.temperature_2m_min ?? [];
  const dailyProbMax: unknown[] =
    data.daily?.precipitation_probability_max ?? [];
  const dailyPrecipSum: unknown[] = data.daily?.precipitation_sum ?? [];
  const dailyWindMax: unknown[] = data.daily?.wind_speed_10m_max ?? [];
  const dailyWmo: unknown[] = data.daily?.weather_code ?? [];

  const days: Day[] = dailyDates.slice(0, 8).map((dateStr, idx) => {
    // Compute daily average humidity from matching hourly records
    const dayHumidityVals: number[] = [];
    hourlyTimes.forEach((t, hIdx) => {
      if (String(t).startsWith(dateStr)) {
        const h = numeric(hourlyHum[hIdx]);
        if (h !== null) dayHumidityVals.push(h);
      }
    });

    const maxT = numeric(dailyMax[idx]);
    const minT = numeric(dailyMin[idx]);
    const prob = numeric(dailyProbMax[idx]);
    const precipMm = numeric(dailyPrecipSum[idx]);
    const windMax = numeric(dailyWindMax[idx]);
    const code = numeric(dailyWmo[idx]);

    return {
      date: String(dateStr),
      high: maxT !== null ? Math.round(maxT) : null,
      low: minT !== null ? Math.round(minT) : null,
      rain: prob !== null ? Math.round(prob) : null,
      rainfallMm: precipMm !== null ? Number(precipMm.toFixed(1)) : null,
      humidity: average(dayHumidityVals),
      wind: windMax !== null ? Math.round(windMax) : null,
      windUnit: "km/h",
      description: wmoCodeToDescription(code),
    };
  });

  if (!days.length) {
    throw new Error("Open-Meteo returned no daily forecast records.");
  }

  return {
    days,
    hourly,
    updatedAt: new Date().toISOString(),
    source: fallbackReason
      ? "Open-Meteo Weather API (Fallback)"
      : "Open-Meteo Global Weather API",
    providerId: "open-meteo",
    timezone: timeZone,
    supportsRainfallAmount: true,
    fallbackReason,
    placeName: place.name,
    latitude: place.lat,
    longitude: place.lon,
  };
}

export async function loadWeather(place: Place): Promise<Weather> {
  const tryNoaaFirst =
    place.isUS === true ||
    (place.isUS === undefined && isLikelyUSCoordinate(place.lat, place.lon));

  if (tryNoaaFirst) {
    try {
      return await loadNoaaWeather(place);
    } catch (noaaErr) {
      const reason =
        noaaErr instanceof Error
          ? `NOAA unavailable (${noaaErr.message}); switched to Open-Meteo.`
          : "NOAA unavailable; switched to Open-Meteo.";
      return await loadOpenMeteoWeather(place, reason);
    }
  }

  return await loadOpenMeteoWeather(
    place,
    "Non-US location (NOAA covers US territories only); using Open-Meteo Global Forecast."
  );
}

export function getWeatherCacheKey(place: { lat: number; lon: number }): string {
  return `fieldshift-weather-${WEATHER_CACHE_VERSION}-${place.lat.toFixed(
    4
  )}-${place.lon.toFixed(4)}`;
}

export function getCachedWeatherForPlace(place: {
  lat: number;
  lon: number;
}): Weather | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getWeatherCacheKey(place));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Weather;
    if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function useWeather(place: Place) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (force = false) => {
      const key = getWeatherCacheKey(place);
      const cached = localStorage.getItem(key);
      let oldWeather: Weather | null = null;

      if (cached) {
        try {
          oldWeather = JSON.parse(cached);
          if (oldWeather && Array.isArray(oldWeather.days)) {
            setWeather(oldWeather);
            const tz = oldWeather.timezone || "UTC";
            const valid =
              Date.now() - new Date(oldWeather.updatedAt).getTime() <
                CACHE_DURATION &&
              oldWeather.days[0]?.date === formatLocalDateInZone(new Date(), tz);

            if (!force && valid) {
              setLoading(false);
              return;
            }
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
    [place.lat, place.lon, place.name, place.isUS]
  );

  useEffect(() => {
    setWeather(null);
    setLoading(true);
    refresh();

    const timer = window.setInterval(() => {
      refresh(true);
    }, CACHE_DURATION);

    const handleFarmLocationChanged = () => {
      refresh(true);
    };

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("cropwise-farm-location-changed", handleFarmLocationChanged);
    }

    return () => {
      window.clearInterval(timer);
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("cropwise-farm-location-changed", handleFarmLocationChanged);
      }
    };
  }, [refresh]);

  return {
    weather,
    loading,
    error,
    refresh: () => refresh(true),
  };
}
