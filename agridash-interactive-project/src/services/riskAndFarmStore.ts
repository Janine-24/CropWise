import {
  CURRENT_CROP_OPTIONS,
  CurrentCropKey,
  evaluateFarmCandidates,
  getSavedMyFarmProfile,
  getSharedFarmLocationState,
  HistoricalWindowId,
  IRRIGATION_OPTIONS,
  IrrigationAvailability,
  MyFarmProfile,
  parseOptionalSoilPh,
  resolveActiveHistoricalWindow,
  saveMyFarmProfile,
  setSharedFarmLocationState,
  validateCoordinates,
  VerifiedFarmLocation,
} from './realFarmEngine';
import { PlannerGoalId } from '../data/decisionPlannerData';
import { NasaPowerDailyResult } from './nasaPowerClient';
import { Weather } from '../weather/useWeather';

export type RiskSeverity = 'Low' | 'Moderate' | 'High';

export type RiskCategory =
  | 'forecast'
  | 'historical-climate'
  | 'farm-profile';

export interface EvaluatedRiskItem {
  id: string;
  category: RiskCategory;
  categoryLabel:
    | 'Weather Forecast Risk'
    | 'Historical Climate Constraint'
    | 'Farm Profile Constraint';
  severity: RiskSeverity;
  title: string;
  farmOrFieldName: string;
  fieldId: string;
  cropLabel: string;
  supportingData: string[];
  reasoning: string;
  recommendedActionTitle: string;
  recommendedActionDetail: string;
  dataSourceLabel: string;
  sourceTimestampLabel: string;
  scientificBoundaryNote: string;
}

export interface CompletedRiskActionRecord {
  id: string;
  riskId: string;
  riskTitle: string;
  riskCategory: RiskCategory;
  riskCategoryLabel: string;
  riskSeverityAtCompletion: RiskSeverity;
  recommendedActionTitle: string;
  recommendedActionDetail: string;
  userNotes: string;
  completedAtIso: string;
  farmName: string;
  fieldId: string;
  fieldName: string;
  cropKey: CurrentCropKey;
  cropLabel: string;
  dataSourceLabel: string;
  supportingDataSnapshot: string[];
  verificationStatusLabel: 'Action Recorded — Risk Remains Active Pending Field Verification';
}

export interface MyFarmFieldSlot {
  fieldId: string;
  fieldName: string;
  parcelId?: string | null;
  areaHa?: number | null;
  geometry?: any | null;
  sourceLabel?: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  currentCrop: CurrentCropKey;
  soilPhInput: string;
  soilPh: number | null;
  irrigationAvailability: IrrigationAvailability;
  primaryGoal: PlannerGoalId;
  historicalWindow: HistoricalWindowId;
  notesConstraint: string;
  updatedAtIso: string;
}

export interface MyFarmMultiFieldState {
  activeFieldId: string;
  fields: MyFarmFieldSlot[];
}

const COMPLETED_ACTIONS_STORAGE_KEY = 'cropwise_completed_risk_actions_v1';
const MY_FARM_FIELDS_STORAGE_KEY = 'cropwise_my_farm_fields_v1';
export const MAX_MY_FARM_FIELDS = 5;

export function getStableParcelId(
  feature: any,
  fallbackLat?: number | null,
  fallbackLon?: number | null
): string {
  const props = feature?.properties || {};
  const rawId = props.CSBID ?? props.Field_ID ?? props.OBJECTID ?? props.id;
  if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
    return `usda-${String(rawId).trim()}`;
  }
  const lat =
    typeof feature?.location?.lat === 'number'
      ? feature.location.lat
      : typeof fallbackLat === 'number'
      ? fallbackLat
      : 0;
  const lon =
    typeof feature?.location?.lon === 'number'
      ? feature.location.lon
      : typeof fallbackLon === 'number'
      ? fallbackLon
      : 0;
  return `pt-${lat.toFixed(4)}-${lon.toFixed(4)}`;
}

export function getSelectedMapFields(
  state?: MyFarmMultiFieldState
): MyFarmFieldSlot[] {
  const s = state ?? getMyFarmMultiFieldState();
  return s.fields.filter(
    (f) =>
      typeof f.latitude === 'number' &&
      Number.isFinite(f.latitude) &&
      typeof f.longitude === 'number' &&
      Number.isFinite(f.longitude)
  );
}

function createSlotFromCurrentProfile(
  profile: MyFarmProfile,
  verifiedLoc: VerifiedFarmLocation | null,
  fieldId = 'my-field-1'
): MyFarmFieldSlot {
  return {
    fieldId,
    fieldName: profile.farmName || 'My Farm Parcel 1',
    parcelId: verifiedLoc
      ? `pt-${verifiedLoc.latitude.toFixed(4)}-${verifiedLoc.longitude.toFixed(4)}`
      : null,
    areaHa: null,
    geometry: null,
    sourceLabel: verifiedLoc
      ? 'Point Coordinates (Boundary Unavailable)'
      : 'Unconfigured Slot',
    latitude: verifiedLoc ? verifiedLoc.latitude : null,
    longitude: verifiedLoc ? verifiedLoc.longitude : null,
    locationLabel: verifiedLoc
      ? verifiedLoc.label
      : 'Coordinates Not Verified',
    currentCrop: profile.currentCrop,
    soilPhInput: profile.soilPhInput,
    soilPh: profile.soilPh,
    irrigationAvailability: profile.irrigationAvailability,
    primaryGoal: profile.primaryGoal,
    historicalWindow: profile.historicalWindow,
    notesConstraint: profile.notesConstraint || '',
    updatedAtIso: new Date().toISOString(),
  };
}

