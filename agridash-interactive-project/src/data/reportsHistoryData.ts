import {
  FIELD_IDS,
  cropwiseFields,
  getFieldBadgeClass,
  getFieldOverviewStatus,
  type FieldEquipmentStatus,
  type FieldOverviewStatus,
} from './cropwiseFields';
import {
  fetchNasaPowerDaily,
  type NasaPowerDailyResult,
} from '../services/nasaPowerClient';

export type DataMode = 'demo' | 'nasa-power';

export type DataAuthenticityTag =
  | 'Team-provided Demo Snapshot'
  | 'Simulated Demo Data'
  | 'NASA POWER Modeled / Assimilated Data'
  | 'NASA Observed Product'
  | 'User-provided Record';

export type TimeRangeKey = '7d' | '30d' | 'season';

export type EnvMetricKey = 'soilMoisture' | 'ndvi' | 'rainfall' | 'temperature';

export type ActivityCategory = 'all' | 'irrigation' | 'nutrition' | 'inspection';

export type SimulatedRiskLevel =
  | 'Low Risk (Simulated)'
  | 'Moderate Risk (Simulated)'
  | 'Elevated Watch (Simulated)'
  | 'High Risk (Simulated)';

export interface NasaTestLocationPreset {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  note: string;
}

export const NASA_PUBLIC_TEST_LOCATIONS: readonly NasaTestLocationPreset[] = [
  {
    id: 'putrajaya-my',
    label: 'Putrajaya, Malaysia (Public Test Location)',
    latitude: 2.9264,
    longitude: 101.6964,
    note: 'Public test coordinates only — does not represent a real farm or team demo plot.',
  },
  {
    id: 'central-java-grid',
    label: 'Central Java Regional Grid (Public Test Location)',
    latitude: -7.4244,
    longitude: 109.2302,
    note: 'Regional meteorological reference only — team demo plots have unconfirmed coordinates (null).',
  },
] as const;

export const NASA_HISTORICAL_WINDOWS: Record<
  TimeRangeKey,
  { startDate: string; endDate: string; displayRange: string }
> = {
  '7d': {
    startDate: '20251001',
    endDate: '20251007',
    displayRange: '2025-10-01 to 2025-10-07 (7-Day Historical Archive)',
  },
  '30d': {
    startDate: '20250908',
    endDate: '20251007',
    displayRange: '2025-09-08 to 2025-10-07 (30-Day Historical Archive)',
  },
  season: {
    startDate: '20250809',
    endDate: '20251007',
    displayRange: '2025-08-09 to 2025-10-07 (60-Day Historical Archive)',
  },
};

export interface FieldDescriptor {
  fieldId: string;
  name: string;
  cropType: string;
  shortCropLabel: string;
  areaHectares: string;
  ph: string;
  waterConsumption: string;
  fertilizerEfficiency: string;
  snapshotScore: number;
  equipmentStatus: FieldEquipmentStatus;
  overviewDisplayStatus: FieldOverviewStatus;
  badgeClass: string;
  cardHumiditySnapshot: string;
  tableSoilMoistureSnapshot: string;
  tableTemperatureSnapshot: string;
  tableGrowthStageSnapshot: string;
  boundaryReference: string | null;
  authenticity: 'Team-provided Demo Snapshot';
}

export interface FarmLocationContext {
  farmId: string;
  regionLabel: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  boundaryReference: string | null;
  elevationReference: string | null;
  dateDiscrepancyNote: string;
  authenticity: 'Team-provided Demo Snapshot';
  fields: FieldDescriptor[];
}

export interface MetricProvenanceMetadata {
  metric: EnvMetricKey;
  label: string;
  unit: string;
  currentProvider: string;
  snapshotAuthenticity: DataAuthenticityTag;
  seriesAuthenticity: DataAuthenticityTag;
  plannedNasaProducts: string[];
  observationDate: string | null;
  knownSpatialResolution: string | null;
  knownTemporalResolution: string | null;
  plannedNasaSpatialResolutionNote: string;
  plannedNasaTemporalResolutionNote: string;
  processingMethod: string;
  uncertaintyAndLimitations: string;
  metricDistinctionNote: string;
}

export interface ActionEffectRecord {
  id: string;
  fieldId: string;
  fieldName: string;
  cropType: string;
  timeRange: TimeRangeKey;
  timeWindowLabel: string;
  scenarioAuthenticity: 'Simulated Demo Data';
  snapshotAuthenticity: 'Team-provided Demo Snapshot';
  snapshotScore: number;
  equipmentStatusSnapshot: FieldEquipmentStatus;
  overviewDisplayStatus: FieldOverviewStatus;
  badgeClass: string;
  priorSimulatedRisk: SimulatedRiskLevel;
  currentSimulatedRisk: SimulatedRiskLevel;
  issue: {
    title: string;
    detail: string;
    snapshotReference: string;
  };
  recommended: {
    title: string;
    detail: string;
  };
  actionTaken: {
    title: string;
    detail: string;
    loggedWindow: string;
    statusLabel: 'Simulated Action Logged' | 'Simulated Schedule Pending';
  };
  observation: {
    title: string;
    detail: string;
    causalityDisclaimer: string;
  };
}

export interface EnvTrendPoint {
  pointLabel: string;
  isoDate?: string;
  value: number;
  origin: DataAuthenticityTag;
}

export interface FieldEnvTrendSeries {
  fieldId: string;
  fieldName: string;
  strokeColor: string;
  badgeClass: string;
  snapshotValueLabel: string;
  snapshotAuthenticity: DataAuthenticityTag;
  points: EnvTrendPoint[];
}

export interface NasaLiveProvenanceDetails {
  parameterCode: 'T2M' | 'PRECTOTCORR';
  parameterLongname: string;
  rawUnit: string;
  displayUnit: string;
  requestedLatitude: number;
  requestedLongitude: number;
  returnedLatitude: number | null;
  returnedLongitude: number | null;
  elevationMeters: number | null;
  headerTitle: string;
  apiName: string;
  apiVersion: string;
  sources: string[];
  fillValue: number;
  timeStandard: string;
  startDateIso: string;
  endDateIso: string;
  validCount: number;
  missingCount: number;
  fromCache: boolean;
  requestUrl: string;
}

export interface EnvironmentalTrendBundle {
  metric: EnvMetricKey;
  timeRange: TimeRangeKey;
  dataMode: DataMode;
  metricAvailability: 'available' | 'unavailable-in-nasa-power' | 'no-valid-points';
  unavailableReason?: string;
  metadata: MetricProvenanceMetadata;
  nasaLiveDetails?: NasaLiveProvenanceDetails;
  seriesByField: FieldEnvTrendSeries[];
}

export interface RiskHistoryNode {
  slotLabel: string;
  simulatedRisk: SimulatedRiskLevel;
  severityLevel: 1 | 2 | 3 | 4;
  summary: string;
  authenticity: 'Simulated Demo Data';
}

export interface FieldRiskHistoryRow {
  fieldId: string;
  fieldName: string;
  cropType: string;
  snapshotScore: number;
  equipmentStatusSnapshot: FieldEquipmentStatus;
  snapshotAuthenticity: 'Team-provided Demo Snapshot';
  seriesAuthenticity: 'Simulated Demo Data';
  nodes: RiskHistoryNode[];
}

