import {
  FIELD_IDS,
  cropwiseFields,
  getFieldBadgeClass,
  getFieldOverviewStatus,
  isFieldId,
  type FieldEquipmentStatus,
  type FieldId,
  type FieldOverviewStatus,
} from './cropwiseFields';
import { validateCoordinates } from '../services/nasaPowerClient';
import {
  NASA_HISTORICAL_WINDOWS,
  NASA_PUBLIC_TEST_LOCATIONS,
  type NasaTestLocationPreset,
  type TimeRangeKey,
} from './reportsHistoryData';

export { NASA_HISTORICAL_WINDOWS, NASA_PUBLIC_TEST_LOCATIONS };
export type { NasaTestLocationPreset, TimeRangeKey };

export type PlannerGoalId = 'earn-more' | 'lower-risk' | 'more-crops';

export type StrategyId = 'baseline' | 'strategy-a' | 'strategy-b' | 'strategy-c';

export type QualitativeRating = 'High' | 'Medium' | 'Low';

export type TradeOffDimensionKey =
  | 'profitPotential'
  | 'waterResilience'
  | 'soilImprovement'
  | 'cropDiversity'
  | 'managementComplexity';

export type PlannerAuthenticityTag =
  | 'Team-provided Demo Snapshot'
  | 'Illustrative Rotation Strategy'
  | 'NASA POWER Modeled / Assimilated Data';

export interface PlannerGoalOption {
  id: PlannerGoalId;
  label: string;
  tagline: string;
  matchingStrategyId: StrategyId;
  matchingStrategyTitle: string;
  emphasizedDimensions: TradeOffDimensionKey[];
  summaryDescription: string;
}

export interface RotationPhaseStep {
  phaseLabel: string;
  cropName: string;
  functionalRole: string;
  seasonWindow: string;
  verificationNote: string;
  isUnverifiedHistory?: boolean;
}

export interface TradeOffCellEvaluation {
  rating: QualitativeRating;
  shortRationale: string;
}

export interface RotationStrategyRecord {
  id: StrategyId;
  codeLabel: string;
  title: string;
  subtitle: string;
  alignedGoalId: PlannerGoalId | null; // null for baseline
  authenticityTag: PlannerAuthenticityTag;
  isBaseline: boolean;
  baselineVerificationBanner?: string;
  sequenceSteps: RotationPhaseStep[];
  expectedBenefits: string[];
  potentialRisks: string[];
  suitableConditions: string[];
  recommendationExplanation: Record<PlannerGoalId, string>;
  supportingEvidenceAndAssumptions: string[];
  uncertaintyAndInformationGaps: string[];
  tradeOffRatings: Record<TradeOffDimensionKey, TradeOffCellEvaluation>;
}

export interface TradeOffDimensionMeta {
  key: TradeOffDimensionKey;
  label: string;
  description: string;
  invertedDesirability: boolean;
  desirabilityLegend: string;
}

export interface FieldRotationPlanBundle {
  fieldId: FieldId;
  fieldName: string;
  cropType: string;
  snapshotScore: number;
  cardHumidity: string;
  ph: string;
  areaHectares: string;
  waterDemand: string;
  fertilizerEfficiency: string;
  equipmentStatus: FieldEquipmentStatus;
  overviewDisplayStatus: FieldOverviewStatus;
  badgeClass: string;
  tableSoilMoistureSnapshot: string;
  tableTemperatureSnapshot: string;
  tableGrowthStageSnapshot: string;
  fieldSnapshotSummary: string;
  agronomicContextAlert: string;
  goalBannerRecommendations: Record<
    PlannerGoalId,
    {
      headline: string;
      rationale: string;
      cautionNote: string;
    }
  >;
  strategies: RotationStrategyRecord[];
}

export interface VerifiedFarmLocation {
  latitude: number;
  longitude: number;
  label: string;
  source: 'browser-geolocation' | 'manual-input' | 'public-test-preset';
  updatedAtIso: string;
}

const FARM_LOCATION_STORAGE_KEY = 'cropwise_verified_farm_location_v1';

const VALID_LOCATION_SOURCES = new Set<VerifiedFarmLocation['source']>([
  'browser-geolocation',
  'manual-input',
  'public-test-preset',
]);

let sharedVerifiedLocation: VerifiedFarmLocation | null = null;
let storageInitialized = false;

function readValidatedLocationFromStorage(): VerifiedFarmLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FARM_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    const coordCheck = validateCoordinates(
      record.latitude as string | number,
      record.longitude as string | number
    );
    if (!coordCheck.valid) {
      window.localStorage.removeItem(FARM_LOCATION_STORAGE_KEY);
      return null;
    }

    const rawLabel = typeof record.label === 'string' ? record.label.trim() : '';
    const sourceCandidate = record.source as VerifiedFarmLocation['source'];
    const validSource: VerifiedFarmLocation['source'] = VALID_LOCATION_SOURCES.has(
      sourceCandidate
    )
      ? sourceCandidate
      : 'manual-input';

    return {
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      label:
        rawLabel ||
        `Farm Coordinates (${coordCheck.latitude}°, ${coordCheck.longitude}°)`,
      source: validSource,
      updatedAtIso:
        typeof record.updatedAtIso === 'string' && record.updatedAtIso.trim() !== ''
          ? record.updatedAtIso
          : new Date().toISOString(),
    };
  } catch {
    // Gracefully handle malformed JSON or unavailable localStorage
    return null;
  }
}

function writeValidatedLocationToStorage(location: VerifiedFarmLocation | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!location) {
      window.localStorage.removeItem(FARM_LOCATION_STORAGE_KEY);
      return;
    }
    const coordCheck = validateCoordinates(location.latitude, location.longitude);
    if (!coordCheck.valid) return;

    const payload: VerifiedFarmLocation = {
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      label:
        location.label.trim() ||
        `Farm Coordinates (${coordCheck.latitude}°, ${coordCheck.longitude}°)`,
      source: VALID_LOCATION_SOURCES.has(location.source)
        ? location.source
        : 'manual-input',
      updatedAtIso: location.updatedAtIso || new Date().toISOString(),
    };
    window.localStorage.setItem(FARM_LOCATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Gracefully ignore QuotaExceededError / SecurityError
  }
}

export function getSharedFarmLocationState(): {
  verifiedLocation: VerifiedFarmLocation | null;
  draftLatInput: string;
  draftLonInput: string;
} {
  const fromStorage = readValidatedLocationFromStorage();
  if (fromStorage) {
    sharedVerifiedLocation = fromStorage;
    storageInitialized = true;
  } else if (!storageInitialized) {
    sharedVerifiedLocation = null;
    storageInitialized = true;
  }

  return {
    verifiedLocation: sharedVerifiedLocation,
    draftLatInput: sharedVerifiedLocation ? String(sharedVerifiedLocation.latitude) : '',
    draftLonInput: sharedVerifiedLocation ? String(sharedVerifiedLocation.longitude) : '',
  };
}

export function setSharedFarmLocationState(next: {
  verifiedLocation: VerifiedFarmLocation | null;
  draftLatInput?: string;
  draftLonInput?: string;
}): void {
  storageInitialized = true;
  if (!next.verifiedLocation) {
    sharedVerifiedLocation = null;
    writeValidatedLocationToStorage(null);
    return;
  }

  const coordCheck = validateCoordinates(
    next.verifiedLocation.latitude,
    next.verifiedLocation.longitude
  );
  if (!coordCheck.valid) {
    return;
  }

  const sanitized: VerifiedFarmLocation = {
    latitude: coordCheck.latitude,
    longitude: coordCheck.longitude,
    label:
      next.verifiedLocation.label.trim() ||
      `Farm Coordinates (${coordCheck.latitude}°, ${coordCheck.longitude}°)`,
    source: VALID_LOCATION_SOURCES.has(next.verifiedLocation.source)
      ? next.verifiedLocation.source
      : 'manual-input',
    updatedAtIso: next.verifiedLocation.updatedAtIso || new Date().toISOString(),
  };

  sharedVerifiedLocation = sanitized;
  writeValidatedLocationToStorage(sanitized);
}