export function getMyFarmMultiFieldState(): MyFarmMultiFieldState {
  const currentProfile = getSavedMyFarmProfile();
  const currentLoc = getSharedFarmLocationState().verifiedLocation;

  if (typeof window === 'undefined') {
    const slot = createSlotFromCurrentProfile(currentProfile, currentLoc);
    return { activeFieldId: slot.fieldId, fields: [slot] };
  }

  try {
    const raw = window.localStorage.getItem(MY_FARM_FIELDS_STORAGE_KEY);
    if (!raw) {
      const slot = createSlotFromCurrentProfile(currentProfile, currentLoc);
      const initial: MyFarmMultiFieldState = {
        activeFieldId: slot.fieldId,
        fields: [slot],
      };
      window.localStorage.setItem(
        MY_FARM_FIELDS_STORAGE_KEY,
        JSON.stringify(initial)
      );
      return initial;
    }

    const parsed = JSON.parse(raw) as MyFarmMultiFieldState;
    if (
      !parsed ||
      !Array.isArray(parsed.fields) ||
      parsed.fields.length === 0
    ) {
      const slot = createSlotFromCurrentProfile(currentProfile, currentLoc);
      return { activeFieldId: slot.fieldId, fields: [slot] };
    }

    const fields = parsed.fields.slice(0, MAX_MY_FARM_FIELDS);
    const activeFieldId = fields.some((f) => f.fieldId === parsed.activeFieldId)
      ? parsed.activeFieldId
      : fields[0].fieldId;

    // Keep active slot synchronized with latest MyFarmProfile / VerifiedFarmLocation edits from other pages
    const syncedFields = fields.map((f) => {
      if (f.fieldId !== activeFieldId) return f;
      return {
        ...f,
        fieldName: currentProfile.farmName || f.fieldName,
        latitude: currentLoc ? currentLoc.latitude : null,
        longitude: currentLoc ? currentLoc.longitude : null,
        locationLabel: currentLoc
          ? currentLoc.label
          : 'Coordinates Not Verified',
        currentCrop: currentProfile.currentCrop,
        soilPhInput: currentProfile.soilPhInput,
        soilPh: currentProfile.soilPh,
        irrigationAvailability: currentProfile.irrigationAvailability,
        primaryGoal: currentProfile.primaryGoal,
        historicalWindow: currentProfile.historicalWindow,
        notesConstraint: currentProfile.notesConstraint,
      };
    });

    return {
      activeFieldId,
      fields: syncedFields,
    };
  } catch {
    const slot = createSlotFromCurrentProfile(currentProfile, currentLoc);
    return { activeFieldId: slot.fieldId, fields: [slot] };
  }
}

export function syncActiveSlotToSharedFarmState(slot: MyFarmFieldSlot): void {
  const existingProfile = getSavedMyFarmProfile();
  const phCheck = parseOptionalSoilPh(slot.soilPhInput);

  saveMyFarmProfile({
    ...existingProfile,
    experienceMode: 'my-farm',
    farmName: slot.fieldName.trim() || 'My Farm Parcel',
    currentCrop: slot.currentCrop,
    soilPhInput:
      phCheck.valid && phCheck.value !== null ? String(phCheck.value) : '',
    soilPh: phCheck.valid ? phCheck.value : null,
    irrigationAvailability: slot.irrigationAvailability,
    primaryGoal: slot.primaryGoal,
    historicalWindow: slot.historicalWindow,
    notesConstraint: slot.notesConstraint,
  });

  if (slot.latitude !== null && slot.longitude !== null) {
    const check = validateCoordinates(slot.latitude, slot.longitude);
    if (check.valid) {
      setSharedFarmLocationState({
        verifiedLocation: {
          latitude: check.latitude,
          longitude: check.longitude,
          label:
            slot.locationLabel &&
            slot.locationLabel !== 'Coordinates Not Verified'
              ? slot.locationLabel
              : `${slot.fieldName} (${check.latitude}°, ${check.longitude}°)`,
          source: 'manual-input',
          updatedAtIso: new Date().toISOString(),
        },
        draftLatInput: String(check.latitude),
        draftLonInput: String(check.longitude),
      });
      return;
    }
  }

  setSharedFarmLocationState({
    verifiedLocation: null,
    draftLatInput: '',
    draftLonInput: '',
  });
}

export function saveMyFarmMultiFieldState(
  state: MyFarmMultiFieldState
): MyFarmMultiFieldState {
  const trimmedFields = state.fields.slice(0, MAX_MY_FARM_FIELDS);
  const activeSlot =
    trimmedFields.find((f) => f.fieldId === state.activeFieldId) ??
    trimmedFields[0];

  const normalized: MyFarmMultiFieldState = {
    activeFieldId: activeSlot ? activeSlot.fieldId : '',
    fields: trimmedFields,
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        MY_FARM_FIELDS_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      // Ignore quota errors
    }
  }

  if (activeSlot) {
    syncActiveSlotToSharedFarmState(activeSlot);
  } else {
    setSharedFarmLocationState({
      verifiedLocation: null,
      draftLatInput: '',
      draftLonInput: '',
    });
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('cropwise-fields-changed', {
          detail: normalized,
        })
      );
    } catch {
      // Ignore in non-DOM test environments
    }
  }

  return normalized;
}

