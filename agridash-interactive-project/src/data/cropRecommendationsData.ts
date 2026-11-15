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
import {
  NASA_HISTORICAL_WINDOWS,
  NASA_PUBLIC_TEST_LOCATIONS,
  PLANNER_GOALS,
  getSharedFarmLocationState,
  setSharedFarmLocationState,
  type PlannerGoalId,
  type StrategyId,
  type TimeRangeKey,
  type VerifiedFarmLocation,
} from './decisionPlannerData';

export {
  NASA_HISTORICAL_WINDOWS,
  NASA_PUBLIC_TEST_LOCATIONS,
  PLANNER_GOALS,
  getSharedFarmLocationState,
  setSharedFarmLocationState,
};
export type { PlannerGoalId, StrategyId, TimeRangeKey, VerifiedFarmLocation };

export type RecommendationProvenanceTag =
  | 'NASA POWER Historical Modeled Data'
  | 'Team-provided Demo Snapshot'
  | 'Illustrative Recommendation';

export type QualitativeSuitabilityLabel =
  | 'High Illustrative Fit (Local Validation Required)'
  | 'Conditional Fit (Soil / Moisture Action Required)'
  | 'Targeted Buffer / Cover Fit (Illustrative)';

export interface CropRecommendationCardItem {
  id: string;
  cropName: string;
  botanicalName: string;
  cropCategory: string;
  roleInRotation: 'Primary Next-Season Crop' | 'Companion / Relay Crop' | 'Protective Break / Cover Crop';
  suitabilityBadge: QualitativeSuitabilityLabel;
  alignedGoalId: PlannerGoalId;
  linkedStrategyTitle: string;
  currentFieldContext: string;
  suitabilityConsiderations: string[];
  potentialBenefits: string[];
  waterConsiderations: string;
  soilConsiderations: string;
  risksAndLimitations: string[];
  supportingEvidenceAndAssumptions: string[];
  dataProvenance: {
    primaryTag: 'Illustrative Recommendation';
    fieldContextTag: 'Team-provided Demo Snapshot';
    climateContextTag: 'NASA POWER Historical Modeled Data';
    provenanceSummary: string;
  };
  thermalWindowReferenceC: { minOptimal: number; maxOptimal: number; note: string };
}

export interface GoalRecommendationSection {
  goalId: PlannerGoalId;
  goalLabel: string;
  linkedDecisionPlannerStrategy: string;
  recommendationHeadline: string;
  recommendationExplanation: string;
  cropSuggestionsSummary: string[];
  potentialLimitations: string[];
  recommendations: CropRecommendationCardItem[];
}

export interface FieldCropRecommendationsBundle {
  fieldId: FieldId;
  fieldName: string;
  currentCropType: string;
  areaHectares: string;
  snapshotScore: number;
  cardHumidity: string;
  tableSoilMoisture: string;
  tableTemperature: string;
  tableGrowthStage: string;
  ph: string;
  waterAllocation: string;
  fertilizerEfficiency: string;
  equipmentStatus: FieldEquipmentStatus;
  overviewDisplayStatus: FieldOverviewStatus;
  badgeClass: string;
  fieldConditionSummary: string;
  globalApplicabilityNote: string;
  byGoal: Record<PlannerGoalId, GoalRecommendationSection>;
}

const TABLE_SNAPSHOT_BY_FIELD: Record<
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