export interface ActivityTimelineItem {
  id: string;
  fieldId: string;
  fieldName: string;
  cropType: string;
  timeRangeMembership: TimeRangeKey[];
  relativeTimeLabel: string;
  observationDate: string | null;
  category: Exclude<ActivityCategory, 'all'>;
  categoryLabel: string;
  operationTitle: string;
  operationDetail: string;
  statusLabel: 'Simulated Record' | 'Simulated Pending Review' | 'Simulated Scheduled';
  authenticity: 'Simulated Demo Data';
}

export interface ReportsQuery {
  dataMode?: DataMode;
  nasaLatitude?: number;
  nasaLongitude?: number;
  nasaLocationLabel?: string;
  fieldFilter: string | 'all';
  timeRange: TimeRangeKey;
  metric: EnvMetricKey;
  activityCategory: ActivityCategory;
  simulateState?: 'normal' | 'empty' | 'error';
}

export interface ReportsHistoryBundle {
  dataMode: DataMode;
  farmContext: FarmLocationContext;
  actionEffects: ActionEffectRecord[];
  environmentalTrend: EnvironmentalTrendBundle;
  riskHistory: FieldRiskHistoryRow[];
  activityTimeline: ActivityTimelineItem[];
}

export interface ReportsHistoryDataProvider {
  readonly providerId: string;
  readonly providerLabel: string;
  readonly providerMode: 'demo-mock' | 'nasa-hybrid';
  fetchReportsBundle(
    query: ReportsQuery,
    options?: { signal?: AbortSignal }
  ): Promise<ReportsHistoryBundle>;
}

const TABLE_SNAPSHOT_BY_FIELD: Record<
  string,
  {
    shortCropLabel: string;
    soilMoisture: string;
    soilMoistureNum: number;
    temperature: string;
    temperatureNum: number;
    growthStage: string;
    strokeColor: string;
  }
> = {
  'north-field-a1': {
    shortCropLabel: 'Corn',
    soilMoisture: '68%',
    soilMoistureNum: 68,
    temperature: '26°C',
    temperatureNum: 26,
    growthStage: 'Vegetative',
    strokeColor: '#166534',
  },
  'east-field-b2': {
    shortCropLabel: 'Wheat',
    soilMoisture: '72%',
    soilMoistureNum: 72,
    temperature: '24°C',
    temperatureNum: 24,
    growthStage: 'Flowering',
    strokeColor: '#22c55e',
  },
  'south-field-c3': {
    shortCropLabel: 'Soybean',
    soilMoisture: '41%',
    soilMoistureNum: 41,
    temperature: '29°C',
    temperatureNum: 29,
    growthStage: 'Seedling',
    strokeColor: '#ef4444',
  },
};

const TEAM_DEMO_FARM_CONTEXT: FarmLocationContext = {
  farmId: 'cropwise-team-demo-preset',
  regionLabel: 'Purwokerto, Central Java, Indonesia (Team Demo Preset)',
  latitude: null,
  longitude: null,
  timezone: null,
  boundaryReference: null,
  elevationReference: null,
  dateDiscrepancyNote:
    'Existing Dashboard references "June 2026" in the Field Monitoring table and "Jan 26 | 8.45 AM" in the Weather widget. No single calendar date is assumed as verified truth.',
  authenticity: 'Team-provided Demo Snapshot',
  fields: FIELD_IDS.map((id) => {
    const raw = cropwiseFields[id];
    const tableSnap = TABLE_SNAPSHOT_BY_FIELD[id];
    return {
      fieldId: id,
      name: raw.name,
      cropType: raw.type,
      shortCropLabel: tableSnap.shortCropLabel,
      areaHectares: raw.area,
      ph: raw.ph,
      waterConsumption: raw.water,
      fertilizerEfficiency: raw.fertilizer,
      snapshotScore: raw.score,
      equipmentStatus: raw.status,
      overviewDisplayStatus: getFieldOverviewStatus(raw.status),
      badgeClass: getFieldBadgeClass(raw.status),
      cardHumiditySnapshot: raw.humidity,
      tableSoilMoistureSnapshot: tableSnap.soilMoisture,
      tableTemperatureSnapshot: tableSnap.temperature,
      tableGrowthStageSnapshot: tableSnap.growthStage,
      boundaryReference: null,
      authenticity: 'Team-provided Demo Snapshot',
    };
  }),
};

const METRIC_METADATA: Record<EnvMetricKey, MetricProvenanceMetadata> = {
  soilMoisture: {
    metric: 'soilMoisture',
    label: 'Soil Moisture',
    unit: '%',
    currentProvider: 'CropWise Local Demo Provider (No live NASA API connected)',
    snapshotAuthenticity: 'Team-provided Demo Snapshot',
    seriesAuthenticity: 'Simulated Demo Data',
    plannedNasaProducts: [
      'NASA SMAP (Surface / Root-Zone Soil Moisture — Planned Integration)',
      'NASA ECOSTRESS (Evaporative Stress Index — Planned Integration)',
    ],
    observationDate: null,
    knownSpatialResolution: null,
    knownTemporalResolution: null,
    plannedNasaSpatialResolutionNote:
      'Planned target: SMAP L3/L4 (~9 km – 36 km regional grid); ECOSTRESS (~70 m canopy thermal proxy)',
    plannedNasaTemporalResolutionNote:
      'Planned target: SMAP ~1–3 day revisit; ECOSTRESS variable orbit revisit',
    processingMethod:
      'Final node anchored to MainContent.tsx table Soil Moisture snapshot (68% / 72% / 41%); prior nodes are deterministic demo simulations.',
    uncertaintyAndLimitations:
      'Current curve is simulated for UI workflow demonstration. Even when SMAP is integrated, coarse 9–36 km pixels reflect regional moisture rather than parcel-level soil probes.',
    metricDistinctionNote:
      'Strictly represents Table "Soil Moisture" (68% / 72% / 41%), NOT the field card "Humidity" metric (32% / 45% / 18%).',
  },
  ndvi: {
    metric: 'ndvi',
    label: 'NDVI (Vegetation Index)',
    unit: 'index (0.00–1.00)',
    currentProvider: 'CropWise Local Demo Provider (No live NASA API connected)',
    snapshotAuthenticity: 'Simulated Demo Data',
    seriesAuthenticity: 'Simulated Demo Data',
    plannedNasaProducts: [
      'NASA/USGS Landsat 8/9 OLI Surface Reflectance (Planned Integration)',
      'NASA MODIS MOD13Q1 / MYD13Q1 Vegetation Indices (Planned Integration)',
    ],
    observationDate: null,
    knownSpatialResolution: null,
    knownTemporalResolution: null,
    plannedNasaSpatialResolutionNote:
      'Planned target: Landsat ~30 m parcel-capable; MODIS ~250 m regional composite',
    plannedNasaTemporalResolutionNote:
      'Planned target: Landsat 8–16 day revisit (cloud-free dependent); MODIS 16-day composite',
    processingMethod:
      'Entire series is deterministic demo data; existing team codebase does not contain an NDVI snapshot.',
    uncertaintyAndLimitations:
      'Simulated values only. In real optical satellite feeds (Landsat/MODIS), tropical cloud cover and mixed boundary pixels on 1.8–4.1 ha plots introduce observation gaps.',
    metricDistinctionNote:
      'No NDVI field exists in cropwiseFields.ts; all points are explicitly marked as Simulated Demo Data.',
  },
  rainfall: {
    metric: 'rainfall',
    label: 'Rainfall',
    unit: 'mm',
    currentProvider: 'CropWise Local Demo Provider',
    snapshotAuthenticity: 'Simulated Demo Data',
    seriesAuthenticity: 'Simulated Demo Data',
    plannedNasaProducts: [
      'NASA POWER PRECTOTCORR (Connected in NASA Data Mode)',
      'NASA GPM IMERG Precipitation (Planned High-Resolution Integration)',
    ],
    observationDate: null,
    knownSpatialResolution: null,
    knownTemporalResolution: null,
    plannedNasaSpatialResolutionNote:
      'NASA POWER: 0.5° × 0.625° (~50 km); Planned GPM IMERG: ~0.1° (~10 km)',
    plannedNasaTemporalResolutionNote:
      'NASA POWER: Daily (LST); Planned GPM: half-hourly to daily',
    processingMethod:
      'In Demo Mode, series is deterministic simulation. Switch to NASA Data Mode to query live NASA POWER PRECTOTCORR historical archive.',
    uncertaintyAndLimitations:
      'In Demo Mode, values are simulated. In NASA POWER Mode, precipitation reflects 0.5° × 0.625° regional grid estimates and cannot differentiate micro-variations across adjacent 2–4 ha fields.',
    metricDistinctionNote:
      'RightPanel.tsx lists "Rain Forecast: 26°C" (temperature unit); Demo Mode millimeter rainfall is Simulated Demo Data.',
  },
  temperature: {
    metric: 'temperature',
    label: 'Temperature',
    unit: '°C',
    currentProvider: 'CropWise Local Demo Provider',
    snapshotAuthenticity: 'Team-provided Demo Snapshot',
    seriesAuthenticity: 'Simulated Demo Data',
    plannedNasaProducts: [
      'NASA POWER T2M 2-Meter Air Temperature (Connected in NASA Data Mode)',
      'NASA ECOSTRESS Land Surface Temperature (LST — Planned Integration)',
    ],
    observationDate: null,
    knownSpatialResolution: null,
    knownTemporalResolution: null,
    plannedNasaSpatialResolutionNote:
      'NASA POWER: 0.5° × 0.625° (~50 km regional grid); Planned ECOSTRESS: ~70 m thermal LST',
    plannedNasaTemporalResolutionNote:
      'NASA POWER: Daily (LST); Planned ECOSTRESS: variable overpass',
    processingMethod:
      'In Demo Mode, final node is anchored to MainContent.tsx table Temp. snapshot (26°C / 24°C / 29°C). Switch to NASA Data Mode for live NASA POWER T2M.',
    uncertaintyAndLimitations:
      'Demo historical curve is simulated. In NASA POWER Mode, T2M represents regional 2m air temperature (MERRA-2 assimilation), not an in-field weather station.',
    metricDistinctionNote:
      'Demo final point reflects MainContent.tsx table Temp. (26°C / 24°C / 29°C); RightPanel weather widget also displays 26°C.',
  },
};