export function addOrSelectFieldFromMap(featureOrPoint: any): {
  state: MyFarmMultiFieldState;
  status: 'added' | 'already-selected' | 'limit-reached';
  slot: MyFarmFieldSlot;
} {
  const current = getMyFarmMultiFieldState();
  const lat = Number(featureOrPoint?.location?.lat);
  const lon = Number(featureOrPoint?.location?.lon);
  const coordCheck = validateCoordinates(lat, lon);
  const validLat = coordCheck.valid ? coordCheck.latitude : 42.0308;
  const validLon = coordCheck.valid ? coordCheck.longitude : -93.6319;

  const parcelId = getStableParcelId(featureOrPoint, validLat, validLon);

  // 1. Check if already selected by stable parcelId or exact coordinates
  const existingMatch = current.fields.find(
    (f) =>
      (f.parcelId && f.parcelId === parcelId) ||
      (f.latitude !== null &&
        f.longitude !== null &&
        Math.abs(f.latitude - validLat) < 0.0001 &&
        Math.abs(f.longitude - validLon) < 0.0001)
  );

  if (existingMatch) {
    const saved = saveMyFarmMultiFieldState({
      ...current,
      activeFieldId: existingMatch.fieldId,
    });
    return {
      state: saved,
      status: 'already-selected',
      slot: existingMatch,
    };
  }

  // Filter out any unconfigured placeholder slot that has null coordinates
  const configuredFields = current.fields.filter(
    (f) => f.latitude !== null && f.longitude !== null
  );

  if (configuredFields.length >= MAX_MY_FARM_FIELDS) {
    const active =
      configuredFields.find((f) => f.fieldId === current.activeFieldId) ??
      configuredFields[0];
    return {
      state: current,
      status: 'limit-reached',
      slot: active,
    };
  }

  const props = featureOrPoint?.properties || {};
  const hasPolygon =
    (featureOrPoint?.geometry?.type === 'Polygon' ||
      featureOrPoint?.geometry?.type === 'MultiPolygon') &&
    Array.isArray(featureOrPoint?.geometry?.coordinates);

  const rawAcres = Number(props.CSBACRES ?? props.Acres ?? 0);
  const areaHa =
    Number.isFinite(rawAcres) && rawAcres > 0
      ? Number((rawAcres * 0.404686).toFixed(2))
      : null;

  const rawParcelCode = props.CSBID ?? props.Field_ID ?? props.OBJECTID;
  const fieldName = hasPolygon
    ? `Parcel ${rawParcelCode || configuredFields.length + 1}`
    : props.Field_ID && !String(props.Field_ID).startsWith('Location (')
    ? String(props.Field_ID)
    : `Field ${configuredFields.length + 1} (${validLat.toFixed(2)}°, ${validLon.toFixed(2)}°)`;

  const newSlot: MyFarmFieldSlot = {
    fieldId: `field-${parcelId}`,
    fieldName,
    parcelId,
    areaHa,
    geometry: hasPolygon ? featureOrPoint.geometry : null,
    sourceLabel: hasPolygon
      ? 'USDA Parcel Boundary'
      : 'Point Location (Boundary Unavailable)',
    latitude: validLat,
    longitude: validLon,
    locationLabel: `${fieldName} (${validLat.toFixed(4)}°, ${validLon.toFixed(4)}°)`,
    currentCrop: 'corn',
    soilPhInput: '',
    soilPh: null,
    irrigationAvailability: 'limited-supplemental',
    primaryGoal: 'earn-more',
    historicalWindow: '30d',
    notesConstraint: '',
    updatedAtIso: new Date().toISOString(),
  };

  const nextFields = [...configuredFields, newSlot];
  const saved = saveMyFarmMultiFieldState({
    activeFieldId: newSlot.fieldId,
    fields: nextFields,
  });

  return {
    state: saved,
    status: 'added',
    slot: newSlot,
  };
}

export function removeSelectedFieldSlot(
  fieldId: string
): MyFarmMultiFieldState {
  const current = getMyFarmMultiFieldState();
  const remaining = current.fields.filter((f) => f.fieldId !== fieldId);

  if (remaining.length === 0) {
    const emptyDefault: MyFarmFieldSlot = {
      fieldId: 'my-field-1',
      fieldName: 'My Farm Parcel 1',
      parcelId: null,
      areaHa: null,
      geometry: null,
      sourceLabel: 'Unconfigured Slot',
      latitude: null,
      longitude: null,
      locationLabel: 'Coordinates Not Verified',
      currentCrop: 'wheat',
      soilPhInput: '',
      soilPh: null,
      irrigationAvailability: 'limited-supplemental',
      primaryGoal: 'earn-more',
      historicalWindow: '30d',
      notesConstraint: '',
      updatedAtIso: new Date().toISOString(),
    };
    return saveMyFarmMultiFieldState({
      activeFieldId: emptyDefault.fieldId,
      fields: [emptyDefault],
    });
  }

  const nextActive =
    current.activeFieldId === fieldId
      ? remaining[0].fieldId
      : current.activeFieldId;

  return saveMyFarmMultiFieldState({
    activeFieldId: nextActive,
    fields: remaining,
  });
}

export function getCompletedRiskActions(): CompletedRiskActionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPLETED_ACTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CompletedRiskActionRecord[];
  } catch {
    return [];
  }
}