export const PLANNER_GOALS: readonly PlannerGoalOption[] = [
  {
    id: 'earn-more',
    label: 'Earn More',
    tagline: 'Prioritize commercial market value & cash-crop sequence output',
    matchingStrategyId: 'strategy-a',
    matchingStrategyTitle: 'Strategy A — Earn More',
    emphasizedDimensions: ['profitPotential', 'soilImprovement'],
    summaryDescription:
      'Focuses on higher-value commercial crop sequences paired with targeted soil conditioning to support marketable output, while acknowledging higher input and management demands.',
  },
  {
    id: 'lower-risk',
    label: 'Lower Risk',
    tagline: 'Prioritize drought buffering, input stability & simpler execution',
    matchingStrategyId: 'strategy-b',
    matchingStrategyTitle: 'Strategy B — Lower Risk',
    emphasizedDimensions: ['waterResilience', 'managementComplexity'],
    summaryDescription:
      'Focuses on water-resilient, lower-input legume and hardy grain sequences designed to buffer moisture deficits, pH stress, and operational complexity.',
  },
  {
    id: 'more-crops',
    label: 'More Crops',
    tagline: 'Prioritize multi-species diversity, relay cover & soil biology',
    matchingStrategyId: 'strategy-c',
    matchingStrategyTitle: 'Strategy C — More Crops',
    emphasizedDimensions: ['cropDiversity', 'soilImprovement'],
    summaryDescription:
      'Focuses on multi-functional crop families (cereals, pulses, oilseeds, and cover biomass) to diversify harvest windows and break pest/disease cycles, trading off higher coordination complexity.',
  },
] as const;

export const TRADE_OFF_DIMENSIONS: readonly TradeOffDimensionMeta[] = [
  {
    key: 'profitPotential',
    label: 'Profit Potential',
    description: 'Illustrative commercial revenue potential under favorable local market access.',
    invertedDesirability: false,
    desirabilityLegend: 'High = Positive • Medium = Neutral • Low = Limited',
  },
  {
    key: 'waterResilience',
    label: 'Water Resilience',
    description: 'Illustrative tolerance to dry spells, erratic rainfall, and irrigation constraints.',
    invertedDesirability: false,
    desirabilityLegend: 'High = Positive • Medium = Neutral • Low = Vulnerable',
  },
  {
    key: 'soilImprovement',
    label: 'Soil Improvement',
    description: 'Illustrative contribution to nitrogen fixation, residue cover, and root structure.',
    invertedDesirability: false,
    desirabilityLegend: 'High = Positive • Medium = Neutral • Low = Depleting',
  },
  {
    key: 'cropDiversity',
    label: 'Crop Diversity',
    description: 'Botanical and functional variety across rotation phases to disrupt pest cycles.',
    invertedDesirability: false,
    desirabilityLegend: 'High = Positive • Medium = Neutral • Low = Monoculture Risk',
  },
  {
    key: 'managementComplexity',
    label: 'Management Complexity',
    description:
      'Operational workload, scheduling precision, and equipment/agronomic skill requirements (INVERTED desirability).',
    invertedDesirability: true,
    desirabilityLegend: 'Low = Positive (Easier) • Medium = Neutral • High = Negative (Harder)',
  },
] as const;

/**
 * Returns semantic Tailwind classes for a qualitative rating cell/badge.
 * Respects inverted desirability for Management Complexity:
 * - Standard dimensions: High = positive (emerald), Medium = neutral (amber), Low = negative (red)
 * - Inverted dimension (Management Complexity): Low = positive (emerald), Medium = neutral (amber), High = negative (red)
 */
export function getQualitativeRatingStyle(
  rating: QualitativeRating,
  invertedDesirability: boolean
): {
  badgeClass: string;
  dotClass: string;
  desirabilityLabel: 'Favorable' | 'Moderate' | 'Challenging';
} {
  if (!invertedDesirability) {
    switch (rating) {
      case 'High':
        return {
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-500',
          desirabilityLabel: 'Favorable',
        };
      case 'Medium':
        return {
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
          desirabilityLabel: 'Moderate',
        };
      case 'Low':
        return {
          badgeClass: 'bg-red-100 text-red-800 border-red-200',
          dotClass: 'bg-red-500',
          desirabilityLabel: 'Challenging',
        };
    }
  } else {
    // Inverted desirability: High complexity is negative, Low complexity is positive
    switch (rating) {
      case 'Low':
        return {
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-500',
          desirabilityLabel: 'Favorable',
        };
      case 'Medium':
        return {
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
          desirabilityLabel: 'Moderate',
        };
      case 'High':
        return {
          badgeClass: 'bg-red-100 text-red-800 border-red-200',
          dotClass: 'bg-red-500',
          desirabilityLabel: 'Challenging',
        };
    }
  }
}

const TABLE_SNAPSHOT_LOOKUP: Record<
  FieldId,
  { soilMoisture: string; temperature: string; growthStage: string }
> = {
  'north-field-a1': {
    soilMoisture: '68%',
    temperature: '26°C',
    growthStage: 'Vegetative',
  },
  'east-field-b2': {
    soilMoisture: '72%',
    temperature: '24°C',
    growthStage: 'Flowering',
  },
  'south-field-c3': {
    soilMoisture: '41%',
    temperature: '29°C',
    growthStage: 'Seedling',
  },
};