function buildFieldRecommendations(): Record<FieldId, FieldCropRecommendationsBundle> {
  const north = cropwiseFields['north-field-a1'];
  const east = cropwiseFields['east-field-b2'];
  const south = cropwiseFields['south-field-c3'];

  return {
    'north-field-a1': {
      fieldId: 'north-field-a1',
      fieldName: north.name,
      currentCropType: north.type,
      areaHectares: north.area,
      snapshotScore: north.score,
      cardHumidity: north.humidity,
      tableSoilMoisture: TABLE_SNAPSHOT_BY_FIELD['north-field-a1'].soilMoisture,
      tableTemperature: TABLE_SNAPSHOT_BY_FIELD['north-field-a1'].temperature,
      tableGrowthStage: TABLE_SNAPSHOT_BY_FIELD['north-field-a1'].growthStage,
      ph: north.ph,
      waterAllocation: north.water,
      fertilizerEfficiency: north.fertilizer,
      equipmentStatus: north.status,
      overviewDisplayStatus: getFieldOverviewStatus(north.status),
      badgeClass: getFieldBadgeClass(north.status),
      fieldConditionSummary:
        'North Field A1 currently hosts a 2.3 ha Corn Plantation (Vegetative stage, Score 70/100, Fertilizer 87%, Water 1,250L). The snapshot flags a low Card Humidity of 32% (vs. 68% Table Soil Moisture) and an extreme acidic pH reading of 2.8.',
      globalApplicabilityNote:
        'Candidate crops below are illustrative rule-based options for transitioning after a cereal corn stand; exact cultivar choice must be adapted to your verified latitude/longitude, local frost/monsoon calendar, and lab-confirmed soil pH.',
      byGoal: {
        'earn-more': {
          goalId: 'earn-more',
          goalLabel: 'Earn More',
          linkedDecisionPlannerStrategy: 'Strategy A — Earn More (Corn → Soybean → Sweet Corn / Edamame)',
          recommendationHeadline:
            'High-Value Legume & Specialty Vegetable-Grain Sequence (Post-pH Remediation)',
          recommendationExplanation:
            'To pursue higher commercial returns after North Field A1’s current Corn Plantation, this pathway introduces nitrogen-fixing soybean and fresh-market edamame/sweet corn phases. Because the team snapshot records pH 2.8, verifying soil acidity and applying agricultural lime is a mandatory prerequisite before planting commercial legumes.',
          cropSuggestionsSummary: [
            'Nodulating Commercial Soybean (Glycine max) — Next-Season Cash & N-Fixation Crop',
            'Fresh-Market Edamame / Vegetable Soybean — High-Margin Short-Window Legume',
            'Hybrid Sweet Corn (Zea mays convar. saccharata) — Follow-on Specialty Cash Crop',
          ],
          potentialLimitations: [
            'Severe pH 2.8 snapshot reading will inhibit Rhizobium nodulation and stunt roots unless verified and corrected with lime prior to seeding.',
            'Fresh-market edamame and sweet corn require dependable irrigation beyond the 32% card humidity snapshot and rapid buyer off-take.',
          ],
          recommendations: [
            {
              id: 'n-earn-1',
              cropName: 'Commercial Soybean',
              botanicalName: 'Glycine max',
              cropCategory: 'Oilseed & Protein Legume',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'Conditional Fit (Soil / Moisture Action Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Follows North Field A1’s 2.3 ha Corn Plantation (Score 70, Vegetative stage) to break continuous cereal cultivation and replenish soil nitrogen.',
              suitabilityConsiderations: [
                'Requires confirming whether the pH 2.8 reading is a sensor artifact or true extreme acidity; soybean requires pH remediation toward 5.8–6.5.',
                'Warm-season photoperiod group must be matched to the farmer’s verified latitude.',
              ],
              potentialBenefits: [
                'Provides a globally traded oilseed/protein cash crop while fixing atmospheric nitrogen for subsequent seasons.',
                'Breaks corn rootworm and stalk-rot pest carry-over on the 2.3 ha parcel.',
              ],
              waterConsiderations:
                'Requires consistent moisture during pod set; current 1,250L water allocation and the discrepancy between 32% card humidity and 68% table soil moisture should be audited before planting.',
              soilConsiderations:
                'Bradyrhizobium inoculation is sensitive to low pH; agricultural liming is essential if lab testing confirms pH < 5.5.',
              risksAndLimitations: [
                'Poor nodulation and aluminum/manganese toxicity if planted directly into unamended pH 2.8 soil.',
                'Pod-fill stress if mid-season rainfall is erratic and supplemental irrigation is delayed.',
              ],
              supportingEvidenceAndAssumptions: [
                'Grounded in North Field A1 snapshot (Corn Plantation, 2.3 ha, pH 2.8, Humidity 32%, Fertilizer 87%).',
                'Follows standard corn–soybean alternation used across temperate and subtropical farming regions.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Rule-based agronomic demonstration combining team field snapshot with optional NASA POWER regional climate context.',
              },
              thermalWindowReferenceC: {
                minOptimal: 20,
                maxOptimal: 30,
                note: 'General vegetative/reproductive warmth range (illustrative reference).',
              },
            },
            {
              id: 'n-earn-2',
              cropName: 'Vegetable Soybean (Edamame)',
              botanicalName: 'Glycine max (Vegetable Type)',
              cropCategory: 'High-Value Specialty Pulse',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'Conditional Fit (Soil / Moisture Action Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Designed for a high-margin short season on North Field A1 (2.3 ha) once current corn is harvested and soil pH is stabilized.',
              suitabilityConsiderations: [
                'Suited to farms with proximity to fresh produce markets, cold storage, or vegetable processors.',
                'Harvested at green-pod stage (R6), shortening field exposure compared to dry grain soybean.',
              ],
              potentialBenefits: [
                'Higher commercial value per hectare than bulk grain when local market channels exist.',
                'Leaves green haulm residue with higher nitrogen content for incorporation prior to the next cereal crop.',
              ],
              waterConsiderations:
                'Sensitive to moisture deficits during flowering and pod plumpness; requires reliable irrigation scheduling within the 1,250L benchmark.',
              soilConsiderations:
                'Leverages North Field A1’s strong 87% fertilizer efficiency metric, provided acidic pH 2.8 stress is neutralized first.',
              risksAndLimitations: [
                'Narrow harvest window (typically 3–5 days at peak green pod quality).',
                'Cosmetic pod blemishes from stink bugs or moisture stress can reduce fresh-market grade.',
              ],
              supportingEvidenceAndAssumptions: [
                'Assumes operator can access fresh or frozen vegetable buyers and correct the pH 2.8 constraint.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative specialty-crop option linked to Decision Planner Strategy A.',
              },
              thermalWindowReferenceC: {
                minOptimal: 21,
                maxOptimal: 30,
                note: 'Warm frost-free window required for uniform pod development.',
              },
            },
            {
              id: 'n-earn-3',
              cropName: 'Fresh-Market Sweet Corn',
              botanicalName: 'Zea mays convar. saccharata',
              cropCategory: 'Specialty Cereal Vegetable',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'Conditional Fit (Soil / Moisture Action Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Positioned as the Phase 3 cash crop on North Field A1 (2.3 ha) *after* an intervening legume break crop — not recommended immediately back-to-back after current field corn.',
              suitabilityConsiderations: [
                'Should only be planted after a legume break (such as soybean or cowpea) to avoid compounding corn pest pressure.',
                'Requires soil pH adjustment above 5.5 and steady ear-fill moisture.',
              ],
              potentialBenefits: [
                'Uses existing corn planter and foliar management familiarity on North Field A1 while targeting fresh-market pricing.',
                'Shorter maturity than dry grain corn allows room for an off-season cover crop.',
              ],
              waterConsiderations:
                'Requires uniform soil moisture during silking; 32% card humidity snapshot indicates supplemental irrigation readiness is necessary.',
              soilConsiderations:
                'Captures residual nitrogen from the preceding Season 2 legume phase, supporting the field’s 87% fertilizer efficiency.',
              risksAndLimitations: [
                'High susceptibility to Lepidopteran ear pests and rapid post-harvest sugar-to-starch conversion without cooling.',
                'Not suitable as an immediate Season 2 crop without a non-corn break phase.',
              ],
              supportingEvidenceAndAssumptions: [
                'Matches Decision Planner Strategy A Phase 3 sequence for North Field A1.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative rotation phase recommendation; requires local market and soil verification.',
              },
              thermalWindowReferenceC: {
                minOptimal: 18,
                maxOptimal: 32,
                note: 'Warm daytime temperatures with adequate moisture during Pollination.',
              },
            },
          ],
        },

        'lower-risk': {
          goalId: 'lower-risk',
          goalLabel: 'Lower Risk',
          linkedDecisionPlannerStrategy: 'Strategy B — Lower Risk (Corn → Cowpea → Grain Sorghum)',
          recommendationHeadline:
            'Acid- & Drought-Buffered Legume and Hardy Cereal Sequence',
          recommendationExplanation:
            'Because North Field A1 exhibits a severe pH 2.8 snapshot reading and 32% card humidity on 2.3 ha, the Lower Risk pathway prioritizes crops with broader acid-soil tolerance and lower transpiration demand (Cowpea, Grain Sorghum, and Pearl Millet) to protect farm stability while soil conditions are audited.',
          cropSuggestionsSummary: [
            'Cowpea / Black-Eyed Pea (Vigna unguiculata) — Acid- & Drought-Tolerant Pulse',
            'Grain Sorghum (Sorghum bicolor) — Water-Resilient Cereal Substitute',
            'Forage / Mulch Pearl Millet (Pennisetum glaucum) — Low-pH Soil Stabilizer',
          ],
          potentialLimitations: [
            'Lower unit commodity price ceiling compared to specialty fresh-market vegetables.',
            'Even acid-tolerant cowpea and millet cannot thrive at true pH 2.8 if aluminum toxicity is severe — soil probe verification remains mandatory.',
          ],
          recommendations: [
            {
              id: 'n-risk-1',
              cropName: 'Cowpea (Black-Eyed Pea)',
              botanicalName: 'Vigna unguiculata',
              cropCategory: 'Drought- & Acid-Resilient Pulse',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Directly addresses North Field A1’s 32% card humidity and acidic pH 2.8 snapshot as a hardy Season 2 break crop after Corn Plantation (2.3 ha).',
              suitabilityConsiderations: [
                'Demonstrates broader tolerance to acidic soils and intermittent dry spells than standard commercial soybean.',
                'Well-suited to warm tropical, subtropical, and warm-temperate zones globally.',
              ],
              potentialBenefits: [
                'Fixes atmospheric nitrogen with lower fertilizer input risk and rapidly shades the soil surface to conserve moisture.',
                'Provides dual-purpose flexibility (dry pulse grain, fresh pods, or soil-building green manure).',
              ],
              waterConsiderations:
                'Significantly lower water demand than repeat corn, helping buffer North Field A1 if irrigation drops below 1,250L or humidity stays near 32%.',
              soilConsiderations:
                'More tolerant of low-pH soils than soybean during the transition period while agricultural lime reacts in the root zone.',
              risksAndLimitations: [
                'Susceptible to aphid and pod-borer pressure if planted in overly dense stands.',
                'Sensitive to waterlogging in poorly drained clay pockets.',
              ],
              supportingEvidenceAndAssumptions: [
                'Selected specifically to mitigate the two primary risk flags in North Field A1’s snapshot: pH 2.8 and 32% card humidity.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Rule-based stress-buffering crop recommendation aligned with Strategy B.',
              },
              thermalWindowReferenceC: {
                minOptimal: 22,
                maxOptimal: 35,
                note: 'Thrives in warm regimes; frost-sensitive.',
              },
            },
            {
              id: 'n-risk-2',
              cropName: 'Grain Sorghum',
              botanicalName: 'Sorghum bicolor',
              cropCategory: 'Water-Efficient C4 Cereal',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Replaces high-transpiration repeat corn on North Field A1 (2.3 ha) with a drought-buffered C4 cereal in Phase 3 after cowpea.',
              suitabilityConsiderations: [
                'Waxy leaf cuticle and dense fibrous root system allow temporary dormancy during mid-season dry spells.',
                'Compatible with standard grain seeding and harvesting machinery.',
              ],
              potentialBenefits: [
                'Lowers crop failure exposure under erratic rainfall or constrained irrigation.',
                'High carbon-to-nitrogen stalks leave durable surface residue that protects soil structure.',
              ],
              waterConsiderations:
                'Requires markedly less seasonal water than corn, aligning safely with or below the 1,250L snapshot benchmark.',
              soilConsiderations:
                'Tolerates moderate soil acidity and utilizes biological nitrogen fixed by the preceding cowpea phase.',
              risksAndLimitations: [
                'Bird predation during soft-dough grain stage and lower market price than food-grade corn in some regions.',
                'Slow early-season emergence if soil temperatures are cool.',
              ],
              supportingEvidenceAndAssumptions: [
                'Grounded in North Field A1’s cereal equipment context and moisture conservation priority.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative drought-resilient cereal option linked to Strategy B.',
              },
              thermalWindowReferenceC: {
                minOptimal: 21,
                maxOptimal: 35,
                note: 'High heat and drought resilience during vegetative and grain-fill phases.',
              },
            },
            {
              id: 'n-risk-3',
              cropName: 'Pearl Millet (Mulch & Grain Buffer)',
              botanicalName: 'Pennisetum glaucum',
              cropCategory: 'Acid-Tolerant Hardy Millet',
              roleInRotation: 'Protective Break / Cover Crop',
              suitabilityBadge: 'Targeted Buffer / Cover Fit (Illustrative)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Serves as a low-risk soil rehabilitation and biomass crop on North Field A1 (2.3 ha) if soil lab tests confirm severe subsoil acidity (pH 2.8 snapshot).',
              suitabilityConsiderations: [
                'Among the most acid-soil and drought-tolerant domesticated cereals worldwide.',
                'Can be harvested for grain/forage or rolled as protective surface mulch.',
              ],
              potentialBenefits: [
                'Deep roots scavenge leached nutrients and build organic matter while liming amendments take effect.',
                'Requires minimal synthetic fertilizer outlay.',
              ],
              waterConsiderations:
                'Thrives under low atmospheric humidity (32% snapshot) and modest rainfall regimes.',
              soilConsiderations:
                'Exceptionally suited to sandy or acidic profiles where corn and soybean suffer root stunting.',
              risksAndLimitations: [
                'Limited commercial cash market in regions without established millet food or poultry-feed buyers.',
              ],
              supportingEvidenceAndAssumptions: [
                'Included as a conservative agronomic safeguard against North Field A1’s extreme pH 2.8 reading.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative soil-stabilizing buffer recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 23,
                maxOptimal: 36,
                note: 'Warm-season hardy annual.',
              },
            },
          ],
        },

        'more-crops': {
          goalId: 'more-crops',
          goalLabel: 'More Crops',
          linkedDecisionPlannerStrategy:
            'Strategy C — More Crops (Corn → Mungbean → Buckwheat → Sunn Hemp / Clover Cover)',
          recommendationHeadline:
            'Multi-Family Short-Window Pulse, Pseudocereal & Green Manure Poly-Rotation',
          recommendationExplanation:
            'For farmers prioritizing ecological diversity and multiple harvestable crop families on North Field A1 (2.3 ha), this pathway sequences fast-maturing Mungbean, phosphorus-scavenging Buckwheat, and a Sunn Hemp + Crimson Clover cover relay after the current Corn Plantation.',
          cropSuggestionsSummary: [
            'Short-Season Mungbean (Vigna radiata) — 65-Day Pulse Break Crop',
            'Common Buckwheat (Fagopyrum esculentum) — Acid-Tolerant Pseudocereal & Weed Suppressor',
            'Sunn Hemp + Crimson Clover Mix — High-Biomass Nitrogen & Pollinator Relay',
          ],
          potentialLimitations: [
            'High management complexity: requires four field passes, multi-seed drill calibration, and tight weather-window execution on 2.3 ha.',
            'Requires verifying local buyer channels for specialty pulse (mungbean) and pseudocereal (buckwheat) outputs.',
          ],
          recommendations: [
            {
              id: 'n-more-1',
              cropName: 'Short-Season Mungbean',
              botanicalName: 'Vigna radiata',
              cropCategory: 'Fast-Maturing Food Pulse',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Slots immediately after North Field A1’s Corn Plantation harvest (2.3 ha) to capture residual soil moisture (68% table snapshot) in a rapid 60–70 day window.',
              suitabilityConsiderations: [
                'Short growth duration allows double- or triple-cropping within a single annual cycle.',
                'Still benefits from liming if the pH 2.8 snapshot is confirmed in the topsoil.',
              ],
              potentialBenefits: [
                'Adds a high-protein food pulse harvest while contributing biological nitrogen credit.',
                'Short lifecycle reduces prolonged exposure to late-season drought.',
              ],
              waterConsiderations:
                'Modest total water footprint; utilizes residual soil moisture efficiently.',
              soilConsiderations:
                'Improves surface friability and microbial activity after heavy corn root extraction.',
              risksAndLimitations: [
                'Pods can sprout or mold if heavy unseasonal rainfall occurs right at maturity.',
                'Requires gentle combine threshing to prevent seed splitting.',
              ],
              supportingEvidenceAndAssumptions: [
                'Aligned with Decision Planner Strategy C Phase 2 for North Field A1.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative short-window pulse recommendation for multi-crop rotation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 20,
                maxOptimal: 32,
                note: 'Warm, relatively dry maturity window preferred.',
              },
            },
            {
              id: 'n-more-2',
              cropName: 'Common Buckwheat',
              botanicalName: 'Fagopyrum esculentum',
              cropCategory: 'Polygonaceae Pseudocereal',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Introduces a non-cereal, non-legume botanical family (Polygonaceae) onto North Field A1 (2.3 ha) that tolerates acidic soils better than most cash grains.',
              suitabilityConsiderations: [
                'Reaches harvestable maturity in 70–80 days and establishes a dense weed-suppressing canopy within 2–3 weeks.',
                'Well-known for tolerating lower soil pH while liming programs are underway.',
              ],
              potentialBenefits: [
                'Root exudates solubilize bound soil phosphorus that is often locked up in acidic soils (relevant to North Field A1’s pH 2.8 flag).',
                'Supports beneficial predatory insects and pollinators with abundant nectar.',
              ],
              waterConsiderations:
                'Moderate water need; prefers cool-to-warm moist conditions without extreme midday heat.',
              soilConsiderations:
                'Leaves fine, rapidly mineralizing residue that releases phosphorus for subsequent crops.',
              risksAndLimitations: [
                'Sensitive to frost and extreme temperatures above 32°C during flowering (blossom blast).',
                'Niche grain market requires pre-arranged specialty milling or cover-crop seed buyers.',
              ],
              supportingEvidenceAndAssumptions: [
                'Selected to address North Field A1’s acidic pH context while expanding botanical diversity.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative pseudocereal recommendation aligned with Strategy C.',
              },
              thermalWindowReferenceC: {
                minOptimal: 15,
                maxOptimal: 26,
                note: 'Prefers moderate temperatures during flowering.',
              },
            },
            {
              id: 'n-more-3',
              cropName: 'Sunn Hemp + Crimson Clover Cover Mix',
              botanicalName: 'Crotalaria juncea + Trifolium incarnatum',
              cropCategory: 'Multi-Species Green Manure',
              roleInRotation: 'Protective Break / Cover Crop',
              suitabilityBadge: 'Targeted Buffer / Cover Fit (Illustrative)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Off-season biological soil builder on North Field A1 (2.3 ha) to replenish organic matter and protect surface humidity (32% card snapshot).',
              suitabilityConsiderations: [
                'Terminated prior to viable seed set as a high-biomass green manure mulch.',
              ],
              potentialBenefits: [
                'Produces fibrous and taproot biomass, suppresses plant-parasitic nematodes, and fixes nitrogen.',
                'Surface mulch reduces evaporative water loss before returning to Season 1 cereal.',
              ],
              waterConsiderations:
                'Establishes on off-season rainfall and improves water infiltration for the following cash crop.',
              soilConsiderations:
                'Buffers topsoil temperature and rebuilds organic carbon on intensively cropped plots.',
              risksAndLimitations: [
                'Requires timely mechanical crimping or mowing before stems become overly woody.',
                'Direct seed cost with no immediate grain sale in the cover window.',
              ],
              supportingEvidenceAndAssumptions: [
                'Completes the 4-phase Strategy C biodiversity cycle for North Field A1.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative agroecological cover recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 18,
                maxOptimal: 33,
                note: 'Sunn hemp thrives in warm windows; clover complements cooler shoulder periods.',
              },
            },
          ],
        },
      },
    },

    'east-field-b2': {
      fieldId: 'east-field-b2',
      fieldName: east.name,
      currentCropType: east.type,
      areaHectares: east.area,
      snapshotScore: east.score,
      cardHumidity: east.humidity,
      tableSoilMoisture: TABLE_SNAPSHOT_BY_FIELD['east-field-b2'].soilMoisture,
      tableTemperature: TABLE_SNAPSHOT_BY_FIELD['east-field-b2'].temperature,
      tableGrowthStage: TABLE_SNAPSHOT_BY_FIELD['east-field-b2'].growthStage,
      ph: east.ph,
      waterAllocation: east.water,
      fertilizerEfficiency: east.fertilizer,
      equipmentStatus: east.status,
      overviewDisplayStatus: getFieldOverviewStatus(east.status),
      badgeClass: getFieldBadgeClass(east.status),
      fieldConditionSummary:
        'East Field B2 is a 4.1 ha Wheat Plantation (Flowering stage) operating at Optimal status (Score 92/100, pH 6.5, Card Humidity 45%, Table Soil Moisture 72%, Temp 24°C, Water 850L, Fertilizer 94%).',
      globalApplicabilityNote:
        'Candidate crops below illustrate broadleaf, oilseed, and pulse break crops suited to follow a small-grain wheat stand with near-neutral pH (6.5); verify cultivar vernalization and thermal requirements for your specific coordinates.',
      byGoal: {
        'earn-more': {
          goalId: 'earn-more',
          goalLabel: 'Earn More',
          linkedDecisionPlannerStrategy:
            'Strategy A — Earn More (Wheat → Canola / Oilseed Rape → Malting Barley)',
          recommendationHeadline:
            'High-Value Brassica Oilseed & Quality-Grade Small Grain Rotation',
          recommendationExplanation:
            'East Field B2’s near-neutral pH (6.5), high fertilizer efficiency (94%), and 4.1 ha scale make it well-positioned for high-value oilseed and quality-grade grain phases that break continuous wheat root diseases.',
          cropSuggestionsSummary: [
            'High-Oleic Canola / Oilseed Rape (Brassica napus) — Primary Broadleaf Oilseed Break Crop',
            'Two-Row Malting Barley (Hordeum vulgare) — Quality-Bonus Small Grain Phase',
            'Food-Grade Kabuli Chickpea (Cicer arietinum) — High-Value Neutral-pH Pulse Alternative',
          ],
          potentialLimitations: [
            'Canola requires adequate soil sulfur and avoidance of extreme heat (>29°C) during bloom.',
            'Malting barley and Kabuli chickpea quality premiums require strict harvest moisture and low fungal staining.',
          ],
          recommendations: [
            {
              id: 'e-earn-1',
              cropName: 'Canola / Oilseed Rape',
              botanicalName: 'Brassica napus',
              cropCategory: 'Commercial Brassica Oilseed',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Follows East Field B2’s 4.1 ha Flowering Wheat Plantation (Score 92, pH 6.5) as a premier broadleaf cash break crop.',
              suitabilityConsiderations: [
                'Thrives in East Field B2’s pH 6.5 and 24°C moderate temperature regime.',
                'Breaks cereal take-all (Gaeumannomyces) and eyespot fungal cycles that penalize continuous wheat.',
              ],
              potentialBenefits: [
                'Produces high-demand vegetable oilseed while deep taproots loosen subsoil for subsequent cereals.',
                'Allows grass-selective herbicide modes of action to clean up cereal weeds.',
              ],
              waterConsiderations:
                'Compatible with East Field B2’s 850L water profile and 72% table soil moisture snapshot; sensitive to severe drought during flowering/pod fill.',
              soilConsiderations:
                'Near-neutral pH 6.5 and 94% fertilizer efficiency are ideal; requires verifying sulfur (S) availability alongside nitrogen.',
              risksAndLimitations: [
                'Pod shattering at harvest if windstorms occur and flea beetle pressure at cotyledon emergence.',
                'Flowering abortion if regional temperatures spike above 30°C.',
              ],
              supportingEvidenceAndAssumptions: [
                'Directly leverages East Field B2’s Optimal snapshot (Score 92, pH 6.5, 4.1 ha).',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Rule-based oilseed break-crop recommendation aligned with Decision Planner Strategy A.',
              },
              thermalWindowReferenceC: {
                minOptimal: 12,
                maxOptimal: 26,
                note: 'Cool-to-moderate flowering window prevents heat blast.',
              },
            },
            {
              id: 'e-earn-2',
              cropName: 'Two-Row Malting Barley',
              botanicalName: 'Hordeum vulgare',
              cropCategory: 'Premium Small-Grain Cereal',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Scheduled as the Phase 3 cereal on East Field B2 (4.1 ha) *after* the Season 2 Canola or Pulse break crop.',
              suitabilityConsiderations: [
                'Requires a preceding non-cereal break crop (like canola or pea) to minimize Fusarium and root-rot inoculum.',
                'Uses the exact same seeding and harvesting equipment as East Field B2’s current wheat.',
              ],
              potentialBenefits: [
                'Targets malting/brewing quality premiums over standard feed grain when protein and germination specs are met.',
                'Earlier maturity than wheat frees up a wider post-harvest window.',
              ],
              waterConsiderations:
                'Matches East Field B2’s efficient 850L water allocation; prefers dry weather at harvest to prevent pre-harvest sprouting.',
              soilConsiderations:
                'Requires precision nitrogen management (supported by East Field B2’s 94% fertilizer efficiency) to keep grain protein within malting bounds.',
              risksAndLimitations: [
                'If grain protein exceeds buyer thresholds or rain causes sprouting, grain is downgraded to feed price.',
              ],
              supportingEvidenceAndAssumptions: [
                'Aligned with Decision Planner Strategy A Phase 3 on East Field B2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative premium small-grain phase following broadleaf break.',
              },
              thermalWindowReferenceC: {
                minOptimal: 14,
                maxOptimal: 25,
                note: 'Moderate grain-fill temperatures support plump kernels.',
              },
            },
            {
              id: 'e-earn-3',
              cropName: 'Kabuli Chickpea',
              botanicalName: 'Cicer arietinum',
              cropCategory: 'High-Value Food Legume',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'High-value food legume alternative to Canola on East Field B2 (4.1 ha) that capitalizes on the near-neutral pH 6.5 and modest 850L water draw.',
              suitabilityConsiderations: [
                'Large-seeded Kabuli chickpeas require pH 6.0–7.5 (matching East Field B2’s 6.5) and well-drained soil.',
              ],
              potentialBenefits: [
                'Commands strong culinary export/local market value while fixing biological nitrogen for the following wheat or barley crop.',
              ],
              waterConsiderations:
                'Deep root system uses residual soil moisture (72% table snapshot) efficiently and prefers drier late-season maturation.',
              soilConsiderations:
                'Requires Mesorhizobium ciceri inoculation if chickpeas have not been grown recently on East Field B2.',
              risksAndLimitations: [
                'High susceptibility to Ascochyta blight in humid or frequently rainy climates — verify with NASA POWER precipitation history.',
              ],
              supportingEvidenceAndAssumptions: [
                'Grounded in East Field B2’s pH 6.5 and 850L water efficiency profile.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative high-value pulse break-crop option.',
              },
              thermalWindowReferenceC: {
                minOptimal: 15,
                maxOptimal: 29,
                note: 'Prefers warm, low-humidity pod maturity.',
              },
            },
          ],
        },

        'lower-risk': {
          goalId: 'lower-risk',
          goalLabel: 'Lower Risk',
          linkedDecisionPlannerStrategy:
            'Strategy B — Lower Risk (Wheat → Field Pea / Chickpea → Hardy Oats)',
          recommendationHeadline:
            'Low-Input Pulse Nitrogen Fixer & Disease-Suppressive Oat Sequence',
          recommendationExplanation:
            'To protect East Field B2’s Optimal 92/100 score with minimal input cost and low operational volatility, this pathway alternates the current Wheat Plantation with Field Pea and Milling/Forage Oats — naturally suppressing cereal take-all fungi and cutting synthetic nitrogen purchases.',
          cropSuggestionsSummary: [
            'Yellow / Green Field Pea (Pisum sativum) — Reliable Nitrogen-Fixing Break Crop',
            'Milling / Forage Oats (Avena sativa) — Take-All Disease-Suppressive Cereal',
            'Desi Chickpea (Cicer arietinum) — Drought-Hardy Low-Water Pulse',
          ],
          potentialLimitations: [
            'Lower gross revenue ceiling than canola or specialty vegetables.',
            'Field peas require level seedbeds and timely harvest to avoid prostrate vine lodging.',
          ],
          recommendations: [
            {
              id: 'e-risk-1',
              cropName: 'Field Pea (Yellow / Green)',
              botanicalName: 'Pisum sativum',
              cropCategory: 'Cool-Season Nitrogen-Fixing Pulse',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Directly follows East Field B2’s 4.1 ha Wheat Plantation (pH 6.5, Score 92) to fix nitrogen and break wheat root pathogen cycles.',
              suitabilityConsiderations: [
                'East Field B2’s pH 6.5 is in the optimal range for Rhizobium leguminosarum nodulation.',
                'Short growing season reduces late-summer drought exposure.',
              ],
              potentialBenefits: [
                'Reduces synthetic nitrogen fertilizer cost in both the pea season and the following grain season.',
                'Shallow root water extraction preserves deep subsoil moisture for the next cereal crop.',
              ],
              waterConsiderations:
                'Low water footprint that comfortably fits within East Field B2’s 850L benchmark.',
              soilConsiderations:
                'Rapidly decomposing pea residue mineralizes nitrogen early for the subsequent crop.',
              risksAndLimitations: [
                'Susceptible to root rot if soil is compacted or waterlogged.',
                'Can lodge near harvest, requiring vine lifters on the combine header.',
              ],
              supportingEvidenceAndAssumptions: [
                'Core Season 2 break crop in Decision Planner Strategy B for East Field B2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Rule-based low-risk pulse recommendation aligned with Strategy B.',
              },
              thermalWindowReferenceC: {
                minOptimal: 12,
                maxOptimal: 24,
                note: 'Prefers moderate temperatures like East Field B2’s 24°C snapshot.',
              },
            },
            {
              id: 'e-risk-2',
              cropName: 'Milling / Forage Oats',
              botanicalName: 'Avena sativa',
              cropCategory: 'Disease-Suppressive Small Grain',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Serves as a low-risk Phase 3 small grain on East Field B2 (4.1 ha) using existing wheat machinery.',
              suitabilityConsiderations: [
                'Oat roots exude avenacin, an antifungal compound that suppresses wheat take-all root rot.',
              ],
              potentialBenefits: [
                'Lower fertilizer and fungicide input requirements than continuous wheat or malting barley.',
                'Can be harvested as milling grain, livestock feed, or baled as high-quality forage hay if weather shifts.',
              ],
              waterConsiderations:
                'Well-matched to East Field B2’s 45% card humidity / 72% table soil moisture profile.',
              soilConsiderations:
                'Fibrous root mass and abundant straw protect East Field B2’s 92/100 soil health score.',
              risksAndLimitations: [
                'Modest commodity grain price compared to oilseeds.',
              ],
              supportingEvidenceAndAssumptions: [
                'Aligned with Decision Planner Strategy B Phase 3 for East Field B2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative low-input cereal stabilizer recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 13,
                maxOptimal: 25,
                note: 'Cool-to-moderate small-grain thermal preference.',
              },
            },
            {
              id: 'e-risk-3',
              cropName: 'Desi Chickpea (Drought-Buffer Pulse)',
              botanicalName: 'Cicer arietinum (Desi Type)',
              cropCategory: 'Drought-Tolerant Pulse',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Alternative to Field Pea on East Field B2 (4.1 ha) when NASA POWER historical data or seasonal forecasts indicate drier, warmer conditions.',
              suitabilityConsiderations: [
                'Smaller, thicker-seeded Desi types have stronger drought and heat resilience than Kabuli chickpeas or field peas.',
              ],
              potentialBenefits: [
                'Fixes nitrogen while tolerating low irrigation allocations (850L snapshot or less).',
              ],
              waterConsiderations:
                'Deep taproot extracts residual moisture efficiently without requiring heavy supplemental irrigation.',
              soilConsiderations:
                'Thrives at East Field B2’s pH 6.5.',
              risksAndLimitations: [
                'Intolerant of waterlogged soils or excessive canopy humidity.',
              ],
              supportingEvidenceAndAssumptions: [
                'Provides a warmer/drier climate alternative within Strategy B.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative water-saving pulse option.',
              },
              thermalWindowReferenceC: {
                minOptimal: 16,
                maxOptimal: 31,
                note: 'Higher heat tolerance than field pea.',
              },
            },
          ],
        },

        'more-crops': {
          goalId: 'more-crops',
          goalLabel: 'More Crops',
          linkedDecisionPlannerStrategy:
            'Strategy C — More Crops (Wheat → Lentil → Brown Mustard → Phacelia + Vetch Cover)',
          recommendationHeadline:
            'Four-Family Agroecological Cereal, Pulse, Biofumigant Brassica & Pollinator Sequence',
          recommendationExplanation:
            'Capitalizing on East Field B2’s Optimal status (Score 92, pH 6.5, 4.1 ha), this pathway maximizes functional biodiversity across four plant families (Poaceae, Fabaceae, Brassicaceae, Boraginaceae) to produce multiple specialty commodities and build soil biology.',
          cropSuggestionsSummary: [
            'Food-Grade Red / Green Lentil (Lens culinaris) — High-Value Nitrogen-Fixing Pulse',
            'Brown / Oriental Mustard (Brassica juncea) — Taproot Spice & Biofumigant Crop',
            'Phacelia + Hairy Vetch + Crimson Clover — Pollinator & Soil-Building Cover Mix',
          ],
          potentialLimitations: [
            'High management complexity: low-pod lentil harvesting requires a smooth, rock-free field surface and flex-header cutterbar.',
            'Requires careful tracking of herbicide plant-back intervals across four sensitive broadleaf and cereal families.',
          ],
          recommendations: [
            {
              id: 'e-more-1',
              cropName: 'Food-Grade Lentil',
              botanicalName: 'Lens culinaris',
              cropCategory: 'Specialty Culinary Pulse',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Rotates after East Field B2’s 4.1 ha Wheat Plantation (pH 6.5, 850L water) to add a high-value food legume phase.',
              suitabilityConsiderations: [
                'Near-neutral pH 6.5 is ideal for lentil nodulation and micronutrient uptake.',
                'Requires a level, stone-rolled seedbed because pods form close to the ground.',
              ],
              potentialBenefits: [
                'Diversifies farm income with a high-protein culinary pulse while fixing nitrogen.',
                'Low water consumption preserves deep soil moisture.',
              ],
              waterConsiderations:
                'Well-suited to East Field B2’s modest 850L water footprint; excessive late rain can delay dry-down.',
              soilConsiderations:
                'Enhances surface nitrogen availability for subsequent brassica or cereal crops.',
              risksAndLimitations: [
                'Harvest loss if field surface is uneven or rocky; vulnerable to Botrytis/Anthracnose in overly wet canopies.',
              ],
              supportingEvidenceAndAssumptions: [
                'Matches Decision Planner Strategy C Phase 2 on East Field B2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative specialty pulse recommendation aligned with Strategy C.',
              },
              thermalWindowReferenceC: {
                minOptimal: 14,
                maxOptimal: 27,
                note: 'Moderate growing temperatures with dry harvest window.',
              },
            },
            {
              id: 'e-more-2',
              cropName: 'Brown / Condiment Mustard',
              botanicalName: 'Brassica juncea',
              cropCategory: 'Biofumigant Oilseed & Spice Crop',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Follows lentil in Phase 3 on East Field B2 (4.1 ha), offering greater heat and drought tolerance than standard canola.',
              suitabilityConsiderations: [
                'More resistant to pod shattering and heat stress than Brassica napus.',
              ],
              potentialBenefits: [
                'Glucosinolate compounds in root and shoot residue provide natural biofumigation against soil-borne fungal pathogens and nematodes.',
                'Produces marketable condiment/oilseed grain.',
              ],
              waterConsiderations:
                'Taproot accesses deeper moisture reserves efficiently within the 850L water profile.',
              soilConsiderations:
                'Scavenges residual nitrogen fixed by the Phase 2 lentil crop and recycles sulfur.',
              risksAndLimitations: [
                'Must not be planted closely with other brassicas to avoid clubroot buildup.',
              ],
              supportingEvidenceAndAssumptions: [
                'Aligned with Decision Planner Strategy C Phase 3 for East Field B2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative brassica biofumigant & spice crop recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 15,
                maxOptimal: 30,
                note: 'Broader heat tolerance than canola.',
              },
            },
            {
              id: 'e-more-3',
              cropName: 'Phacelia + Hairy Vetch Cover Relay',
              botanicalName: 'Phacelia tanacetifolia + Vicia villosa',
              cropCategory: 'Pollinator & Soil Structure Cover Mix',
              roleInRotation: 'Protective Break / Cover Crop',
              suitabilityBadge: 'Targeted Buffer / Cover Fit (Illustrative)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Inter-season living cover on East Field B2 (4.1 ha) before cycling back to wheat.',
              suitabilityConsiderations: [
                'Phacelia belongs to Boraginaceae, introducing a fourth distinct plant family that hosts neither cereal nor legume/brassica diseases.',
              ],
              potentialBenefits: [
                'Dense lacy roots aggregate topsoil tilth while hairy vetch fixes nitrogen for the next wheat cycle.',
                'High nectar output attracts hoverflies and parasitic wasps that predate cereal aphids.',
              ],
              waterConsiderations:
                'Protects the 72% table soil moisture profile from evaporative loss between cash crops.',
              soilConsiderations:
                'Maintains East Field B2’s top-tier 92/100 score and 94% nutrient cycling efficiency.',
              risksAndLimitations: [
                'Hairy vetch must be terminated cleanly before seed set to avoid volunteer vetch in subsequent wheat.',
              ],
              supportingEvidenceAndAssumptions: [
                'Completes the 4-family Strategy C rotation on East Field B2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative pollinator and soil-health cover recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 12,
                maxOptimal: 26,
                note: 'Cool-to-warm shoulder season cover mix.',
              },
            },
          ],
        },
      },
    },

    'south-field-c3': {
      fieldId: 'south-field-c3',
      fieldName: south.name,
      currentCropType: south.type,
      areaHectares: south.area,
      snapshotScore: south.score,
      cardHumidity: south.humidity,
      tableSoilMoisture: TABLE_SNAPSHOT_BY_FIELD['south-field-c3'].soilMoisture,
      tableTemperature: TABLE_SNAPSHOT_BY_FIELD['south-field-c3'].temperature,
      tableGrowthStage: TABLE_SNAPSHOT_BY_FIELD['south-field-c3'].growthStage,
      ph: south.ph,
      waterAllocation: south.water,
      fertilizerEfficiency: south.fertilizer,
      equipmentStatus: south.status,
      overviewDisplayStatus: getFieldOverviewStatus(south.status),
      badgeClass: getFieldBadgeClass(south.status),
      fieldConditionSummary:
        'South Field C3 is a 1.8 ha Soybean Plantation (Seedling stage) in Critical status (Score 41/100, low Card Humidity 18%, Table Soil Moisture 41%, warm Temp 29°C, moderately acidic pH 5.2, high Water draw 2,100L, and Fertilizer 62%).',
      globalApplicabilityNote:
        'Candidate crops below focus on breaking continuous soybean disease cycles, monetizing residual legume nitrogen, and buffering South Field C3’s severe moisture/heat stress (18% humidity, 29°C, pH 5.2); validate locally before planting.',
      byGoal: {
        'earn-more': {
          goalId: 'earn-more',
          goalLabel: 'Earn More',
          linkedDecisionPlannerStrategy:
            'Strategy A — Earn More (Soybean → Hybrid Corn → Culinary Sesame)',
          recommendationHeadline:
            'Nitrogen-Credited Cereal & Heat-Tolerant High-Value Oilseed Sequence',
          recommendationExplanation:
            'Once South Field C3’s current Soybean Plantation completes its cycle and the 2,100L vs. 18% humidity irrigation anomaly is repaired, the Earn More pathway captures the residual legume nitrogen credit with Hybrid Corn, followed by heat- and drought-tolerant Culinary Sesame suited to 29°C and pH 5.2–6.0.',
          cropSuggestionsSummary: [
            'Culinary / Export Sesame (Sesamum indicum) — Heat- & Drought-Adapted High-Value Oilseed',
            'Nitrogen-Credited Hybrid Corn (Zea mays) — Cereal Cash Crop Utilizing Soybean N-Credit',
            'Valencia / Spanish Groundnut (Arachis hypogaea) — Acid-Tolerant Warm-Climate Oilseed/Food Crop',
          ],
          potentialLimitations: [
            'High-input hybrid corn cannot succeed until South Field C3’s Critical moisture loss (2,100L draw with only 18% card humidity / 41% table moisture) is diagnosed and repaired.',
            'Groundnut should not immediately follow soybean without an intervening cereal break due to shared soil-borne fungi.',
          ],
          recommendations: [
            {
              id: 's-earn-1',
              cropName: 'Culinary / Export Sesame',
              botanicalName: 'Sesamum indicum',
              cropCategory: 'Heat-Tolerant High-Value Oilseed',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Well-matched to South Field C3’s warm 29°C temperature, 1.8 ha scale, and low atmospheric humidity (18% snapshot) as a high-unit-value non-legume break crop.',
              suitabilityConsiderations: [
                'Belongs to Pedaliaceae, cleanly breaking soybean cyst nematode and legume root-rot cycles.',
                'Tolerates moderately acidic soils (pH 5.2–6.5) and high daytime heat.',
              ],
              potentialBenefits: [
                'High commercial market value for confectionery and oil extraction with much lower water demand than corn or soybean.',
                'Deep taproot scavenges leached nutrients, helping improve the 62% fertilizer efficiency baseline.',
              ],
              waterConsiderations:
                'Once established, sesame thrives under drier regimes and helps reduce South Field C3’s excessive 2,100L water draw.',
              soilConsiderations:
                'Tolerates pH 5.2 better than many specialty crops, though light dolomitic liming toward 5.8 improves vigor.',
              risksAndLimitations: [
                'Capsule shattering at maturity if non-shattering varieties are unavailable or harvest is delayed.',
                'Extremely sensitive to waterlogging if heavy rains pool on the field.',
              ],
              supportingEvidenceAndAssumptions: [
                'Directly aligned with Decision Planner Strategy A Phase 3 and South Field C3’s 29°C / low-humidity profile.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Rule-based heat-adapted commercial oilseed recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 24,
                maxOptimal: 35,
                note: 'Thrives in warm 29°C conditions where cool-season crops fail.',
              },
            },
            {
              id: 's-earn-2',
              cropName: 'Hybrid Field Corn (Utilizing Legume N-Credit)',
              botanicalName: 'Zea mays',
              cropCategory: 'Primary Cereal Cash Crop',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'Conditional Fit (Soil / Moisture Action Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Follows South Field C3’s 1.8 ha Soybean Plantation in Season 2 to monetize biological nitrogen fixation, contingent on fixing the field’s irrigation uniformity.',
              suitabilityConsiderations: [
                'Requires repairing the cause of Critical moisture stress (Score 41, 18% humidity despite 2,100L water use) and applying lime to raise pH 5.2 toward 5.8–6.2.',
              ],
              potentialBenefits: [
                'Captures residual soybean nitrogen to improve South Field C3’s lagging 62% fertilizer efficiency.',
                'Produces abundant stalk stover to cover bare soil after low-residue soybean.',
              ],
              waterConsiderations:
                'Should only be planted once irrigation delivery efficiency on the 1.8 ha plot is verified.',
              soilConsiderations:
                'Moderately acidic pH 5.2 is much easier to amend with standard agricultural lime than North Field A1’s pH 2.8.',
              risksAndLimitations: [
                'High risk of tassel-stage moisture stress at 29°C if irrigation leakage or runoff remains unresolved.',
              ],
              supportingEvidenceAndAssumptions: [
                'Matches Decision Planner Strategy A Phase 2 for South Field C3.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative cereal rotation phase conditioned on irrigation repair.',
              },
              thermalWindowReferenceC: {
                minOptimal: 20,
                maxOptimal: 32,
                note: 'Requires dependable root-zone moisture at 29°C.',
              },
            },
            {
              id: 's-earn-3',
              cropName: 'Spanish / Valencia Groundnut (After Cereal Break)',
              botanicalName: 'Arachis hypogaea',
              cropCategory: 'Acid-Tolerant High-Value Legume',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'Conditional Fit (Soil / Moisture Action Required)',
              alignedGoalId: 'earn-more',
              linkedStrategyTitle: 'Strategy A — Earn More',
              currentFieldContext:
                'Candidate high-value warm-climate crop for South Field C3 (1.8 ha, pH 5.2, 29°C) *only after* an intervening cereal/sesame break season.',
              suitabilityConsiderations: [
                'Groundnut tolerates moderately acidic pH 5.2–5.8 well, provided calcium (gypsum) is supplied in the pegging zone.',
                'Must not be planted directly after soybean due to shared Sclerotium / Cylindrocladium root pathogens.',
              ],
              potentialBenefits: [
                'High local and export food value on smaller plots (1.8 ha).',
                'Drought-hardy foliage shades warm soil surfaces.',
              ],
              waterConsiderations:
                'More drought-resilient than soybean, though pegging stage requires moderate topsoil moisture.',
              soilConsiderations:
                'Requires friable, non-crusted topsoil and adequate calcium at pH 5.2 for pod filling.',
              risksAndLimitations: [
                'Aflatoxin risk if severe late-season drought occurs combined with high soil temperatures.',
              ],
              supportingEvidenceAndAssumptions: [
                'Tailored to South Field C3’s pH 5.2 and 29°C thermal snapshot after a non-legume break.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative warm-climate cash-crop option requiring cereal break interval.',
              },
              thermalWindowReferenceC: {
                minOptimal: 22,
                maxOptimal: 34,
                note: 'Warm-season crop suited to 29°C regimes.',
              },
            },
          ],
        },

        'lower-risk': {
          goalId: 'lower-risk',
          goalLabel: 'Lower Risk',
          linkedDecisionPlannerStrategy:
            'Strategy B — Lower Risk (Soybean → Pearl Millet / Sorghum Mulch → Pigeon Pea)',
          recommendationHeadline:
            'High-Mulch Drought Cereal & Deep-Taproot Woody Legume Stabilization Sequence',
          recommendationExplanation:
            'Because South Field C3 is in Critical status (Score 41, 18% card humidity, 41% table soil moisture, 29°C, pH 5.2, 2,100L water draw), the Lower Risk pathway is the primary agronomic stabilization strategy: using Pearl Millet or Sorghum to build thick evaporative-shield mulch, followed by deep-rooted Pigeon Pea.',
          cropSuggestionsSummary: [
            'Pearl Millet (Pennisetum glaucum) — Surface Mulch Builder & Heat/Acid Buffer',
            'Pigeon Pea (Cajanus cajan) — Deep-Taproot Drought-Hardy Woody Pulse',
            'Grain / Forage Sorghum (Sorghum bicolor) — Nematode-Break Cereal Stabilizer',
          ],
          potentialLimitations: [
            'Focuses on field rehabilitation and downside protection rather than maximum short-term cash margins.',
            'Pigeon pea requires a longer frost-free maturity window.',
          ],
          recommendations: [
            {
              id: 's-risk-1',
              cropName: 'Pearl Millet (Mulch & Grain Builder)',
              botanicalName: 'Pennisetum glaucum',
              cropCategory: 'Heat- & Acid-Hardy C4 Cereal',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Directly remedies South Field C3’s Critical stress markers (Score 41, 18% humidity, 29°C, pH 5.2) as the immediate post-soybean rotation crop on the 1.8 ha plot.',
              suitabilityConsiderations: [
                'Non-host break crop for Soybean Cyst Nematode (SCN) and Phytophthora root rot.',
                'Thrives at pH 5.2 and 29°C with minimal water and fertilizer overhead.',
              ],
              potentialBenefits: [
                'Generates durable, high-C:N stalk mulch that blankets the soil surface, lowering soil temperature and cutting evaporative water loss.',
                'Scavenges residual nitrogen left by the current soybean stand.',
              ],
              waterConsiderations:
                'Dramatically reduces irrigation demand below the unsustainable 2,100L snapshot.',
              soilConsiderations:
                'Rebuilds surface organic armor that continuous soybean fails to provide.',
              risksAndLimitations: [
                'Lower commercial grain price than hybrid corn or oilseeds.',
              ],
              supportingEvidenceAndAssumptions: [
                'Core Phase 2 stabilizer in Decision Planner Strategy B for South Field C3.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Rule-based stress-recovery crop recommendation aligned with Strategy B.',
              },
              thermalWindowReferenceC: {
                minOptimal: 23,
                maxOptimal: 36,
                note: 'Excels in warm 29°C conditions with low atmospheric humidity.',
              },
            },
            {
              id: 's-risk-2',
              cropName: 'Pigeon Pea (Deep-Taproot Pulse)',
              botanicalName: 'Cajanus cajan',
              cropCategory: 'Drought-Tolerant Woody Legume',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Follows Phase 2 millet/sorghum on South Field C3 (1.8 ha) to break subsoil compaction and fix nitrogen under dry, pH 5.2 conditions.',
              suitabilityConsiderations: [
                'Woody taproot penetrates compacted subsoil layers to access deep moisture reserves unavailable to shallow soybean roots.',
              ],
              potentialBenefits: [
                'Produces edible dhal/pulse grain, woody stems, and heavy leaf fall that enriches topsoil organic matter.',
                'Secretes piscidic acid from roots to release iron-bound phosphorus in acidic soils (pH 5.2).',
              ],
              waterConsiderations:
                'Among the most drought-resilient food legumes once established.',
              soilConsiderations:
                'Directly improves South Field C3’s low 62% fertilizer efficiency metric through biological N fixation and P mobilization.',
              risksAndLimitations: [
                'Pod borers (Helicoverpa) require monitoring during flowering/podding.',
              ],
              supportingEvidenceAndAssumptions: [
                'Aligned with Decision Planner Strategy B Phase 3 for South Field C3.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative deep-rooting legume recommendation for moisture-stressed plots.',
              },
              thermalWindowReferenceC: {
                minOptimal: 20,
                maxOptimal: 35,
                note: 'Warm-climate pulse adapted to semi-arid and seasonal-rain zones.',
              },
            },
            {
              id: 's-risk-3',
              cropName: 'Drought-Hardy Grain Sorghum',
              botanicalName: 'Sorghum bicolor',
              cropCategory: 'Water-Conserving Cereal',
              roleInRotation: 'Companion / Relay Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'lower-risk',
              linkedStrategyTitle: 'Strategy B — Lower Risk',
              currentFieldContext:
                'Alternative to Pearl Millet on South Field C3 (1.8 ha) where established grain sorghum feed/food markets exist.',
              suitabilityConsiderations: [
                'Tolerates pH 5.2 and 29°C heat far better than corn while breaking soybean pest cycles.',
              ],
              potentialBenefits: [
                'Stomatal regulation pauses water loss during midday heat spikes (18% card humidity snapshot).',
              ],
              waterConsiderations:
                'Helps bring South Field C3’s 2,100L water consumption down toward sustainable levels.',
              soilConsiderations:
                'Dense root system stabilizes topsoil structure.',
              risksAndLimitations: [
                'Not tolerant of cold soils at planting.',
              ],
              supportingEvidenceAndAssumptions: [
                'Supports Decision Planner Strategy B Phase 2.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative low-risk cereal rotation option.',
              },
              thermalWindowReferenceC: {
                minOptimal: 21,
                maxOptimal: 35,
                note: 'Well-adapted to 29°C regimes.',
              },
            },
          ],
        },

        'more-crops': {
          goalId: 'more-crops',
          goalLabel: 'More Crops',
          linkedDecisionPlannerStrategy:
            'Strategy C — More Crops (Soybean → Sorghum/Millet → Sunflower → Lablab + Stylo Cover)',
          recommendationHeadline:
            'Heat-Adapted Cereal, Deep-Taproot Oilseed & Acid-Tolerant Living Mulch Sequence',
          recommendationExplanation:
            'To rehabilitate South Field C3 (1.8 ha, Score 41 Critical, pH 5.2, 29°C) through multi-species diversity, this pathway rotates from the current Soybean Plantation into Sorghum/Finger Millet, Drought-Tolerant Sunflower, and a Lablab + Stylosanthes living mulch relay.',
          cropSuggestionsSummary: [
            'Finger Millet / Grain Sorghum — Fibrous-Root Mulch & Nematode Break',
            'Drought-Tolerant Oilseed Sunflower (Helianthus annuus) — Deep-Taproot Asteraceae Crop',
            'Lablab Bean + Stylosanthes Cover Mix — Acid-Tolerant Living Soil Armor',
          ],
          potentialLimitations: [
            'Sunflower and soybean can share Sclerotinia (white mold) in wet seasons — keep at least one cereal phase between them or substitute sesame if Sclerotinia is present.',
            'High operational coordination required for four distinct species on a 1.8 ha plot.',
          ],
          recommendations: [
            {
              id: 's-more-1',
              cropName: 'Drought-Tolerant Oilseed Sunflower',
              botanicalName: 'Helianthus annuus',
              cropCategory: 'Asteraceae Taproot Oilseed',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'Conditional Fit (Soil / Moisture Action Required)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Placed in Phase 3 on South Field C3 (1.8 ha) *after* a Phase 2 sorghum/millet cereal break to add a third botanical family (Asteraceae).',
              suitabilityConsiderations: [
                'Deep taproot (often >1.5 m) extracts deep moisture and leached nutrients unused by shallow crops.',
                'Must be separated from Season 1 soybean by a cereal phase to manage Sclerotinia risk.',
              ],
              potentialBenefits: [
                'Produces marketable oilseed/confectionery seed and supports pollinator populations.',
                'Improves deep soil macroporosity on the 1.8 ha parcel.',
              ],
              waterConsiderations:
                'High drought tolerance once taproot is established, suited to reducing South Field C3’s 2,100L water draw.',
              soilConsiderations:
                'Tolerates pH 5.5–7.0 best; mild liming of South Field C3’s pH 5.2 during the preceding cereal phase improves head fill.',
              risksAndLimitations: [
                'Shared susceptibility to Sclerotinia stem rot with soybean if rotated too tightly without a grass break.',
                'Bird damage near seed maturity.',
              ],
              supportingEvidenceAndAssumptions: [
                'Matches Decision Planner Strategy C Phase 3 for South Field C3.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative Asteraceae oilseed diversification option.',
              },
              thermalWindowReferenceC: {
                minOptimal: 18,
                maxOptimal: 32,
                note: 'Broad thermal adaptability.',
              },
            },
            {
              id: 's-more-2',
              cropName: 'Finger Millet (Eleusine coracana)',
              botanicalName: 'Eleusine coracana',
              cropCategory: 'Climate-Resilient Nutrient-Dense Millet',
              roleInRotation: 'Primary Next-Season Crop',
              suitabilityBadge: 'High Illustrative Fit (Local Validation Required)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Serves as the Phase 2 cereal break immediately following South Field C3’s Soybean Plantation (1.8 ha, pH 5.2, 29°C).',
              suitabilityConsiderations: [
                'Thrives in moderately acidic soils (pH 5.0–6.5) and warm temperatures (29°C snapshot).',
              ],
              potentialBenefits: [
                'Produces calcium-rich food grain with exceptional storage longevity (resistant to storage insects).',
                'Dense fibrous roots rebuild topsoil aggregation and break soybean nematode cycles.',
              ],
              waterConsiderations:
                'Low water requirement compared to South Field C3’s current 2,100L demand.',
              soilConsiderations:
                'Utilizes nitrogen fixed by Season 1 soybean to boost South Field C3’s 62% fertilizer efficiency.',
              risksAndLimitations: [
                'Small seed size requires fine seedbed preparation and early weed control.',
              ],
              supportingEvidenceAndAssumptions: [
                'Aligned with Decision Planner Strategy C Phase 2 for South Field C3.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative nutrient-dense millet break crop.',
              },
              thermalWindowReferenceC: {
                minOptimal: 20,
                maxOptimal: 33,
                note: 'Warm-climate resilient cereal.',
              },
            },
            {
              id: 's-more-3',
              cropName: 'Lablab Bean + Stylosanthes Living Mulch',
              botanicalName: 'Lablab purpureus + Stylosanthes guianensis',
              cropCategory: 'Acid-Tolerant Forage & Soil Armor Relay',
              roleInRotation: 'Protective Break / Cover Crop',
              suitabilityBadge: 'Targeted Buffer / Cover Fit (Illustrative)',
              alignedGoalId: 'more-crops',
              linkedStrategyTitle: 'Strategy C — More Crops',
              currentFieldContext:
                'Phase 4 soil rehabilitation cover on South Field C3 (1.8 ha) designed to shield the 29°C soil surface and restore the 41/100 field score.',
              suitabilityConsiderations: [
                'Stylosanthes and Lablab are specially adapted to acidic soils (pH 5.0–5.5) and high heat.',
              ],
              potentialBenefits: [
                'Blankets the ground with thick living mulch that locks in moisture (combating the 18% card humidity / 41% table moisture deficit).',
                'Provides high-protein forage or green manure biomass.',
              ],
              waterConsiderations:
                'Deep roots survive dry seasons and drastically improve rainfall infiltration.',
              soilConsiderations:
                'Rebuilds organic nitrogen and organic matter on South Field C3’s 62% fertilizer efficiency baseline.',
              risksAndLimitations: [
                'Requires mechanical termination before planting the next main cash crop.',
              ],
              supportingEvidenceAndAssumptions: [
                'Completes Decision Planner Strategy C Phase 4 for South Field C3.',
              ],
              dataProvenance: {
                primaryTag: 'Illustrative Recommendation',
                fieldContextTag: 'Team-provided Demo Snapshot',
                climateContextTag: 'NASA POWER Historical Modeled Data',
                provenanceSummary:
                  'Illustrative acid-tolerant cover & forage relay recommendation.',
              },
              thermalWindowReferenceC: {
                minOptimal: 22,
                maxOptimal: 35,
                note: 'Adapted to warm 29°C regimes and acidic soils.',
              },
            },
          ],
        },
      },
    },
  };
}

export const FIELD_CROP_RECOMMENDATIONS: Record<FieldId, FieldCropRecommendationsBundle> =
  buildFieldRecommendations();

export function getFieldCropRecommendations(
  fieldId: string | null | undefined
): FieldCropRecommendationsBundle {
  if (isFieldId(fieldId)) {
    return FIELD_CROP_RECOMMENDATIONS[fieldId];
  }
  return FIELD_CROP_RECOMMENDATIONS[FIELD_IDS[0]];
}