export function recordCompletedRiskAction(
  risk: EvaluatedRiskItem,
  cropKey: CurrentCropKey,
  userNotes = ''
): CompletedRiskActionRecord[] {
  const existing = getCompletedRiskActions();
  const record: CompletedRiskActionRecord = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    riskId: risk.id,
    riskTitle: risk.title,
    riskCategory: risk.category,
    riskCategoryLabel: risk.categoryLabel,
    riskSeverityAtCompletion: risk.severity,
    recommendedActionTitle: risk.recommendedActionTitle,
    recommendedActionDetail: risk.recommendedActionDetail,
    userNotes: userNotes.trim().slice(0, 240),
    completedAtIso: new Date().toISOString(),
    farmName: risk.farmOrFieldName,
    fieldId: risk.fieldId,
    fieldName: risk.farmOrFieldName,
    cropKey,
    cropLabel: risk.cropLabel,
    dataSourceLabel: risk.dataSourceLabel,
    supportingDataSnapshot: risk.supportingData,
    verificationStatusLabel:
      'Action Recorded — Risk Remains Active Pending Field Verification',
  };

  const next = [record, ...existing];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        COMPLETED_ACTIONS_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function removeCompletedRiskAction(
  actionId: string
): CompletedRiskActionRecord[] {
  const existing = getCompletedRiskActions();
  const next = existing.filter((item) => item.id !== actionId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        COMPLETED_ACTIONS_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

/**
 * Evaluates explainable agricultural risks separated strictly into:
 * 1. Forecast risks (from live NOAA / Open-Meteo weather forecast)
 * 2. Historical climate constraints (from NASA POWER daily archive + realFarmEngine)
 * 3. Farm profile constraints (from MyFarmProfile crop rotation, soil pH, and irrigation)
 *
 * Never fabricates soil moisture, disease observations, or numeric risk probabilities.
 */
export function evaluateExplainableRisks(params: {
  profile: MyFarmProfile;
  verifiedLocation: VerifiedFarmLocation | null;
  weather: Weather | null;
  nasaResult: NasaPowerDailyResult | null;
  fieldId?: string;
}): EvaluatedRiskItem[] {
  const {
    profile,
    verifiedLocation,
    weather,
    nasaResult,
    fieldId = 'my-field-1',
  } = params;

  const cropMeta =
    CURRENT_CROP_OPTIONS.find((c) => c.key === profile.currentCrop) ??
    CURRENT_CROP_OPTIONS[0];
  const irrigationMeta =
    IRRIGATION_OPTIONS.find((i) => i.id === profile.irrigationAvailability) ??
    IRRIGATION_OPTIONS[0];
  const activeWindow = resolveActiveHistoricalWindow(profile);
  const evaluation = evaluateFarmCandidates(
    profile,
    verifiedLocation,
    nasaResult
  );

  const farmName = profile.farmName || 'My Farm Parcel';
  const risks: EvaluatedRiskItem[] = [];

  // =========================================================================
  // CATEGORY 1: WEATHER FORECAST RISKS (NOAA / Open-Meteo 7-Day & Hourly)
  // =========================================================================
  if (!weather || !weather.days || weather.days.length === 0) {
    risks.push({
      id: `forecast-unverified-${fieldId}`,
      category: 'forecast',
      categoryLabel: 'Weather Forecast Risk',
      severity: 'Moderate',
      title: 'Short-Range Weather Forecast Not Loaded',
      farmOrFieldName: farmName,
      fieldId,
      cropLabel: cropMeta.label,
      supportingData: [
        'Forecast Provider: Awaiting NOAA / Open-Meteo response',
        verifiedLocation
          ? `Farm Coordinates: ${verifiedLocation.latitude.toFixed(4)}°, ${verifiedLocation.longitude.toFixed(4)}°`
          : 'Farm Coordinates: Not verified',
      ],
      reasoning:
        'Without an active 7-day forecast, short-term heat stress, heavy downpours, and wind-drift windows cannot be screened before field operations.',
      recommendedActionTitle: 'Load or Refresh 7-Day Weather Forecast Before Field Operations',
      recommendedActionDetail:
        'Verify farm coordinates and refresh the NOAA / Open-Meteo forecast before scheduling spraying, fertilizer top-dressing, or planting passes.',
      dataSourceLabel: 'Weather Forecast Check (Pending)',
      sourceTimestampLabel: 'Not yet retrieved',
      scientificBoundaryNote:
        'Completing this action records that the operator checked weather readiness; it does not eliminate meteorological risk.',
    });
  } else {
    const forecastDays = weather.days.slice(0, 7);
    const highs = forecastDays
      .map((d) => d.high)
      .filter((v): v is number => v !== null);
    const lows = forecastDays
      .map((d) => d.low)
      .filter((v): v is number => v !== null);
    const rainProbs = forecastDays
      .map((d) => d.rain)
      .filter((v): v is number => v !== null);
    const winds = forecastDays
      .map((d) => d.wind)
      .filter((v): v is number => v !== null);
    const rainSums = forecastDays
      .map((d) => d.rainfallMm)
      .filter((v): v is number => v !== null);

    const maxHighC = highs.length ? Math.max(...highs) : null;
    const minLowC = lows.length ? Math.min(...lows) : null;
    const maxRainProb = rainProbs.length ? Math.max(...rainProbs) : null;
    const highRainDaysCount = rainProbs.filter((p) => p >= 65).length;
    const totalRainMm7d =
      weather.supportsRainfallAmount && rainSums.length
        ? Number(rainSums.reduce((a, b) => a + b, 0).toFixed(1))
        : null;
    const maxWindKmh = winds.length ? Math.max(...winds) : null;
    const updatedLabel = new Date(weather.updatedAt).toLocaleString();

    // 1A. Forecast Precipitation / Downpour vs Dry-Window Risk
    if (
      (maxRainProb !== null && maxRainProb >= 70) ||
      (totalRainMm7d !== null && totalRainMm7d >= 45)
    ) {
      const isHigh =
        (maxRainProb !== null && maxRainProb >= 85 && highRainDaysCount >= 2) ||
        (totalRainMm7d !== null && totalRainMm7d >= 75);
      risks.push({
        id: `forecast-precip-excess-${fieldId}`,
        category: 'forecast',
        categoryLabel: 'Weather Forecast Risk',
        severity: isHigh ? 'High' : 'Moderate',
        title: 'Elevated 7-Day Precipitation & Field Runoff Risk',
        farmOrFieldName: farmName,
        fieldId,
        cropLabel: cropMeta.label,
        supportingData: [
          `Peak Rain Probability (7d): ${maxRainProb ?? '—'}% (${highRainDaysCount} day(s) ≥ 65%)`,
          weather.supportsRainfallAmount && totalRainMm7d !== null
            ? `7-Day Forecast Rainfall Sum: ${totalRainMm7d} mm (Open-Meteo)`
            : 'Quantitative Rainfall (mm): Not provided by NOAA hourly feed',
          `Forecast Timezone: ${weather.timezone}`,
        ],
        reasoning: `The 7-day forecast indicates high precipitation likelihood (${maxRainProb}% peak probability${
          totalRainMm7d !== null ? `, ${totalRainMm7d} mm cumulative` : ''
        }). Applying soluble fertilizer or driving heavy machinery before wet days increases nutrient runoff and topsoil compaction.`,
        recommendedActionTitle:
          'Inspect Surface Drainage & Delay Soluble Fertilizer / Heavy Traffic',
        recommendedActionDetail:
          'Clear field drainage outlets and postpone broadcast nitrogen or foliar applications until after the high-probability rain window passes.',
        dataSourceLabel: weather.source,
        sourceTimestampLabel: updatedLabel,
        scientificBoundaryNote:
          'Forecast precipitation probability is a model prediction, not an in-field rain gauge or soil moisture measurement.',
      });
    } else if (
      maxRainProb !== null &&
      maxRainProb < 30 &&
      profile.irrigationAvailability !== 'reliable-irrigated'
    ) {
      risks.push({
        id: `forecast-dry-spell-${fieldId}`,
        category: 'forecast',
        categoryLabel: 'Weather Forecast Risk',
        severity:
          profile.irrigationAvailability === 'none-rainfed' ? 'High' : 'Moderate',
        title: 'Low 7-Day Rain Probability Under Limited Irrigation',
        farmOrFieldName: farmName,
        fieldId,
        cropLabel: cropMeta.label,
        supportingData: [
          `Peak 7-Day Rain Probability: ${maxRainProb}%`,
          weather.supportsRainfallAmount && totalRainMm7d !== null
            ? `7-Day Forecast Rainfall Sum: ${totalRainMm7d} mm`
            : 'Quantitative Rainfall: N/A (NOAA probability only)',
          `Irrigation Profile: ${irrigationMeta.label}`,
        ],
        reasoning: `No high-probability rainfall event (peak ${maxRainProb}%) is forecast in the next 7 days while farm irrigation is set to "${irrigationMeta.shortLabel}".`,
        recommendedActionTitle:
          'Conserve Topsoil Moisture & Schedule Supplemental Watering Window',
        recommendedActionDetail:
          'Minimize soil-disturbing tillage to retain capillary moisture and prioritize supplemental water allocation for active root zones.',
        dataSourceLabel: weather.source,
        sourceTimestampLabel: updatedLabel,
        scientificBoundaryNote:
          'Does not measure actual root-zone soil moisture; on-site soil inspection is required.',
      });
    } else {
      risks.push({
        id: `forecast-precip-moderate-${fieldId}`,
        category: 'forecast',
        categoryLabel: 'Weather Forecast Risk',
        severity: 'Low',
        title: 'Manageable 7-Day Precipitation Window',
        farmOrFieldName: farmName,
        fieldId,
        cropLabel: cropMeta.label,
        supportingData: [
          `Peak 7-Day Rain Probability: ${maxRainProb ?? '—'}%`,
          weather.supportsRainfallAmount && totalRainMm7d !== null
            ? `7-Day Forecast Rainfall Sum: ${totalRainMm7d} mm`
            : `Irrigation Profile: ${irrigationMeta.shortLabel}`,
        ],
        reasoning:
          'Forecast precipitation probabilities over the next 7 days fall within a moderate operational window.',
        recommendedActionTitle:
          'Confirm Daily Hourly Forecast Window Prior to Field Passes',
        recommendedActionDetail:
          'Verify the 12-hour hourly strip before initiating seeding, cultivation, or harvest operations.',
        dataSourceLabel: weather.source,
        sourceTimestampLabel: updatedLabel,
        scientificBoundaryNote:
          'Standard operational check recorded by the farmer.',
      });
    }

    // 1B. Forecast Thermal Stress & Wind Drift Check
    if (maxHighC !== null && maxHighC >= 33) {
      risks.push({
        id: `forecast-heat-stress-${fieldId}`,
        category: 'forecast',
        categoryLabel: 'Weather Forecast Risk',
        severity: maxHighC >= 36 ? 'High' : 'Moderate',
        title: `Forecast Canopy Heat Stress (${maxHighC}°C Peak High)`,
        farmOrFieldName: farmName,
        fieldId,
        cropLabel: cropMeta.label,
        supportingData: [
          `7-Day Peak Forecast High: ${maxHighC}°C`,
          `7-Day Minimum Forecast Low: ${minLowC ?? '—'}°C`,
          `Max Forecast Wind: ${maxWindKmh ?? '—'} km/h`,
        ],
        reasoning: `Forecast daytime highs reach ${maxHighC}°C, elevating evapotranspiration demand and pollen/canopy heat stress for ${cropMeta.label}.`,
        recommendedActionTitle:
          'Shift Irrigation & Foliar Operations to Early Morning Hours',
        recommendedActionDetail:
          'Avoid midday foliar applications above 30°C and schedule irrigation before peak afternoon solar radiation.',
        dataSourceLabel: weather.source,
        sourceTimestampLabel: updatedLabel,
        scientificBoundaryNote:
          'Air temperature forecast is regional; canopy microclimate should be verified on site.',
      });
    } else if (minLowC !== null && minLowC <= 4) {
      risks.push({
        id: `forecast-cold-window-${fieldId}`,
        category: 'forecast',
        categoryLabel: 'Weather Forecast Risk',
        severity: minLowC <= 0 ? 'High' : 'Moderate',
        title: `Forecast Cold / Frost Exposure (${minLowC}°C Minimum Low)`,
        farmOrFieldName: farmName,
        fieldId,
        cropLabel: cropMeta.label,
        supportingData: [
          `7-Day Minimum Forecast Low: ${minLowC}°C`,
          `7-Day Peak Forecast High: ${maxHighC ?? '—'}°C`,
          `Max Forecast Wind: ${maxWindKmh ?? '—'} km/h`,
        ],
        reasoning: `Overnight temperatures are forecast to drop to ${minLowC}°C within the next 7 days, creating chilling or frost risk for warm-season seedlings.`,
        recommendedActionTitle:
          'Hold Warm-Season Seeding & Protect Cold-Sensitive Stands',
        recommendedActionDetail:
          'Delay planting frost-sensitive crops until soil and night air temperatures stabilize above crop minimum thresholds.',
        dataSourceLabel: weather.source,
        sourceTimestampLabel: updatedLabel,
        scientificBoundaryNote:
          'Low-lying field pockets may experience temperatures 1–3°C colder than grid forecasts.',
      });
    } else if (maxWindKmh !== null && maxWindKmh >= 28) {
      risks.push({
        id: `forecast-wind-drift-${fieldId}`,
        category: 'forecast',
        categoryLabel: 'Weather Forecast Risk',
        severity: maxWindKmh >= 38 ? 'High' : 'Moderate',
        title: `Forecast High Wind & Spray-Drift Risk (${maxWindKmh} km/h)`,
        farmOrFieldName: farmName,
        fieldId,
        cropLabel: cropMeta.label,
        supportingData: [
          `Peak 7-Day Forecast Wind: ${maxWindKmh} km/h`,
          `Temperature Range: ${minLowC ?? '—'}°C to ${maxHighC ?? '—'}°C`,
        ],
        reasoning: `Wind speeds up to ${maxWindKmh} km/h increase off-target spray drift and physical lodging stress.`,
        recommendedActionTitle:
          'Suspend Boom Spraying During High-Wind Hours',
        recommendedActionDetail:
          'Operate sprayers only during low-wind morning/evening hours (<15 km/h) and use drift-reduction nozzles.',
        dataSourceLabel: weather.source,
        sourceTimestampLabel: updatedLabel,
        scientificBoundaryNote:
          'On-site anemometer check is required prior to chemical application.',
      });
    }
  }

  // =========================================================================
  // CATEGORY 2: HISTORICAL CLIMATE CONSTRAINTS (NASA POWER T2M & PRECTOTCORR)
  // =========================================================================
  if (!verifiedLocation || !nasaResult || evaluation.observedT2mMean === null) {
    risks.push({
      id: `climate-unverified-${fieldId}`,
      category: 'historical-climate',
      categoryLabel: 'Historical Climate Constraint',
      severity: 'Moderate',
      title: 'NASA POWER Historical Climate Baseline Not Yet Verified',
      farmOrFieldName: farmName,
      fieldId,
      cropLabel: cropMeta.label,
      supportingData: [
        verifiedLocation
          ? `Verified Coordinates: ${verifiedLocation.latitude.toFixed(4)}°, ${verifiedLocation.longitude.toFixed(4)}°`
          : 'Verified Coordinates: None set',
        `Selected Historical Window: ${activeWindow.label} (${activeWindow.startIso} to ${activeWindow.endIso})`,
        'NASA POWER Parameters: T2M & PRECTOTCORR pending',
      ],
      reasoning:
        'Historical agroclimatology (NASA POWER daily temperature T2M and precipitation PRECTOTCORR) has not been loaded for this parcel, leaving seasonal thermal and rainfall suitability unverified.',
      recommendedActionTitle:
        'Verify Farm Coordinates & Query NASA POWER Historical Archive',
      recommendedActionDetail:
        'Set farm latitude/longitude in Farm Management or Risk Management and fetch NASA POWER daily T2M and PRECTOTCORR records.',
      dataSourceLabel: 'NASA POWER Agroclimatology (Pending Query)',
      sourceTimestampLabel: `${activeWindow.startIso} to ${activeWindow.endIso}`,
      scientificBoundaryNote:
        'NASA POWER provides ~0.5° × 0.625° regional satellite/reanalysis grid data, not in-field weather station measurements.',
    });
  } else {
    const meanT = evaluation.observedT2mMean;
    const minT = evaluation.observedT2mMin;
    const maxT = evaluation.observedT2mMax;
    const meanRain = evaluation.observedPrecipMeanMmPerDay ?? 0;
    const totalRain = evaluation.observedPrecipTotalMm ?? 0;
    const unsuitableCount = evaluation.rejectedCandidates.length;

    const isExtremeThermal = meanT < 10 || meanT > 32;
    const isDryHistorical =
      meanRain < 1.5 && profile.irrigationAvailability !== 'reliable-irrigated';
    const isWetHistorical = meanRain > 7.5;

    const climateSeverity: RiskSeverity =
      isExtremeThermal ||
      (isDryHistorical && profile.irrigationAvailability === 'none-rainfed') ||
      !evaluation.hasViableCandidates
        ? 'High'
        : isDryHistorical || isWetHistorical || unsuitableCount >= 4 || activeWindow.isShortWindow
        ? 'Moderate'
        : 'Low';

    risks.push({
      id: `climate-nasa-window-${fieldId}`,
      category: 'historical-climate',
      categoryLabel: 'Historical Climate Constraint',
      severity: climateSeverity,
      title: isDryHistorical
        ? `Historical Rainfall Deficit (${meanRain.toFixed(2)} mm/day Mean)`
        : isWetHistorical
        ? `High Historical Rainfall Regime (${meanRain.toFixed(2)} mm/day Mean)`
        : isExtremeThermal
        ? `Historical Thermal Constraint (${meanT.toFixed(1)}°C Window Mean)`
        : `Historical Climate Screening (${activeWindow.daySpan}-Day NASA POWER Window)`,
      farmOrFieldName: farmName,
      fieldId,
      cropLabel: cropMeta.label,
      supportingData: [
        `NASA POWER T2M Mean: ${meanT.toFixed(1)}°C (Min ${minT?.toFixed(1) ?? '—'}°C / Max ${maxT?.toFixed(1) ?? '—'}°C)`,
        `NASA POWER PRECTOTCORR: ${meanRain.toFixed(2)} mm/day (${totalRain.toFixed(1)} mm total over ${evaluation.validClimateDays} valid days)`,
        `Candidate Screening: ${evaluation.viableCandidates.length} viable / ${unsuitableCount} flagged unsuitable`,
      ],
      reasoning: `${
        isDryHistorical
          ? `Observed NASA POWER precipitation averaged ${meanRain.toFixed(2)} mm/day (${totalRain.toFixed(1)} mm total) over ${activeWindow.startIso} to ${activeWindow.endIso}, which constrains high-water-demand crops without full irrigation.`
          : isWetHistorical
          ? `Observed NASA POWER precipitation averaged ${meanRain.toFixed(2)} mm/day (${totalRain.toFixed(1)} mm total), increasing waterlogging and fungal canopy pressure for dry-adapted pulses.`
          : `Observed NASA POWER mean temperature (${meanT.toFixed(1)}°C) and rainfall (${meanRain.toFixed(2)} mm/day) screen out ${unsuitableCount} of 12 candidate crops for this window.`
      } ${activeWindow.isShortWindow ? `Note: ${activeWindow.daySpan}-day window is shorter than a full 90–150 day crop cycle.` : ''}`,
      recommendedActionTitle:
        'Align Next-Season Cultivar Maturity & Water Demand With Historical Window',
      recommendedActionDetail:
        'Select top-ranked candidate crops from Crop Recommendations that match your observed NASA POWER temperature and rainfall regime, and verify against a 90-day seasonal window.',
      dataSourceLabel: `NASA POWER Agroclimatology Archive (${verifiedLocation.latitude.toFixed(3)}°, ${verifiedLocation.longitude.toFixed(3)}°)`,
      sourceTimestampLabel: `Archive Window: ${activeWindow.startIso} to ${activeWindow.endIso}`,
      scientificBoundaryNote: evaluation.shortWindowScopeDisclaimer,
    });
  }

  // =========================================================================
  // CATEGORY 3: FARM PROFILE CONSTRAINTS (Soil pH, Rotation Family, Irrigation)
  // =========================================================================
  // 3A. Soil pH Constraint
  if (profile.soilPh === null) {
    risks.push({
      id: `profile-soil-ph-missing-${fieldId}`,
      category: 'farm-profile',
      categoryLabel: 'Farm Profile Constraint',
      severity: 'Moderate',
      title: 'Unverified Soil pH Baseline (Soil Test Not Provided)',
      farmOrFieldName: farmName,
      fieldId,
      cropLabel: cropMeta.label,
      supportingData: [
        'Soil pH Input: Not provided (null)',
        `Current Crop: ${cropMeta.label} (${cropMeta.family})`,
        `Primary Goal: ${profile.primaryGoal}`,
      ],
      reasoning:
        'Soil pH has not been entered for this field. Acid-sensitive pulses and oilseeds (e.g., chickpea, lentil, faba bean, soybean, canola) suffer nodulation failure or aluminum toxicity below pH 5.5.',
      recommendedActionTitle:
        'Conduct Topsoil pH Test (0–20 cm) & Enter Result in Farm Management',
      recommendedActionDetail:
        'Collect composite soil cores across the field zone, test soil pH, and record the value in Farm Management to unlock pH-screened crop recommendations.',
      dataSourceLabel: 'My Farm Profile (User Input State)',
      sourceTimestampLabel: 'Current Active Profile',
      scientificBoundaryNote:
        'CropWise never invents soil pH or soil moisture values when unmeasured.',
    });
  } else if (profile.soilPh < 5.5 || profile.soilPh > 7.8) {
    const isAcidic = profile.soilPh < 5.5;
    const isSevere = profile.soilPh < 5.0 || profile.soilPh > 8.3;
    risks.push({
      id: `profile-soil-ph-constraint-${fieldId}`,
      category: 'farm-profile',
      categoryLabel: 'Farm Profile Constraint',
      severity: isSevere ? 'High' : 'Moderate',
      title: isAcidic
        ? `Acidic Soil pH Constraint (pH ${profile.soilPh.toFixed(1)})`
        : `Alkaline Soil pH Constraint (pH ${profile.soilPh.toFixed(1)})`,
      farmOrFieldName: farmName,
      fieldId,
      cropLabel: cropMeta.label,
      supportingData: [
        `Recorded Soil pH: ${profile.soilPh.toFixed(1)}`,
        `Constraint Type: ${isAcidic ? 'Strong Soil Acidity (< 5.5)' : 'Alkaline Micronutrient Lock-out (> 7.8)'}`,
        `Current Crop: ${cropMeta.label}`,
      ],
      reasoning: isAcidic
        ? `At soil pH ${profile.soilPh.toFixed(1)}, phosphorus availability drops and Rhizobium nodulation in sensitive legumes (lentil, chickpea, faba bean, soybean) is inhibited.`
        : `At soil pH ${profile.soilPh.toFixed(1)}, iron, zinc, and manganese availability is restricted for sensitive crops.`,
      recommendedActionTitle: isAcidic
        ? 'Apply Agricultural Lime Amendment or Select Acid-Tolerant Rotation Crops'
        : 'Use Acidifying Banded Fertilizers & Alkaline-Tolerant Crops',
      recommendedActionDetail: isAcidic
        ? 'Incorporate calcitic/dolomitic lime according to buffer-pH lab recommendations, or prioritize acid-tolerant candidates (cowpea, pearl millet, buckwheat).'
        : 'Prioritize alkaline-tolerant candidates (mustard, barley, chickpea) and monitor foliar micronutrient status.',
      dataSourceLabel: 'My Farm Profile (User-Entered Soil pH)',
      sourceTimestampLabel: 'Current Active Profile',
      scientificBoundaryNote:
        'Recording a lime or amendment action logs your field operation; follow-up soil sampling is required to confirm pH change.',
    });
  } else {
    risks.push({
      id: `profile-soil-ph-optimal-${fieldId}`,
      category: 'farm-profile',
      categoryLabel: 'Farm Profile Constraint',
      severity: 'Low',
      title: `Favorable Soil pH Range (pH ${profile.soilPh.toFixed(1)})`,
      farmOrFieldName: farmName,
      fieldId,
      cropLabel: cropMeta.label,
      supportingData: [
        `Recorded Soil pH: ${profile.soilPh.toFixed(1)} (Optimal 5.5–7.8 window)`,
        `Current Crop: ${cropMeta.label}`,
      ],
      reasoning: `User-entered soil pH (${profile.soilPh.toFixed(1)}) supports nutrient uptake and legume nodulation across most candidate rotation crops.`,
      recommendedActionTitle:
        'Maintain Annual Soil pH & Residue Monitoring',
      recommendedActionDetail:
        'Re-test soil pH after nitrogen-fertilized cereal phases to prevent gradual acidification.',
      dataSourceLabel: 'My Farm Profile (User-Entered Soil pH)',
      sourceTimestampLabel: 'Current Active Profile',
      scientificBoundaryNote:
        'Routine agronomic maintenance record.',
    });
  }

  // 3B. Botanical Rotation & Irrigation Profile Constraint
  const isMonocultureRisk =
    cropMeta.family === 'Poaceae' || cropMeta.family === 'Fabaceae';
  const isRainfedConstraint =
    profile.irrigationAvailability === 'none-rainfed' ||
    profile.irrigationAvailability === 'not-specified';

  risks.push({
    id: `profile-rotation-irrigation-${fieldId}`,
    category: 'farm-profile',
    categoryLabel: 'Farm Profile Constraint',
    severity:
      profile.irrigationAvailability === 'none-rainfed'
        ? 'High'
        : isRainfedConstraint || isMonocultureRisk
        ? 'Moderate'
        : 'Low',
    title: `${cropMeta.label} (${cropMeta.family}) Rotation & ${irrigationMeta.shortLabel} Constraint`,
    farmOrFieldName: farmName,
    fieldId,
    cropLabel: cropMeta.label,
    supportingData: [
      `Current Crop: ${cropMeta.label} (Family: ${cropMeta.family})`,
      `Nitrogen Role: ${cropMeta.isNitrogenFixer ? 'Legume N-Fixer' : 'Soil N Consumer'}`,
      `Irrigation Availability: ${irrigationMeta.label}`,
    ],
    reasoning: `${cropMeta.rotationGuidance} In addition, irrigation is configured as "${irrigationMeta.label}", which ${
      profile.irrigationAvailability === 'none-rainfed'
        ? 'requires drought-tolerant rotation candidates and strict moisture conservation.'
        : profile.irrigationAvailability === 'not-specified'
        ? 'adds water-supply uncertainty until irrigation capacity is confirmed.'
        : 'buffers moderate dry spells when paired with complementary root-depth crops.'
    }`,
    recommendedActionTitle: cropMeta.isNitrogenFixer
      ? `Rotate From ${cropMeta.label} to a Non-Legume Cereal or Oilseed Break Crop`
      : `Rotate From ${cropMeta.label} (${cropMeta.family}) to a Nitrogen-Fixing Legume or Broadleaf Break Crop`,
    recommendedActionDetail: `Use Decision Planner to compare a ${
      cropMeta.isNitrogenFixer ? 'Poaceae/Brassicaceae' : 'Fabaceae legume'
    } follow-on crop that breaks ${cropMeta.family} pest/disease carryover and matches your ${irrigationMeta.shortLabel.toLowerCase()} regime.`,
    dataSourceLabel: 'My Farm Profile & Agronomic Rule Engine',
    sourceTimestampLabel: 'Current Active Profile',
    scientificBoundaryNote:
      'Rule-based rotation screening does not replace local pest scouting or on-site disease diagnosis.',
  });

  return risks;
}
