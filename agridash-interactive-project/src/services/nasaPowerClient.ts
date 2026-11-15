export type NasaParameterCode = 'T2M' | 'PRECTOTCORR';

export interface NasaPowerRequestParams {
  latitude: number;
  longitude: number;
  startDate: string; // 'YYYYMMDD'
  endDate: string;   // 'YYYYMMDD'
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface NasaDailyObservationPoint {
  rawDate: string;      // '20251001'
  isoDate: string;      // '2025-10-01'
  shortLabel: string;   // '10-01'
  value: number | null; // null when rawValue === fillValue
  rawValue: number;
  isMissing: boolean;
}

export interface NasaParameterSeries {
  parameter: NasaParameterCode;
  longname: string;
  rawUnit: string;
  displayUnit: string;
  points: NasaDailyObservationPoint[];
  validCount: number;
  missingCount: number;
}

export interface NasaPowerDailyResult {
  requestUrl: string;
  requestedLatitude: number;
  requestedLongitude: number;
  returnedCoordinates: {
    longitude: number | null;
    latitude: number | null;
    elevationMeters: number | null;
  };
  headerTitle: string;
  apiName: string;
  apiVersion: string;
  sources: string[];
  fillValue: number;
  timeStandard: string;
  startDate: string;
  endDate: string;
  spatialResolution: string;
  temporalResolution: string;
  dataAuthenticity: 'NASA POWER Modeled / Assimilated Data';
  series: Record<NasaParameterCode, NasaParameterSeries>;
  fetchedAtIso: string;
  fromCache: boolean;
}

interface RawNasaPowerGeoJsonResponse {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
  header?: {
    title?: string;
    api?: {
      version?: string;
      name?: string;
    };
    sources?: string[];
    fill_value?: number;
    time_standard?: string;
    start?: string;
    end?: string;
  };
  parameters?: Record<
    string,
    {
      units?: string;
      longname?: string;
    }
  >;
  messages?: unknown[];
  detail?: Array<{ msg?: string }>;
}

const NASA_POWER_DAILY_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 40;

const responseCache = new Map<string, { timestamp: number; result: NasaPowerDailyResult }>();
const inFlightRequests = new Map<string, Promise<NasaPowerDailyResult>>();

export function validateCoordinates(
  latInput: string | number,
  lonInput: string | number
): { valid: true; latitude: number; longitude: number } | { valid: false; error: string } {
  const lat = typeof latInput === 'number' ? latInput : Number(String(latInput).trim());
  const lon = typeof lonInput === 'number' ? lonInput : Number(String(lonInput).trim());

  if (String(latInput).trim() === '' || !Number.isFinite(lat)) {
    return { valid: false, error: 'Latitude must be a valid number between -90 and 90.' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90 degrees.' };
  }
  if (String(lonInput).trim() === '' || !Number.isFinite(lon)) {
    return { valid: false, error: 'Longitude must be a valid number between -180 and 180.' };
  }
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180 degrees.' };
  }

  return {
    valid: true,
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
  };
}

export function validateDateRange(
  startDate: string,
  endDate: string
): { valid: true } | { valid: false; error: string } {
  if (!/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate)) {
    return { valid: false, error: 'Dates must be in YYYYMMDD format.' };
  }
  if (startDate < '19810101') {
    return { valid: false, error: 'Start date cannot be earlier than 19810101.' };
  }
  if (startDate > endDate) {
    return { valid: false, error: 'Start date must be on or before end date.' };
  }
  return { valid: true };
}

function formatRawDateToIso(rawDate: string): { isoDate: string; shortLabel: string } {
  if (rawDate.length === 8) {
    const y = rawDate.slice(0, 4);
    const m = rawDate.slice(4, 6);
    const d = rawDate.slice(6, 8);
    return {
      isoDate: `${y}-${m}-${d}`,
      shortLabel: `${m}-${d}`,
    };
  }
  return { isoDate: rawDate, shortLabel: rawDate };
}

function normalizeDisplayUnit(rawUnit: string | undefined, param: NasaParameterCode): string {
  if (!rawUnit) {
    return param === 'T2M' ? '°C' : 'mm/day';
  }
  if (rawUnit.toUpperCase() === 'C') return '°C';
  return rawUnit;
}

function withCallerSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