const TIME_SLOTS_BY_RANGE: Record<TimeRangeKey, string[]> = {
  '7d': ['T-6d', 'T-5d', 'T-4d', 'T-3d', 'T-2d', 'T-1d', 'Snapshot'],
  '30d': ['W-5', 'W-4', 'W-3', 'W-2', 'W-1', 'Snapshot'],
  season: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Snapshot'],
};

const SIMULATED_ENV_VALUES: Record<
  EnvMetricKey,
  Record<string, Record<TimeRangeKey, number[]>>
> = {
  soilMoisture: {
    'north-field-a1': {
      '7d': [62, 64, 63, 65, 66, 67, 68],
      '30d': [58, 60, 63, 65, 67, 68],
      season: [54, 59, 62, 64, 66, 68],
    },
    'east-field-b2': {
      '7d': [70, 71, 71, 72, 73, 72, 72],
      '30d': [68, 69, 70, 71, 72, 72],
      season: [65, 67, 70, 71, 72, 72],
    },
    'south-field-c3': {
      '7d': [52, 49, 47, 45, 43, 42, 41],
      '30d': [60, 56, 51, 47, 44, 41],
      season: [64, 59, 53, 48, 44, 41],
    },
  },
  ndvi: {
    'north-field-a1': {
      '7d': [0.58, 0.59, 0.6, 0.61, 0.61, 0.62, 0.63],
      '30d': [0.51, 0.54, 0.57, 0.59, 0.61, 0.63],
      season: [0.38, 0.45, 0.52, 0.57, 0.6, 0.63],
    },
    'east-field-b2': {
      '7d': [0.76, 0.77, 0.78, 0.79, 0.8, 0.81, 0.82],
      '30d': [0.7, 0.73, 0.76, 0.78, 0.8, 0.82],
      season: [0.52, 0.61, 0.69, 0.75, 0.79, 0.82],
    },
    'south-field-c3': {
      '7d': [0.46, 0.45, 0.43, 0.41, 0.4, 0.39, 0.38],
      '30d': [0.54, 0.5, 0.47, 0.43, 0.4, 0.38],
      season: [0.49, 0.52, 0.48, 0.44, 0.41, 0.38],
    },
  },
  rainfall: {
    'north-field-a1': {
      '7d': [12, 4, 0, 8, 15, 6, 3],
      '30d': [42, 35, 28, 38, 31, 24],
      season: [110, 95, 82, 68, 54, 40],
    },
    'east-field-b2': {
      '7d': [14, 5, 0, 9, 16, 7, 4],
      '30d': [45, 38, 30, 40, 33, 26],
      season: [115, 98, 86, 72, 58, 44],
    },
    'south-field-c3': {
      '7d': [6, 0, 0, 2, 4, 0, 1],
      '30d': [24, 18, 12, 10, 8, 5],
      season: [88, 70, 52, 34, 20, 11],
    },
  },
  temperature: {
    'north-field-a1': {
      '7d': [25, 26, 26, 27, 26, 25, 26],
      '30d': [25, 25, 26, 27, 26, 26],
      season: [24, 25, 25, 26, 26, 26],
    },
    'east-field-b2': {
      '7d': [24, 23, 24, 25, 24, 24, 24],
      '30d': [23, 24, 24, 25, 24, 24],
      season: [23, 23, 24, 24, 25, 24],
    },
    'south-field-c3': {
      '7d': [27, 28, 28, 29, 30, 29, 29],
      '30d': [26, 27, 28, 28, 29, 29],
      season: [25, 26, 27, 28, 29, 29],
    },
  },
};

const ACTION_EFFECT_BY_FIELD: Record<
  string,
  Record<
    TimeRangeKey,
    Omit<
      ActionEffectRecord,
      | 'fieldId'
      | 'fieldName'
      | 'cropType'
      | 'timeRange'
      | 'scenarioAuthenticity'
      | 'snapshotAuthenticity'
      | 'snapshotScore'
      | 'equipmentStatusSnapshot'
      | 'overviewDisplayStatus'
      | 'badgeClass'
    >
  >
