import { validateCoordinates, type NasaPowerDailyResult } from './nasaPowerClient';
import {
  getSharedFarmLocationState,
  setSharedFarmLocationState,
  type PlannerGoalId,
  type QualitativeRating,
  type StrategyId,
  type TradeOffCellEvaluation,
  type TradeOffDimensionKey,
  type VerifiedFarmLocation,
} from '../data/decisionPlannerData';

export type ExperienceMode = 'my-farm' | 'explore-demo';

export type CurrentCropKey =
  | 'corn'
  | 'wheat'
  | 'soybean'
  | 'rice'
  | 'barley'
  | 'sorghum'
  | 'canola'
  | 'fallow';

export type IrrigationAvailability =
  | 'none-rainfed'
  | 'limited-supplemental'
  | 'reliable-irrigated'
  | 'not-specified';

export type HistoricalWindowId =
  | '7d'
  | '30d'
  | 'season'
  | 'summer-90d'
  | 'spring-90d'
  | 'custom';

export type BotanicalFamily =
  | 'Poaceae'
  | 'Fabaceae'
  | 'Brassicaceae'
  | 'Pedaliaceae'
  | 'Polygonaceae';

export interface MyFarmProfile {
  experienceMode: ExperienceMode;
  farmName: string;
  currentCrop: CurrentCropKey;
  soilPhInput: string; // raw string so input stays controlled; parsed into number | null
  soilPh: number | null;
  irrigationAvailability: IrrigationAvailability;
  primaryGoal: PlannerGoalId;
  historicalWindow: HistoricalWindowId;
  customStartDate: string; // YYYY-MM-DD
  customEndDate: string;   // YYYY-MM-DD
  notesConstraint: string;
}

export interface HistoricalWindowOption {
  id: HistoricalWindowId;
  label: string;
  shortLabel: string;
  startDate: string; // YYYYMMDD
  endDate: string;   // YYYYMMDD
  startIso: string;  // YYYY-MM-DD
  endIso: string;    // YYYY-MM-DD
  daySpan: number;
  isShortWindow: boolean;
  displayRange: string;
  scopeNote: string;
}

export const REAL_FARM_HISTORICAL_WINDOWS: Record<
  Exclude<HistoricalWindowId, 'custom'>,
  HistoricalWindowOption
> = {
  '30d': {
    id: '30d',
    label: 'Preset: 30-Day Autumn Window (2025-09-08 to 2025-10-07)',
    shortLabel: '30D (Sep–Oct 2025)',
    startDate: '20250908',
    endDate: '20251007',
    startIso: '2025-09-08',
    endIso: '2025-10-07',
    daySpan: 30,
    isShortWindow: true,
    displayRange: '2025-09-08 to 2025-10-07 (30-Day Historical Archive)',
    scopeNote:
      'Short 30-day historical window from NASA POWER. Useful for reproducible equinox comparison, but a 30-day average is NOT sufficient to establish full growing-season crop suitability.',
  },
  season: {
    id: 'season',
    label: 'Preset: 60-Day Late-Summer / Autumn Window (2025-08-09 to 2025-10-07)',
    shortLabel: '60D (Aug–Oct 2025)',
    startDate: '20250809',
    endDate: '20251007',
    startIso: '2025-08-09',
    endIso: '2025-10-07',
    daySpan: 60,
    isShortWindow: false,
    displayRange: '2025-08-09 to 2025-10-07 (60-Day Historical Archive)',
    scopeNote:
      '60-day historical archive capturing late-summer into early-autumn regional temperature and rainfall. Historical archive only — not a seasonal forecast.',
  },
  'summer-90d': {
    id: 'summer-90d',
    label: 'Preset: 90-Day Jun–Aug Window (2025-06-01 to 2025-08-29)',
    shortLabel: '90D (Jun–Aug 2025)',
    startDate: '20250601',
    endDate: '20250829',
    startIso: '2025-06-01',
    endIso: '2025-08-29',
    daySpan: 90,
    isShortWindow: false,
    displayRange: '2025-06-01 to 2025-08-29 (90-Day Historical Archive)',
    scopeNote:
      '90-day June–August historical archive representing peak boreal summer / austral winter conditions. Multi-year local climate review is still required.',
  },
  'spring-90d': {
    id: 'spring-90d',
    label: 'Preset: 90-Day Mar–May Window (2025-03-01 to 2025-05-29)',
    shortLabel: '90D (Mar–May 2025)',
    startDate: '20250301',
    endDate: '20250529',
    startIso: '2025-03-01',
    endIso: '2025-05-29',
    daySpan: 90,
    isShortWindow: false,
    displayRange: '2025-03-01 to 2025-05-29 (90-Day Historical Archive)',
    scopeNote:
      '90-day March–May historical archive representing boreal spring / austral autumn conditions. Multi-year local climate review is still required.',
  },
  '7d': {
    id: '7d',
    label: 'Preset: 7-Day Diagnostic Test Window (2025-10-01 to 2025-10-07)',
    shortLabel: '7D Test (Oct 2025)',
    startDate: '20251001',
    endDate: '20251007',
    startIso: '2025-10-01',
    endIso: '2025-10-07',
    daySpan: 7,
    isShortWindow: true,
    displayRange: '2025-10-01 to 2025-10-07 (7-Day Diagnostic Archive)',
    scopeNote:
      'Short 7-day diagnostic window for rapid API verification only — a 7-day average cannot establish full growing-season crop suitability.',
  },
};

export interface DateRangeValidationResult {
  valid: boolean;
  error: string | null;
  startIso: string;
  endIso: string;
  startDateYmd: string;
  endDateYmd: string;
  daySpan: number;
  isShortWindow: boolean;
}