export async function fetchNasaPowerDaily(
  params: NasaPowerRequestParams
): Promise<NasaPowerDailyResult> {
  const coordCheck = validateCoordinates(params.latitude, params.longitude);
  if (!coordCheck.valid) {
    throw new Error(coordCheck.error);
  }
  const dateCheck = validateDateRange(params.startDate, params.endDate);
  if (!dateCheck.valid) {
    throw new Error(dateCheck.error);
  }

  const { latitude, longitude } = coordCheck;
  const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}_${params.startDate}_${params.endDate}`;

  // 1. Check completed response cache
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (params.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return { ...cached.result, fromCache: true };
  }

  // 2. Deduplicate in-flight requests without cross-aborting shared network promises
  let sharedPromise = inFlightRequests.get(cacheKey);
  if (!sharedPromise) {
    const timeoutMs = params.timeoutMs ?? 12000;
    const url = `${NASA_POWER_DAILY_ENDPOINT}?parameters=T2M,PRECTOTCORR&community=AG&longitude=${encodeURIComponent(
      String(longitude)
    )}&latitude=${encodeURIComponent(String(latitude))}&start=${encodeURIComponent(
      params.startDate
    )}&end=${encodeURIComponent(params.endDate)}&format=JSON`;

    sharedPromise = (async (): Promise<NasaPowerDailyResult> => {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: timeoutController.signal,
        });

        if (!res.ok) {
          let detailMsg = `HTTP ${res.status} ${res.statusText}`;
          try {
            const errJson = (await res.json()) as RawNasaPowerGeoJsonResponse;
            if (Array.isArray(errJson.detail) && errJson.detail[0]?.msg) {
              detailMsg = `${detailMsg} — ${errJson.detail[0].msg}`;
            }
          } catch {
            // Ignore JSON parse failure on error body
          }
          throw new Error(`NASA POWER API request failed (${detailMsg}).`);
        }

        const data = (await res.json()) as RawNasaPowerGeoJsonResponse;
        const fillValue =
          typeof data.header?.fill_value === 'number' ? data.header.fill_value : -999;

        const coords = Array.isArray(data.geometry?.coordinates)
          ? data.geometry!.coordinates!
          : [];

        const buildParameterSeries = (code: NasaParameterCode): NasaParameterSeries => {
          const rawMap = data.properties?.parameter?.[code] ?? {};
          const paramMeta = data.parameters?.[code];
          const rawUnit = paramMeta?.units ?? (code === 'T2M' ? 'C' : 'mm/day');
          const displayUnit = normalizeDisplayUnit(rawUnit, code);
          const longname =
            paramMeta?.longname ??
            (code === 'T2M' ? 'Temperature at 2 Meters' : 'Precipitation Corrected');

          const sortedDates = Object.keys(rawMap).sort();
          let validCount = 0;
          let missingCount = 0;

          const points: NasaDailyObservationPoint[] = sortedDates.map((rawDate) => {
            const rawValue = rawMap[rawDate];
            const isMissing = !Number.isFinite(rawValue) || rawValue === fillValue;
            if (isMissing) {
              missingCount += 1;
            } else {
              validCount += 1;
            }
            const { isoDate, shortLabel } = formatRawDateToIso(rawDate);
            return {
              rawDate,
              isoDate,
              shortLabel,
              value: isMissing ? null : rawValue,
              rawValue,
              isMissing,
            };
          });

          return {
            parameter: code,
            longname,
            rawUnit,
            displayUnit,
            points,
            validCount,
            missingCount,
          };
        };

        const result: NasaPowerDailyResult = {
          requestUrl: url,
          requestedLatitude: latitude,
          requestedLongitude: longitude,
          returnedCoordinates: {
            longitude: typeof coords[0] === 'number' ? coords[0] : null,
            latitude: typeof coords[1] === 'number' ? coords[1] : null,
            elevationMeters: typeof coords[2] === 'number' ? coords[2] : null,
          },
          headerTitle: data.header?.title ?? 'NASA/POWER Daily Data',
          apiName: data.header?.api?.name ?? 'POWER Daily API',
          apiVersion: data.header?.api?.version ?? 'dynamic',
          sources: Array.isArray(data.header?.sources) ? data.header!.sources! : [],
          fillValue,
          timeStandard: data.header?.time_standard ?? 'LST',
          startDate: data.header?.start ?? params.startDate,
          endDate: data.header?.end ?? params.endDate,
          spatialResolution: '0.5° × 0.625° (~50 km regional assimilation grid)',
          temporalResolution: 'Daily',
          dataAuthenticity: 'NASA POWER Modeled / Assimilated Data',
          series: {
            T2M: buildParameterSeries('T2M'),
            PRECTOTCORR: buildParameterSeries('PRECTOTCORR'),
          },
          fetchedAtIso: new Date().toISOString(),
          fromCache: false,
        };

        if (responseCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = responseCache.keys().next().value;
          if (oldestKey) responseCache.delete(oldestKey);
        }
        responseCache.set(cacheKey, { timestamp: Date.now(), result });

        return result;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error(
            `NASA POWER API request timed out after ${Math.round(timeoutMs / 1000)}s.`
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, sharedPromise);
  }

  return withCallerSignal(sharedPromise, params.signal);
}