> = {
  'north-field-a1': {
    '7d': {
      id: 'ae-a1-7d',
      timeWindowLabel: '7-Day Simulated Tracking Window',
      priorSimulatedRisk: 'Elevated Watch (Simulated)',
      currentSimulatedRisk: 'Moderate Risk (Simulated)',
      issue: {
        title: 'Acidic Soil pH & Low Card Humidity Signal',
        detail:
          'Team snapshot records pH 2.8 and card Humidity 32% (while table Soil Moisture is 68%) during Corn Vegetative stage.',
        snapshotReference: 'Snapshot: pH 2.8 • Card Humidity 32% • Table Soil Moisture 68%',
      },
      recommended: {
        title: 'Agricultural Lime Buffering & Zone pH Re-Sampling',
        detail:
          'Simulated recommendation: apply staged dolomitic lime dressing and verify root-zone pH calibration across 2.3 Ha.',
      },
      actionTaken: {
        title: 'Sub-Zone Lime Trial Logged (Simulated)',
        detail:
          'Simulated operational record: initial lime buffer test and sensor calibration check logged in demo workflow.',
        loggedWindow: 'Window T-3d (Simulated Demo)',
        statusLabel: 'Simulated Action Logged',
      },
      observation: {
        title: 'Monitoring Ongoing — Acidic pH Requires Field Verification',
        detail:
          'Team snapshot score stands at 70% (Equipment Status: Active). Simulated workflow shows buffering in progress; actual soil pH neutralization requires lab/probe confirmation.',
        causalityDisclaimer:
          'Simulated scenario only. Neither equipment status ("Active") nor satellite indices prove verified pH recovery.',
      },
    },
    '30d': {
      id: 'ae-a1-30d',
      timeWindowLabel: '30-Day Simulated Tracking Window',
      priorSimulatedRisk: 'Elevated Watch (Simulated)',
      currentSimulatedRisk: 'Moderate Risk (Simulated)',
      issue: {
        title: 'Persistent Acidity in Corn Vegetative Zone (pH 2.8 Snapshot)',
        detail:
          'Over the 30-day simulated window, acidic soil conditions (pH 2.8 snapshot) pose potential nutrient lock-out risk.',
        snapshotReference: 'Snapshot: Score 70% • Fertilizer Efficiency 87% • Water 1,250L',
      },
      recommended: {
        title: 'Split Nutrient Application & pH Amendment Plan',
        detail:
          'Pair pH amendment with split nitrogen scheduling to avoid leaching on 2.3 Ha Corn Plantation.',
      },
      actionTaken: {
        title: 'Soil Sampling & Split Fertilizer Schedule (Simulated)',
        detail:
          'Simulated 30-day log: soil cores collected and fertilizer split cycle recorded for North Field A1.',
        loggedWindow: 'Window W-2 (Simulated Demo)',
        statusLabel: 'Simulated Action Logged',
      },
      observation: {
        title: 'Vegetative Canopy Stable in Demo Simulation',
        detail:
          'Current team snapshot shows 68% table Soil Moisture and 70% Health Score. Outcome remains unverified in real-world agronomy.',
        causalityDisclaimer:
          'Simulated 30-day review. Causal improvement cannot be claimed from demo snapshot metrics.',
      },
    },
    season: {
      id: 'ae-a1-season',
      timeWindowLabel: 'Season Simulated Tracking Window',
      priorSimulatedRisk: 'Elevated Watch (Simulated)',
      currentSimulatedRisk: 'Moderate Risk (Simulated)',
      issue: {
        title: 'Baseline Soil Acidity Management Across Corn Cycle',
        detail:
          'Season-level simulated tracking focused on managing pH 2.8 and 1,250L water allocation across 2.3 Ha.',
        snapshotReference: 'Snapshot: North Field A1 • 2.3 Ha • Vegetative Stage',
      },
      recommended: {
        title: 'Multi-Stage Soil Conditioning & Moisture Tracking',
        detail:
          'Combine pre-planting lime conditioning with periodic root-zone moisture checks.',
      },
      actionTaken: {
        title: 'Season Amendment Protocol Recorded (Simulated)',
        detail:
          'Simulated season log: baseline conditioning and irrigation checkpoints recorded in demo history.',
        loggedWindow: 'Stage 3–5 (Simulated Demo)',
        statusLabel: 'Simulated Action Logged',
      },
      observation: {
        title: 'Snapshot Health Score at 70% (Demo Reference)',
        detail:
          'Field is currently in Vegetative stage with 87% fertilizer efficiency snapshot. Field scouting required for verified assessment.',
        causalityDisclaimer:
          'Season trajectory is 100% simulated demo data for workflow illustration.',
      },
    },
  },
  'east-field-b2': {
    '7d': {
      id: 'ae-b2-7d',
      timeWindowLabel: '7-Day Simulated Tracking Window',
      priorSimulatedRisk: 'Low Risk (Simulated)',
      currentSimulatedRisk: 'Low Risk (Simulated)',
      issue: {
        title: 'Flowering Stage Moisture & Canopy Maintenance',
        detail:
          'Wheat Plantation (4.1 Ha) is in Flowering stage with favorable snapshot metrics (Score 92%, pH 6.5, Soil Moisture 72%).',
        snapshotReference: 'Snapshot: Score 92% • pH 6.5 • Table Soil Moisture 72%',
      },
      recommended: {
        title: 'Maintain Baseline Irrigation & Preventative Scouting',
        detail:
          'Keep water consumption near 850L benchmark and monitor flowering heads for fungal pressure during humid mornings.',
      },
      actionTaken: {
        title: 'Routine Flowering Canopy Inspection (Simulated)',
        detail:
          'Simulated 7-day log: preventative scouting and nozzle pressure check completed.',
        loggedWindow: 'Window T-2d (Simulated Demo)',
        statusLabel: 'Simulated Action Logged',
      },
      observation: {
        title: 'Optimal Snapshot Maintained (Score 92%)',
        detail:
          'Team snapshot reflects Optimal status (94% fertilizer efficiency, 24°C table temp). Continued routine monitoring advised.',
        causalityDisclaimer:
          'Simulated maintenance log. Snapshot values are static team demo data.',
      },
    },
    '30d': {
      id: 'ae-b2-30d',
      timeWindowLabel: '30-Day Simulated Tracking Window',
      priorSimulatedRisk: 'Moderate Risk (Simulated)',
      currentSimulatedRisk: 'Low Risk (Simulated)',
      issue: {
        title: 'Pre-Flowering Nutrient & Water Balance Check',
        detail:
          'Simulated 30-day check prior to Wheat flowering across 4.1 Ha zone.',
        snapshotReference: 'Snapshot: 4.1 Ha • Water 850L • Fertilizer 94%',
      },
      recommended: {
        title: 'Foliar Micronutrient Support & Flow Calibration',
        detail:
          'Calibrate irrigation lines to sustain 70%+ soil moisture entering flowering phase.',
      },
      actionTaken: {
        title: 'Flow Calibration & Foliar Pass Logged (Simulated)',
        detail:
          'Simulated 30-day record: emitter uniformity check logged prior to flowering stage.',
        loggedWindow: 'Window W-3 (Simulated Demo)',
        statusLabel: 'Simulated Action Logged',
      },
      observation: {
        title: 'Field Snapshot at 92% Health Score (Demo)',
        detail:
          'Current team snapshot is Optimal (72% table Soil Moisture, 45% card Humidity).',
        causalityDisclaimer:
          'Simulated historical transition; not a verified agronomic trial result.',
      },
    },
    season: {
      id: 'ae-b2-season',
      timeWindowLabel: 'Season Simulated Tracking Window',
      priorSimulatedRisk: 'Moderate Risk (Simulated)',
      currentSimulatedRisk: 'Low Risk (Simulated)',
      issue: {
        title: 'Season-Long Uniformity on 4.1 Ha Wheat Plot',
        detail:
          'Largest monitored zone (4.1 Ha) requires consistent moisture distribution across gently varying terrain.',
        snapshotReference: 'Snapshot: East Field B2 • 4.1 Ha • pH 6.5',
      },
      recommended: {
        title: 'Zone-Based Irrigation Scheduling',
        detail:
          'Use terrain-aware scheduling to keep water usage near 850L benchmark.',
      },
      actionTaken: {
        title: 'Seasonal Irrigation Schedule Active (Simulated)',
        detail:
          'Simulated season log: scheduled irrigation intervals maintained through Stage 5.',
        loggedWindow: 'Stage 2–5 (Simulated Demo)',
        statusLabel: 'Simulated Action Logged',
      },
      observation: {
        title: 'Optimal Snapshot Status in Flowering Stage',
        detail:
          'Team snapshot records 92% Health Score and pH 6.5. Ground verification still required in production.',
        causalityDisclaimer:
          'Simulated season summary for hackathon workflow demonstration.',
      },
    },
  },
  'south-field-c3': {
    '7d': {
      id: 'ae-c3-7d',
      timeWindowLabel: '7-Day Simulated Tracking Window',
      priorSimulatedRisk: 'High Risk (Simulated)',
      currentSimulatedRisk: 'High Risk (Simulated)',
      issue: {
        title: 'Critical Moisture Deficit & High Water Draw at Seedling Stage',
        detail:
          'Team snapshot shows Critical status: Score 41%, card Humidity 18%, table Soil Moisture 41%, Temp 29°C, while Water Consumption is 2,100L and Fertilizer Efficiency is 62%.',
        snapshotReference:
          'Snapshot: Score 41% (Critical) • Card Humidity 18% • Soil Moisture 41% • Water 2,100L',
      },
      recommended: {
        title: 'Inspect Distribution Line Leaks & Apply Mulch / Pulse Drip',
        detail:
          'High water draw (2,100L on 1.8 Ha) paired with low soil moisture (41%) suggests distribution loss or runoff; inspect lines before increasing volume.',
      },
      actionTaken: {
        title: 'Emergency Line Audit & Pulse Irrigation Queued (Simulated)',
        detail:
          'Simulated 7-day log: irrigation line pressure audit and targeted seedling pulse cycle logged.',
        loggedWindow: 'Window T-1d (Simulated Demo)',
        statusLabel: 'Simulated Schedule Pending',
      },
      observation: {
        title: 'Remains in Critical Status (Score 41% Snapshot) — Unresolved',
        detail:
          'We do NOT fabricate recovery: current team snapshot remains Critical (41%). Immediate on-site inspection is required to verify whether seedling stress is stabilizing.',
        causalityDisclaimer:
          'Simulated emergency tracking. Field remains Critical in team snapshot; no verified improvement has occurred.',
      },
    },
    '30d': {
      id: 'ae-c3-30d',
      timeWindowLabel: '30-Day Simulated Tracking Window',
      priorSimulatedRisk: 'Elevated Watch (Simulated)',
      currentSimulatedRisk: 'High Risk (Simulated)',
      issue: {
        title: 'Progressive Moisture Decline & Elevated Temperature (29°C)',
        detail:
          'Over the 30-day simulated window, Soybean seedlings on 1.8 Ha experienced rising thermal stress (29°C snapshot) and declining fertilizer efficiency (62%).',
        snapshotReference: 'Snapshot: Temp 29°C • pH 5.2 • Fertilizer Efficiency 62%',
      },
      recommended: {
        title: 'Root-Zone Moisture Retention & Sub-Surface Line Check',
        detail:
          'Audit sub-surface delivery efficiency and evaluate temporary shade/mulch protection for seedlings.',
      },
      actionTaken: {
        title: 'Moisture Deficit Alert Escalated (Simulated)',
        detail:
          'Simulated 30-day log: field flagged as Critical priority and diagnostic check scheduled.',
        loggedWindow: 'Window W-1 (Simulated Demo)',
        statusLabel: 'Simulated Schedule Pending',
      },
      observation: {
        title: 'Critical Snapshot Persists (Score 41%)',
        detail:
          'Team snapshot indicates ongoing Critical status. Any future satellite thermal/moisture feed (ECOSTRESS/SMAP) must be paired with physical valve inspection.',
        causalityDisclaimer:
          'Simulated 30-day escalation record. Does not represent verified field recovery.',
      },
    },
    season: {
      id: 'ae-c3-season',
      timeWindowLabel: 'Season Simulated Tracking Window',
      priorSimulatedRisk: 'Moderate Risk (Simulated)',
      currentSimulatedRisk: 'High Risk (Simulated)',
      issue: {
        title: 'Vulnerable Seedling Establishment on 1.8 Ha Soybean Zone',
        detail:
          'South Field C3 shows the lowest health score (41%) and highest water consumption (2,100L) among all three demo zones.',
        snapshotReference: 'Snapshot: South Field C3 • 1.8 Ha • Seedling Stage • Critical',
      },
      recommended: {
        title: 'Comprehensive Irrigation Retrofit & Soil Organic Amendment',
        detail:
          'Address water retention capacity and pH 5.2 before next planting cycle.',
      },
      actionTaken: {
        title: 'Diagnostic Review Logged in Demo Planner (Simulated)',
        detail:
          'Simulated season log: zone marked for priority intervention and irrigation audit.',
        loggedWindow: 'Stage 5 (Simulated Demo)',
        statusLabel: 'Simulated Schedule Pending',
      },
      observation: {
        title: 'Requires Immediate Agronomic Intervention (Score 41%)',
        detail:
          'Current snapshot remains Critical. Demo simulation preserves the exact team snapshot without fabricating positive outcomes.',
        causalityDisclaimer:
          'Simulated season record. All historical nodes are unverified demo data.',
      },
    },
  },
};