function parseStrictIsoDate(iso: string): Date | null {
  const trimmed = (iso || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

export function getMaxHistoricalDateIso(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function validateHistoricalDateRange(
  startIso: string,
  endIso: string
): DateRangeValidationResult {
  const startDt = parseStrictIsoDate(startIso);
  const endDt = parseStrictIsoDate(endIso);
  if (!startDt || !endDt) {
    return {
      valid: false,
      error: 'Please enter valid calendar dates in YYYY-MM-DD format (e.g., 2024-05-01 to 2024-07-29).',
      startIso,
      endIso,
      startDateYmd: '',
      endDateYmd: '',
      daySpan: 0,
      isShortWindow: true,
    };
  }

  const minArchiveDt = new Date(Date.UTC(1981, 0, 1));
  const nowUtc = new Date();
  const todayUtc = new Date(
    Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate())
  );

  if (startDt < minArchiveDt) {
    return {
      valid: false,
      error: 'Start date cannot be earlier than 1981-01-01 (start of NASA POWER daily archive).',
      startIso,
      endIso,
      startDateYmd: '',
      endDateYmd: '',
      daySpan: 0,
      isShortWindow: true,
    };
  }

  if (startDt > todayUtc || endDt > todayUtc) {
    return {
      valid: false,
      error: `Future dates are not permitted. Please select historical dates on or before today (${getMaxHistoricalDateIso()}).`,
      startIso,
      endIso,
      startDateYmd: '',
      endDateYmd: '',
      daySpan: 0,
      isShortWindow: true,
    };
  }

  if (startDt > endDt) {
    return {
      valid: false,
      error: 'Historical start date must be on or before the end date.',
      startIso,
      endIso,
      startDateYmd: '',
      endDateYmd: '',
      daySpan: 0,
      isShortWindow: true,
    };
  }

  const daySpan =
    Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (daySpan < 3) {
    return {
      valid: false,
      error: 'Please select a historical window of at least 3 days.',
      startIso,
      endIso,
      startDateYmd: '',
      endDateYmd: '',
      daySpan,
      isShortWindow: true,
    };
  }
  if (daySpan > 366) {
    return {
      valid: false,
      error: 'Please select a historical window of 366 days or fewer per query for responsive analysis.',
      startIso,
      endIso,
      startDateYmd: '',
      endDateYmd: '',
      daySpan,
      isShortWindow: false,
    };
  }

  const sClean = startIso.trim();
  const eClean = endIso.trim();
  return {
    valid: true,
    error: null,
    startIso: sClean,
    endIso: eClean,
    startDateYmd: sClean.replace(/-/g, ''),
    endDateYmd: eClean.replace(/-/g, ''),
    daySpan,
    isShortWindow: daySpan < 60,
  };
}

export function resolveActiveHistoricalWindow(
  profile: MyFarmProfile
): HistoricalWindowOption {
  if (profile.historicalWindow !== 'custom') {
    return REAL_FARM_HISTORICAL_WINDOWS[profile.historicalWindow] ?? REAL_FARM_HISTORICAL_WINDOWS['30d'];
  }
  const check = validateHistoricalDateRange(
    profile.customStartDate,
    profile.customEndDate
  );
  if (!check.valid) {
    // Safe fallback to 2024-05-01..2024-07-29 if custom draft is temporarily invalid
    return {
      id: 'custom',
      label: 'Custom Historical Date Range (2024-05-01 to 2024-07-29)',
      shortLabel: 'Custom (2024-05-01..2024-07-29)',
      startDate: '20240501',
      endDate: '20240729',
      startIso: '2024-05-01',
      endIso: '2024-07-29',
      daySpan: 90,
      isShortWindow: false,
      displayRange: '2024-05-01 to 2024-07-29 (90-Day Custom Historical Archive)',
      scopeNote:
        'Custom user-selected historical NASA POWER window. Historical observations are not weather forecasts.',
    };
  }
  return {
    id: 'custom',
    label: `Custom Historical Date Range (${check.startIso} to ${check.endIso})`,
    shortLabel: `Custom (${check.startIso} to ${check.endIso}, ${check.daySpan}D)`,
    startDate: check.startDateYmd,
    endDate: check.endDateYmd,
    startIso: check.startIso,
    endIso: check.endIso,
    daySpan: check.daySpan,
    isShortWindow: check.isShortWindow,
    displayRange: `${check.startIso} to ${check.endIso} (${check.daySpan}-Day Custom Historical Archive)`,
    scopeNote: check.isShortWindow
      ? `Custom ${check.daySpan}-day historical archive. Because this window is shorter than a full 90–150 day crop cycle, mean temperature and rainfall are preliminary screening signals only.`
      : `Custom ${check.daySpan}-day historical archive from NASA POWER. Reflects past regional climate for the selected dates — not a future forecast.`,
  };
}

export interface CurrentCropMetadata {
  key: CurrentCropKey;
  label: string;
  botanicalName: string;
  family: BotanicalFamily | 'None';
  isNitrogenFixer: boolean;
  typicalResidue: 'High C:N Straw' | 'Low C:N Fragile Residue' | 'Moderate Residue' | 'Bare / Fallow';
  rotationGuidance: string;
}

export const CURRENT_CROP_OPTIONS: readonly CurrentCropMetadata[] = [
  {
    key: 'corn',
    label: 'Corn / Maize (Zea mays)',
    botanicalName: 'Zea mays',
    family: 'Poaceae',
    isNitrogenFixer: false,
    typicalResidue: 'High C:N Straw',
    rotationGuidance:
      'High nitrogen demand cereal (Poaceae). Benefits strongly from rotating into a nitrogen-fixing legume (Fabaceae) or broadleaf break crop to disrupt rootworm and stalk-rot cycles.',
  },
  {
    key: 'wheat',
    label: 'Wheat (Triticum aestivum)',
    botanicalName: 'Triticum aestivum',
    family: 'Poaceae',
    isNitrogenFixer: false,
    typicalResidue: 'High C:N Straw',
    rotationGuidance:
      'Small-grain cereal (Poaceae). Repeating wheat builds take-all root rot and grass weeds; rotating into pulse legumes, brassica oilseeds, or disease-suppressive oats is recommended.',
  },
  {
    key: 'soybean',
    label: 'Soybean (Glycine max)',
    botanicalName: 'Glycine max',
    family: 'Fabaceae',
    isNitrogenFixer: true,
    typicalResidue: 'Low C:N Fragile Residue',
    rotationGuidance:
      'Nitrogen-fixing legume (Fabaceae). Leaves biological N credit but sparse surface residue; rotate into a non-legume cereal or oilseed to monetize N credit and prevent Soybean Cyst Nematode / root rot buildup.',
  },
  {
    key: 'rice',
    label: 'Rice (Oryza sativa)',
    botanicalName: 'Oryza sativa',
    family: 'Poaceae',
    isNitrogenFixer: false,
    typicalResidue: 'High C:N Straw',
    rotationGuidance:
      'Cereal grain (Poaceae). Post-rice upland rotation into short-season pulses (mungbean, cowpea, soybean) or oilseeds breaks stem-borer cycles and restores soil nitrogen.',
  },
  {
    key: 'barley',
    label: 'Barley (Hordeum vulgare)',
    botanicalName: 'Hordeum vulgare',
    family: 'Poaceae',
    isNitrogenFixer: false,
    typicalResidue: 'High C:N Straw',
    rotationGuidance:
      'Small-grain cereal (Poaceae). Rotate into broadleaf oilseeds (canola/mustard) or pulses (pea/lentil/chickpea) to prevent cereal fungal carry-over.',
  },
  {
    key: 'sorghum',
    label: 'Sorghum / Millet (C4 Cereal)',
    botanicalName: 'Sorghum bicolor / Pennisetum glaucum',
    family: 'Poaceae',
    isNitrogenFixer: false,
    typicalResidue: 'High C:N Straw',
    rotationGuidance:
      'Drought-hardy C4 cereal (Poaceae). Follow with a deep-rooted or nitrogen-fixing pulse (cowpea, chickpea, pigeon pea, soybean) or broadleaf oilseed (sesame) to replenish soil nitrogen.',
  },
  {
    key: 'canola',
    label: 'Canola / Rapeseed (Brassica napus)',
    botanicalName: 'Brassica napus',
    family: 'Brassicaceae',
    isNitrogenFixer: false,
    typicalResidue: 'Moderate Residue',
    rotationGuidance:
      'Brassica oilseed (Brassicaceae). Avoid back-to-back brassicas due to clubroot and blackleg risk; rotate into cereals or pulse legumes.',
  },
  {
    key: 'fallow',
    label: 'Fallow / Uncropped / New Parcel',
    botanicalName: 'No Prior Crop Specified',
    family: 'None',
    isNitrogenFixer: false,
    typicalResidue: 'Bare / Fallow',
    rotationGuidance:
      'Uncropped or fallow baseline. Establishing living root cover or a climate-adapted pioneer cash/legume crop helps prevent erosion and build soil organic matter.',
  },
] as const;

export const IRRIGATION_OPTIONS: readonly {
  id: IrrigationAvailability;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: 'none-rainfed',
    label: 'Rainfed Only (No Irrigation)',
    shortLabel: 'Rainfed Only',
    description: 'Relies entirely on natural precipitation and stored soil moisture.',
  },
  {
    id: 'limited-supplemental',
    label: 'Limited / Supplemental Irrigation',
    shortLabel: 'Limited Irrigation',
    description: 'Can supply targeted water during critical flowering or establishment dry spells.',
  },
  {
    id: 'reliable-irrigated',
    label: 'Reliable Full Irrigation',
    shortLabel: 'Reliable Irrigation',
    description: 'Dependable seasonal water delivery capable of supporting higher-transpiration crops.',
  },
  {
    id: 'not-specified',
    label: 'Not Provided (Unknown Water Access)',
    shortLabel: 'Not Provided',
    description: 'Irrigation capacity unknown; water-sensitive crops will be flagged for local review.',
  },
] as const;

export const GLOBAL_QUICK_LOCATIONS: readonly {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  climateHint: string;
}[] = [
  {
    id: 'london-uk',
    label: 'London, UK',
    latitude: 51.5074,
    longitude: -0.1278,
    climateHint: 'Cool-temperate maritime reference (51.5074°, -0.1278°)',
  },
  {
    id: 'cairo-eg',
    label: 'Cairo, Egypt',
    latitude: 30.0444,
    longitude: 31.2357,
    climateHint: 'Warm/hot arid Nile region reference (30.0444°, 31.2357°)',
  },
  {
    id: 'putrajaya-my',
    label: 'Putrajaya, Malaysia',
    latitude: 2.9264,
    longitude: 101.6964,
    climateHint: 'Warm-humid equatorial reference (2.9264°, 101.6964°)',
  },
] as const;

export interface CandidateCropSpec {
  id: string;
  cropName: string;
  botanicalName: string;
  family: BotanicalFamily;
  categoryLabel: string;
  rotationRole: 'Nitrogen-Fixing Pulse' | 'Broadleaf Oilseed Break' | 'Disease-Suppressive Cereal' | 'Drought-Buffered Cereal' | 'Short-Window Pseudocereal / Cover';
  isNitrogenFixer: boolean;
  // Provisional screening thresholds (unvalidated heuristic ranges — require local agronomic review)
  thermalOptimalMinC: number;
  thermalOptimalMaxC: number;
  thermalTolerableMinC: number;
  thermalTolerableMaxC: number;
  waterDemandTier: 'very-low' | 'low' | 'moderate' | 'high';
  minRainfedMmPerDay: number;
  maxTolerableRainMmPerDay: number; // Above this, disease/waterlogging watch applies
  phOptimalMin: number;
  phOptimalMax: number;
  phTolerableMin: number;
  phTolerableMax: number;
  goalBaseWeights: Record<PlannerGoalId, number>;
  tradeOffProfile: {
    profitPotential: QualitativeRating;
    waterResilience: QualitativeRating;
    soilImprovement: QualitativeRating;
    cropDiversityContribution: QualitativeRating;
    managementComplexity: QualitativeRating;
  };
  agronomicSummary: string;
  waterGuidance: string;
  soilGuidance: string;
  keyRisks: string[];
  ruleSourceNote: string;
}

const PROVISIONAL_RULE_DISCLAIMER =
  'Provisional screening assumption (unvalidated heuristic range — requires local agronomic verification).';

export const CANDIDATE_CROP_CATALOG: readonly CandidateCropSpec[] = [
  {
    id: 'field-pea',
    cropName: 'Field Pea (Yellow / Green)',
    botanicalName: 'Pisum sativum',
    family: 'Fabaceae',
    categoryLabel: 'Cool-Season Nitrogen-Fixing Pulse',
    rotationRole: 'Nitrogen-Fixing Pulse',
    isNitrogenFixer: true,
    thermalOptimalMinC: 10,
    thermalOptimalMaxC: 21,
    thermalTolerableMinC: 6,
    thermalTolerableMaxC: 25,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 1.2,
    maxTolerableRainMmPerDay: 5.5,
    phOptimalMin: 5.8,
    phOptimalMax: 7.2,
    phTolerableMin: 5.3,
    phTolerableMax: 7.8,
    goalBaseWeights: { 'earn-more': 14, 'lower-risk': 22, 'more-crops': 20 },
    tradeOffProfile: {
      profitPotential: 'Medium',
      waterResilience: 'High',
      soilImprovement: 'High',
      cropDiversityContribution: 'High',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Cool-season pulse that fixes atmospheric nitrogen and breaks cereal root-rot cycles with a short growing window.',
    waterGuidance:
      'Shallow root extraction preserves deep profile moisture; dislikes waterlogged soils or excessive canopy rain.',
    soilGuidance:
      'Nodulates best at pH 5.8–7.2 with Rhizobium leguminosarum; sensitive to strong soil acidity (<5.3).',
    keyRisks: [
      'High temperatures (>25°C) during bloom cause flower abortion.',
      'Ascochyta blight and root rot in poorly drained or overly wet fields.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'canola-rapeseed',
    cropName: 'Canola / Oilseed Rape',
    botanicalName: 'Brassica napus',
    family: 'Brassicaceae',
    categoryLabel: 'Commercial Brassica Oilseed',
    rotationRole: 'Broadleaf Oilseed Break',
    isNitrogenFixer: false,
    thermalOptimalMinC: 10,
    thermalOptimalMaxC: 22,
    thermalTolerableMinC: 5,
    thermalTolerableMaxC: 26,
    waterDemandTier: 'moderate',
    minRainfedMmPerDay: 1.6,
    maxTolerableRainMmPerDay: 6.5,
    phOptimalMin: 5.8,
    phOptimalMax: 7.5,
    phTolerableMin: 5.3,
    phTolerableMax: 8.0,
    goalBaseWeights: { 'earn-more': 24, 'lower-risk': 12, 'more-crops': 18 },
    tradeOffProfile: {
      profitPotential: 'High',
      waterResilience: 'Medium',
      soilImprovement: 'Medium',
      cropDiversityContribution: 'High',
      managementComplexity: 'Medium',
    },
    agronomicSummary:
      'High-value broadleaf oilseed with deep taproots that break cereal take-all fungal cycles and loosen subsoil.',
    waterGuidance:
      'Requires moderate moisture through flowering and pod fill; taproot aids subsoil water access.',
    soilGuidance:
      'Performs best at pH 5.8–7.5 with adequate sulfur (S) and nitrogen fertility; utilizes residual legume N well.',
    keyRisks: [
      'Heat stress (>26–28°C) at flowering causes pod abortion.',
      'Clubroot and Sclerotinia risk if rotated too tightly with other brassicas or host broadleaves.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'faba-bean',
    cropName: 'Faba Bean (Broad Bean)',
    botanicalName: 'Vicia faba',
    family: 'Fabaceae',
    categoryLabel: 'Cool-Temperate High-N Pulse',
    rotationRole: 'Nitrogen-Fixing Pulse',
    isNitrogenFixer: true,
    thermalOptimalMinC: 9,
    thermalOptimalMaxC: 20,
    thermalTolerableMinC: 5,
    thermalTolerableMaxC: 24,
    waterDemandTier: 'moderate',
    minRainfedMmPerDay: 1.6,
    maxTolerableRainMmPerDay: 6.5,
    phOptimalMin: 6.0,
    phOptimalMax: 7.5,
    phTolerableMin: 5.4,
    phTolerableMax: 8.0,
    goalBaseWeights: { 'earn-more': 19, 'lower-risk': 16, 'more-crops': 20 },
    tradeOffProfile: {
      profitPotential: 'High',
      waterResilience: 'Medium',
      soilImprovement: 'High',
      cropDiversityContribution: 'High',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'High-biomass cool-climate pulse with strong biological nitrogen fixation and stiff upright stems.',
    waterGuidance:
      'More tolerant of moist, heavier soils than field pea or chickpea, but sensitive to severe heat/drought.',
    soilGuidance:
      'Prefers near-neutral pH (6.0–7.5); nodulation declines in strongly acidic soils (<5.4).',
    keyRisks: [
      'Chocolate spot (Botrytis fabae) in humid conditions and flower drop above 25°C.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'milling-oats',
    cropName: 'Milling / Forage Oats',
    botanicalName: 'Avena sativa',
    family: 'Poaceae',
    categoryLabel: 'Disease-Suppressive Small Grain',
    rotationRole: 'Disease-Suppressive Cereal',
    isNitrogenFixer: false,
    thermalOptimalMinC: 9,
    thermalOptimalMaxC: 22,
    thermalTolerableMinC: 5,
    thermalTolerableMaxC: 26,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 1.2,
    maxTolerableRainMmPerDay: 6.5,
    phOptimalMin: 5.0,
    phOptimalMax: 7.0,
    phTolerableMin: 4.5,
    phTolerableMax: 7.5,
    goalBaseWeights: { 'earn-more': 11, 'lower-risk': 23, 'more-crops': 16 },
    tradeOffProfile: {
      profitPotential: 'Medium',
      waterResilience: 'High',
      soilImprovement: 'Medium',
      cropDiversityContribution: 'Medium',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Hardy small grain whose roots release avenacin, naturally suppressing wheat take-all root rot while tolerating acidic soils.',
    waterGuidance:
      'Modest water demand; flexible harvest as grain, livestock feed, or forage hay.',
    soilGuidance:
      'Tolerates acidic soils down to pH 4.5–5.0 better than wheat or barley.',
    keyRisks: [
      'Lower unit grain price than oilseeds and still within Poaceae grass family.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'food-lentil',
    cropName: 'Food-Grade Lentil',
    botanicalName: 'Lens culinaris',
    family: 'Fabaceae',
    categoryLabel: 'Water-Efficient Culinary Pulse',
    rotationRole: 'Nitrogen-Fixing Pulse',
    isNitrogenFixer: true,
    thermalOptimalMinC: 12,
    thermalOptimalMaxC: 24,
    thermalTolerableMinC: 7,
    thermalTolerableMaxC: 28,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 0.8,
    maxTolerableRainMmPerDay: 4.5,
    phOptimalMin: 6.0,
    phOptimalMax: 7.8,
    phTolerableMin: 5.5,
    phTolerableMax: 8.2,
    goalBaseWeights: { 'earn-more': 21, 'lower-risk': 18, 'more-crops': 22 },
    tradeOffProfile: {
      profitPotential: 'High',
      waterResilience: 'High',
      soilImprovement: 'High',
      cropDiversityContribution: 'High',
      managementComplexity: 'Medium',
    },
    agronomicSummary:
      'High-value culinary legume with low water demand that fixes nitrogen for subsequent grain crops.',
    waterGuidance:
      'Adapted to drier or moderate-rainfall windows; excessive rainfall (>4.5 mm/day) promotes canopy disease and lodging.',
    soilGuidance:
      'Requires pH 5.8–7.8 and a smooth, level soil surface for low-pod harvesting.',
    keyRisks: [
      'Sensitive to waterlogging, high rainfall humidity, and acidic soils (<5.5).',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'chickpea',
    cropName: 'Chickpea (Desi / Kabuli)',
    botanicalName: 'Cicer arietinum',
    family: 'Fabaceae',
    categoryLabel: 'Drought-Hardy Nitrogen-Fixing Pulse',
    rotationRole: 'Nitrogen-Fixing Pulse',
    isNitrogenFixer: true,
    thermalOptimalMinC: 15,
    thermalOptimalMaxC: 29,
    thermalTolerableMinC: 11,
    thermalTolerableMaxC: 33,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 0.7,
    maxTolerableRainMmPerDay: 4.5,
    phOptimalMin: 6.0,
    phOptimalMax: 8.0,
    phTolerableMin: 5.5,
    phTolerableMax: 8.4,
    goalBaseWeights: { 'earn-more': 22, 'lower-risk': 22, 'more-crops': 18 },
    tradeOffProfile: {
      profitPotential: 'High',
      waterResilience: 'High',
      soilImprovement: 'High',
      cropDiversityContribution: 'High',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Deep-rooting pulse suited to warm, dryland or supplemental-irrigated rotations after wheat, corn, or sorghum.',
    waterGuidance:
      'Deep taproot utilizes residual moisture efficiently; dislikes heavy equatorial downpours (>4.5 mm/day).',
    soilGuidance:
      'Thrives in neutral to slightly alkaline soils (pH 6.0–8.0); sensitive to strong acidity (<5.5).',
    keyRisks: [
      'Ascochyta blight in wet/humid climates and root rot in poorly drained soils.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'culinary-sesame',
    cropName: 'Culinary / Export Sesame',
    botanicalName: 'Sesamum indicum',
    family: 'Pedaliaceae',
    categoryLabel: 'Heat- & Drought-Adapted Oilseed',
    rotationRole: 'Broadleaf Oilseed Break',
    isNitrogenFixer: false,
    thermalOptimalMinC: 23,
    thermalOptimalMaxC: 34,
    thermalTolerableMinC: 19,
    thermalTolerableMaxC: 38,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 0.8,
    maxTolerableRainMmPerDay: 6.0,
    phOptimalMin: 5.4,
    phOptimalMax: 7.6,
    phTolerableMin: 5.0,
    phTolerableMax: 8.0,
    goalBaseWeights: { 'earn-more': 25, 'lower-risk': 17, 'more-crops': 21 },
    tradeOffProfile: {
      profitPotential: 'High',
      waterResilience: 'High',
      soilImprovement: 'Medium',
      cropDiversityContribution: 'High',
      managementComplexity: 'Medium',
    },
    agronomicSummary:
      'Warm-climate Pedaliaceae oilseed that breaks both cereal and legume pest/nematode cycles with low water demand.',
    waterGuidance:
      'Once established, tolerates heat and dry spells well; intolerant of standing water.',
    soilGuidance:
      'Broad pH adaptability (5.4–7.6) and deep taproot nutrient scavenging.',
    keyRisks: [
      'Fails in cool climates (<19°C) and requires timely harvest to minimize capsule shattering.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'cowpea',
    cropName: 'Cowpea (Black-Eyed Pea)',
    botanicalName: 'Vigna unguiculata',
    family: 'Fabaceae',
    categoryLabel: 'Warm-Season Acid- & Drought-Tolerant Pulse',
    rotationRole: 'Nitrogen-Fixing Pulse',
    isNitrogenFixer: true,
    thermalOptimalMinC: 21,
    thermalOptimalMaxC: 34,
    thermalTolerableMinC: 17,
    thermalTolerableMaxC: 38,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 0.9,
    maxTolerableRainMmPerDay: 9.5,
    phOptimalMin: 5.0,
    phOptimalMax: 7.2,
    phTolerableMin: 4.5,
    phTolerableMax: 7.8,
    goalBaseWeights: { 'earn-more': 15, 'lower-risk': 25, 'more-crops': 22 },
    tradeOffProfile: {
      profitPotential: 'Medium',
      waterResilience: 'High',
      soilImprovement: 'High',
      cropDiversityContribution: 'High',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Heat-, drought-, and acid-tolerant legume that rapidly shades soil and fixes nitrogen after corn, sorghum, or rice.',
    waterGuidance:
      'Low water requirement; performs across semi-arid supplemental irrigation and humid tropical regimes.',
    soilGuidance:
      'Notable tolerance to acidic soils (down to pH 4.5–5.0) where soybean and chickpea struggle.',
    keyRisks: [
      'Frost-sensitive (unsuitable below 17°C) and requires monitoring for pod borers/aphids.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'pearl-millet',
    cropName: 'Pearl Millet (Grain & Mulch Buffer)',
    botanicalName: 'Pennisetum glaucum',
    family: 'Poaceae',
    categoryLabel: 'Arid- & Acid-Hardy C4 Cereal',
    rotationRole: 'Drought-Buffered Cereal',
    isNitrogenFixer: false,
    thermalOptimalMinC: 22,
    thermalOptimalMaxC: 36,
    thermalTolerableMinC: 18,
    thermalTolerableMaxC: 40,
    waterDemandTier: 'very-low',
    minRainfedMmPerDay: 0.5,
    maxTolerableRainMmPerDay: 8.5,
    phOptimalMin: 4.8,
    phOptimalMax: 7.4,
    phTolerableMin: 4.2,
    phTolerableMax: 8.0,
    goalBaseWeights: { 'earn-more': 11, 'lower-risk': 26, 'more-crops': 16 },
    tradeOffProfile: {
      profitPotential: 'Medium',
      waterResilience: 'High',
      soilImprovement: 'High',
      cropDiversityContribution: 'Medium',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Ultra-hardy C4 cereal that builds durable surface mulch and breaks soybean/legume nematode cycles under heat, drought, or acidity.',
    waterGuidance:
      'Lowest water requirement among major cereals; ideal when irrigation is limited or rainfall is erratic.',
    soilGuidance:
      'Thrives in acidic (down to pH 4.2–4.8) and sandy soils.',
    keyRisks: [
      'Modest commercial cash price compared to oilseeds; requires warm soil (>18°C) to establish.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'grain-sorghum',
    cropName: 'Grain Sorghum',
    botanicalName: 'Sorghum bicolor',
    family: 'Poaceae',
    categoryLabel: 'Water-Resilient C4 Cereal',
    rotationRole: 'Drought-Buffered Cereal',
    isNitrogenFixer: false,
    thermalOptimalMinC: 20,
    thermalOptimalMaxC: 34,
    thermalTolerableMinC: 16,
    thermalTolerableMaxC: 38,
    waterDemandTier: 'low',
    minRainfedMmPerDay: 1.0,
    maxTolerableRainMmPerDay: 9.0,
    phOptimalMin: 5.3,
    phOptimalMax: 7.8,
    phTolerableMin: 4.8,
    phTolerableMax: 8.2,
    goalBaseWeights: { 'earn-more': 17, 'lower-risk': 23, 'more-crops': 15 },
    tradeOffProfile: {
      profitPotential: 'Medium',
      waterResilience: 'High',
      soilImprovement: 'Medium',
      cropDiversityContribution: 'Medium',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Drought-buffered C4 grain crop that monetizes residual legume nitrogen with lower water risk than corn.',
    waterGuidance:
      'Waxy leaf cuticle and stomatal control buffer mid-season dry spells.',
    soilGuidance:
      'Tolerates pH 5.3–7.8 and leaves fibrous root organic matter.',
    keyRisks: [
      'Same family (Poaceae) as corn/wheat/rice; best used after a legume (soybean/cowpea/chickpea) rather than after another cereal.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'commercial-soybean',
    cropName: 'Commercial Soybean',
    botanicalName: 'Glycine max',
    family: 'Fabaceae',
    categoryLabel: 'Warm-Season Oilseed & Protein Legume',
    rotationRole: 'Nitrogen-Fixing Pulse',
    isNitrogenFixer: true,
    thermalOptimalMinC: 20,
    thermalOptimalMaxC: 30,
    thermalTolerableMinC: 15,
    thermalTolerableMaxC: 34,
    waterDemandTier: 'high',
    minRainfedMmPerDay: 2.2,
    maxTolerableRainMmPerDay: 11.0,
    phOptimalMin: 5.8,
    phOptimalMax: 7.0,
    phTolerableMin: 5.2,
    phTolerableMax: 7.6,
    goalBaseWeights: { 'earn-more': 25, 'lower-risk': 14, 'more-crops': 17 },
    tradeOffProfile: {
      profitPotential: 'High',
      waterResilience: 'Medium',
      soilImprovement: 'Medium',
      cropDiversityContribution: 'Medium',
      managementComplexity: 'Low',
    },
    agronomicSummary:
      'Globally traded oilseed/protein legume that fixes nitrogen after corn, wheat, rice, or sorghum when moisture and pH are adequate.',
    waterGuidance:
      'Requires dependable moisture during flowering and pod fill (>=2.2 mm/day rainfall or reliable irrigation).',
    soilGuidance:
      'Requires pH 5.8–7.0 for optimal Bradyrhizobium nodulation; stunted by strongly acidic soils (<5.2).',
    keyRisks: [
      'Vulnerable to drought in rainfed arid zones and to cyst nematode/root rot if planted back-to-back after soybean.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
  {
    id: 'common-buckwheat',
    cropName: 'Common Buckwheat',
    botanicalName: 'Fagopyrum esculentum',
    family: 'Polygonaceae',
    categoryLabel: 'Fast-Maturing Acid-Tolerant Pseudocereal',
    rotationRole: 'Short-Window Pseudocereal / Cover',
    isNitrogenFixer: false,
    thermalOptimalMinC: 13,
    thermalOptimalMaxC: 24,
    thermalTolerableMinC: 9,
    thermalTolerableMaxC: 28,
    waterDemandTier: 'moderate',
    minRainfedMmPerDay: 1.4,
    maxTolerableRainMmPerDay: 7.5,
    phOptimalMin: 5.0,
    phOptimalMax: 6.8,
    phTolerableMin: 4.5,
    phTolerableMax: 7.3,
    goalBaseWeights: { 'earn-more': 14, 'lower-risk': 16, 'more-crops': 26 },
    tradeOffProfile: {
      profitPotential: 'Medium',
      waterResilience: 'Medium',
      soilImprovement: 'High',
      cropDiversityContribution: 'High',
      managementComplexity: 'Medium',
    },
    agronomicSummary:
      'Non-cereal, non-legume Polygonaceae break crop that matures in 70 days, suppresses weeds, and solubilizes phosphorus in acidic soils.',
    waterGuidance:
      'Moderate moisture need; rapid canopy shades topsoil quickly.',
    soilGuidance:
      'Tolerates acidic soils down to pH 4.5–5.0 and mobilizes bound phosphorus.',
    keyRisks: [
      'Blossom blast above 28–30°C and requires specialty grain buyer or green-manure termination plan.',
    ],
    ruleSourceNote: PROVISIONAL_RULE_DISCLAIMER,
  },
] as const;

export type EvaluationStatusLabel =
  | 'Recommended Candidate (Requires Local Agronomic Review)'
  | 'Conditional Candidate (Action / Amendment Needed)'
  | 'Insufficient Data — Requires Local Review'
  | 'Not Recommended for Current Constraints';

export interface EvaluatedCandidateCrop {
  spec: CandidateCropSpec;
  rank: number;
  internalSortScore: number; // strictly internal for ordering; never shown as a confidence %
  evaluationStatus: EvaluationStatusLabel;
  thermalFit: {
    status: 'Favorable' | 'Marginal' | 'Unsuitable' | 'Insufficient Data';
    explanation: string;
  };
  waterFit: {
    status: 'Favorable' | 'Marginal' | 'Constraint Flag' | 'Requires Review';
    explanation: string;
  };
  soilPhFit: {
    status: 'Favorable' | 'Marginal (Amend pH)' | 'Constraint Flag' | 'Not Provided';
    explanation: string;
  };
  rotationFit: {
    status: 'Strong Break Crop' | 'Complementary Follow-On' | 'Same-Family Caution';
    explanation: string;
  };
  goalFitExplanation: string;
  missingInputsAndUncertainty: string[];
}

export interface RealFarmEvaluationResult {
  hasVerifiedLocation: boolean;
  hasNasaClimate: boolean;
  activeWindow: HistoricalWindowOption;
  shortWindowScopeDisclaimer: string;
  observedT2mMean: number | null;
  observedT2mMin: number | null;
  observedT2mMax: number | null;
  observedPrecipMeanMmPerDay: number | null;
  observedPrecipTotalMm: number | null;
  observedRainyDays: number | null;
  validClimateDays: number;
  missingClimateDays: number;
  currentCropMeta: CurrentCropMetadata;
  missingInputWarnings: string[];
  whyTheseCropsSummary: string[];
  hasViableCandidates: boolean;
  allCandidatesUnsuitableReason: string | null;
  viableCandidates: EvaluatedCandidateCrop[];
  rejectedCandidates: EvaluatedCandidateCrop[];
  rankedCandidates: EvaluatedCandidateCrop[];
  topCandidates: EvaluatedCandidateCrop[];
  otherCandidates: EvaluatedCandidateCrop[];
}

export interface DynamicStrategyStep {
  phaseLabel: string;
  cropName: string;
  roleLabel: string;
  note: string;
  isUnverified?: boolean;
}

export interface DynamicRotationStrategy {
  id: StrategyId;
  codeLabel: string;
  title: string;
  subtitle: string;
  alignedGoalId: PlannerGoalId | null;
  isSupported: boolean;
  supportStatusLabel:
    | 'Current-Crop Baseline (History Unverified)'
    | 'Supported by Candidate Evaluation (Requires Local Review)'
    | 'Conditionally Supported (See Input / Climate Limitations)'
    | 'Not Supported — No Viable Candidate Crops for Current Constraints'
    | 'Insufficient Data to Validate Rotation';
  steps: DynamicStrategyStep[];
  whyConsidered: string;
  expectedBenefits: string[];
  limitationsAndRisks: string[];
  missingEvidenceGaps: string[];
  tradeOffRatings: Record<TradeOffDimensionKey, TradeOffCellEvaluation>;
}

const MY_FARM_STORAGE_KEY = 'cropwise_my_farm_profile_v1';

const DEFAULT_MY_FARM_PROFILE: MyFarmProfile = {
  experienceMode: 'my-farm',
  farmName: 'My Farm Parcel',
  currentCrop: 'wheat',
  soilPhInput: '',
  soilPh: null,
  irrigationAvailability: 'limited-supplemental',
  primaryGoal: 'earn-more',
  historicalWindow: '30d',
  customStartDate: '2024-05-01',
  customEndDate: '2024-07-29',
  notesConstraint: '',
};

const VALID_EXPERIENCE_MODES = new Set<ExperienceMode>(['my-farm', 'explore-demo']);
const VALID_CROPS = new Set<CurrentCropKey>(
  CURRENT_CROP_OPTIONS.map((c) => c.key)
);
const VALID_IRRIGATION = new Set<IrrigationAvailability>(
  IRRIGATION_OPTIONS.map((i) => i.id)
);
const VALID_GOALS = new Set<PlannerGoalId>(['earn-more', 'lower-risk', 'more-crops']);
const VALID_WINDOWS = new Set<HistoricalWindowId>([
  '7d',
  '30d',
  'season',
  'summer-90d',
  'spring-90d',
  'custom',
]);

export function parseOptionalSoilPh(raw: string | number | null | undefined): {
  valid: boolean;
  value: number | null;
  error: string | null;
} {
  if (raw === null || raw === undefined) {
    return { valid: true, value: null, error: null };
  }
  const trimmed = String(raw).trim();
  if (trimmed === '') {
    return { valid: true, value: null, error: null };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 2.0 || num > 10.0) {
    return {
      valid: false,
      value: null,
      error: 'Soil pH must be between 2.0 and 10.0, or left blank if unknown.',
    };
  }
  return { valid: true, value: Number(num.toFixed(1)), error: null };
}

export function getSavedMyFarmProfile(): MyFarmProfile {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_MY_FARM_PROFILE };
  }
  try {
    const raw = window.localStorage.getItem(MY_FARM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MY_FARM_PROFILE };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_MY_FARM_PROFILE };
    }
    const rec = parsed as Record<string, unknown>;
    const experienceMode: ExperienceMode = VALID_EXPERIENCE_MODES.has(
      rec.experienceMode as ExperienceMode
    )
      ? (rec.experienceMode as ExperienceMode)
      : DEFAULT_MY_FARM_PROFILE.experienceMode;
    const farmName =
      typeof rec.farmName === 'string' && rec.farmName.trim() !== ''
        ? rec.farmName.trim().slice(0, 80)
        : DEFAULT_MY_FARM_PROFILE.farmName;
    const currentCrop: CurrentCropKey = VALID_CROPS.has(
      rec.currentCrop as CurrentCropKey
    )
      ? (rec.currentCrop as CurrentCropKey)
      : DEFAULT_MY_FARM_PROFILE.currentCrop;
    const irrigationAvailability: IrrigationAvailability = VALID_IRRIGATION.has(
      rec.irrigationAvailability as IrrigationAvailability
    )
      ? (rec.irrigationAvailability as IrrigationAvailability)
      : DEFAULT_MY_FARM_PROFILE.irrigationAvailability;
    const primaryGoal: PlannerGoalId = VALID_GOALS.has(
      rec.primaryGoal as PlannerGoalId
    )
      ? (rec.primaryGoal as PlannerGoalId)
      : DEFAULT_MY_FARM_PROFILE.primaryGoal;
    const historicalWindow: HistoricalWindowId = VALID_WINDOWS.has(
      rec.historicalWindow as HistoricalWindowId
    )
      ? (rec.historicalWindow as HistoricalWindowId)
      : DEFAULT_MY_FARM_PROFILE.historicalWindow;

    const rawStart =
      typeof rec.customStartDate === 'string'
        ? rec.customStartDate.trim()
        : DEFAULT_MY_FARM_PROFILE.customStartDate;
    const rawEnd =
      typeof rec.customEndDate === 'string'
        ? rec.customEndDate.trim()
        : DEFAULT_MY_FARM_PROFILE.customEndDate;
    const rangeCheck = validateHistoricalDateRange(rawStart, rawEnd);
    const customStartDate = rangeCheck.valid
      ? rawStart
      : DEFAULT_MY_FARM_PROFILE.customStartDate;
    const customEndDate = rangeCheck.valid
      ? rawEnd
      : DEFAULT_MY_FARM_PROFILE.customEndDate;

    const phCheck = parseOptionalSoilPh(rec.soilPhInput as string);
    const soilPh = phCheck.valid ? phCheck.value : null;
    const soilPhInput = soilPh !== null ? String(soilPh) : '';
    const notesConstraint =
      typeof rec.notesConstraint === 'string'
        ? rec.notesConstraint.slice(0, 200)
        : '';

    return {
      experienceMode,
      farmName,
      currentCrop,
      soilPhInput,
      soilPh,
      irrigationAvailability,
      primaryGoal,
      historicalWindow,
      customStartDate,
      customEndDate,
      notesConstraint,
    };
  } catch {
    return { ...DEFAULT_MY_FARM_PROFILE };
  }
}

export function saveMyFarmProfile(profile: MyFarmProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const phCheck = parseOptionalSoilPh(profile.soilPhInput);
    const rangeCheck = validateHistoricalDateRange(
      profile.customStartDate,
      profile.customEndDate
    );
    const sanitized: MyFarmProfile = {
      experienceMode: VALID_EXPERIENCE_MODES.has(profile.experienceMode)
        ? profile.experienceMode
        : 'my-farm',
      farmName: profile.farmName.trim() || 'My Farm Parcel',
      currentCrop: VALID_CROPS.has(profile.currentCrop)
        ? profile.currentCrop
        : 'wheat',
      soilPhInput: phCheck.valid && phCheck.value !== null ? String(phCheck.value) : '',
      soilPh: phCheck.valid ? phCheck.value : null,
      irrigationAvailability: VALID_IRRIGATION.has(profile.irrigationAvailability)
        ? profile.irrigationAvailability
        : 'limited-supplemental',
      primaryGoal: VALID_GOALS.has(profile.primaryGoal)
        ? profile.primaryGoal
        : 'earn-more',
      historicalWindow: VALID_WINDOWS.has(profile.historicalWindow)
        ? profile.historicalWindow
        : '30d',
      customStartDate: rangeCheck.valid
        ? profile.customStartDate.trim()
        : DEFAULT_MY_FARM_PROFILE.customStartDate,
      customEndDate: rangeCheck.valid
        ? profile.customEndDate.trim()
        : DEFAULT_MY_FARM_PROFILE.customEndDate,
      notesConstraint: (profile.notesConstraint || '').slice(0, 200),
    };
    window.localStorage.setItem(MY_FARM_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota or SecurityError
  }
}

export function resetMyFarmProfileAndLocation(): MyFarmProfile {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(MY_FARM_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  setSharedFarmLocationState({ verifiedLocation: null });
  return { ...DEFAULT_MY_FARM_PROFILE };
}

export { getSharedFarmLocationState, setSharedFarmLocationState, validateCoordinates };
export type { VerifiedFarmLocation };

/**
 * Evaluates all candidate crops in CANDIDATE_CROP_CATALOG against:
 * 1. Actual retrieved NASA POWER historical T2M and PRECTOTCORR (if available)
 * 2. User-entered currentCrop (botanical rotation & nitrogen credit logic)
 * 3. Optional user-entered soilPh (or explicit "Not provided" uncertainty)
 * 4. User-entered irrigationAvailability
 * 5. User-selected primaryGoal ('earn-more' | 'lower-risk' | 'more-crops')
 */
export function evaluateFarmCandidates(
  profile: MyFarmProfile,
  verifiedLocation: VerifiedFarmLocation | null,
  nasaResult: NasaPowerDailyResult | null
): RealFarmEvaluationResult {
  const activeWindow = resolveActiveHistoricalWindow(profile);
  const currentCropMeta =
    CURRENT_CROP_OPTIONS.find((c) => c.key === profile.currentCrop) ??
    CURRENT_CROP_OPTIONS[0];

  // Extract NASA POWER climate statistics if genuinely loaded
  let observedT2mMean: number | null = null;
  let observedT2mMin: number | null = null;
  let observedT2mMax: number | null = null;
  let observedPrecipMeanMmPerDay: number | null = null;
  let observedPrecipTotalMm: number | null = null;
  let observedRainyDays: number | null = null;
  let validClimateDays = 0;
  let missingClimateDays = 0;

  if (nasaResult) {
    const t2mPts = nasaResult.series.T2M.points
      .filter((p) => !p.isMissing && p.value !== null)
      .map((p) => p.value as number);
    const precPts = nasaResult.series.PRECTOTCORR.points
      .filter((p) => !p.isMissing && p.value !== null)
      .map((p) => p.value as number);

    validClimateDays = nasaResult.series.T2M.validCount;
    missingClimateDays = nasaResult.series.T2M.missingCount;

    if (t2mPts.length > 0) {
      observedT2mMean = t2mPts.reduce((a, b) => a + b, 0) / t2mPts.length;
      observedT2mMin = Math.min(...t2mPts);
      observedT2mMax = Math.max(...t2mPts);
    }
    if (precPts.length > 0) {
      observedPrecipTotalMm = precPts.reduce((a, b) => a + b, 0);
      observedPrecipMeanMmPerDay = observedPrecipTotalMm / precPts.length;
      observedRainyDays = precPts.filter((v) => v >= 1.0).length;
    }
  }

  const hasVerifiedLocation = verifiedLocation !== null;
  const hasNasaClimate =
    hasVerifiedLocation && nasaResult !== null && observedT2mMean !== null;

  const shortWindowScopeDisclaimer = activeWindow.isShortWindow
    ? `Growing-Season Scope Limitation: The selected ${activeWindow.daySpan}-day historical window (${activeWindow.startIso} to ${activeWindow.endIso}) is shorter than a full 90–150 day crop cycle. Window mean temperature and rainfall provide a preliminary climate screening signal only — they do not establish full-season frost-free duration, flowering heat stress, or multi-year drought frequency.`
    : `Growing-Season Scope Notice: The selected ${activeWindow.daySpan}-day historical window (${activeWindow.startIso} to ${activeWindow.endIso}) reflects a single historical period. Window mean temperature and rainfall are screening indicators and must be verified against multi-year local growing-season records and cultivar maturity requirements.`;

  const missingInputWarnings: string[] = [];
  if (!hasVerifiedLocation) {
    missingInputWarnings.push(
      'Location Not Verified: Enter farm latitude/longitude and fetch NASA POWER data to evaluate regional temperature and rainfall compatibility.'
    );
  } else if (!hasNasaClimate) {
    missingInputWarnings.push(
      'NASA Climate Data Pending or Unavailable: Candidate crops are currently ranked using rotation, soil pH, and irrigation rules only — thermal and rainfall suitability require NASA POWER data.'
    );
  }
  if (profile.soilPh === null) {
    missingInputWarnings.push(
      'Soil pH Not Provided: Acid-sensitive crops (e.g., chickpea, lentil, faba bean, canola, soybean) cannot be screened against soil acidity until a local soil pH test is supplied.'
    );
  }
  if (profile.irrigationAvailability === 'not-specified') {
    missingInputWarnings.push(
      'Irrigation Availability Not Provided: Water-sensitive crops require confirming whether supplemental irrigation is available during dry spells.'
    );
  }
  if (activeWindow.daySpan <= 14) {
    missingInputWarnings.push(
      `Short ${activeWindow.daySpan}-Day Climate Window (${activeWindow.startIso} to ${activeWindow.endIso}): A short window is useful for API testing, but is too brief to represent a full crop growing season. Select a 60-Day, 90-Day, or custom multi-month window for seasonal screening.`
    );
  } else if (activeWindow.isShortWindow) {
    missingInputWarnings.push(
      `Sub-Seasonal ${activeWindow.daySpan}-Day Window (${activeWindow.startIso} to ${activeWindow.endIso}): Represents a single ${activeWindow.daySpan}-day slice rather than a full 90–150 day growing season.`
    );
  }

  const evaluated: EvaluatedCandidateCrop[] = CANDIDATE_CROP_CATALOG.map((spec) => {
    let score = spec.goalBaseWeights[profile.primaryGoal];
    let hasHardConstraint = false;
    let hasModerateConstraint = false;
    const uncertaintyNotes: string[] = [spec.ruleSourceNote];

    // 1. Thermal Evaluation (from real NASA POWER T2M)
    let thermalFit: EvaluatedCandidateCrop['thermalFit'];
    if (observedT2mMean === null) {
      thermalFit = {
        status: 'Insufficient Data',
        explanation: `No NASA POWER temperature loaded yet. Provisional optimal window is ${spec.thermalOptimalMinC}–${spec.thermalOptimalMaxC}°C.`,
      };
      uncertaintyNotes.push('Regional temperature compatibility has not been verified with NASA POWER data.');
    } else if (
      observedT2mMean >= spec.thermalOptimalMinC &&
      observedT2mMean <= spec.thermalOptimalMaxC
    ) {
      score += 24;
      thermalFit = {
        status: 'Favorable',
        explanation: `Observed NASA POWER window mean T2M (${observedT2mMean.toFixed(
          1
        )}°C over ${activeWindow.startIso} to ${activeWindow.endIso}) falls within provisional optimal range (${spec.thermalOptimalMinC}–${
          spec.thermalOptimalMaxC
        }°C).`,
      };
    } else if (
      observedT2mMean >= spec.thermalTolerableMinC &&
      observedT2mMean <= spec.thermalTolerableMaxC
    ) {
      score += 8;
      hasModerateConstraint = true;
      thermalFit = {
        status: 'Marginal',
        explanation: `Observed NASA POWER mean T2M (${observedT2mMean.toFixed(
          1
        )}°C over ${activeWindow.startIso} to ${activeWindow.endIso}) is outside optimal (${spec.thermalOptimalMinC}–${
          spec.thermalOptimalMaxC
        }°C) but within tolerable range (${spec.thermalTolerableMinC}–${
          spec.thermalTolerableMaxC
        }°C). Planting date adjustment required.`,
      };
    } else {
      score -= 35;
      hasHardConstraint = true;
      const direction =
        observedT2mMean < spec.thermalTolerableMinC ? 'too cool' : 'too warm';
      thermalFit = {
        status: 'Unsuitable',
        explanation: `Observed NASA POWER mean T2M (${observedT2mMean.toFixed(
          1
        )}°C over ${activeWindow.startIso} to ${activeWindow.endIso}) is ${direction} for ${spec.cropName} (provisional tolerable range: ${
          spec.thermalTolerableMinC
        }–${spec.thermalTolerableMaxC}°C).`,
      };
    }

    // 2. Water & Irrigation Evaluation (combines NASA PRECTOTCORR + user irrigationAvailability)
    let waterFit: EvaluatedCandidateCrop['waterFit'];
    const irr = profile.irrigationAvailability;

    if (observedPrecipMeanMmPerDay === null) {
      if (irr === 'none-rainfed') {
        if (spec.waterDemandTier === 'very-low' || spec.waterDemandTier === 'low') {
          score += 10;
          waterFit = {
            status: 'Requires Review',
            explanation: `Rainfed mode selected: ${spec.cropName} has ${spec.waterDemandTier} water demand, but NASA rainfall history is not yet loaded.`,
          };
        } else {
          score -= 10;
          hasModerateConstraint = true;
          waterFit = {
            status: 'Constraint Flag',
            explanation: `Rainfed mode selected without verified rainfall data; ${spec.cropName} has ${spec.waterDemandTier} water demand.`,
          };
        }
      } else if (irr === 'reliable-irrigated') {
        score += 12;
        waterFit = {
          status: 'Favorable',
          explanation: `Reliable full irrigation selected, buffering ${spec.cropName} (${spec.waterDemandTier} water demand).`,
        };
      } else {
        waterFit = {
          status: 'Requires Review',
          explanation: `Irrigation is ${
            irr === 'not-specified' ? 'not provided' : 'limited/supplemental'
          }; load NASA POWER precipitation data to assess regional rainfall.`,
        };
      }
    } else {
      // We have real NASA POWER precipitation data
      const rainMm = observedPrecipMeanMmPerDay;
      const isTooWet = rainMm > spec.maxTolerableRainMmPerDay;

      if (isTooWet) {
        score -= 14;
        hasModerateConstraint = true;
        waterFit = {
          status: 'Marginal',
          explanation: `Observed NASA POWER rainfall (${rainMm.toFixed(
            2
          )} mm/day) exceeds dry-canopy threshold (${
            spec.maxTolerableRainMmPerDay
          } mm/day); elevated fungal blight or drainage risk.`,
        };
      } else if (rainMm >= spec.minRainfedMmPerDay) {
        score += 18;
        waterFit = {
          status: 'Favorable',
          explanation: `Observed NASA POWER rainfall (${rainMm.toFixed(
            2
          )} mm/day) meets provisional moisture baseline (>=${
            spec.minRainfedMmPerDay
          } mm/day) alongside ${
            IRRIGATION_OPTIONS.find((i) => i.id === irr)?.shortLabel ?? irr
          }.`,
        };
      } else {
        // Rainfall is below minRainfedMmPerDay (e.g. arid Cairo 0.00 mm/day or dry spell)
        if (irr === 'reliable-irrigated') {
          score += spec.waterDemandTier === 'high' ? 14 : 18;
          waterFit = {
            status: 'Favorable',
            explanation: `Historical rainfall is low (${rainMm.toFixed(
              2
            )} mm/day), but Reliable Full Irrigation supports ${spec.cropName}.`,
          };
        } else if (irr === 'limited-supplemental') {
          if (spec.waterDemandTier === 'very-low' || spec.waterDemandTier === 'low') {
            score += 15;
            waterFit = {
              status: 'Favorable',
              explanation: `Low rainfall (${rainMm.toFixed(
                2
              )} mm/day) is buffered by ${
                spec.cropName
              }'s drought-hardy (${spec.waterDemandTier}) profile and supplemental irrigation.`,
            };
          } else {
            score -= 10;
            hasModerateConstraint = true;
            waterFit = {
              status: 'Marginal',
              explanation: `Historical rainfall is low (${rainMm.toFixed(
                2
              )} mm/day) and irrigation is limited; ${
                spec.cropName
              } (${spec.waterDemandTier} demand) faces moisture deficit risk.`,
            };
          }
        } else if (irr === 'none-rainfed') {
          if (spec.waterDemandTier === 'very-low' && rainMm >= 0.15) {
            score += 4;
            hasModerateConstraint = true;
            waterFit = {
              status: 'Marginal',
              explanation: `Rainfed with low rainfall (${rainMm.toFixed(
                2
              )} mm/day): only ultra-drought-hardy ${spec.cropName} is plausible, requiring stored soil moisture.`,
            };
          } else {
            const rainfedTierPenalty =
              spec.waterDemandTier === 'very-low'
                ? 16
                : spec.waterDemandTier === 'low'
                ? 24
                : spec.waterDemandTier === 'moderate'
                ? 34
                : 44;
            score -= rainfedTierPenalty;
            hasHardConstraint = true;
            waterFit = {
              status: 'Constraint Flag',
              explanation: `Historical rainfall (${rainMm.toFixed(
                2
              )} mm/day) is below rainfed threshold (${
                spec.minRainfedMmPerDay
              } mm/day) and No Irrigation is selected (${spec.waterDemandTier} water demand).`,
            };
          }
        } else {
          // irr === 'not-specified'
          hasModerateConstraint = true;
          score += spec.waterDemandTier === 'very-low' || spec.waterDemandTier === 'low' ? 6 : -8;
          waterFit = {
            status: 'Requires Review',
            explanation: `Historical rainfall is low (${rainMm.toFixed(
              2
            )} mm/day) and irrigation availability was not provided. Confirm irrigation access before planting.`,
          };
        }
      }
    }

    // 3. Soil pH Evaluation (Optional input — never fabricated when absent)
    let soilPhFit: EvaluatedCandidateCrop['soilPhFit'];
    if (profile.soilPh === null) {
      soilPhFit = {
        status: 'Not Provided',
        explanation: `Soil pH not provided. Provisional optimal range for ${spec.cropName} is pH ${spec.phOptimalMin.toFixed(
          1
        )}–${spec.phOptimalMax.toFixed(1)} (tolerable down to ${spec.phTolerableMin.toFixed(
          1
        )}).`,
      };
      uncertaintyNotes.push(
        `Soil pH is unknown; verify local pH is within ${spec.phOptimalMin.toFixed(
          1
        )}–${spec.phOptimalMax.toFixed(1)} before seeding.`
      );
    } else {
      const ph = profile.soilPh;
      if (ph >= spec.phOptimalMin && ph <= spec.phOptimalMax) {
        score += 16;
        soilPhFit = {
          status: 'Favorable',
          explanation: `Entered soil pH (${ph.toFixed(
            1
          )}) is within the provisional optimal range (${spec.phOptimalMin.toFixed(
            1
          )}–${spec.phOptimalMax.toFixed(1)}).`,
        };
      } else if (ph >= spec.phTolerableMin && ph <= spec.phTolerableMax) {
        score += 5;
        hasModerateConstraint = true;
        soilPhFit = {
          status: 'Marginal (Amend pH)',
          explanation: `Entered soil pH (${ph.toFixed(
            1
          )}) is outside optimal (${spec.phOptimalMin.toFixed(
            1
          )}–${spec.phOptimalMax.toFixed(
            1
          )}) but within tolerable bounds (${spec.phTolerableMin.toFixed(
            1
          )}–${spec.phTolerableMax.toFixed(1)}). Liming or soil buffering advised.`,
        };
      } else {
        score -= 30;
        hasHardConstraint = true;
        soilPhFit = {
          status: 'Constraint Flag',
          explanation: `Entered soil pH (${ph.toFixed(
            1
          )}) is outside tolerable bounds (${spec.phTolerableMin.toFixed(
            1
          )}–${spec.phTolerableMax.toFixed(1)}) for ${spec.cropName}.`,
        };
      }
    }

    // 4. Rotation & Current Crop Compatibility
    let rotationFit: EvaluatedCandidateCrop['rotationFit'];
    if (currentCropMeta.family === 'None') {
      score += 10;
      rotationFit = {
        status: 'Complementary Follow-On',
        explanation: `Suitable pioneer crop for transitioning out of ${currentCropMeta.label}.`,
      };
    } else if (spec.family !== currentCropMeta.family) {
      // Different botanical family -> breaks pest/disease cycles!
      if (!currentCropMeta.isNitrogenFixer && spec.isNitrogenFixer) {
        score += 20;
        rotationFit = {
          status: 'Strong Break Crop',
          explanation: `Rotates from non-legume ${currentCropMeta.label} (${currentCropMeta.family}) into nitrogen-fixing ${spec.family}, breaking cereal pest cycles and replenishing soil N.`,
        };
      } else if (currentCropMeta.isNitrogenFixer && !spec.isNitrogenFixer) {
        score += 18;
        rotationFit = {
          status: 'Strong Break Crop',
          explanation: `Rotates from nitrogen-fixing ${currentCropMeta.label} (${currentCropMeta.family}) into ${spec.family}, monetizing residual biological nitrogen and breaking legume root pathogen cycles.`,
        };
      } else {
        score += 14;
        rotationFit = {
          status: 'Strong Break Crop',
          explanation: `Switches botanical family from ${currentCropMeta.family} to ${spec.family}, disrupting host-specific pests and weeds.`,
        };
      }
    } else {
      // Same botanical family
      if (spec.id === 'milling-oats' && (profile.currentCrop === 'wheat' || profile.currentCrop === 'barley')) {
        score -= 4;
        hasModerateConstraint = true;
        rotationFit = {
          status: 'Complementary Follow-On',
          explanation: `Both are Poaceae small grains, though oats release avenacin which helps suppress wheat take-all fungus compared to repeat wheat.`,
        };
      } else {
        score -= 22;
        hasModerateConstraint = true;
        rotationFit = {
          status: 'Same-Family Caution',
          explanation: `Shares the same botanical family (${spec.family}) as your current crop (${currentCropMeta.label}), increasing shared pest, root-rot, or nematode carry-over.`,
        };
      }
    }

    // 5. Goal Alignment Bonus
    let goalFitExplanation = '';
    if (profile.primaryGoal === 'earn-more') {
      if (spec.tradeOffProfile.profitPotential === 'High') {
        score += 12;
      }
      goalFitExplanation = `Evaluated for Earn More: ${spec.tradeOffProfile.profitPotential} commercial revenue potential paired with ${spec.rotationRole.toLowerCase()} function.`;
    } else if (profile.primaryGoal === 'lower-risk') {
      if (spec.tradeOffProfile.waterResilience === 'High') score += 10;
      if (spec.tradeOffProfile.managementComplexity === 'Low') score += 8;
      goalFitExplanation = `Evaluated for Lower Risk: ${spec.tradeOffProfile.waterResilience} water resilience and ${spec.tradeOffProfile.managementComplexity.toLowerCase()} management complexity.`;
    } else {
      if (spec.tradeOffProfile.cropDiversityContribution === 'High') score += 10;
      if (spec.tradeOffProfile.soilImprovement === 'High') score += 8;
      goalFitExplanation = `Evaluated for More Crops: ${spec.tradeOffProfile.cropDiversityContribution} biodiversity contribution (${spec.family}) and ${spec.tradeOffProfile.soilImprovement.toLowerCase()} soil conditioning.`;
    }

    // Determine honest qualitative evaluation status
    let evaluationStatus: EvaluationStatusLabel;
    if (!hasNasaClimate) {
      evaluationStatus = hasHardConstraint
        ? 'Not Recommended for Current Constraints'
        : 'Insufficient Data — Requires Local Review';
    } else if (hasHardConstraint) {
      evaluationStatus = 'Not Recommended for Current Constraints';
    } else if (hasModerateConstraint || profile.soilPh === null || irr === 'not-specified') {
      evaluationStatus = 'Conditional Candidate (Action / Amendment Needed)';
    } else {
      evaluationStatus = 'Recommended Candidate (Requires Local Agronomic Review)';
    }

    return {
      spec,
      rank: 0,
      internalSortScore: score,
      evaluationStatus,
      thermalFit,
      waterFit,
      soilPhFit,
      rotationFit,
      goalFitExplanation,
      missingInputsAndUncertainty: uncertaintyNotes,
    };
  });

  evaluated.sort((a, b) => b.internalSortScore - a.internalSortScore);
  evaluated.forEach((item, index) => {
    item.rank = index + 1;
  });

  // CRITICAL SCIENTIFIC SAFETY GUARD:
  // Separate viable candidates from rejected ('Not Recommended for Current Constraints') candidates.
  // Never present 'Not Recommended for Current Constraints' crops as top viable recommendations!
  const viableCandidates = evaluated.filter(
    (c) => c.evaluationStatus !== 'Not Recommended for Current Constraints'
  );
  const rejectedCandidates = evaluated.filter(
    (c) => c.evaluationStatus === 'Not Recommended for Current Constraints'
  );
  const hasViableCandidates = viableCandidates.length > 0;
  const topCandidates = viableCandidates.slice(0, 3);
  const topIds = new Set(topCandidates.map((c) => c.spec.id));
  const otherCandidates = evaluated.filter((c) => !topIds.has(c.spec.id));

  let allCandidatesUnsuitableReason: string | null = null;
  if (!hasViableCandidates) {
    const reasons: string[] = [];
    if (
      profile.irrigationAvailability === 'none-rainfed' &&
      observedPrecipMeanMmPerDay !== null &&
      observedPrecipMeanMmPerDay < 0.5
    ) {
      reasons.push(
        `Observed NASA POWER rainfall is ${observedPrecipMeanMmPerDay.toFixed(
          2
        )} mm/day (${activeWindow.startIso} to ${activeWindow.endIso}) and "No Irrigation (Rainfed Only)" is selected — below the minimum rainfed threshold (0.50–2.20 mm/day) of all 12 candidate crops.`
      );
    }
    if (
      profile.soilPh !== null &&
      (profile.soilPh < 4.2 || profile.soilPh > 8.4)
    ) {
      reasons.push(
        `Entered soil pH (${profile.soilPh.toFixed(
          1
        )}) is outside the provisional tolerable pH range (4.2–8.4) of all 12 candidate crops.`
      );
    }
    if (
      observedT2mMean !== null &&
      (observedT2mMean < 5.0 || observedT2mMean > 40.0)
    ) {
      reasons.push(
        `Observed NASA POWER window mean temperature (${observedT2mMean.toFixed(
          1
        )}°C) is outside the provisional thermal bounds (5–40°C) of all 12 candidate crops.`
      );
    }
    if (reasons.length === 0) {
      reasons.push(
        'Combined thermal, moisture/irrigation, and soil pH constraints triggered hard suitability flags across all 12 candidate crops.'
      );
    }
    allCandidatesUnsuitableReason = reasons.join(' ');
  }

  const whyTheseCropsSummary: string[] = [
    hasNasaClimate
      ? hasViableCandidates
        ? `Climate Filter (NASA POWER ${activeWindow.shortLabel}: ${activeWindow.startIso} to ${activeWindow.endIso}): Mean T2M of ${observedT2mMean!.toFixed(
            1
          )}°C and mean rainfall of ${observedPrecipMeanMmPerDay!.toFixed(
            2
          )} mm/day identified ${viableCandidates.length} viable candidate(s) (${topCandidates
            .map((c) => c.spec.cropName)
            .join(', ')}) and rejected ${rejectedCandidates.length} unsuitable crop(s).`
        : `Climate & Constraint Block (NASA POWER ${activeWindow.shortLabel}: ${activeWindow.startIso} to ${activeWindow.endIso}): Mean T2M of ${observedT2mMean!.toFixed(
            1
          )}°C and mean rainfall of ${observedPrecipMeanMmPerDay!.toFixed(
            2
          )} mm/day combined with your farm constraints resulted in 0 viable candidates (${rejectedCandidates.length} of 12 rejected).`
      : `Climate Filter Pending: Without verified NASA POWER data, candidates are ordered by rotation break benefit, entered soil/irrigation settings, and your ${profile.primaryGoal} goal.`,
    `Rotation Break Rule: Because your current crop is ${currentCropMeta.label} (${currentCropMeta.family}), the engine prioritizes non-${currentCropMeta.family} break crops to reduce pest carry-over and improve nutrient cycling.`,
    profile.soilPh !== null
      ? `Soil pH Filter (pH ${profile.soilPh.toFixed(
          1
        )}): Screened candidates against pH ${profile.soilPh.toFixed(1)} tolerance bounds.`
      : `Soil pH Unverified ("Not provided"): Candidates are flagged as requiring local soil pH testing prior to seeding.`,
    `Irrigation & Goal Filter: Weighted for "${
      IRRIGATION_OPTIONS.find((i) => i.id === profile.irrigationAvailability)?.label ??
      profile.irrigationAvailability
    }" and primary goal "${profile.primaryGoal}".`,
  ];

  return {
    hasVerifiedLocation,
    hasNasaClimate,
    activeWindow,
    shortWindowScopeDisclaimer,
    observedT2mMean,
    observedT2mMin,
    observedT2mMax,
    observedPrecipMeanMmPerDay,
    observedPrecipTotalMm,
    observedRainyDays,
    validClimateDays,
    missingClimateDays,
    currentCropMeta,
    missingInputWarnings,
    whyTheseCropsSummary,
    hasViableCandidates,
    allCandidatesUnsuitableReason,
    viableCandidates,
    rejectedCandidates,
    rankedCandidates: evaluated,
    topCandidates,
    otherCandidates,
  };
}

/**
 * Generates the 4 dynamic rotation strategies (Baseline, Strategy A, Strategy B, Strategy C)
 * for Decision Planner in My Farm mode directly from the evaluated candidates.
 *
 * SCIENTIFIC SAFETY INVARIANT:
 * Candidates marked 'Not Recommended for Current Constraints' are NEVER selected into
 * Strategy A, B, or C. If no viable candidates exist (`evaluation.viableCandidates.length === 0`),
 * Strategy A, B, and C are explicitly marked `Not Supported — No Viable Candidate Crops for Current Constraints`.
 */
export function generateDynamicRotationStrategies(
  profile: MyFarmProfile,
  evaluation: RealFarmEvaluationResult
): DynamicRotationStrategy[] {
  const {
    currentCropMeta,
    hasNasaClimate,
    viableCandidates,
    hasViableCandidates,
    allCandidatesUnsuitableReason,
    activeWindow,
  } = evaluation;

  // Helper to pick best VIABLE candidate for a specific goal & optional filter.
  // Strictly searches ONLY `viableCandidates` (never `Not Recommended for Current Constraints`).
  const pickViableCandidateForGoal = (
    goalId: PlannerGoalId,
    excludeIds: Set<string>,
    preferPredicate?: (c: EvaluatedCandidateCrop) => boolean
  ): EvaluatedCandidateCrop | null => {
    if (viableCandidates.length === 0) {
      return null;
    }
    const pool = viableCandidates.filter((c) => !excludeIds.has(c.spec.id));
    const effectivePool = pool.length > 0 ? pool : viableCandidates;
    const scored = [...effectivePool].sort((a, b) => {
      const aBonus =
        a.spec.goalBaseWeights[goalId] +
        (preferPredicate && preferPredicate(a) ? 18 : 0);
      const bBonus =
        b.spec.goalBaseWeights[goalId] +
        (preferPredicate && preferPredicate(b) ? 18 : 0);
      return b.internalSortScore + bBonus - (a.internalSortScore + aBonus);
    });
    return scored[0] ?? null;
  };

  const baselineStrategy: DynamicRotationStrategy = {
    id: 'baseline',
    codeLabel: 'Baseline Reference',
    title: 'Current Rotation — Baseline',
    subtitle: `Current Crop: ${currentCropMeta.label} (multi-season rotation history not supplied)`,
    alignedGoalId: null,
    isSupported: true,
    supportStatusLabel: 'Current-Crop Baseline (History Unverified)',
    steps: [
      {
        phaseLabel: 'Prior History',
        cropName: 'Not Provided by User',
        roleLabel: 'Unverified Historical Sequence',
        note: 'Multi-year crop history was not entered.',
        isUnverified: true,
      },
      {
        phaseLabel: 'Current Crop',
        cropName: currentCropMeta.label,
        roleLabel: `${currentCropMeta.family} Reference`,
        note: currentCropMeta.typicalResidue,
      },
      {
        phaseLabel: 'Continuation Benchmark',
        cropName: `Repeat ${currentCropMeta.label}`,
        roleLabel: 'Monoculture Comparison Baseline',
        note: 'Used as baseline benchmark against diversified strategies.',
        isUnverified: true,
      },
    ],
    whyConsidered:
      'Represents your entered current crop as a baseline reference without inventing a multi-year historical rotation.',
    expectedBenefits: [
      `Uses existing ${currentCropMeta.label} machinery, seed familiarity, and buyer channels.`,
    ],
    limitationsAndRisks: [
      currentCropMeta.rotationGuidance,
      ...(evaluation.missingInputWarnings.length > 0
        ? [evaluation.missingInputWarnings[0]]
        : []),
    ],
    missingEvidenceGaps: [
      'Prior 2–3 year field crop history, local pest/weed pressure, and lab soil test buffering capacity are not supplied.',
    ],
    tradeOffRatings: {
      profitPotential: {
        rating: 'Medium',
        shortRationale:
          'Familiar market channel, but continuous monoculture risks progressive yield drag.',
      },
      waterResilience: {
        rating: 'Low',
        shortRationale:
          'Lacks complementary root-depth alternation or moisture-conserving break crops.',
      },
      soilImprovement: {
        rating: currentCropMeta.isNitrogenFixer ? 'Medium' : 'Low',
        shortRationale: currentCropMeta.isNitrogenFixer
          ? 'Fixes nitrogen, but continuous legume cropping leaves sparse surface residue.'
          : 'Continuous non-legume draw without biological nitrogen fixation.',
      },
      cropDiversity: {
        rating: 'Low',
        shortRationale: 'Single crop family baseline without verified multi-species rotation.',
      },
      managementComplexity: {
        rating: 'Low',
        shortRationale:
          'Lowest operational complexity — no new seeding or harvest equipment required.',
      },
    },
  };

  // If NO viable candidate crops exist (all 12 marked 'Not Recommended for Current Constraints'),
  // preserve the 4-strategy comparison structure but explicitly mark Strategy A, B, and C as
  // unsupported and DO NOT insert rejected crops as planting recommendations.
  if (!hasViableCandidates) {
    const blockReason =
      allCandidatesUnsuitableReason ??
      'All 12 candidate crops failed current thermal, rainfall/irrigation, or soil pH constraints.';

    const buildUnsupportedStrategy = (
      id: StrategyId,
      codeLabel: string,
      title: string,
      goalId: PlannerGoalId
    ): DynamicRotationStrategy => ({
      id,
      codeLabel,
      title,
      subtitle: 'Not Supported — No viable candidate crops pass current constraints',
      alignedGoalId: goalId,
      isSupported: false,
      supportStatusLabel: 'Not Supported — No Viable Candidate Crops for Current Constraints',
      steps: [
        {
          phaseLabel: 'Phase 1 (Current)',
          cropName: currentCropMeta.label,
          roleLabel: `Current ${currentCropMeta.family} Stand`,
          note: 'User-entered current crop',
        },
        {
          phaseLabel: 'Phase 2 (Constraint Blocked)',
          cropName: 'No Viable Break Crop (Not Recommended)',
          roleLabel: 'Blocked by Current Constraints',
          note: '0 of 12 candidates passed screening rules',
          isUnverified: true,
        },
        {
          phaseLabel: 'Phase 3 (Constraint Blocked)',
          cropName: 'Requires Constraint Resolution',
          roleLabel: 'See Irrigation / Soil / Window Settings',
          note: 'Do not plant unvalidated crops under current constraints',
          isUnverified: true,
        },
      ],
      whyConsidered: `This strategy slot is preserved for side-by-side comparison, but is NOT recommended because all 12 candidate crops are marked "Not Recommended for Current Constraints" for ${activeWindow.startIso} to ${activeWindow.endIso}.`,
      expectedBenefits: [
        'Prevents false agronomic confidence: CropWise refuses to recommend break crops that violate your active water, thermal, or soil pH constraints.',
      ],
      limitationsAndRisks: [
        blockReason,
        'Adjust irrigation availability (e.g. if supplemental or full irrigation is possible), verify soil pH amendments, or test a different seasonal planting window.',
      ],
      missingEvidenceGaps: [
        ...evaluation.missingInputWarnings,
        evaluation.shortWindowScopeDisclaimer,
      ],
      tradeOffRatings: {
        profitPotential: {
          rating: 'Low',
          shortRationale:
            'Not supported — no candidate crop meets minimum survival/establishment thresholds under current constraints.',
        },
        waterResilience: {
          rating: 'Low',
          shortRationale: blockReason,
        },
        soilImprovement: {
          rating: 'Low',
          shortRationale:
            'Cannot establish biological nitrogen-fixing or residue-building break crops under current constraints.',
        },
        cropDiversity: {
          rating: 'Low',
          shortRationale: 'No viable rotation break crop identified.',
        },
        managementComplexity: {
          rating: 'High',
          shortRationale:
            'Requires resolving fundamental water, soil pH, or seasonal window constraints before planting.',
        },
      },
    });

    return [
      baselineStrategy,
      buildUnsupportedStrategy('strategy-a', 'Strategy A', 'Strategy A — Earn More', 'earn-more'),
      buildUnsupportedStrategy('strategy-b', 'Strategy B', 'Strategy B — Lower Risk', 'lower-risk'),
      buildUnsupportedStrategy('strategy-c', 'Strategy C', 'Strategy C — More Crops', 'more-crops'),
    ];
  }

  // Viable candidates exist! Assemble Strategy A, B, C exclusively from viableCandidates.
  const stratAPhase2 = pickViableCandidateForGoal(
    'earn-more',
    new Set(),
    (c) =>
      c.spec.family !== currentCropMeta.family &&
      c.spec.tradeOffProfile.profitPotential === 'High'
  )!;
  const stratAPhase3 = pickViableCandidateForGoal(
    'earn-more',
    new Set([stratAPhase2.spec.id]),
    (c) => c.spec.family !== stratAPhase2.spec.family
  )!;

  const stratBPhase2 = pickViableCandidateForGoal(
    'lower-risk',
    new Set(),
    (c) =>
      c.spec.family !== currentCropMeta.family &&
      c.spec.tradeOffProfile.waterResilience === 'High' &&
      c.spec.isNitrogenFixer
  )!;
  const stratBPhase3 = pickViableCandidateForGoal(
    'lower-risk',
    new Set([stratBPhase2.spec.id]),
    (c) =>
      c.spec.tradeOffProfile.waterResilience === 'High' &&
      c.spec.tradeOffProfile.managementComplexity === 'Low'
  )!;

  const stratCPhase2 = pickViableCandidateForGoal(
    'more-crops',
    new Set(),
    (c) => c.spec.isNitrogenFixer && c.spec.family !== currentCropMeta.family
  )!;
  const stratCPhase3 = pickViableCandidateForGoal(
    'more-crops',
    new Set([stratCPhase2.spec.id]),
    (c) =>
      c.spec.family !== currentCropMeta.family &&
      c.spec.family !== stratCPhase2.spec.family
  )!;
  const stratCPhase4 = pickViableCandidateForGoal(
    'more-crops',
    new Set([stratCPhase2.spec.id, stratCPhase3.spec.id]),
    (c) =>
      c.spec.rotationRole === 'Short-Window Pseudocereal / Cover' ||
      c.spec.tradeOffProfile.soilImprovement === 'High'
  )!;

  const computeStrategySupport = (
    crops: EvaluatedCandidateCrop[]
  ): {
    isSupported: boolean;
    label: DynamicRotationStrategy['supportStatusLabel'];
  } => {
    if (!hasNasaClimate) {
      return {
        isSupported: false,
        label: 'Insufficient Data to Validate Rotation',
      };
    }
    const anyConditional =
      profile.soilPh === null ||
      profile.irrigationAvailability === 'not-specified' ||
      activeWindow.isShortWindow ||
      crops.some(
        (c) => c.evaluationStatus === 'Conditional Candidate (Action / Amendment Needed)'
      );
    if (anyConditional) {
      return {
        isSupported: true,
        label: 'Conditionally Supported (See Input / Climate Limitations)',
      };
    }
    return {
      isSupported: true,
      label: 'Supported by Candidate Evaluation (Requires Local Review)',
    };
  };

  const supportA = computeStrategySupport([stratAPhase2, stratAPhase3]);
  const supportB = computeStrategySupport([stratBPhase2, stratBPhase3]);
  const supportC = computeStrategySupport([stratCPhase2, stratCPhase3, stratCPhase4]);

  return [
    baselineStrategy,
    {
      id: 'strategy-a',
      codeLabel: 'Strategy A',
      title: 'Strategy A — Earn More',
      subtitle: `${currentCropMeta.label} → ${stratAPhase2.spec.cropName} → ${stratAPhase3.spec.cropName}`,
      alignedGoalId: 'earn-more',
      isSupported: supportA.isSupported,
      supportStatusLabel: supportA.label,
      steps: [
        {
          phaseLabel: 'Phase 1 (Current)',
          cropName: currentCropMeta.label,
          roleLabel: `Current ${currentCropMeta.family} Stand`,
          note: 'User-entered current crop',
        },
        {
          phaseLabel: 'Phase 2 (Break Crop)',
          cropName: stratAPhase2.spec.cropName,
          roleLabel: stratAPhase2.spec.rotationRole,
          note: `${stratAPhase2.thermalFit.status} Thermal • ${stratAPhase2.waterFit.status} Water`,
        },
        {
          phaseLabel: 'Phase 3 (Commercial Follow-On)',
          cropName: stratAPhase3.spec.cropName,
          roleLabel: stratAPhase3.spec.rotationRole,
          note: `${stratAPhase3.thermalFit.status} Thermal • ${stratAPhase3.waterFit.status} Water`,
        },
      ],
      whyConsidered: `Dynamically assembled from viable commercial candidates (${stratAPhase2.spec.cropName} and ${stratAPhase3.spec.cropName}) that break ${currentCropMeta.label} cycles under your ${activeWindow.startIso} to ${activeWindow.endIso} climate window and farm inputs.`,
      expectedBenefits: [
        `${stratAPhase2.spec.cropName}: ${stratAPhase2.rotationFit.explanation}`,
        `${stratAPhase3.spec.cropName}: ${stratAPhase3.goalFitExplanation}`,
      ],
      limitationsAndRisks: [
        stratAPhase2.waterFit.explanation,
        stratAPhase2.soilPhFit.explanation,
        ...stratAPhase2.spec.keyRisks.slice(0, 1),
      ],
      missingEvidenceGaps: [
        ...evaluation.missingInputWarnings,
        evaluation.shortWindowScopeDisclaimer,
        'Local buyer pricing and cultivar maturity group must be verified with regional extension.',
      ],
      tradeOffRatings: {
        profitPotential: {
          rating: supportA.isSupported ? 'High' : 'Medium',
          shortRationale: `Prioritizes higher-value commercial phases (${stratAPhase2.spec.cropName}, ${stratAPhase3.spec.cropName}).`,
        },
        waterResilience: {
          rating: stratAPhase2.spec.tradeOffProfile.waterResilience,
          shortRationale: stratAPhase2.waterFit.explanation,
        },
        soilImprovement: {
          rating:
            stratAPhase2.spec.isNitrogenFixer || stratAPhase3.spec.isNitrogenFixer
              ? 'High'
              : 'Medium',
          shortRationale: `Alternates ${currentCropMeta.family} with ${stratAPhase2.spec.family} and ${stratAPhase3.spec.family}.`,
        },
        cropDiversity: {
          rating: 'Medium',
          shortRationale: 'Three-phase commercial rotation across contrasting crop groups.',
        },
        managementComplexity: {
          rating: 'Medium',
          shortRationale:
            'Requires commercial quality management, inoculation/fertility tuning, and market timing.',
        },
      },
    },
    {
      id: 'strategy-b',
      codeLabel: 'Strategy B',
      title: 'Strategy B — Lower Risk',
      subtitle: `${currentCropMeta.label} → ${stratBPhase2.spec.cropName} → ${stratBPhase3.spec.cropName}`,
      alignedGoalId: 'lower-risk',
      isSupported: supportB.isSupported,
      supportStatusLabel: supportB.label,
      steps: [
        {
          phaseLabel: 'Phase 1 (Current)',
          cropName: currentCropMeta.label,
          roleLabel: `Current ${currentCropMeta.family} Stand`,
          note: 'User-entered current crop',
        },
        {
          phaseLabel: 'Phase 2 (Stress-Buffer Break)',
          cropName: stratBPhase2.spec.cropName,
          roleLabel: stratBPhase2.spec.rotationRole,
          note: `${stratBPhase2.thermalFit.status} Thermal • ${stratBPhase2.waterFit.status} Water`,
        },
        {
          phaseLabel: 'Phase 3 (Low-Input Stabilizer)',
          cropName: stratBPhase3.spec.cropName,
          roleLabel: stratBPhase3.spec.rotationRole,
          note: `${stratBPhase3.thermalFit.status} Thermal • ${stratBPhase3.waterFit.status} Water`,
        },
      ],
      whyConsidered: `Dynamically selects the most water-resilient, lower-input viable candidates (${stratBPhase2.spec.cropName} and ${stratBPhase3.spec.cropName}) compatible with your ${activeWindow.startIso} to ${activeWindow.endIso} window, soil pH (${
        profile.soilPh !== null ? profile.soilPh : 'Not provided'
      }), and irrigation setting.`,
      expectedBenefits: [
        `${stratBPhase2.spec.cropName}: ${stratBPhase2.waterFit.explanation}`,
        `${stratBPhase3.spec.cropName}: ${stratBPhase3.spec.agronomicSummary}`,
      ],
      limitationsAndRisks: [
        'Trades peak specialty-crop revenue potential for lower input exposure and greater drought/soil-stress buffering.',
        ...stratBPhase2.spec.keyRisks.slice(0, 1),
      ],
      missingEvidenceGaps: [
        ...evaluation.missingInputWarnings,
        evaluation.shortWindowScopeDisclaimer,
        'Subsoil water-holding capacity and local feed/pulse market liquidity require on-farm verification.',
      ],
      tradeOffRatings: {
        profitPotential: {
          rating: 'Medium',
          shortRationale:
            'Focuses on stable staple/pulse returns and reduced fertilizer/water risk.',
        },
        waterResilience: {
          rating: 'High',
          shortRationale: `Selected for high drought/moisture resilience (${stratBPhase2.spec.cropName}, ${stratBPhase3.spec.cropName}).`,
        },
        soilImprovement: {
          rating: 'High',
          shortRationale: `Combines nitrogen fixation (${stratBPhase2.spec.cropName}) with protective root/residue cover.`,
        },
        cropDiversity: {
          rating: 'Medium',
          shortRationale: `Alternates ${currentCropMeta.family}, ${stratBPhase2.spec.family}, and ${stratBPhase3.spec.family}.`,
        },
        managementComplexity: {
          rating: 'Low',
          shortRationale: 'Forgiving agronomic windows and lower synthetic input requirements.',
        },
      },
    },
    {
      id: 'strategy-c',
      codeLabel: 'Strategy C',
      title: 'Strategy C — More Crops',
      subtitle: `${currentCropMeta.label} → ${stratCPhase2.spec.cropName} → ${stratCPhase3.spec.cropName} → ${stratCPhase4.spec.cropName}`,
      alignedGoalId: 'more-crops',
      isSupported: supportC.isSupported,
      supportStatusLabel: supportC.label,
      steps: [
        {
          phaseLabel: 'Phase 1 (Current)',
          cropName: currentCropMeta.label,
          roleLabel: `${currentCropMeta.family} Crop`,
          note: 'User-entered current crop',
        },
        {
          phaseLabel: 'Phase 2 (Pulse Break)',
          cropName: stratCPhase2.spec.cropName,
          roleLabel: `${stratCPhase2.spec.family} Legume`,
          note: `${stratCPhase2.thermalFit.status} Thermal`,
        },
        {
          phaseLabel: 'Phase 3 (Broadleaf / Oilseed)',
          cropName: stratCPhase3.spec.cropName,
          roleLabel: `${stratCPhase3.spec.family} Break`,
          note: `${stratCPhase3.thermalFit.status} Thermal`,
        },
        {
          phaseLabel: 'Phase 4 (Relay / Diversity)',
          cropName: stratCPhase4.spec.cropName,
          roleLabel: `${stratCPhase4.spec.family} / Cover`,
          note: `${stratCPhase4.thermalFit.status} Thermal`,
        },
      ],
      whyConsidered: `Dynamically sequences four crop phases (${currentCropMeta.label}, ${stratCPhase2.spec.cropName}, ${stratCPhase3.spec.cropName}, ${stratCPhase4.spec.cropName}) from viable candidates to maximize botanical diversity, root architecture contrast, and pest-cycle disruption.`,
      expectedBenefits: [
        `Spans multiple botanical families (${Array.from(
          new Set([
            currentCropMeta.family,
            stratCPhase2.spec.family,
            stratCPhase3.spec.family,
            stratCPhase4.spec.family,
          ])
        ).join(', ')}) to suppress soil-borne pests and weeds.`,
        'Diversifies harvest outputs and builds continuous root biomass.',
      ],
      limitationsAndRisks: [
        'High management complexity: requires multi-crop seeding calibration, herbicide residue tracking, and tighter scheduling.',
        ...stratCPhase3.spec.keyRisks.slice(0, 1),
      ],
      missingEvidenceGaps: [
        ...evaluation.missingInputWarnings,
        evaluation.shortWindowScopeDisclaimer,
        'Frost-free or monsoon-safe relay windows must be verified against local multi-year weather station records.',
      ],
      tradeOffRatings: {
        profitPotential: {
          rating: 'Medium',
          shortRationale:
            'Multiple harvestable outputs balanced by higher seed and field-pass overhead.',
        },
        waterResilience: {
          rating: stratCPhase2.spec.tradeOffProfile.waterResilience,
          shortRationale: 'Diversified crop timing spreads seasonal rainfall risk.',
        },
        soilImprovement: {
          rating: 'High',
          shortRationale:
            'Maximizes root diversity, biological N fixation, and surface residue cover.',
        },
        cropDiversity: {
          rating: 'High',
          shortRationale: 'Four-phase poly-family rotation.',
        },
        managementComplexity: {
          rating: 'High',
          shortRationale:
            'Highest operational coordination across four crop phases (inverted desirability: Challenging).',
        },
      },
    },
  ];
}