function buildFieldPlans(): Record<FieldId, FieldRotationPlanBundle> {
  const north = cropwiseFields['north-field-a1'];
  const east = cropwiseFields['east-field-b2'];
  const south = cropwiseFields['south-field-c3'];

  return {
    'north-field-a1': {
      fieldId: 'north-field-a1',
      fieldName: north.name,
      cropType: north.type,
      snapshotScore: north.score,
      cardHumidity: north.humidity,
      ph: north.ph,
      areaHectares: north.area,
      waterDemand: north.water,
      fertilizerEfficiency: north.fertilizer,
      equipmentStatus: north.status,
      overviewDisplayStatus: getFieldOverviewStatus(north.status),
      badgeClass: getFieldBadgeClass(north.status),
      tableSoilMoistureSnapshot: TABLE_SNAPSHOT_LOOKUP['north-field-a1'].soilMoisture,
      tableTemperatureSnapshot: TABLE_SNAPSHOT_LOOKUP['north-field-a1'].temperature,
      tableGrowthStageSnapshot: TABLE_SNAPSHOT_LOOKUP['north-field-a1'].growthStage,
      fieldSnapshotSummary:
        'Current crop: Corn Plantation (2.3 ha, Vegetative stage). Team snapshot records Score 70/100, Field Card Humidity 32% (Table Soil Moisture 68%), Water 1,250L, Fertilizer 87%, and an extreme acidic pH reading of 2.8.',
      agronomicContextAlert:
        'Agronomic Constraint Note: The team snapshot reports pH 2.8 for North Field A1, which is severely acidic for commercial corn or legume nodulation. All rotation options below require local soil lab verification and agricultural liming assessment before implementation.',
      goalBannerRecommendations: {
        'earn-more': {
          headline:
            'Recommended for Earn More on North Field A1: Strategy A — Corn → Soybean → High-Value Sweet Corn / Edamame Sequence',
          rationale:
            'Pairs the existing Corn Plantation with a nitrogen-fixing legume phase and a high-margin specialty vegetable-legume window once soil pH (2.8 snapshot) is corrected.',
          cautionNote:
            'Commercial specialty phases require verified pH remediation and reliable irrigation beyond the 32% card humidity snapshot.',
        },
        'lower-risk': {
          headline:
            'Recommended for Lower Risk on North Field A1: Strategy B — Corn → Acid-Tolerant Cowpea → Sorghum-Sudangrass Buffer',
          rationale:
            'Replaces consecutive high-input corn with drought- and acid-resilient cowpea and sorghum phases to reduce water vulnerability and input exposure.',
          cautionNote:
            'Prioritizes yield stability and soil recovery over peak cash-crop margins while pH 2.8 anomaly is investigated.',
        },
        'more-crops': {
          headline:
            'Recommended for More Crops on North Field A1: Strategy C — Corn → Mungbean → Upland Rice / Buckwheat → Crimson Clover Cover',
          rationale:
            'Introduces four distinct functional plant families across seasons to maximize biodiversity, surface residue cover, and pest-cycle disruption.',
          cautionNote:
            'Carries High management complexity due to tighter planting windows and multi-crop harvest handling on 2.3 ha.',
        },
      },
      strategies: [
        {
          id: 'baseline',
          codeLabel: 'Baseline Reference',
          title: 'Current Rotation — Baseline',
          subtitle: 'Existing Corn Plantation reference (unverified multi-season rotation history)',
          alignedGoalId: null,
          authenticityTag: 'Team-provided Demo Snapshot',
          isBaseline: true,
          baselineVerificationBanner:
            'Current-Crop Reference Only — Multi-season historical crop sequence is unverified in existing team records.',
          sequenceSteps: [
            {
              phaseLabel: 'Prior Season(s)',
              cropName: 'Unverified Historical Sequence',
              functionalRole: 'No Prior Crop Log in Team Data',
              seasonWindow: 'Pre-Snapshot Archive',
              verificationNote: 'Not recorded in MainContent.tsx',
              isUnverifiedHistory: true,
            },
            {
              phaseLabel: 'Current Observed Snapshot',
              cropName: 'Corn Plantation (Zea mays)',
              functionalRole: 'Primary Cereal Crop (Vegetative Stage)',
              seasonWindow: 'Current Active Season',
              verificationNote: 'Verified in cropwiseFields.ts (Score 70, 2.3 ha)',
            },
            {
              phaseLabel: 'Next Planned Phase',
              cropName: 'Unassigned / Repeat Corn Reference',
              functionalRole: 'Baseline Continuation Benchmark',
              seasonWindow: 'Upcoming Cycle',
              verificationNote: 'Used as baseline comparison benchmark',
              isUnverifiedHistory: true,
            },
          ],
          expectedBenefits: [
            'Uses existing Corn Plantation equipment, seed supply, and familiar vegetative-stage workflow (fertilizer efficiency snapshot: 87%).',
            'Requires zero immediate changeover in harvesting gear or buyer channels.',
          ],
          potentialRisks: [
            'Repeating corn without a rotation break increases rootworm/stem-borer carry-over and nitrogen fertilizer dependency.',
            'Severe pH 2.8 snapshot reading and 32% card humidity indicate high vulnerability if acidic root-zone stress persists.',
          ],
          suitableConditions: [
            'Short-term operational continuity only while soil pH sensor calibration (pH 2.8) and field moisture discrepancy (32% card vs 68% table) are audited.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Serves as the current benchmark; continuous corn without legume rotation or pH correction limits long-term revenue resilience.',
            'lower-risk':
              'Serves as the current benchmark; repeating single-crop corn exposes the 2.3 ha plot to moisture and acidity stress.',
            'more-crops':
              'Serves as the current benchmark; single-family cereal cultivation offers minimal botanical diversity.',
          },
          supportingEvidenceAndAssumptions: [
            'Team-provided snapshot: North Field A1 is a 2.3 ha Corn Plantation with Score 70, Humidity 32%, pH 2.8, Water 1,250L, and Fertilizer 87%.',
            'Table overview records Soil Moisture 68%, Temp 26°C, Growth Stage: Vegetative.',
          ],
          uncertaintyAndInformationGaps: [
            'Team codebase provides only a single-point snapshot; prior 2–3 year crop history and cultivar acid-tolerance are unverified.',
            'Extreme pH 2.8 reading may reflect either localized acid-sulfate soil conditions or an uncalibrated in-field probe.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Established corn market, but constrained by fertilizer costs and pH stress.',
            },
            waterResilience: {
              rating: 'Low',
              shortRationale: 'Corn is sensitive to moisture deficits during tasseling and silking.',
            },
            soilImprovement: {
              rating: 'Low',
              shortRationale: 'High nitrogen draw with no legume fixation phase.',
            },
            cropDiversity: {
              rating: 'Low',
              shortRationale: 'Single known cereal crop without verified rotation diversity.',
            },
            managementComplexity: {
              rating: 'Low',
              shortRationale: 'Familiar existing workflow with no new crop tooling required.',
            },
          },
        },
        {
          id: 'strategy-a',
          codeLabel: 'Strategy A',
          title: 'Strategy A — Earn More',
          subtitle: 'Corn → Nodulating Soybean → Specialty Sweet Corn / Edamame Cash Cycle',
          alignedGoalId: 'earn-more',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Field Corn (Zea mays)',
              functionalRole: 'Primary Cereal Grain + Lime Incorporation',
              seasonWindow: 'Season 1',
              verificationNote: 'Existing crop + post-harvest pH remediation',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Commercial Soybean (Glycine max)',
              functionalRole: 'Nitrogen-Fixing Oilseed / Protein Cash Crop',
              seasonWindow: 'Season 2',
              verificationNote: 'Reduces synthetic N need for following crop',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Fresh-Market Sweet Corn + Edamame Relay',
              functionalRole: 'High-Margin Dual Commercial Harvest',
              seasonWindow: 'Season 3',
              verificationNote: 'Illustrative high-value market phase',
            },
          ],
          expectedBenefits: [
            'Targets higher gross revenue potential by combining bulk grain/oilseed with fresh-market sweet corn and edamame phases.',
            'Soybean phase contributes biological nitrogen fixation, helping buffer synthetic fertilizer expenditure.',
          ],
          potentialRisks: [
            'Fresh-market sweet corn and edamame require strict harvest timing, cold-chain or rapid local buyer off-take, and stable moisture.',
            'Soybean nodulation will fail if the snapshot pH (2.8) is genuine and left uncorrected prior to Season 2.',
          ],
          suitableConditions: [
            'Farms with reliable market access, verified irrigation scheduling (1,250L baseline capacity), and confirmed soil pH remediation toward 5.8–6.5.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Directly aligned with Earn More: maximizes marketable cash-crop phases while inserting a nitrogen-fixing legume to protect subsequent cereal vigor.',
            'lower-risk':
              'Not prioritized for Lower Risk because specialty sweet corn/edamame phases are sensitive to dry spells and market timing.',
            'more-crops':
              'Provides moderate diversification (2 botanical families), though less ecologically diverse than Strategy C.',
          },
          supportingEvidenceAndAssumptions: [
            'Assumes North Field A1 fertilizer efficiency (87%) and existing corn infrastructure can be leveraged for high-value corn-legume alternation.',
            'Requires resolving the pH 2.8 constraint before introducing Bradyrhizobium-inoculated soybeans.',
          ],
          uncertaintyAndInformationGaps: [
            'Local buyer contract pricing for sweet corn/edamame and transport distance from the farm are not present in team data.',
            'Lime requirement (tons/ha) cannot be calculated from pH alone without soil buffer pH and cation exchange capacity (CEC).',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'High',
              shortRationale: 'Combines commercial grain/soybean with higher-margin specialty harvest.',
            },
            waterResilience: {
              rating: 'Medium',
              shortRationale: 'Moderate water demand; sweet corn remains sensitive during ear fill.',
            },
            soilImprovement: {
              rating: 'Medium',
              shortRationale: 'Legume nitrogen credit helps, though two harvested cash phases export nutrients.',
            },
            cropDiversity: {
              rating: 'Medium',
              shortRationale: 'Alternates Poaceae (corn) and Fabaceae (soybean/edamame) families.',
            },
            managementComplexity: {
              rating: 'Medium',
              shortRationale: 'Requires pH correction, inoculation, and timely specialty harvest.',
            },
          },
        },
        {
          id: 'strategy-b',
          codeLabel: 'Strategy B',
          title: 'Strategy B — Lower Risk',
          subtitle: 'Corn → Acid-Tolerant Cowpea → Drought-Buffered Grain Sorghum',
          alignedGoalId: 'lower-risk',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Field Corn (Zea mays)',
              functionalRole: 'Current Vegetative Crop',
              seasonWindow: 'Season 1',
              verificationNote: 'Monitored under current 1,250L water allocation',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Cowpea / Black-Eyed Pea (Vigna unguiculata)',
              functionalRole: 'Drought- & Acid-Tolerant Nitrogen Fixer',
              seasonWindow: 'Season 2',
              verificationNote: 'Tolerates lower pH and low humidity better than soybean',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Grain Sorghum (Sorghum bicolor)',
              functionalRole: 'Water-Resilient Cereal Substitute',
              seasonWindow: 'Season 3',
              verificationNote: 'Lower transpiration demand than repeat corn',
            },
          ],
          expectedBenefits: [
            'Significantly improves water resilience when field card humidity drops (32% snapshot) or regional rainfall becomes erratic.',
            'Cowpea tolerates acidic soils better than standard soybean while building surface mulch and fixing atmospheric nitrogen.',
          ],
          potentialRisks: [
            'Grain sorghum and cowpea typically command lower unit market prices than specialty corn in premium urban markets.',
            'Bird predation on sorghum heads requires basic field monitoring prior to harvest.',
          ],
          suitableConditions: [
            'Ideal when moisture conservation, lower input outlay, and resilience against acidic soil stress (pH 2.8 snapshot) are top priorities.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Trades peak gross revenue for downside protection and reduced input expenditure.',
            'lower-risk':
              'Directly aligned with Lower Risk: replaces water-intensive repeat corn with hardy cowpea and sorghum that buffer drought and soil acidity.',
            'more-crops':
              'Offers functional resilience across 3 crops, though with fewer total harvestable species than Strategy C.',
          },
          supportingEvidenceAndAssumptions: [
            'Addresses North Field A1’s 32% card humidity and pH 2.8 snapshot by selecting species known for lower water use and broader pH tolerance.',
            'Compatible with standard grain harvesting equipment already used on cereal plots.',
          ],
          uncertaintyAndInformationGaps: [
            'Local feed/food market liquidity for sorghum and cowpea in the user’s specific region must be confirmed.',
            'Subsoil moisture profile beyond the single 68% table / 32% card snapshot is unverified.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Stable staple returns with lower fertilizer and water risk exposure.',
            },
            waterResilience: {
              rating: 'High',
              shortRationale: 'Sorghum and cowpea exhibit strong drought-avoidance and recovery traits.',
            },
            soilImprovement: {
              rating: 'High',
              shortRationale: 'Dense cowpea residue plus deep fibrous sorghum roots improve structure.',
            },
            cropDiversity: {
              rating: 'Medium',
              shortRationale: 'Rotates C4 cereal with hardy tropical/subtropical pulse.',
            },
            managementComplexity: {
              rating: 'Low',
              shortRationale: 'Forgiving planting windows and lower pest/irrigation intervention needs.',
            },
          },
        },
        {
          id: 'strategy-c',
          codeLabel: 'Strategy C',
          title: 'Strategy C — More Crops',
          subtitle: 'Corn → Short-Season Mungbean → Buckwheat → Sunn Hemp / Clover Cover',
          alignedGoalId: 'more-crops',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Field Corn (Zea mays)',
              functionalRole: 'Primary Cereal Cash Crop',
              seasonWindow: 'Season 1',
              verificationNote: 'Current active stand (2.3 ha)',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Mungbean (Vigna radiata)',
              functionalRole: 'Fast 65-Day Pulse + Nitrogen Credit',
              seasonWindow: 'Mid-Season Window',
              verificationNote: 'Short-duration pulse break crop',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Buckwheat (Fagopyrum esculentum)',
              functionalRole: 'Phosphorus-Scavenging Pseudocereal',
              seasonWindow: 'Late-Season Window',
              verificationNote: 'Rapid canopy suppresses weeds in acidic soils',
            },
            {
              phaseLabel: 'Phase 4 (Cover)',
              cropName: 'Sunn Hemp + Crimson Clover Mix',
              functionalRole: 'Biomass Mulch & Pollinator Habitat',
              seasonWindow: 'Off-Season Relay',
              verificationNote: 'Terminated as green manure before next cycle',
            },
          ],
          expectedBenefits: [
            'Maximizes botanical diversity across four plant families (Poaceae, Fabaceae, Polygonaceae, leguminous cover), disrupting corn pest and weed cycles.',
            'Buckwheat and sunn hemp build organic matter and scavenge bound phosphorus in acidic soils.',
          ],
          potentialRisks: [
            'High operational coordination required for four planting/termination passes on a 2.3 ha parcel.',
            'Short-window crops can face establishment failure if rainfall timing shifts unexpectedly.',
          ],
          suitableConditions: [
            'Farms seeking intensive ecological regeneration, diversified pulse/pseudocereal outputs, and active multi-season field management.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Generates multiple niche harvests (corn, mungbean, buckwheat), but cover-crop seed and labor costs moderate net margins.',
            'lower-risk':
              'Biological diversity buffers single-crop pest collapse, but tight multi-crop scheduling increases operational complexity.',
            'more-crops':
              'Directly aligned with More Crops: delivers a 4-phase poly-family rotation combining cereal, fast pulse, pseudocereal, and green manure.',
          },
          supportingEvidenceAndAssumptions: [
            'Buckwheat is agronomically noted for rapid establishment and tolerance of lower-pH soils whileNorth Field A1 pH (2.8 snapshot) is remediated.',
            'Mungbean provides a rapid harvestable legume window with modest water demand.',
          ],
          uncertaintyAndInformationGaps: [
            'Requires confirming local seed availability for buckwheat/sunn hemp and small-seed drill calibration.',
            'Length of frost-free or monsoon-safe growing window depends on exact verified farm coordinates.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Multiple harvestable outputs offset by extra seed and field pass costs.',
            },
            waterResilience: {
              rating: 'Medium',
              shortRationale: 'Living mulch conserves moisture, though relay seeding needs timely rain.',
            },
            soilImprovement: {
              rating: 'High',
              shortRationale: 'Continuous living root cover, green manure biomass, and N/P cycling.',
            },
            cropDiversity: {
              rating: 'High',
              shortRationale: 'Four distinct species across three botanical families.',
            },
            managementComplexity: {
              rating: 'High',
              shortRationale: 'Frequent seeding, harvest timing, and cover termination require close oversight.',
            },
          },
        },
      ],
    },

    'east-field-b2': {
      fieldId: 'east-field-b2',
      fieldName: east.name,
      cropType: east.type,
      snapshotScore: east.score,
      cardHumidity: east.humidity,
      ph: east.ph,
      areaHectares: east.area,
      waterDemand: east.water,
      fertilizerEfficiency: east.fertilizer,
      equipmentStatus: east.status,
      overviewDisplayStatus: getFieldOverviewStatus(east.status),
      badgeClass: getFieldBadgeClass(east.status),
      tableSoilMoistureSnapshot: TABLE_SNAPSHOT_LOOKUP['east-field-b2'].soilMoisture,
      tableTemperatureSnapshot: TABLE_SNAPSHOT_LOOKUP['east-field-b2'].temperature,
      tableGrowthStageSnapshot: TABLE_SNAPSHOT_LOOKUP['east-field-b2'].growthStage,
      fieldSnapshotSummary:
        'Current crop: Wheat Plantation (4.1 ha, Flowering stage). Team snapshot records Score 92/100 (Optimal), Field Card Humidity 45% (Table Soil Moisture 72%), near-neutral pH 6.5, Water 850L, and Fertilizer 94%.',
      agronomicContextAlert:
        'Agronomic Readiness Note: East Field B2 has the strongest baseline conditions in the team snapshot (pH 6.5, Score 92, 4.1 ha). Preserving this neutral pH and preventing cereal take-all fungal buildup are the primary rotation priorities.',
      goalBannerRecommendations: {
        'earn-more': {
          headline:
            'Recommended for Earn More on East Field B2: Strategy A — Wheat → High-Oleic Canola / Rapeseed → Malting Barley or Milling Wheat',
          rationale:
            'Leverages East Field B2’s optimal pH 6.5 and 4.1 ha scale to integrate high-value oilseed brassica and premium grain phases.',
          cautionNote:
            'Brassica oilseeds require sulfur monitoring and careful flowering-stage heat management.',
        },
        'lower-risk': {
          headline:
            'Recommended for Lower Risk on East Field B2: Strategy B — Wheat → Field Pea / Chickpea → Oats Stabilizer',
          rationale:
            'Uses a low-water pulse break crop (field pea/chickpea) followed by hardy oats to break wheat root disease cycles while keeping water use near the efficient 850L baseline.',
          cautionNote:
            'Avoids brassica pest pressure and minimizes synthetic nitrogen input requirements.',
        },
        'more-crops': {
          headline:
            'Recommended for More Crops on East Field B2: Strategy C — Wheat → Lentil → Mustard / Canola → Phacelia + Vetch Pollinator Cover',
          rationale:
            'Rotates cereal, cool-season food legume, brassica biofumigant, and multi-species cover across the 4.1 ha parcel.',
          cautionNote:
            'Requires multi-crop seed cleaning, precise herbicide residue tracking, and higher management coordination.',
        },
      },
      strategies: [
        {
          id: 'baseline',
          codeLabel: 'Baseline Reference',
          title: 'Current Rotation — Baseline',
          subtitle: 'Existing Wheat Plantation reference (unverified multi-season rotation history)',
          alignedGoalId: null,
          authenticityTag: 'Team-provided Demo Snapshot',
          isBaseline: true,
          baselineVerificationBanner:
            'Current-Crop Reference Only — Multi-season historical crop sequence is unverified in existing team records.',
          sequenceSteps: [
            {
              phaseLabel: 'Prior Season(s)',
              cropName: 'Unverified Historical Sequence',
              functionalRole: 'No Prior Crop Log in Team Data',
              seasonWindow: 'Pre-Snapshot Archive',
              verificationNote: 'Not recorded in MainContent.tsx',
              isUnverifiedHistory: true,
            },
            {
              phaseLabel: 'Current Observed Snapshot',
              cropName: 'Wheat Plantation (Triticum aestivum)',
              functionalRole: 'Primary Small-Grain Cereal (Flowering Stage)',
              seasonWindow: 'Current Active Season',
              verificationNote: 'Verified in cropwiseFields.ts (Score 92, pH 6.5, 4.1 ha)',
            },
            {
              phaseLabel: 'Next Planned Phase',
              cropName: 'Unassigned / Continuous Wheat Reference',
              functionalRole: 'Baseline Continuation Benchmark',
              seasonWindow: 'Upcoming Cycle',
              verificationNote: 'Used as baseline comparison benchmark',
              isUnverifiedHistory: true,
            },
          ],
          expectedBenefits: [
            'Current stand performs at Optimal status (Score 92/100, Fertilizer 94%, Water 850L) on a favorable pH 6.5 profile.',
            'Streamlined small-grain harvesting and storage logistics across the 4.1 ha plot.',
          ],
          potentialRisks: [
            'Continuous wheat monoculture rapidly builds take-all root rot (Gaeumannomyces), Fusarium head blight, and grass-weed resistance.',
            'Gradual depletion of soil organic nitrogen without a broadleaf or legume break crop.',
          ],
          suitableConditions: [
            'Current flowering-stage completion only; subsequent seasons benefit from a broadleaf break crop to protect the 92/100 health score.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Serves as the current benchmark; repeating wheat without an oilseed or legume break risks yield drag and grain quality penalties.',
            'lower-risk':
              'Serves as the current benchmark; cereal-on-cereal increases fungal disease exposure over time.',
            'more-crops':
              'Serves as the current benchmark; single-species cereal cultivation lacks functional crop diversity.',
          },
          supportingEvidenceAndAssumptions: [
            'Team-provided snapshot: East Field B2 is a 4.1 ha Wheat Plantation with Score 92, Humidity 45%, pH 6.5, Water 850L, and Fertilizer 94%.',
            'Table overview records Soil Moisture 72%, Temp 24°C, Growth Stage: Flowering.',
          ],
          uncertaintyAndInformationGaps: [
            'Prior rotation history, wheat class (winter vs. spring / hard vs. soft), and local rust/Fusarium pressure are unverified.',
            'Exact elevation and thermal regime must be confirmed if grown in a tropical/subtropical highland zone.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Strong current stand, but continuous wheat suffers progressive disease drag.',
            },
            waterResilience: {
              rating: 'Medium',
              shortRationale: 'Moderate water footprint (850L snapshot), sensitive during flowering/grain fill.',
            },
            soilImprovement: {
              rating: 'Low',
              shortRationale: 'Fibrous roots provide straw residue but no biological nitrogen fixation.',
            },
            cropDiversity: {
              rating: 'Low',
              shortRationale: 'Single cereal species reference with unverified prior rotation.',
            },
            managementComplexity: {
              rating: 'Low',
              shortRationale: 'Uses existing small-grain drill, sprayer, and combine setup.',
            },
          },
        },
        {
          id: 'strategy-a',
          codeLabel: 'Strategy A',
          title: 'Strategy A — Earn More',
          subtitle: 'Wheat → Canola / Oilseed Rape → Certified Milling Wheat or Malting Barley',
          alignedGoalId: 'earn-more',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Wheat Plantation (Triticum aestivum)',
              functionalRole: 'Current Flowering Cereal Crop',
              seasonWindow: 'Season 1',
              verificationNote: 'Score 92 Optimal baseline on 4.1 ha',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Canola / Oilseed Rape (Brassica napus)',
              functionalRole: 'High-Value Oilseed + Deep Taproot Break Crop',
              seasonWindow: 'Season 2',
              verificationNote: 'Thrives at East Field B2’s pH 6.5',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Malting Barley or Premium Milling Wheat',
              functionalRole: 'Quality-Bonus Commercial Small Grain',
              seasonWindow: 'Season 3',
              verificationNote: 'Benefits from brassica root disease break',
            },
          ],
          expectedBenefits: [
            'Canola/rapeseed breaks cereal root pathogen cycles while targeting strong vegetable-oil market value on the 4.1 ha field.',
            'Deep brassica taproots scavenge subsoil nutrients and leave mellow seedbeds for a subsequent premium grain phase.',
          ],
          potentialRisks: [
            'Canola is sensitive to high temperatures during flowering and requires diligent flea-beetle and sulfur fertility management.',
            'Malting/milling quality premiums depend on strict protein and moisture specifications at harvest.',
          ],
          suitableConditions: [
            'Well-drained, near-neutral soils (like East Field B2’s pH 6.5) with moderate temperatures (24°C snapshot) and high fertilizer management efficiency (94%).',
          ],
          recommendationExplanation: {
            'earn-more':
              'Directly aligned with Earn More: capitalizes on East Field B2’s optimal pH 6.5 and 4.1 ha scale to pair high-demand oilseed with quality small grains.',
            'lower-risk':
              'Less aligned with Lower Risk due to canola input costs and sensitivity to heat spikes at flowering.',
            'more-crops':
              'Introduces a brassica break crop, though less species-rich than the 4-part Strategy C rotation.',
          },
          supportingEvidenceAndAssumptions: [
            'East Field B2’s pH 6.5 and 94% fertilizer metric provide a strong agronomic foundation for brassica-cereal alternation.',
            'Assumes standard small-grain seeding and harvesting equipment can be adapted for oilseed swathing/direct-heading.',
          ],
          uncertaintyAndInformationGaps: [
            'Local oilseed crushing/delivery points and seasonal temperature extremes at flowering must be verified.',
            'Soil sulfur status is not included in the current CropWise sensor snapshot.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'High',
              shortRationale: 'High-value oilseed phase plus break-crop boost for following premium grain.',
            },
            waterResilience: {
              rating: 'Medium',
              shortRationale: 'Deep taproots aid water access, but flowering stage remains heat-sensitive.',
            },
            soilImprovement: {
              rating: 'Medium',
              shortRationale: 'Biofumigant root break and taproot channels, but no legume N fixation.',
            },
            cropDiversity: {
              rating: 'Medium',
              shortRationale: 'Alternates Poaceae (wheat/barley) with Brassicaceae (canola).',
            },
            managementComplexity: {
              rating: 'Medium',
              shortRationale: 'Requires tiny-seed depth control, sulfur balancing, and pod-shatter timing.',
            },
          },
        },
        {
          id: 'strategy-b',
          codeLabel: 'Strategy B',
          title: 'Strategy B — Lower Risk',
          subtitle: 'Wheat → Field Pea / Chickpea → Hardy Oats Stabilizer',
          alignedGoalId: 'lower-risk',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Wheat Plantation (Triticum aestivum)',
              functionalRole: 'Current Flowering Cereal Crop',
              seasonWindow: 'Season 1',
              verificationNote: 'Maintains current 850L water profile',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Field Pea or Desi Chickpea',
              functionalRole: 'Water-Efficient Nitrogen-Fixing Pulse',
              seasonWindow: 'Season 2',
              verificationNote: 'Shallow water draw preserves deep subsoil moisture',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Milling / Forage Oats (Avena sativa)',
              functionalRole: 'Low-Input Disease-Suppressive Cereal',
              seasonWindow: 'Season 3',
              verificationNote: 'Lower root-rot susceptibility than repeat wheat',
            },
          ],
          expectedBenefits: [
            'Minimizes synthetic nitrogen purchase risk by fixing atmospheric N at pH 6.5 (ideal range for Rhizobium leguminosarum).',
            'Conserves deep profile moisture for subsequent cereal phases while cleanly breaking wheat take-all disease.',
          ],
          potentialRisks: [
            'Field peas and chickpeas can face Ascochyta blight if prolonged canopy wetness occurs.',
            'Oats generally trade at more modest commodity prices than specialty oilseeds.',
          ],
          suitableConditions: [
            'Producers seeking consistent, low-volatility returns, reduced fertilizer outlay, and strong water buffer capacity.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Prioritizes cost containment and biological nitrogen credit over maximum gross crop revenue.',
            'lower-risk':
              'Directly aligned with Lower Risk: leverages pH 6.5 for reliable pulse nodulation and pairs it with low-input oats to safeguard East Field B2’s 92/100 score.',
            'more-crops':
              'Provides a balanced 3-species rotation with straightforward field operations.',
          },
          supportingEvidenceAndAssumptions: [
            'East Field B2’s pH 6.5 and moderate 850L water footprint align well with cool/temperate pulse-oat rotations.',
            'Oats release avenacin root compounds that naturally suppress cereal take-all fungi.',
          ],
          uncertaintyAndInformationGaps: [
            'Requires verifying local drainage on the 4.1 ha plot, as pulse roots dislike waterlogged soil pockets.',
            'Specific pulse species choice (field pea vs. chickpea) depends on regional rainfall distribution.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Steady pulse + oat market returns reinforced by lower nitrogen input cost.',
            },
            waterResilience: {
              rating: 'High',
              shortRationale: 'Pulses use less water and leave residual deep moisture for the following grain.',
            },
            soilImprovement: {
              rating: 'High',
              shortRationale: 'Reliable legume nitrogen fixation at pH 6.5 plus disease-suppressive oat roots.',
            },
            cropDiversity: {
              rating: 'Medium',
              shortRationale: 'Three species across small grains and food legumes.',
            },
            managementComplexity: {
              rating: 'Low',
              shortRationale: 'Uses standard grain seeding/harvest equipment with low input complexity.',
            },
          },
        },
        {
          id: 'strategy-c',
          codeLabel: 'Strategy C',
          title: 'Strategy C — More Crops',
          subtitle: 'Wheat → Food-Grade Lentil → Brown Mustard → Phacelia + Hairy Vetch Cover',
          alignedGoalId: 'more-crops',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Wheat Plantation (Triticum aestivum)',
              functionalRole: 'Primary Cereal Grain',
              seasonWindow: 'Season 1',
              verificationNote: 'Current 4.1 ha stand',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Food-Grade Lentil (Lens culinaris)',
              functionalRole: 'Nitrogen-Fixing Pulse Cash Crop',
              seasonWindow: 'Season 2',
              verificationNote: 'High-value food legume suited to pH 6.5',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Condiment / Biofumigant Mustard (Brassica juncea)',
              functionalRole: 'Taproot Oilseed / Spice + Pest Suppression',
              seasonWindow: 'Season 3',
              verificationNote: 'Breaks both cereal and pulse pathogen cycles',
            },
            {
              phaseLabel: 'Phase 4 (Cover)',
              cropName: 'Phacelia + Hairy Vetch + Crimson Clover',
              functionalRole: 'Pollinator & Nitrogen Builder Cover Mix',
              seasonWindow: 'Inter-Season Cover',
              verificationNote: 'Protects soil surface before returning to wheat',
            },
          ],
          expectedBenefits: [
            'Combines four botanical families (Poaceae, Fabaceae, Brassicaceae, Boraginaceae) to maximize soil microbial diversity and beneficial insect habitat.',
            'Produces three distinct commercial commodities (wheat, lentil, mustard seed) across rotation cycles.',
          ],
          potentialRisks: [
            'Lentils have a low pod height requiring a smooth, stone-free soil surface and flex-header combine adjustment.',
            'High scheduling complexity managing four distinct crop phases and herbicide plant-back intervals.',
          ],
          suitableConditions: [
            'Well-managed fields like East Field B2 (Score 92, pH 6.5) where operators want maximum ecological diversity and multi-commodity output.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Lentil and mustard offer attractive specialty markets, though cover-crop establishment and equipment adjustments add cost.',
            'lower-risk':
              'Diversifies market and pest risk, but lentil harvest height and multi-crop coordination elevate operational risk.',
            'more-crops':
              'Directly aligned with More Crops: establishes a 4-family agroecological sequence that maximizes species richness on East Field B2.',
          },
          supportingEvidenceAndAssumptions: [
            'Near-neutral pH 6.5 and 72% table soil moisture snapshot support sensitive pulse and brassica phases without lime delay.',
          ],
          uncertaintyAndInformationGaps: [
            'Field surface micro-topography (rockiness/levelness for low lentil pods) is unknown in current team data.',
            'Requires verifying local buyer channels for food-grade lentils and mustard seed.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'High',
              shortRationale: 'Three specialty/staple cash crops, moderated by higher operational overhead.',
            },
            waterResilience: {
              rating: 'High',
              shortRationale: 'Lentil and mustard are notably water-efficient compared to heavy cereals.',
            },
            soilImprovement: {
              rating: 'High',
              shortRationale: 'Combines legume N fixation, brassica biofumigation, and multi-species cover.',
            },
            cropDiversity: {
              rating: 'High',
              shortRationale: 'Four botanical families with contrasting root architectures.',
            },
            managementComplexity: {
              rating: 'High',
              shortRationale: 'Low-pod lentil harvest, multi-seed calibration, and cover termination timing.',
            },
          },
        },
      ],
    },

    'south-field-c3': {
      fieldId: 'south-field-c3',
      fieldName: south.name,
      cropType: south.type,
      snapshotScore: south.score,
      cardHumidity: south.humidity,
      ph: south.ph,
      areaHectares: south.area,
      waterDemand: south.water,
      fertilizerEfficiency: south.fertilizer,
      equipmentStatus: south.status,
      overviewDisplayStatus: getFieldOverviewStatus(south.status),
      badgeClass: getFieldBadgeClass(south.status),
      tableSoilMoistureSnapshot: TABLE_SNAPSHOT_LOOKUP['south-field-c3'].soilMoisture,
      tableTemperatureSnapshot: TABLE_SNAPSHOT_LOOKUP['south-field-c3'].temperature,
      tableGrowthStageSnapshot: TABLE_SNAPSHOT_LOOKUP['south-field-c3'].growthStage,
      fieldSnapshotSummary:
        'Current crop: Soybean Plantation (1.8 ha, Seedling stage). Team snapshot records Critical status (Score 41/100), low Field Card Humidity 18% (Table Soil Moisture 41%), Temp 29°C, moderately acidic pH 5.2, high Water draw 2,100L, and Fertilizer 62%.',
      agronomicContextAlert:
        'Critical Stress Alert: South Field C3 is in Critical status (Score 41, Seedling stage, 18% card humidity / 41% table soil moisture, 29°C, 2,100L water demand). Stabilizing seedling moisture and avoiding repeat soybean disease buildup are urgent.',
      goalBannerRecommendations: {
        'earn-more': {
          headline:
            'Recommended for Earn More on South Field C3: Strategy A — Soybean → Hybrid Corn (Utilizing N-Credit) → High-Value Sesame / Groundnut',
          rationale:
            'Captures the biological nitrogen credit left by the current Soybean Plantation with a subsequent cereal phase, followed by heat-adapted high-value oilseed (sesame/groundnut) suited to pH 5.2–6.0.',
          cautionNote:
            'Current seedling moisture stress (18% card humidity, Score 41) must be stabilized first before committing to high-input commercial phases.',
        },
        'lower-risk': {
          headline:
            'Recommended for Lower Risk on South Field C3: Strategy B — Soybean → Pearl Millet / Sorghum Mulch Builder → Pigeon Pea',
          rationale:
            'Directly addresses South Field C3’s Critical water stress (2,100L draw, 18% card humidity, 29°C) and acidic pH 5.2 by rotating into ultra-drought-hardy millet/sorghum and deep-rooted pigeon pea.',
          cautionNote:
            'Strongly recommended when irrigation supply is constrained or heat stress persists on the 1.8 ha plot.',
        },
        'more-crops': {
          headline:
            'Recommended for More Crops on South Field C3: Strategy C — Soybean → Finger Millet / Sorghum → Sunflower → Lablab / Stylo Forage Cover',
          rationale:
            'Establishes a heat- and acid-adapted 4-crop sequence that rebuilds surface mulch (reducing evaporation at 29°C) and breaks soybean cyst nematode / root rot cycles.',
          cautionNote:
            'Higher management coordination across 4 species, so irrigation stabilization on the 1.8 ha plot remains prerequisite.',
        },
      },
      strategies: [
        {
          id: 'baseline',
          codeLabel: 'Baseline Reference',
          title: 'Current Rotation — Baseline',
          subtitle: 'Existing Soybean Plantation reference (unverified multi-season rotation history)',
          alignedGoalId: null,
          authenticityTag: 'Team-provided Demo Snapshot',
          isBaseline: true,
          baselineVerificationBanner:
            'Current-Crop Reference Only — Multi-season historical crop sequence is unverified in existing team records.',
          sequenceSteps: [
            {
              phaseLabel: 'Prior Season(s)',
              cropName: 'Unverified Historical Sequence',
              functionalRole: 'No Prior Crop Log in Team Data',
              seasonWindow: 'Pre-Snapshot Archive',
              verificationNote: 'Not recorded in MainContent.tsx',
              isUnverifiedHistory: true,
            },
            {
              phaseLabel: 'Current Observed Snapshot',
              cropName: 'Soybean Plantation (Glycine max)',
              functionalRole: 'Primary Legume Oilseed (Seedling Stage)',
              seasonWindow: 'Current Active Season',
              verificationNote: 'Verified in cropwiseFields.ts (Score 41 Critical, 1.8 ha)',
            },
            {
              phaseLabel: 'Next Planned Phase',
              cropName: 'Unassigned / Repeat Soybean Reference',
              functionalRole: 'Baseline Continuation Benchmark',
              seasonWindow: 'Upcoming Cycle',
              verificationNote: 'Used as baseline comparison benchmark',
              isUnverifiedHistory: true,
            },
          ],
          expectedBenefits: [
            'Retains current soybean workflow and inoculant/seed inventory on the 1.8 ha parcel.',
            'Soybean fixes atmospheric nitrogen if seedling survival and nodulation recover.',
          ],
          potentialRisks: [
            'Critical field status (Score 41, 18% card humidity, 41% table soil moisture, 29°C) signals severe seedling establishment risk under current management.',
            'Planting soybean after soybean accelerates Soybean Cyst Nematode (SCN), Phytophthora root rot, and sparse residue cover (increasing evaporative water loss).',
          ],
          suitableConditions: [
            'Reference baseline only; immediate irrigation audit (2,100L draw) and post-season rotation break are strongly advised.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Serves as the current benchmark; continuous soybean forfeits the nitrogen credit that a following non-legume cash crop would monetize.',
            'lower-risk':
              'Serves as the current benchmark; low soybean residue cover leaves the 1.8 ha soil exposed to 29°C evaporative loss.',
            'more-crops':
              'Serves as the current benchmark; continuous legume monoculture increases soil-borne pathogen pressure.',
          },
          supportingEvidenceAndAssumptions: [
            'Team-provided snapshot: South Field C3 is a 1.8 ha Soybean Plantation with Score 41 (Critical), Humidity 18%, pH 5.2, Water 2,100L, and Fertilizer 62%.',
            'Table overview records Soil Moisture 41%, Temp 29°C, Growth Stage: Seedling.',
          ],
          uncertaintyAndInformationGaps: [
            'Cause of high water consumption (2,100L on 1.8 ha) alongside low moisture (18% card / 41% table) is unverified — could indicate line leakage, coarse sandy soil, or high evapotranspiration.',
            'Prior soybean frequency and nematode status are not recorded in team files.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Low',
              shortRationale: 'Score 41 Critical seedling stress and repeat-legume disease risk threaten output.',
            },
            waterResilience: {
              rating: 'Low',
              shortRationale: 'Low residue cover and 2,100L water draw highlight severe moisture vulnerability.',
            },
            soilImprovement: {
              rating: 'Medium',
              shortRationale: 'Fixes nitrogen, but low C:N residue decomposes rapidly and leaves soil bare.',
            },
            cropDiversity: {
              rating: 'Low',
              shortRationale: 'Single legume species reference without verified rotation break.',
            },
            managementComplexity: {
              rating: 'Low',
              shortRationale: 'No crop-switch tooling needed, though emergency irrigation troubleshooting is required.',
            },
          },
        },
        {
          id: 'strategy-a',
          codeLabel: 'Strategy A',
          title: 'Strategy A — Earn More',
          subtitle: 'Soybean → Nitrogen-Credited Hybrid Corn → Heat-Adapted Sesame Cash Crop',
          alignedGoalId: 'earn-more',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Soybean Plantation (Glycine max)',
              functionalRole: 'Current Seedling Legume + Moisture Recovery',
              seasonWindow: 'Season 1',
              verificationNote: 'Stabilize irrigation & apply dolomitic lime for pH 5.2',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Hybrid Field Corn (Zea mays)',
              functionalRole: 'High-Yield Cereal Utilizing Legume N-Credit',
              seasonWindow: 'Season 2',
              verificationNote: 'Monetizes residual nitrogen from Season 1 soybean',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Export/Culinary Sesame (Sesamum indicum)',
              functionalRole: 'Heat- & Drought-Tolerant High-Value Oilseed',
              seasonWindow: 'Season 3',
              verificationNote: 'Thrives at 29°C and lower post-monsoon moisture',
            },
          ],
          expectedBenefits: [
            'Converts Season 1 soybean nitrogen fixation into reduced fertilizer cost and stronger vigor for Season 2 corn.',
            'Sesame adds a high-unit-value oilseed phase that tolerates warm temperatures (29°C snapshot) and lower late-season humidity.',
          ],
          potentialRisks: [
            'Season 2 corn requires reliable irrigation delivery; the current 2,100L vs. 18% humidity anomaly must be fixed before planting corn.',
            'Sesame requires careful capsule-shatter management at harvest.',
          ],
          suitableConditions: [
            'Warm-climate plots (29°C snapshot) once irrigation uniformity is restored and pH 5.2 is nudged toward 5.8–6.2.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Directly aligned with Earn More: sequences a cereal cash crop to capture soybean nitrogen credit, followed by high-value, heat-tolerant sesame.',
            'lower-risk':
              'Less aligned with Lower Risk than Strategy B because Season 2 corn remains vulnerable if irrigation issues recur.',
            'more-crops':
              'Rotates three plant families (Fabaceae, Poaceae, Pedaliaceae), offering solid commercial diversity.',
          },
          supportingEvidenceAndAssumptions: [
            'Follows standard agronomic principle of rotating soybean into a nitrogen-demanding cereal plus a non-host oilseed break.',
            'Sesame is well-suited to warm regimes (29°C table snapshot) and modest water allocations.',
          ],
          uncertaintyAndInformationGaps: [
            'Requires diagnosing why South Field C3 uses 2,100L while remaining at 18% card humidity / 41% table moisture.',
            'Local sesame buyer contracts and non-shattering variety availability must be verified.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'High',
              shortRationale: 'Captures legume N-credit in corn and adds high-value sesame oilseed.',
            },
            waterResilience: {
              rating: 'Medium',
              shortRationale: 'Sesame is drought-hardy, though the corn phase still requires dependable water.',
            },
            soilImprovement: {
              rating: 'Medium',
              shortRationale: 'Corn stover adds surface residue lacking in continuous soybean.',
            },
            cropDiversity: {
              rating: 'Medium',
              shortRationale: 'Three distinct botanical families across three seasons.',
            },
            managementComplexity: {
              rating: 'Medium',
              shortRationale: 'Requires irrigation repair, mild liming (pH 5.2), and fine-seed sesame planting.',
            },
          },
        },
        {
          id: 'strategy-b',
          codeLabel: 'Strategy B',
          title: 'Strategy B — Lower Risk',
          subtitle: 'Soybean → Pearl Millet / Sorghum Mulch Builder → Deep-Rooted Pigeon Pea',
          alignedGoalId: 'lower-risk',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Soybean Plantation (Glycine max)',
              functionalRole: 'Current Seedling Stand (Emergency Stabilization)',
              seasonWindow: 'Season 1',
              verificationNote: 'Prioritize targeted root-zone moisture retention',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Pearl Millet or Forage/Grain Sorghum',
              functionalRole: 'High-C:N Mulch Builder & Acid/Drought Buffer',
              seasonWindow: 'Season 2',
              verificationNote: 'Tolerates pH 5.2, 29°C heat, and low humidity',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Pigeon Pea (Cajanus cajan)',
              functionalRole: 'Deep-Taproot Woody Legume & Subsoil Breaker',
              seasonWindow: 'Season 3',
              verificationNote: 'Accesses deep moisture and fixes N under acidic conditions',
            },
          ],
          expectedBenefits: [
            'Directly counters South Field C3’s Critical water stress: pearl millet/sorghum produces durable straw mulch that shades the 29°C soil surface and cuts evaporation.',
            'Both pearl millet and pigeon pea tolerate acidic pH 5.2 and low atmospheric humidity (18% snapshot) far better than corn or repeat soybean.',
          ],
          potentialRisks: [
            'Lower gross commodity price ceiling compared to irrigated specialty cash crops.',
            'Pigeon pea has a longer maturity window requiring planned field scheduling.',
          ],
          suitableConditions: [
            'Moisture-stressed, warm (29°C), moderately acidic (pH 5.2) plots like South Field C3 (Score 41) where stabilizing production and cutting water demand (2,100L) are paramount.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Prioritizes survival, input savings, and soil moisture recovery over maximum short-term cash revenue.',
            'lower-risk':
              'Directly aligned with Lower Risk: specifically engineered for South Field C3’s Critical 18% humidity / 41% soil moisture, 29°C heat, and pH 5.2 constraints.',
            'more-crops':
              'Provides strong functional complementarity (shallow fibrous mulch cereal + deep taproot legume).',
          },
          supportingEvidenceAndAssumptions: [
            'Addresses all four stress markers in South Field C3’s snapshot: Score 41, Humidity 18%, pH 5.2, and Water 2,100L.',
            'High C:N cereal stalks persist on the soil surface much longer than fragile soybean residue.',
          ],
          uncertaintyAndInformationGaps: [
            'Soil compaction depth (which pigeon pea taproots help penetrate) has not been physically measured.',
            'Local market vs. on-farm feed utilization for millet/pigeon pea should be confirmed by the operator.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Modest commodity prices, but avoids catastrophic crop failure under dry/acidic stress.',
            },
            waterResilience: {
              rating: 'High',
              shortRationale: 'Millet/sorghum mulch and deep pigeon pea roots excel in hot, water-limited conditions.',
            },
            soilImprovement: {
              rating: 'High',
              shortRationale: 'Builds lasting surface mulch, breaks hardpans, and fixes nitrogen at pH 5.2.',
            },
            cropDiversity: {
              rating: 'Medium',
              shortRationale: 'Alternates soybean with C4 drought cereal and deep-rooted perennial-type pulse.',
            },
            managementComplexity: {
              rating: 'Low',
              shortRationale: 'Hardy, low-input crops forgiving of erratic moisture and fertilizer efficiency (62%).',
            },
          },
        },
        {
          id: 'strategy-c',
          codeLabel: 'Strategy C',
          title: 'Strategy C — More Crops',
          subtitle: 'Soybean → Sorghum/Millet → Oilseed Sunflower → Lablab + Stylo Cover Relay',
          alignedGoalId: 'more-crops',
          authenticityTag: 'Illustrative Rotation Strategy',
          isBaseline: false,
          sequenceSteps: [
            {
              phaseLabel: 'Phase 1 (Current)',
              cropName: 'Soybean Plantation (Glycine max)',
              functionalRole: 'Current Legume Oilseed (1.8 ha)',
              seasonWindow: 'Season 1',
              verificationNote: 'Current active stand',
            },
            {
              phaseLabel: 'Phase 2',
              cropName: 'Grain Sorghum / Finger Millet',
              functionalRole: 'Fibrous-Root Cereal Mulch &SCN Break',
              seasonWindow: 'Season 2',
              verificationNote: 'Non-host break for soybean nematodes',
            },
            {
              phaseLabel: 'Phase 3',
              cropName: 'Drought-Tolerant Sunflower (Helianthus annuus)',
              functionalRole: 'Deep-Taproot Asteraceae Oilseed & Pollinator Crop',
              seasonWindow: 'Season 3',
              verificationNote: 'Scavenges deep leached water and nutrients',
            },
            {
              phaseLabel: 'Phase 4 (Cover)',
              cropName: 'Lablab Bean + Stylosanthes Cover Mix',
              functionalRole: 'Heat/Acid-Tolerant Living Mulch & N-Restorer',
              seasonWindow: 'Inter-Season Relay',
              verificationNote: 'High-biomass tropical/subtropical soil armor',
            },
          ],
          expectedBenefits: [
            'Combines Fabaceae, Poaceae, and Asteraceae with acid-tolerant tropical legumes (Stylo/Lablab) to rebuild South Field C3’s 62% fertilizer efficiency and biological health.',
            'Continuous soil armor protects the 1.8 ha surface from 29°C crusting and moisture loss.',
          ],
          potentialRisks: [
            'Sunflower and soybean can share Sclerotinia (white mold) in humid seasons if spacing is too tight, requiring careful variety selection.',
            'Managing four distinct crop phases on 1.8 ha increases equipment setup and labor time.',
          ],
          suitableConditions: [
            'Operators committed to rehabilitating South Field C3 through multi-species soil armor while harvesting grain, oilseed, and forage/pulse outputs.',
          ],
          recommendationExplanation: {
            'earn-more':
              'Produces multiple oilseed and grain outputs, though cover relay seeds and multi-pass labor add overhead.',
            'lower-risk':
              'Drought-hardy species reduce climate exposure, but 4-phase scheduling increases operational complexity.',
            'more-crops':
              'Directly aligned with More Crops: maximizes functional root diversity (shallow fibrous + deep taproot + nitrogen-fixing vine cover) tailored to warm, pH 5.2 conditions.',
          },
          supportingEvidenceAndAssumptions: [
            'Stylosanthes and lablab are widely recognized in warm-climate agronomy for thriving at pH 5.0–5.5 and building dense moisture-retaining mulch.',
          ],
          uncertaintyAndInformationGaps: [
            'Sclerotinia history on South Field C3 is unknown; if present, sunflower should be substituted with sesame or safflower.',
            'Requires verifying combine header attachments for small-plot sunflower harvesting.',
          ],
          tradeOffRatings: {
            profitPotential: {
              rating: 'Medium',
              shortRationale: 'Diversified oilseed/grain revenue streams balanced by higher multi-crop operating cost.',
            },
            waterResilience: {
              rating: 'High',
              shortRationale: 'Deep sunflower taproots, sorghum stomatal control, and living Lablab mulch conserve water.',
            },
            soilImprovement: {
              rating: 'High',
              shortRationale: 'Restores organic matter, root-channel porosity, and N cycling on a stressed 41-score plot.',
            },
            cropDiversity: {
              rating: 'High',
              shortRationale: 'Four functional crop groups across three botanical families.',
            },
            managementComplexity: {
              rating: 'High',
              shortRationale: 'Requires multi-crop planter plates, header changes, and cover termination management.',
            },
          },
        },
      ],
    },
  };
}

export const FIELD_ROTATION_PLANS: Record<FieldId, FieldRotationPlanBundle> = buildFieldPlans();

export function getFieldRotationPlan(fieldId: string | null | undefined): FieldRotationPlanBundle {
  if (isFieldId(fieldId)) {
    return FIELD_ROTATION_PLANS[fieldId];
  }
  return FIELD_ROTATION_PLANS[FIELD_IDS[0]];
}