const SIMULATED_RISK_HISTORY: Record<
  string,
  Record<TimeRangeKey, RiskHistoryNode[]>
> = {
  'north-field-a1': {
    '7d': [
      { slotLabel: 'T-6d', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated acidic pH watch (pH 2.8 snapshot context)', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-5d', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated lime buffer preparation', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-4d', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated sub-zone application', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-3d', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated moisture check (66% demo)', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-2d', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated vegetative canopy check', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-1d', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated pH follow-up pending', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Anchored to Team Snapshot: Score 70% (Equipment: Active, pH 2.8)', authenticity: 'Simulated Demo Data' },
    ],
    '30d': [
      { slotLabel: 'W-5', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated early vegetative acidity watch', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-4', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated soil core sampling week', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-3', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated lime buffering initiated', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-2', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated split fertilizer cycle', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-1', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated moisture stability check', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Anchored to Team Snapshot: Score 70% (Equipment: Active)', authenticity: 'Simulated Demo Data' },
    ],
    season: [
      { slotLabel: 'Stage 1', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated planting baseline', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 2', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated acidity detection', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 3', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated amendment protocol', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 4', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated vegetative monitoring', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 5', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated mid-season check', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Anchored to Team Snapshot: Score 70%', authenticity: 'Simulated Demo Data' },
    ],
  },
  'east-field-b2': {
    '7d': [
      { slotLabel: 'T-6d', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated stable flowering conditions', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-5d', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated moisture at 71%', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-4d', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated routine line check', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-3d', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated optimal canopy index', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-2d', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated preventative scouting', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-1d', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated steady 24°C window', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Anchored to Team Snapshot: Score 92% (Optimal, pH 6.5)', authenticity: 'Simulated Demo Data' },
    ],
    '30d': [
      { slotLabel: 'W-5', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated pre-flowering nutrient check', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-4', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated emitter calibration', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-3', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated foliar support pass', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-2', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated flowering onset', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-1', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated uniform moisture 72%', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Anchored to Team Snapshot: Score 92% (Optimal)', authenticity: 'Simulated Demo Data' },
    ],
    season: [
      { slotLabel: 'Stage 1', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated emergence baseline', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 2', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated tillering moisture adjustment', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 3', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated balanced nutrition', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 4', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated heading stage', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 5', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Simulated flowering stability', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'Low Risk (Simulated)', severityLevel: 1, summary: 'Anchored to Team Snapshot: Score 92% (Optimal)', authenticity: 'Simulated Demo Data' },
    ],
  },
  'south-field-c3': {
    '7d': [
      { slotLabel: 'T-6d', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated moisture drop below 52%', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-5d', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated warm spell (28°C)', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-4d', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated high water draw vs low retention', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-3d', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated seedling stress alert', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-2d', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated line pressure audit requested', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'T-1d', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated pulse irrigation queued', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Anchored to Team Snapshot: Score 41% (Critical, Soil Moisture 41%)', authenticity: 'Simulated Demo Data' },
    ],
    '30d': [
      { slotLabel: 'W-5', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated early seeding baseline', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-4', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated declining topsoil moisture', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-3', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated fertilizer efficiency dip', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-2', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated water consumption spike (2,100L)', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'W-1', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated critical seedling stress', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Anchored to Team Snapshot: Score 41% (Critical)', authenticity: 'Simulated Demo Data' },
    ],
    season: [
      { slotLabel: 'Stage 1', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated pre-seeding soil prep (pH 5.2)', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 2', simulatedRisk: 'Moderate Risk (Simulated)', severityLevel: 2, summary: 'Simulated germination phase', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 3', simulatedRisk: 'Elevated Watch (Simulated)', severityLevel: 3, summary: 'Simulated rainfall deficit window', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 4', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated irrigation line inefficiency', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Stage 5', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Simulated critical moisture alert', authenticity: 'Simulated Demo Data' },
      { slotLabel: 'Snapshot (Demo)', simulatedRisk: 'High Risk (Simulated)', severityLevel: 4, summary: 'Anchored to Team Snapshot: Score 41% (Critical)', authenticity: 'Simulated Demo Data' },
    ],
  },
};

const SIMULATED_ACTIVITY_LOGS: ActivityTimelineItem[] = [
  {
    id: 'act-1',
    fieldId: 'south-field-c3',
    fieldName: 'South Field C3',
    cropType: 'Soybean Plantation',
    timeRangeMembership: ['7d', '30d', 'season'],
    relativeTimeLabel: 'Window T-1d (Demo)',
    observationDate: null,
    category: 'irrigation',
    categoryLabel: 'Irrigation',
    operationTitle: 'Emergency Distribution Line Audit & Pulse Cycle',
    operationDetail:
      'Simulated log: queued line pressure check to investigate 2,100L water draw vs. 41% table Soil Moisture in Seedling zone.',
    statusLabel: 'Simulated Scheduled',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-2',
    fieldId: 'east-field-b2',
    fieldName: 'East Field B2',
    cropType: 'Wheat Plantation',
    timeRangeMembership: ['7d', '30d', 'season'],
    relativeTimeLabel: 'Window T-2d (Demo)',
    observationDate: null,
    category: 'inspection',
    categoryLabel: 'Inspection',
    operationTitle: 'Flowering Stage Canopy & Head Scouting',
    operationDetail:
      'Simulated log: routine visual check on 4.1 Ha Wheat zone (Snapshot Score 92%, Optimal).',
    statusLabel: 'Simulated Record',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-3',
    fieldId: 'north-field-a1',
    fieldName: 'North Field A1',
    cropType: 'Corn Plantation',
    timeRangeMembership: ['7d', '30d', 'season'],
    relativeTimeLabel: 'Window T-3d (Demo)',
    observationDate: null,
    category: 'nutrition',
    categoryLabel: 'Nutrition & Soil',
    operationTitle: 'Dolomitic Lime Sub-Zone Buffering Trial',
    operationDetail:
      'Simulated log: staged lime buffering trial addressing acidic pH 2.8 team snapshot on 2.3 Ha Corn plot.',
    statusLabel: 'Simulated Pending Review',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-4',
    fieldId: 'south-field-c3',
    fieldName: 'South Field C3',
    cropType: 'Soybean Plantation',
    timeRangeMembership: ['7d', '30d', 'season'],
    relativeTimeLabel: 'Window T-5d (Demo)',
    observationDate: null,
    category: 'inspection',
    categoryLabel: 'Inspection',
    operationTitle: 'Thermal & Topsoil Stress Flag Logged',
    operationDetail:
      'Simulated log: seedling stress noted alongside 29°C table temperature and 18% card humidity snapshot.',
    statusLabel: 'Simulated Record',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-5',
    fieldId: 'north-field-a1',
    fieldName: 'North Field A1',
    cropType: 'Corn Plantation',
    timeRangeMembership: ['30d', 'season'],
    relativeTimeLabel: 'Window W-2 (Demo)',
    observationDate: null,
    category: 'nutrition',
    categoryLabel: 'Nutrition & Soil',
    operationTitle: 'Split Nitrogen Application & pH Core Sampling',
    operationDetail:
      'Simulated 30-day log: split nutrient application aligned with 87% fertilizer efficiency snapshot.',
    statusLabel: 'Simulated Record',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-6',
    fieldId: 'east-field-b2',
    fieldName: 'East Field B2',
    cropType: 'Wheat Plantation',
    timeRangeMembership: ['30d', 'season'],
    relativeTimeLabel: 'Window W-3 (Demo)',
    observationDate: null,
    category: 'irrigation',
    categoryLabel: 'Irrigation',
    operationTitle: 'Emitter Flow Calibration (850L Benchmark)',
    operationDetail:
      'Simulated 30-day log: verified drip/sprinkler uniformity across 4.1 Ha prior to flowering.',
    statusLabel: 'Simulated Record',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-7',
    fieldId: 'south-field-c3',
    fieldName: 'South Field C3',
    cropType: 'Soybean Plantation',
    timeRangeMembership: ['30d', 'season'],
    relativeTimeLabel: 'Window W-4 (Demo)',
    observationDate: null,
    category: 'nutrition',
    categoryLabel: 'Nutrition & Soil',
    operationTitle: 'Seedling Foliar & Root Nutrient Check',
    operationDetail:
      'Simulated 30-day log: evaluated nutrient uptake efficiency (62% snapshot) under pH 5.2 conditions.',
    statusLabel: 'Simulated Pending Review',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-8',
    fieldId: 'east-field-b2',
    fieldName: 'East Field B2',
    cropType: 'Wheat Plantation',
    timeRangeMembership: ['season'],
    relativeTimeLabel: 'Stage 2 (Demo)',
    observationDate: null,
    category: 'nutrition',
    categoryLabel: 'Nutrition & Soil',
    operationTitle: 'Baseline Soil pH 6.5 Verification & Topdressing',
    operationDetail:
      'Simulated season log: early-season nutrient balance check for East Field B2.',
    statusLabel: 'Simulated Record',
    authenticity: 'Simulated Demo Data',
  },
  {
    id: 'act-9',
    fieldId: 'north-field-a1',
    fieldName: 'North Field A1',
    cropType: 'Corn Plantation',
    timeRangeMembership: ['season'],
    relativeTimeLabel: 'Stage 1 (Demo)',
    observationDate: null,
    category: 'irrigation',
    categoryLabel: 'Irrigation',
    operationTitle: 'Vegetative Zone Baseline Meter Setup (1,250L)',
    operationDetail:
      'Simulated season log: baseline flow allocation configured for 2.3 Ha Corn Plantation.',
    statusLabel: 'Simulated Record',
    authenticity: 'Simulated Demo Data',
  },
];

function getSnapshotValueLabel(metric: EnvMetricKey, fieldId: string): string {
  const snap = TABLE_SNAPSHOT_BY_FIELD[fieldId];
  if (!snap) return 'N/A';
  switch (metric) {
    case 'soilMoisture':
      return `${snap.soilMoisture} (Table Snapshot)`;
    case 'temperature':
      return `${snap.temperature} (Table Snapshot)`;
    case 'ndvi':
      return 'No Team Snapshot (Simulated)';
    case 'rainfall':
      return 'No mm Snapshot (Simulated)';
  }
}

function buildNasaEnvironmentalBundle(
  query: ReportsQuery,
  nasaResult: NasaPowerDailyResult
): EnvironmentalTrendBundle {
  const paramCode = query.metric === 'temperature' ? 'T2M' : 'PRECTOTCORR';
  const paramSeries = nasaResult.series[paramCode];
  const validPoints: EnvTrendPoint[] = paramSeries.points
    .filter((pt) => !pt.isMissing && pt.value !== null)
    .map((pt) => ({
      pointLabel: pt.shortLabel,
      isoDate: pt.isoDate,
      value: pt.value as number,
      origin: 'NASA POWER Modeled / Assimilated Data',
    }));

  const startIso =
    nasaResult.startDate.length === 8
      ? `${nasaResult.startDate.slice(0, 4)}-${nasaResult.startDate.slice(
          4,
          6
        )}-${nasaResult.startDate.slice(6, 8)}`
      : nasaResult.startDate;
  const endIso =
    nasaResult.endDate.length === 8
      ? `${nasaResult.endDate.slice(0, 4)}-${nasaResult.endDate.slice(
          4,
          6
        )}-${nasaResult.endDate.slice(6, 8)}`
      : nasaResult.endDate;

  const locationTitle =
    query.nasaLocationLabel ||
    `Lat ${nasaResult.requestedLatitude.toFixed(4)}°, Lon ${nasaResult.requestedLongitude.toFixed(
      4
    )}°`;

  const nasaLiveDetails: NasaLiveProvenanceDetails = {
    parameterCode: paramCode,
    parameterLongname: paramSeries.longname,
    rawUnit: paramSeries.rawUnit,
    displayUnit: paramSeries.displayUnit,
    requestedLatitude: nasaResult.requestedLatitude,
    requestedLongitude: nasaResult.requestedLongitude,
    returnedLatitude: nasaResult.returnedCoordinates.latitude,
    returnedLongitude: nasaResult.returnedCoordinates.longitude,
    elevationMeters: nasaResult.returnedCoordinates.elevationMeters,
    headerTitle: nasaResult.headerTitle,
    apiName: nasaResult.apiName,
    apiVersion: nasaResult.apiVersion,
    sources: nasaResult.sources,
    fillValue: nasaResult.fillValue,
    timeStandard: nasaResult.timeStandard,
    startDateIso: startIso,
    endDateIso: endIso,
    validCount: paramSeries.validCount,
    missingCount: paramSeries.missingCount,
    fromCache: nasaResult.fromCache,
    requestUrl: nasaResult.requestUrl,
  };

  const metadata: MetricProvenanceMetadata = {
    metric: query.metric,
    label: `${paramSeries.longname} (${paramCode})`,
    unit: paramSeries.displayUnit,
    currentProvider: `${nasaResult.apiName} (${nasaResult.apiVersion}) • Sources: ${
      nasaResult.sources.join(', ') || 'NASA POWER'
    }`,
    snapshotAuthenticity: 'NASA POWER Modeled / Assimilated Data',
    seriesAuthenticity: 'NASA POWER Modeled / Assimilated Data',
    plannedNasaProducts: [
      `Active: NASA POWER ${paramCode} (${nasaResult.headerTitle})`,
      query.metric === 'temperature'
        ? 'Planned high-res thermal: NASA ECOSTRESS LST (~70m)'
        : 'Planned high-res precipitation: NASA GPM IMERG (~10km)',
    ],
    observationDate: `${startIso} to ${endIso} (Historical Archive, ${nasaResult.timeStandard})`,
    knownSpatialResolution: nasaResult.spatialResolution,
    knownTemporalResolution: `${nasaResult.temporalResolution} (${nasaResult.timeStandard})`,
    plannedNasaSpatialResolutionNote: nasaResult.spatialResolution,
    plannedNasaTemporalResolutionNote: nasaResult.temporalResolution,
    processingMethod: `Live HTTP GET from power.larc.nasa.gov (community=AG). Fill value (${nasaResult.fillValue}) filtered out.`,
    uncertaintyAndLimitations:
      'NASA POWER provides regional 0.5° × 0.625° (~50 km) modeled/assimilated historical climate grid data. It must NOT be claimed as in-field sensor measurement or real-time weather forecast.',
    metricDistinctionNote: `Historical archive window (${startIso} – ${endIso}) for ${locationTitle}. Valid days: ${paramSeries.validCount}, Missing (${nasaResult.fillValue}): ${paramSeries.missingCount}.`,
  };

  if (validPoints.length === 0) {
    return {
      metric: query.metric,
      timeRange: query.timeRange,
      dataMode: 'nasa-power',
      metricAvailability: 'no-valid-points',
      unavailableReason: `All ${paramSeries.points.length} requested days returned NASA POWER fill_value (${nasaResult.fillValue}). This typically occurs for very recent dates due to 2–7 day assimilation latency.`,
      metadata,
      nasaLiveDetails,
      seriesByField: [],
    };
  }

  const latestVal = validPoints[validPoints.length - 1].value;
  const formattedLatest =
    query.metric === 'temperature' ? `${latestVal}°C` : `${latestVal} mm/day`;

  return {
    metric: query.metric,
    timeRange: query.timeRange,
    dataMode: 'nasa-power',
    metricAvailability: 'available',
    metadata,
    nasaLiveDetails,
    seriesByField: [
      {
        fieldId: 'nasa-power-grid',
        fieldName: `NASA POWER Grid (${nasaResult.requestedLatitude.toFixed(
          3
        )}°, ${nasaResult.requestedLongitude.toFixed(3)}°)`,
        strokeColor: query.metric === 'temperature' ? '#166534' : '#0284c7',
        badgeClass: 'bg-green-100 text-green-800',
        snapshotValueLabel: `${formattedLatest} (on ${
          validPoints[validPoints.length - 1].isoDate
        })`,
        snapshotAuthenticity: 'NASA POWER Modeled / Assimilated Data',
        points: validPoints,
      },
    ],
  };
}

export const demoReportsHistoryProvider: ReportsHistoryDataProvider = {
  providerId: 'cropwise-hybrid-reports-provider',
  providerLabel: 'CropWise Reports Provider (Demo + Live NASA POWER Adapter)',
  providerMode: 'nasa-hybrid',

  async fetchReportsBundle(
    query: ReportsQuery,
    options?: { signal?: AbortSignal }
  ): Promise<ReportsHistoryBundle> {
    const mode: DataMode = query.dataMode ?? 'demo';

    if (query.simulateState === 'error') {
      throw new Error(
        'Simulated data provider error: Unable to load observation bundle (Demo error state test).'
      );
    }

    const farmContext = TEAM_DEMO_FARM_CONTEXT;

    if (query.simulateState === 'empty') {
      return {
        dataMode: mode,
        farmContext,
        actionEffects: [],
        environmentalTrend: {
          metric: query.metric,
          timeRange: query.timeRange,
          dataMode: mode,
          metricAvailability: 'available',
          metadata: METRIC_METADATA[query.metric],
          seriesByField: [],
        },
        riskHistory: [],
        activityTimeline: [],
      };
    }

    const targetFields =
      query.fieldFilter === 'all'
        ? farmContext.fields
        : farmContext.fields.filter((f) => f.fieldId === query.fieldFilter);

    const activeFields = targetFields.length > 0 ? targetFields : farmContext.fields;

    // 1. Action Effect records (always anchored to Team Demo Snapshot + Simulated Demo workflow)
    const actionEffects: ActionEffectRecord[] = activeFields.map((field) => {
      const template = ACTION_EFFECT_BY_FIELD[field.fieldId][query.timeRange];
      return {
        ...template,
        fieldId: field.fieldId,
        fieldName: field.name,
        cropType: field.cropType,
        timeRange: query.timeRange,
        scenarioAuthenticity: 'Simulated Demo Data',
        snapshotAuthenticity: 'Team-provided Demo Snapshot',
        snapshotScore: field.snapshotScore,
        equipmentStatusSnapshot: field.equipmentStatus,
        overviewDisplayStatus: field.overviewDisplayStatus,
        badgeClass: field.badgeClass,
      };
    });

    // 2. Risk History rows
    const riskHistory: FieldRiskHistoryRow[] = activeFields.map((field) => ({
      fieldId: field.fieldId,
      fieldName: field.name,
      cropType: field.cropType,
      snapshotScore: field.snapshotScore,
      equipmentStatusSnapshot: field.equipmentStatus,
      snapshotAuthenticity: 'Team-provided Demo Snapshot',
      seriesAuthenticity: 'Simulated Demo Data',
      nodes: SIMULATED_RISK_HISTORY[field.fieldId][query.timeRange],
    }));

    // 3. Activity Timeline
    const allowedFieldIds = new Set(activeFields.map((f) => f.fieldId));
    const activityTimeline = SIMULATED_ACTIVITY_LOGS.filter((item) => {
      const matchesField = allowedFieldIds.has(item.fieldId);
      const matchesRange = item.timeRangeMembership.includes(query.timeRange);
      const matchesCategory =
        query.activityCategory === 'all' || item.category === query.activityCategory;
      return matchesField && matchesRange && matchesCategory;
    });

    // 4. Environmental Trend: branch by DataMode ('demo' vs 'nasa-power')
    if (mode === 'nasa-power') {
      if (query.metric === 'soilMoisture' || query.metric === 'ndvi') {
        const baseMeta = METRIC_METADATA[query.metric];
        return {
          dataMode: 'nasa-power',
          farmContext,
          actionEffects,
          environmentalTrend: {
            metric: query.metric,
            timeRange: query.timeRange,
            dataMode: 'nasa-power',
            metricAvailability: 'unavailable-in-nasa-power',
            unavailableReason:
              query.metric === 'soilMoisture'
                ? 'Soil Moisture is not provided by the connected NASA POWER query (T2M / PRECTOTCORR). Planned NASA integration: SMAP L3/L4 & ECOSTRESS. Switch to Demo Data mode to view simulated Soil Moisture curves.'
                : 'NDVI is an optical vegetation index not provided by NASA POWER meteorology. Planned NASA integration: Landsat 8/9 OLI & MODIS MOD13Q1. Switch to Demo Data mode to view simulated NDVI curves.',
            metadata: {
              ...baseMeta,
              currentProvider: 'Not connected in NASA POWER mode (T2M & PRECTOTCORR only)',
            },
            seriesByField: [],
          },
          riskHistory,
          activityTimeline,
        };
      }

      const lat = query.nasaLatitude ?? NASA_PUBLIC_TEST_LOCATIONS[0].latitude;
      const lon = query.nasaLongitude ?? NASA_PUBLIC_TEST_LOCATIONS[0].longitude;
      const windowSpec = NASA_HISTORICAL_WINDOWS[query.timeRange];

      const nasaResult = await fetchNasaPowerDaily({
        latitude: lat,
        longitude: lon,
        startDate: windowSpec.startDate,
        endDate: windowSpec.endDate,
        signal: options?.signal,
      });

      const environmentalTrend = buildNasaEnvironmentalBundle(query, nasaResult);

      return {
        dataMode: 'nasa-power',
        farmContext,
        actionEffects,
        environmentalTrend,
        riskHistory,
        activityTimeline,
      };
    }

    // Default Demo Mode execution
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 30);
      if (options?.signal) {
        if (options.signal.aborted) {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        options.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      }
    });

    const timeSlots = TIME_SLOTS_BY_RANGE[query.timeRange];
    const metadata = METRIC_METADATA[query.metric];
    const seriesByField: FieldEnvTrendSeries[] = activeFields.map((field) => {
      const rawNumbers = SIMULATED_ENV_VALUES[query.metric][field.fieldId][query.timeRange];
      const tableSnap = TABLE_SNAPSHOT_BY_FIELD[field.fieldId];
      const points: EnvTrendPoint[] = rawNumbers.map((val, idx) => {
        const isLast = idx === rawNumbers.length - 1;
        const isTeamSnapshotPoint =
          isLast && (query.metric === 'soilMoisture' || query.metric === 'temperature');
        return {
          pointLabel: timeSlots[idx] || `P${idx + 1}`,
          value: val,
          origin: isTeamSnapshotPoint
            ? 'Team-provided Demo Snapshot'
            : 'Simulated Demo Data',
        };
      });

      return {
        fieldId: field.fieldId,
        fieldName: field.name,
        strokeColor: tableSnap.strokeColor,
        badgeClass: field.badgeClass,
        snapshotValueLabel: getSnapshotValueLabel(query.metric, field.fieldId),
        snapshotAuthenticity: metadata.snapshotAuthenticity,
        points,
      };
    });

    return {
      dataMode: 'demo',
      farmContext,
      actionEffects,
      environmentalTrend: {
        metric: query.metric,
        timeRange: query.timeRange,
        dataMode: 'demo',
        metricAvailability: 'available',
        metadata,
        seriesByField,
      },
      riskHistory,
      activityTimeline,
    };
  },
};
