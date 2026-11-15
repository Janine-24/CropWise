import React, { useEffect, useState } from 'react';
import {
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Globe,
  MapPin,
  Navigation,
  Sparkles,
  ShieldCheck,
  Layers,
  TrendingUp,
  Droplets,
  Sprout,
  GitBranch,
  Sliders,
  Info,
  RefreshCw,
  ArrowRight,
  CloudRain,
  Sun,
  HelpCircle,
  FileWarning,
  Compass,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import {
  FIELD_IDS,
  cropwiseFields,
  getFieldBadgeClass,
  getFieldOverviewStatus,
  isFieldId,
  type FieldId,
} from '../../data/cropwiseFields';
import {
  fetchNasaPowerDaily,
  validateCoordinates,
  type NasaDailyObservationPoint,
  type NasaPowerDailyResult,
} from '../../services/nasaPowerClient';
import {
  FIELD_ROTATION_PLANS,
  NASA_PUBLIC_TEST_LOCATIONS,
  PLANNER_GOALS,
  TRADE_OFF_DIMENSIONS,
  getFieldRotationPlan,
  getQualitativeRatingStyle,
  getSharedFarmLocationState,
  setSharedFarmLocationState,
  type PlannerGoalId,
  type StrategyId,
  type TradeOffDimensionKey,
  type VerifiedFarmLocation,
} from '../../data/decisionPlannerData';
import {
  CURRENT_CROP_OPTIONS,
  GLOBAL_QUICK_LOCATIONS,
  IRRIGATION_OPTIONS,
  REAL_FARM_HISTORICAL_WINDOWS,
  evaluateFarmCandidates,
  generateDynamicRotationStrategies,
  getMaxHistoricalDateIso,
  getSavedMyFarmProfile,
  parseOptionalSoilPh,
  resetMyFarmProfileAndLocation,
  resolveActiveHistoricalWindow,
  saveMyFarmProfile,
  validateHistoricalDateRange,
  type CurrentCropKey,
  type ExperienceMode,
  type HistoricalWindowId,
  type IrrigationAvailability,
  type MyFarmProfile,
} from '../../services/realFarmEngine';

interface DecisionPlannerProps {
  activeField?: string | null;
}

const GOAL_ICON_MAP: Record<PlannerGoalId, React.FC<{ className?: string }>> = {
  'earn-more': TrendingUp,
  'lower-risk': ShieldCheck,
  'more-crops': Layers,
};

const DIMENSION_ICON_MAP: Record<TradeOffDimensionKey, React.FC<{ className?: string }>> = {
  profitPotential: TrendingUp,
  waterResilience: Droplets,
  soilImprovement: Sprout,
  cropDiversity: GitBranch,
  managementComplexity: Sliders,
};

interface MiniClimateSparklineProps {
  points: NasaDailyObservationPoint[];
  mode: 'line' | 'bar';
  strokeColor: string;
  fillColor: string;
  unit: string;
}

const MiniClimateSparkline: React.FC<MiniClimateSparklineProps> = ({
  points,
  mode,
  strokeColor,
  fillColor,
  unit,
}) => {
  const validPoints = points.filter((p) => !p.isMissing && p.value !== null);
  if (validPoints.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-400">
        No valid daily observations in selected window
      </div>
    );
  }

  const values = validPoints.map((p) => p.value as number);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;
  const width = 260;
  const height = 56;
  const padX = 8;
  const padY = 8;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-14 overflow-visible"
        role="img"
        aria-label={`NASA POWER daily ${unit} trend`}
      >
        {mode === 'bar' ? (
          points.map((pt, idx) => {
            const barWidth = Math.max(2, plotW / Math.max(points.length * 1.4, 1));
            const x =
              padX +
              (points.length === 1 ? plotW / 2 : (idx / (points.length - 1)) * (plotW - barWidth));
            if (pt.isMissing || pt.value === null) {
              return (
                <line
                  key={pt.rawDate}
                  x1={x}
                  y1={padY}
                  x2={x}
                  y2={height - padY}
                  stroke="#fca5a5"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                />
              );
            }
            const normalized = maxVal === 0 ? 0 : pt.value / maxVal;
            const barH = Math.max(2, normalized * plotH);
            const y = height - padY - barH;
            return (
              <rect
                key={pt.rawDate}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={1.5}
                fill={strokeColor}
                opacity={0.85}
              >
                <title>{`${pt.isoDate}: ${pt.value.toFixed(2)} ${unit}`}</title>
              </rect>
            );
          })
        ) : (
          <>
            {(() => {
              const segments: Array<Array<{ x: number; y: number; pt: NasaDailyObservationPoint }>> =
                [];
              let currentSeg: Array<{ x: number; y: number; pt: NasaDailyObservationPoint }> = [];
              points.forEach((pt, idx) => {
                const x =
                  padX + (points.length === 1 ? plotW / 2 : (idx / (points.length - 1)) * plotW);
                if (pt.isMissing || pt.value === null) {
                  if (currentSeg.length > 0) {
                    segments.push(currentSeg);
                    currentSeg = [];
                  }
                  return;
                }
                const y = padY + plotH - ((pt.value - minVal) / span) * plotH;
                currentSeg.push({ x, y, pt });
              });
              if (currentSeg.length > 0) segments.push(currentSeg);

              return segments.map((seg, sIdx) => {
                const polyPoints = seg.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
                return (
                  <g key={sIdx}>
                    <polyline
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polyPoints}
                    />
                    {seg.map((c) => (
                      <circle
                        key={c.pt.rawDate}
                        cx={c.x}
                        cy={c.y}
                        r={2.5}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={1.5}
                      >
                        <title>{`${c.pt.isoDate}: ${(c.pt.value as number).toFixed(
                          2
                        )} ${unit}`}</title>
                      </circle>
                    ))}
                  </g>
                );
              });
            })()}
          </>
        )}
      </svg>
    </div>
  );
};

const DecisionPlanner: React.FC<DecisionPlannerProps> = ({ activeField }) => {
  // 0. Experience Mode & My Farm Profile (persisted in localStorage)
  const [farmProfile, setFarmProfile] = useState<MyFarmProfile>(() => getSavedMyFarmProfile());
  const [soilPhError, setSoilPhError] = useState<string | null>(null);
  const [customStartInput, setCustomStartInput] = useState<string>(
    () => getSavedMyFarmProfile().customStartDate
  );
  const [customEndInput, setCustomEndInput] = useState<string>(
    () => getSavedMyFarmProfile().customEndDate
  );
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [expandedStrategyIds, setExpandedStrategyIds] = useState<Record<StrategyId, boolean>>({
    baseline: false,
    'strategy-a': true,
    'strategy-b': false,
    'strategy-c': false,
  });

  const updateProfile = (patch: Partial<MyFarmProfile>) => {
    setFarmProfile((prev) => {
      const next: MyFarmProfile = { ...prev, ...patch };
      saveMyFarmProfile(next);
      return next;
    });
  };

  // 1. Field selection state for Explore Demo mode (respects activeField from Dashboard)
  const [selectedFieldId, setSelectedFieldId] = useState<FieldId>(() =>
    isFieldId(activeField) ? activeField : FIELD_IDS[0]
  );

  useEffect(() => {
    if (isFieldId(activeField)) {
      setSelectedFieldId(activeField);
    }
  }, [activeField]);

  // 2. Goal selection state (synced with farmProfile.primaryGoal)
  const selectedGoal = farmProfile.primaryGoal;
  const handleSelectGoal = (goalId: PlannerGoalId) => {
    updateProfile({ primaryGoal: goalId });
  };

  // 3. Global Farm Location & NASA POWER state
  const initialSharedLoc = getSharedFarmLocationState();
  const [verifiedLocation, setVerifiedLocation] = useState<VerifiedFarmLocation | null>(
    initialSharedLoc.verifiedLocation
  );
  const [latInput, setLatInput] = useState<string>(initialSharedLoc.draftLatInput);
  const [lonInput, setLonInput] = useState<string>(initialSharedLoc.draftLonInput);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [geoStatusMessage, setGeoStatusMessage] = useState<{
    type: 'info' | 'warning' | 'success';
    text: string;
  } | null>(null);
  const [isLocatingDevice, setIsLocatingDevice] = useState<boolean>(false);

  // NASA POWER Historical Window & Fetch lifecycle (uses farmProfile.historicalWindow)
  const nasaWindow = farmProfile.historicalWindow;
  const setNasaWindow = (wKey: HistoricalWindowId) => {
    setCustomDateError(null);
    updateProfile({ historicalWindow: wKey });
  };

  const handleApplyCustomDates = () => {
    const check = validateHistoricalDateRange(customStartInput, customEndInput);
    if (!check.valid) {
      setCustomDateError(check.error);
      return;
    }
    setCustomDateError(null);
    updateProfile({
      historicalWindow: 'custom',
      customStartDate: check.startIso,
      customEndDate: check.endIso,
    });
  };

  const activeWindowMeta = React.useMemo(
    () => resolveActiveHistoricalWindow(farmProfile),
    [farmProfile]
  );

  const [nasaStatus, setNasaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() =>
    initialSharedLoc.verifiedLocation ? 'loading' : 'idle'
  );
  const [nasaError, setNasaError] = useState<string | null>(null);
  const [nasaResult, setNasaResult] = useState<NasaPowerDailyResult | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);

  // Fetch real NASA POWER climate data ONLY when verifiedLocation is non-null
  useEffect(() => {
    if (!verifiedLocation) {
      setNasaStatus('idle');
      setNasaResult(null);
      setNasaError(null);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();

    // Immediately invalidate previous coordinate NASA results before fetching new ones
    setNasaResult(null);
    setNasaStatus('loading');
    setNasaError(null);

    fetchNasaPowerDaily({
      latitude: verifiedLocation.latitude,
      longitude: verifiedLocation.longitude,
      startDate: activeWindowMeta.startDate,
      endDate: activeWindowMeta.endDate,
      signal: controller.signal,
    })
      .then((res) => {
        if (!isCurrent) return;
        setNasaResult(res);
        setNasaStatus('success');
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setNasaError(
          err instanceof Error
            ? err.message
            : 'Unable to retrieve NASA POWER historical climate data.'
        );
        setNasaStatus('error');
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [verifiedLocation, activeWindowMeta.startDate, activeWindowMeta.endDate, retryToken]);

  // Handlers for Global Location (Browser Geolocation, Manual Entry, Quick Presets, Clear)
  const handleUseBrowserGeolocation = () => {
    setCoordError(null);

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatusMessage({
        type: 'warning',
        text: 'Browser Geolocation API is not supported in this environment. Please enter latitude and longitude manually below.',
      });
      return;
    }

    setIsLocatingDevice(true);
    setGeoStatusMessage({
      type: 'info',
      text: 'Requesting approximate device coordinates from browser... (You may deny permission and use manual entry at any time.)',
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingDevice(false);
        const rawLat = position.coords.latitude;
        const rawLon = position.coords.longitude;
        const check = validateCoordinates(rawLat, rawLon);
        if (!check.valid) {
          setCoordError(check.error);
          return;
        }
        const formattedLat = String(check.latitude);
        const formattedLon = String(check.longitude);
        const nextLoc: VerifiedFarmLocation = {
          latitude: check.latitude,
          longitude: check.longitude,
          label: `Browser Device Coordinates (${check.latitude}°, ${check.longitude}° — Editable)`,
          source: 'browser-geolocation',
          updatedAtIso: new Date().toISOString(),
        };
        setLatInput(formattedLat);
        setLonInput(formattedLon);
        setVerifiedLocation(nextLoc);
        setSharedFarmLocationState({ verifiedLocation: nextLoc });
        setGeoStatusMessage({
          type: 'success',
          text: `Device coordinates populated (${check.latitude}°, ${check.longitude}°). Note: Device location is an approximate reference, not automatically your exact field boundary. You may adjust the numbers below at any time.`,
        });
      },
      (err) => {
        setIsLocatingDevice(false);
        const reason =
          err.code === 1
            ? 'Location permission was denied.'
            : err.code === 2
            ? 'Device position is unavailable.'
            : 'Location request timed out.';
        setGeoStatusMessage({
          type: 'warning',
          text: `${reason} Manual coordinate entry and public NASA test locations remain fully available below.`,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  };

  const handleApplyManualCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    setGeoStatusMessage(null);
    const check = validateCoordinates(latInput, lonInput);
    if (!check.valid) {
      setCoordError(check.error);
      return;
    }
    setCoordError(null);
    const nextLoc: VerifiedFarmLocation = {
      latitude: check.latitude,
      longitude: check.longitude,
      label: `Manual Farm Coordinates (${check.latitude}°, ${check.longitude}°)`,
      source: 'manual-input',
      updatedAtIso: new Date().toISOString(),
    };
    setLatInput(String(check.latitude));
    setLonInput(String(check.longitude));
    setVerifiedLocation(nextLoc);
    setSharedFarmLocationState({ verifiedLocation: nextLoc });
  };

  const handleSelectPublicTestPreset = (presetId: string) => {
    const preset = NASA_PUBLIC_TEST_LOCATIONS.find((p) => p.id === presetId);
    if (!preset) return;
    setCoordError(null);
    setGeoStatusMessage({
      type: 'info',
      text: `Loaded ${preset.label}. ${preset.note}`,
    });
    const nextLoc: VerifiedFarmLocation = {
      latitude: preset.latitude,
      longitude: preset.longitude,
      label: preset.label,
      source: 'public-test-preset',
      updatedAtIso: new Date().toISOString(),
    };
    setLatInput(String(preset.latitude));
    setLonInput(String(preset.longitude));
    setVerifiedLocation(nextLoc);
    setSharedFarmLocationState({ verifiedLocation: nextLoc });
  };

  const handleSelectQuickLocation = (locId: string) => {
    const loc = GLOBAL_QUICK_LOCATIONS.find((l) => l.id === locId);
    if (!loc) return;
    setCoordError(null);
    setGeoStatusMessage({
      type: 'info',
      text: `Loaded ${loc.label} (${loc.climateHint}).`,
    });
    const nextLoc: VerifiedFarmLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      label: `${loc.label} — ${loc.climateHint}`,
      source: 'public-test-preset',
      updatedAtIso: new Date().toISOString(),
    };
    setLatInput(String(loc.latitude));
    setLonInput(String(loc.longitude));
    setVerifiedLocation(nextLoc);
    setSharedFarmLocationState({ verifiedLocation: nextLoc });
  };

  const handleClearVerifiedLocation = () => {
    setVerifiedLocation(null);
    setLatInput('');
    setLonInput('');
    setSharedFarmLocationState({ verifiedLocation: null });
    setCoordError(null);
    setGeoStatusMessage({
      type: 'info',
      text: 'Cleared verified coordinates. Returned to unverified location state (NASA climate data hidden until coordinates are specified).',
    });
  };

  const handleSoilPhChange = (raw: string) => {
    const check = parseOptionalSoilPh(raw);
    if (!check.valid) {
      setSoilPhError(check.error);
      setFarmProfile((prev) => ({ ...prev, soilPhInput: raw }));
      return;
    }
    setSoilPhError(null);
    updateProfile({
      soilPhInput: raw,
      soilPh: check.value,
    });
  };

  const handleResetAllMyFarm = () => {
    const defaults = resetMyFarmProfileAndLocation();
    setFarmProfile(defaults);
    setSoilPhError(null);
    setVerifiedLocation(null);
    setLatInput('');
    setLonInput('');
    setCoordError(null);
    setNasaResult(null);
    setNasaStatus('idle');
    setGeoStatusMessage({
      type: 'info',
      text: 'Reset My Farm profile and cleared saved coordinates.',
    });
  };

  const toggleStrategyExpand = (id: StrategyId) => {
    setExpandedStrategyIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Current field rotation bundle & goal metadata
  const currentPlan = getFieldRotationPlan(selectedFieldId);
  const currentGoalMeta =
    PLANNER_GOALS.find((g) => g.id === selectedGoal) ?? PLANNER_GOALS[0];

  // Dynamic Real Farm Evaluation & Rotation Strategies when in My Farm mode
  const realFarmEvaluation = React.useMemo(
    () =>
      evaluateFarmCandidates(
        farmProfile,
        verifiedLocation,
        nasaStatus === 'success' ? nasaResult : null
      ),
    [farmProfile, verifiedLocation, nasaStatus, nasaResult]
  );

  const dynamicStrategies = React.useMemo(
    () => generateDynamicRotationStrategies(farmProfile, realFarmEvaluation),
    [farmProfile, realFarmEvaluation]
  );

  const isMyFarm = farmProfile.experienceMode === 'my-farm';

  // Derived climate statistics when NASA POWER data is genuinely retrieved
  const climateSummary = React.useMemo(() => {
    if (!nasaResult) return null;
    const t2mSeries = nasaResult.series.T2M;
    const precSeries = nasaResult.series.PRECTOTCORR;

    const validT2m = t2mSeries.points
      .filter((p) => !p.isMissing && p.value !== null)
      .map((p) => p.value as number);
    const validPrec = precSeries.points
      .filter((p) => !p.isMissing && p.value !== null)
      .map((p) => p.value as number);

    const t2mMean =
      validT2m.length > 0
        ? validT2m.reduce((acc, v) => acc + v, 0) / validT2m.length
        : null;
    const t2mMin = validT2m.length > 0 ? Math.min(...validT2m) : null;
    const t2mMax = validT2m.length > 0 ? Math.max(...validT2m) : null;
    const t2mLatest = validT2m.length > 0 ? validT2m[validT2m.length - 1] : null;

    const precTotal =
      validPrec.length > 0 ? validPrec.reduce((acc, v) => acc + v, 0) : null;
    const precMean =
      validPrec.length > 0 && precTotal !== null ? precTotal / validPrec.length : null;
    const precMax = validPrec.length > 0 ? Math.max(...validPrec) : null;
    const rainyDays = validPrec.filter((v) => v >= 1.0).length;

    return {
      t2mSeries,
      precSeries,
      t2mMean,
      t2mMin,
      t2mMax,
      t2mLatest,
      precTotal,
      precMean,
      precMax,
      rainyDays,
    };
  }, [nasaResult]);

  // Dynamic banner text for My Farm vs Explore Demo
  const activeBannerRec = React.useMemo(() => {
    if (!isMyFarm) {
      return currentPlan.goalBannerRecommendations[selectedGoal];
    }
    const matchingDyn =
      dynamicStrategies.find((s) => s.alignedGoalId === selectedGoal) ??
      dynamicStrategies[1];
    return {
      headline: `${matchingDyn.title}: ${matchingDyn.subtitle}`,
      rationale: `${matchingDyn.whyConsidered} (${matchingDyn.supportStatusLabel})`,
      cautionNote:
        realFarmEvaluation.missingInputWarnings.length > 0
          ? realFarmEvaluation.missingInputWarnings.join(' ')
          : matchingDyn.limitationsAndRisks[0] ??
            'Requires local soil-lab and regional extension cultivar verification.',
    };
  }, [isMyFarm, currentPlan, selectedGoal, dynamicStrategies, realFarmEvaluation]);

  const activeContextLabel = isMyFarm
    ? `${farmProfile.farmName} (Current: ${realFarmEvaluation.currentCropMeta.label})`
    : `${currentPlan.fieldName} (${currentPlan.cropType})`;

  return (
    <main
      data-testid="decision-planner-page"
      className="flex-1 flex flex-col min-w-0 ml-3 mr-3 md:ml-5 md:mr-5 gap-5 relative h-full overflow-y-auto pr-1 custom-scrollbar"
    >
      {/* 1. Page Header, Experience Switch (My Farm vs Explore Demo), and Farm/Field Context */}
      <section className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-green-100 text-green-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-800">Decision Planner</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                  Field Shift • Multi-Season Rotation Lab
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                  Open Access • No Login Required
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                {isMyFarm
                  ? 'Dynamic, input-driven rotation strategy generator powered by your farm inputs and historical NASA POWER climate observations.'
                  : 'Explore the team’s three illustrative demo fields (North Field A1, East Field B2, South Field C3) and qualitative trade-off portfolios.'}
              </p>
            </div>
          </div>

          {/* Explicit Experience Mode Switch: My Farm vs Explore Demo */}
          <div
            data-testid="planner-experience-mode-switch"
            className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 self-start"
          >
            {(
              [
                {
                  id: 'my-farm' as ExperienceMode,
                  label: 'My Farm (Dynamic NASA Analysis)',
                },
                {
                  id: 'explore-demo' as ExperienceMode,
                  label: 'Explore Demo (3 Team Fields)',
                },
              ] as const
            ).map((tab) => {
              const active = farmProfile.experienceMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`planner-mode-btn-${tab.id}`}
                  onClick={() => updateProfile({ experienceMode: tab.id })}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-green-800 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode-Specific Context Control: My Farm Setup vs Explore Demo 3-Field Selector */}
        {isMyFarm ? (
          <div data-testid="planner-my-farm-setup" className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-green-800 uppercase tracking-wider">
                  My Farm Profile & Agronomic Inputs (Synced with Crop Recommendations)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-semibold">
                  Rule-Based Dynamic Strategies
                </span>
              </div>
              <button
                type="button"
                data-testid="planner-reset-my-farm-btn"
                onClick={handleResetAllMyFarm}
                className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Saved Farm Profile
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-green-50/40 p-4 rounded-2xl border border-green-100">
              {/* Farm Name */}
              <div>
                <label
                  htmlFor="planner-farm-name-input"
                  className="block text-[11px] font-semibold text-gray-700 mb-1"
                >
                  Farm Name
                </label>
                <input
                  id="planner-farm-name-input"
                  data-testid="planner-farm-name-input"
                  type="text"
                  value={farmProfile.farmName}
                  onChange={(e) => updateProfile({ farmName: e.target.value })}
                  placeholder="e.g. Riverbend Arable Farm"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                />
              </div>

              {/* Current Crop */}
              <div>
                <label
                  htmlFor="planner-current-crop-select"
                  className="block text-[11px] font-semibold text-gray-700 mb-1"
                >
                  Current Crop (Rotation Baseline)
                </label>
                <select
                  id="planner-current-crop-select"
                  data-testid="planner-current-crop-select"
                  value={farmProfile.currentCrop}
                  onChange={(e) =>
                    updateProfile({ currentCrop: e.target.value as CurrentCropKey })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                >
                  {CURRENT_CROP_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} [{c.family}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Soil pH */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label
                    htmlFor="planner-soil-ph-input"
                    className="text-[11px] font-semibold text-gray-700"
                  >
                    Soil pH (Optional)
                  </label>
                  <span
                    data-testid="planner-soil-ph-status"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      farmProfile.soilPh !== null
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {farmProfile.soilPh !== null
                      ? `pH ${farmProfile.soilPh.toFixed(1)}`
                      : 'Not provided'}
                  </span>
                </div>
                <input
                  id="planner-soil-ph-input"
                  data-testid="planner-soil-ph-input"
                  type="text"
                  inputMode="decimal"
                  value={farmProfile.soilPhInput}
                  onChange={(e) => handleSoilPhChange(e.target.value)}
                  placeholder="Leave blank if unknown (e.g. 6.4)"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                />
                {soilPhError && (
                  <p className="text-[10px] text-red-600 mt-1">{soilPhError}</p>
                )}
              </div>

              {/* Irrigation Availability */}
              <div>
                <label
                  htmlFor="planner-irrigation-select"
                  className="block text-[11px] font-semibold text-gray-700 mb-1"
                >
                  Irrigation Availability
                </label>
                <select
                  id="planner-irrigation-select"
                  data-testid="planner-irrigation-select"
                  value={farmProfile.irrigationAvailability}
                  onChange={(e) =>
                    updateProfile({
                      irrigationAvailability: e.target.value as IrrigationAvailability,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                >
                  {IRRIGATION_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Missing Input Impact & Confidence Notice */}
            {realFarmEvaluation.missingInputWarnings.length > 0 && (
              <div
                data-testid="planner-missing-input-warnings"
                className="mt-3 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold block">
                    Missing / Unverified Inputs Affect Strategy Confidence:
                  </span>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900">
                    {realFarmEvaluation.missingInputWarnings.map((w, idx) => (
                      <li key={idx}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Explore Demo Mode: 3 Team Fields Selector */
          <div className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Explore Demo: Active Monitored Field Context
                </span>
                <span className="text-[11px] text-gray-400">
                  (Team-provided Demo Snapshot • Click any field to switch crop rotation portfolio)
                </span>
              </div>
              <span className="text-[11px] text-gray-500 font-medium">
                Selected:{' '}
                <strong className="text-green-800">
                  {currentPlan.fieldName} ({currentPlan.cropType})
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {FIELD_IDS.map((fieldId) => {
                const field = cropwiseFields[fieldId];
                const plan = FIELD_ROTATION_PLANS[fieldId];
                const isSelected = selectedFieldId === fieldId;
                const overviewStatus = getFieldOverviewStatus(field.status);
                const badgeClass = getFieldBadgeClass(field.status);

                return (
                  <button
                    key={fieldId}
                    type="button"
                    data-testid={`planner-field-btn-${fieldId}`}
                    onClick={() => setSelectedFieldId(fieldId)}
                    aria-pressed={isSelected}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-green-700 bg-green-50/50 ring-2 ring-green-700/20 shadow-xs'
                        : 'border-gray-100 bg-gray-50/60 hover:bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${field.dotColor}`} />
                        <span className="font-semibold text-sm text-gray-800 truncate">
                          {field.name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${badgeClass}`}
                        title={`Equipment Status: ${field.status} (Overview Display: ${overviewStatus})`}
                      >
                        {overviewStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-gray-600 mb-2">
                      <span className="font-medium text-green-800">{field.type}</span>
                      <span className="text-[11px] text-gray-500">
                        {field.area} ha • Stage: {plan.tableGrowthStageSnapshot}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-gray-200/60 text-[10px] text-gray-500">
                      <div>
                        <span className="block text-gray-400">Score</span>
                        <span className="font-semibold text-gray-700">{field.score}/100</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Humidity</span>
                        <span className="font-semibold text-gray-700">{field.humidity}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Soil pH</span>
                        <span className="font-semibold text-gray-700">{field.ph}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Water</span>
                        <span className="font-semibold text-gray-700">{field.water}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Field Snapshot & Agronomic Alert Strip */}
            <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-950 leading-relaxed">
                  <p className="font-semibold">{currentPlan.fieldSnapshotSummary}</p>
                  <p className="text-amber-800 mt-0.5">{currentPlan.agronomicContextAlert}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-amber-200 text-[10px] font-semibold text-amber-900 flex-shrink-0 self-start md:self-center">
                Source: cropwiseFields.ts (Team Snapshot)
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 2. Global Farm Location & Real NASA POWER Climate Context (P0) */}
      <section
        data-testid="global-location-nasa-section"
        className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-800 flex items-center justify-center flex-shrink-0 border border-green-100">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-800">
                  Global Farm Location & Real NASA POWER Climate Context
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-semibold">
                  Worldwide Support • No Account Needed
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Specify coordinates via optional Browser Geolocation or manual entry (-90° to 90° Lat, -180° to 180° Lon) to query historical regional Temperature (<code className="text-green-800 font-semibold">T2M</code>) and Precipitation (<code className="text-green-800 font-semibold">PRECTOTCORR</code>) from NASA POWER.
              </p>
            </div>
          </div>

          {/* Historical Time Window Selector (supports 30d, season, summer-90d, spring-90d, 7d, custom) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            {(
              ['30d', 'season', 'summer-90d', 'spring-90d', '7d', 'custom'] as HistoricalWindowId[]
            ).map((wKey) => {
              const active = nasaWindow === wKey;
              const shortLabel =
                wKey === 'custom'
                  ? 'Custom Dates'
                  : REAL_FARM_HISTORICAL_WINDOWS[wKey].shortLabel;
              return (
                <button
                  key={wKey}
                  type="button"
                  data-testid={`nasa-window-btn-${wKey}`}
                  onClick={() => setNasaWindow(wKey)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-green-800 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Historical Start / End Date Bar */}
        <div
          data-testid="planner-custom-date-box"
          className="mb-4 p-3 rounded-2xl bg-gray-50/80 border border-gray-100 flex flex-wrap items-end justify-between gap-3"
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <div>
              <label
                htmlFor="planner-custom-start-date"
                className="block text-[10px] font-medium text-gray-500 mb-0.5"
              >
                Custom Start Date (YYYY-MM-DD)
              </label>
              <input
                id="planner-custom-start-date"
                data-testid="planner-custom-start-date"
                type="date"
                min="1981-01-01"
                max={getMaxHistoricalDateIso()}
                value={customStartInput}
                onChange={(e) => setCustomStartInput(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-800"
              />
            </div>
            <div>
              <label
                htmlFor="planner-custom-end-date"
                className="block text-[10px] font-medium text-gray-500 mb-0.5"
              >
                Custom End Date (YYYY-MM-DD)
              </label>
              <input
                id="planner-custom-end-date"
                data-testid="planner-custom-end-date"
                type="date"
                min="1981-01-01"
                max={getMaxHistoricalDateIso()}
                value={customEndInput}
                onChange={(e) => setCustomEndInput(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-800"
              />
            </div>
            <button
              type="button"
              data-testid="planner-apply-custom-dates-btn"
              onClick={handleApplyCustomDates}
              className="px-3 py-1.5 rounded-lg bg-green-800 hover:bg-green-700 text-white text-xs font-semibold cursor-pointer"
            >
              Apply Custom Window
            </button>
          </div>
          <div className="text-[11px] text-gray-600">
            Active Date Window:{' '}
            <strong className="text-green-800">
              {activeWindowMeta.startIso} to {activeWindowMeta.endIso} ({activeWindowMeta.daySpan}{' '}
              days)
            </strong>
          </div>
          {customDateError && (
            <div
              data-testid="planner-custom-date-error"
              role="alert"
              className="w-full text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{customDateError}</span>
            </div>
          )}
        </div>

        {/* Location Controls Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
          {/* Manual Coordinate Form */}
          <form
            onSubmit={handleApplyManualCoordinates}
            className="lg:col-span-7 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-green-700" />
                Manual Farm Coordinates (Editable Override)
              </span>
              <span className="text-[11px] text-gray-400">
                Valid range: Lat [-90, 90] • Lon [-180, 180]
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="planner-lat-input"
                  className="block text-[11px] font-medium text-gray-600 mb-1"
                >
                  Latitude (°N / °S)
                </label>
                <input
                  id="planner-lat-input"
                  data-testid="planner-lat-input"
                  type="text"
                  inputMode="decimal"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="e.g. 51.5074, 30.0444, or 2.9264"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                />
              </div>
              <div>
                <label
                  htmlFor="planner-lon-input"
                  className="block text-[11px] font-medium text-gray-600 mb-1"
                >
                  Longitude (°E / °W)
                </label>
                <input
                  id="planner-lon-input"
                  data-testid="planner-lon-input"
                  type="text"
                  inputMode="decimal"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  placeholder="e.g. -0.1278, 31.2357, or 101.6964"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                data-testid="planner-fetch-nasa-btn"
                className="px-3.5 py-2 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Compass className="w-3.5 h-3.5" />
                Verify Coordinates & Fetch NASA POWER
              </button>

              <button
                type="button"
                data-testid="planner-browser-geo-btn"
                onClick={handleUseBrowserGeolocation}
                disabled={isLocatingDevice}
                className="px-3 py-2 rounded-xl bg-white hover:bg-green-50 text-green-800 border border-green-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                <Navigation className="w-3.5 h-3.5" />
                {isLocatingDevice ? 'Locating...' : 'Use Device Location (Optional)'}
              </button>

              {verifiedLocation && (
                <button
                  type="button"
                  data-testid="planner-clear-coords-btn"
                  onClick={handleClearVerifiedLocation}
                  className="px-2.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Clear Coordinates
                </button>
              )}
            </div>

            {coordError && (
              <div
                data-testid="planner-coord-error"
                role="alert"
                className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{coordError}</span>
              </div>
            )}

            {geoStatusMessage && (
              <div
                data-testid="planner-geo-status"
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                  geoStatusMessage.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : geoStatusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{geoStatusMessage.text}</span>
              </div>
            )}
          </form>

          {/* Global Climate Verification Presets & Public Test Coordinates */}
          <div className="lg:col-span-5 flex flex-col gap-2.5 border-t lg:border-t-0 lg:border-l border-gray-200/80 pt-3 lg:pt-0 lg:pl-4">
            <span className="text-xs font-semibold text-gray-700">
              Global Climate Presets (London, Cairo, Putrajaya & Regional Benchmarks)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {GLOBAL_QUICK_LOCATIONS.map((loc) => {
                const isSelected =
                  verifiedLocation &&
                  Math.abs(verifiedLocation.latitude - loc.latitude) < 0.001 &&
                  Math.abs(verifiedLocation.longitude - loc.longitude) < 0.001;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    data-testid={`planner-quick-loc-${loc.id}`}
                    onClick={() => handleSelectQuickLocation(loc.id)}
                    className={`text-left p-2 rounded-xl border text-[11px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-green-50 border-green-700 text-green-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                    }`}
                  >
                    <span className="block truncate font-semibold">{loc.label}</span>
                    <span className="block text-[10px] text-gray-500 font-mono">
                      {loc.latitude}°, {loc.longitude}°
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              {NASA_PUBLIC_TEST_LOCATIONS.map((preset) => {
                const isSelectedPreset =
                  verifiedLocation &&
                  verifiedLocation.latitude === preset.latitude &&
                  verifiedLocation.longitude === preset.longitude;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`planner-preset-${preset.id}`}
                    onClick={() => handleSelectPublicTestPreset(preset.id)}
                    className={`text-left px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelectedPreset
                        ? 'bg-green-50 border-green-600 text-green-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                    }`}
                  >
                    <span className="truncate">{preset.label}</span>
                    <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">
                      {preset.latitude}°, {preset.longitude}°
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* NASA POWER Climate Context Display Area */}
        <div className="mt-4">
          {nasaStatus === 'idle' && (
            <div
              data-testid="nasa-climate-unavailable"
              className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <FileWarning className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-semibold text-gray-700">
                    NASA POWER Regional Climate Data Not Yet Loaded (No Verified Coordinates Set)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Enter farm coordinates above, use optional Browser Geolocation, or select a global location preset to fetch real historical NASA POWER <code className="text-gray-700">T2M</code> and <code className="text-gray-700">PRECTOTCORR</code> data.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-gray-200/80 text-gray-700 text-[11px] font-semibold flex-shrink-0 self-start md:self-center">
                {isMyFarm ? 'Awaiting Farm Coordinates' : 'Illustrative Strategy Mode Active'}
              </span>
            </div>
          )}

          {nasaStatus === 'loading' && (
            <div
              data-testid="nasa-climate-loading"
              className="p-5 rounded-2xl bg-green-50/40 border border-green-100 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-green-700 animate-spin flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-semibold text-gray-800">
                    Querying NASA POWER Daily API (T2M & PRECTOTCORR)...
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Coordinates: {verifiedLocation?.latitude}°, {verifiedLocation?.longitude}° • Window:{' '}
                    {activeWindowMeta.startIso} to {activeWindowMeta.endIso}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-green-800">Live Request</span>
            </div>
          )}

          {nasaStatus === 'error' && (
            <div
              data-testid="nasa-climate-error"
              className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-semibold text-red-900">
                    NASA POWER Climate Request Failed — Rotation Comparison Remains Active
                  </h3>
                  <p className="text-xs text-red-700 mt-0.5">{nasaError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRetryToken((c) => c + 1)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-100 text-red-800 border border-red-200 text-xs font-semibold cursor-pointer flex-shrink-0 self-start sm:self-center"
              >
                Retry NASA Fetch
              </button>
            </div>
          )}

          {nasaStatus === 'success' && nasaResult && climateSummary && (
            <div
              data-testid="nasa-climate-loaded"
              className="p-4 rounded-2xl bg-green-50/40 border border-green-200/80 flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-green-200/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-green-800 text-white text-[11px] font-semibold">
                    {nasaResult.dataAuthenticity}
                  </span>
                  <span className="text-xs font-semibold text-gray-800">
                    {verifiedLocation?.label}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    • {activeWindowMeta.startIso} to {activeWindowMeta.endIso} ({activeWindowMeta.daySpan} days)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                  <span>
                    API: <strong>{nasaResult.apiVersion}</strong> ({nasaResult.sources.join(', ') || 'MERRA2'})
                  </span>
                  <span>•</span>
                  <span>
                    Grid: <strong>{nasaResult.spatialResolution}</strong>
                  </span>
                </div>
              </div>

              {/* T2M and PRECTOTCORR Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-2xs flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Sun className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">
                           Historical Temperature (T2M)
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          {climateSummary.t2mSeries.longname} ({climateSummary.t2mSeries.displayUnit})
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                      {climateSummary.t2mSeries.validCount} Valid • {climateSummary.t2mSeries.missingCount} Missing
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-gray-50/80 p-2.5 rounded-xl">
                    <div>
                      <span className="block text-[10px] text-gray-400">Period Mean</span>
                      <span data-testid="nasa-t2m-mean" className="font-semibold text-gray-800">
                        {climateSummary.t2mMean !== null
                          ? `${climateSummary.t2mMean.toFixed(2)}°C`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">Min / Max</span>
                      <span className="font-semibold text-gray-800">
                        {climateSummary.t2mMin !== null && climateSummary.t2mMax !== null
                          ? `${climateSummary.t2mMin.toFixed(1)}° / ${climateSummary.t2mMax.toFixed(1)}°C`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">Latest Daily</span>
                      <span className="font-semibold text-green-800">
                        {climateSummary.t2mLatest !== null
                          ? `${climateSummary.t2mLatest.toFixed(2)}°C`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <MiniClimateSparkline
                    points={climateSummary.t2mSeries.points}
                    mode="line"
                    strokeColor="#d97706"
                    fillColor="#fef3c7"
                    unit={climateSummary.t2mSeries.displayUnit}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-2xs flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CloudRain className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">
                          Historical Precipitation (PRECTOTCORR)
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          {climateSummary.precSeries.longname} ({climateSummary.precSeries.displayUnit})
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                      {climateSummary.precSeries.validCount} Valid • {climateSummary.precSeries.missingCount} Missing
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-gray-50/80 p-2.5 rounded-xl">
                    <div>
                      <span className="block text-[10px] text-gray-400">Window Total</span>
                      <span data-testid="nasa-prec-total" className="font-semibold text-gray-800">
                        {climateSummary.precTotal !== null
                          ? `${climateSummary.precTotal.toFixed(2)} mm`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">Daily Mean / Peak</span>
                      <span className="font-semibold text-gray-800">
                        {climateSummary.precMean !== null && climateSummary.precMax !== null
                          ? `${climateSummary.precMean.toFixed(1)} / ${climateSummary.precMax.toFixed(1)} mm`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400">Rainy Days (≥1mm)</span>
                      <span className="font-semibold text-blue-700">
                        {climateSummary.rainyDays} / {climateSummary.precSeries.validCount} days
                      </span>
                    </div>
                  </div>

                  <MiniClimateSparkline
                    points={climateSummary.precSeries.points}
                    mode="bar"
                    strokeColor="#2563eb"
                    fillColor="#dbeafe"
                    unit={climateSummary.precSeries.displayUnit}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/90 border border-green-200 text-[11px] text-gray-600 flex items-start gap-2">
                <Info className="w-4 h-4 text-green-800 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-gray-800">Scientific Scope & Provenance Notice:</strong>{' '}
                  NASA POWER provides historical regional climate assimilation data ({nasaResult.spatialResolution}, fill_value: {nasaResult.fillValue}) — not a real-time weather forecast.{' '}
                  <strong>
                    NASA POWER does not directly calculate farm profit, crop yield, or prescribe the single optimal crop rotation.
                  </strong>{' '}
                  {realFarmEvaluation.shortWindowScopeDisclaimer}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Interactive Goal Selector & Dynamic Recommendation Banner */}
      <section className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              1. Select Primary Planning Goal
            </h2>
            <p className="text-xs text-gray-500">
              Switching goals highlights the matching rotation strategy, updates the recommendation rationale, and shifts visual emphasis in the Trade-off Matrix while keeping all four strategies visible.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-800 text-xs font-semibold border border-green-200">
            Active Goal: {currentGoalMeta.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {PLANNER_GOALS.map((goal) => {
            const Icon = GOAL_ICON_MAP[goal.id];
            const isSelected = selectedGoal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                data-testid={`planner-goal-btn-${goal.id}`}
                onClick={() => handleSelectGoal(goal.id)}
                aria-pressed={isSelected}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-green-800 bg-green-800 text-white shadow-sm'
                    : 'border-gray-100 bg-gray-50/70 hover:bg-white hover:border-green-300 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-white/15 text-white'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold block">{goal.label}</span>
                      <span
                        className={`text-[11px] ${
                          isSelected ? 'text-green-100' : 'text-green-700 font-medium'
                        }`}
                      >
                        Matches: {goal.matchingStrategyTitle}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full bg-white text-green-900 text-[10px] font-bold">
                      Selected
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs leading-relaxed ${
                    isSelected ? 'text-green-50' : 'text-gray-500'
                  }`}
                >
                  {goal.tagline}
                </p>
              </button>
            );
          })}
        </div>

        {/* Dynamic Explanatory Recommendation Focal Banner */}
        <div
          data-testid="planner-recommendation-banner"
          className="rounded-2xl bg-gradient-to-br from-[#143326] via-[#1b4332] to-[#0f291e] text-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Goal-Aligned Strategy Focus • {activeContextLabel}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-200 text-[11px] font-semibold">
              {isMyFarm && !realFarmEvaluation.hasViableCandidates
                ? `Not Supported Under Current Constraints (${activeWindowMeta.startIso} to ${activeWindowMeta.endIso})`
                : `Highlighted: ${currentGoalMeta.matchingStrategyTitle}`}
            </span>
          </div>

          <h3
            data-testid="planner-banner-headline"
            className="text-sm md:text-base font-semibold text-white mt-3"
          >
            {activeBannerRec.headline}
          </h3>
          <p
            data-testid="planner-banner-rationale"
            className="text-xs md:text-sm text-gray-200 mt-1.5 leading-relaxed"
          >
            {activeBannerRec.rationale}
          </p>

          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-200">
            <span>
              <strong>Key Caution:</strong> {activeBannerRec.cautionNote}
            </span>
            <span className="text-[11px] text-white/80 flex-shrink-0">
              Matrix Priority:{' '}
              {currentGoalMeta.emphasizedDimensions
                .map(
                  (dKey) =>
                    TRADE_OFF_DIMENSIONS.find((d) => d.key === dKey)?.label ?? dKey
                )
                .join(' + ')}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Rotation Strategy Comparison — Dynamic in My Farm Mode, Demo Portfolio in Explore Demo Mode */}
      <section className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              2. Multi-Season Rotation Strategy Comparison ({activeContextLabel})
            </h2>
            <p className="text-xs text-gray-500">
              {isMyFarm
                ? `Generated dynamically from candidate crops evaluated against your NASA climate window (${activeWindowMeta.startIso} to ${activeWindowMeta.endIso}), current crop, soil pH, and irrigation setting.`
                : 'Illustrative rotation strategies for the selected team demo field.'}{' '}
              The strategy aligned with <strong className="text-green-800">{currentGoalMeta.label}</strong> is highlighted.
            </p>
          </div>
          <span className="text-[11px] text-gray-400">
            Showing 4 of 4 strategies • Local agronomic verification required
          </span>
        </div>

        {isMyFarm && !realFarmEvaluation.hasViableCandidates && (
          <div
            data-testid="planner-no-viable-strategies-banner"
            className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-950 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-700 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-950">
                No Viable Break Crops Under Current Constraints — Strategies A, B &amp; C Are Marked Not Supported
              </h3>
              <p className="mt-1 text-red-900 leading-relaxed">
                {realFarmEvaluation.allCandidatesUnsuitableReason}
              </p>
              <p className="mt-1 text-red-800">
                The 4-strategy comparison structure is preserved below, but CropWise does not recommend unsupported rotations. Adjust irrigation availability, soil pH, or the historical date window above to explore viable sequences.
              </p>
            </div>
          </div>
        )}

        {isMyFarm ? (
          /* Dynamic My Farm Strategies with Progressive Disclosure */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dynamicStrategies.map((strategy) => {
              const isGoalMatch = strategy.alignedGoalId === selectedGoal;
              const isExpanded = Boolean(expandedStrategyIds[strategy.id]);
              const isUnsupported =
                strategy.supportStatusLabel ===
                'Not Supported — No Viable Candidate Crops for Current Constraints';
              return (
                <article
                  key={strategy.id}
                  data-testid={`strategy-card-${strategy.id}`}
                  data-highlighted={isGoalMatch ? 'true' : 'false'}
                  className={`rounded-3xl p-5 border transition-all flex flex-col justify-between gap-3.5 ${
                    isUnsupported
                      ? 'border-red-300 bg-red-50/20'
                      : isGoalMatch
                      ? 'border-green-700 bg-green-50/30 ring-2 ring-green-700/25 shadow-md'
                      : strategy.id === 'baseline'
                      ? 'border-gray-200 bg-gray-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isUnsupported
                                ? 'bg-red-800 text-white'
                                : isGoalMatch
                                ? 'bg-green-800 text-white'
                                : strategy.id === 'baseline'
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {strategy.codeLabel}
                          </span>
                          <span
                            data-testid={`strategy-support-badge-${strategy.id}`}
                            className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${
                              isUnsupported
                                ? 'bg-red-100 border-red-300 text-red-900'
                                : strategy.isSupported
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            {strategy.supportStatusLabel}
                          </span>
                          {isGoalMatch && !isUnsupported && (
                            <span
                              data-testid={`strategy-match-badge-${strategy.id}`}
                              className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              Highlighted for {currentGoalMeta.label}
                            </span>
                          )}
                          {isGoalMatch && isUnsupported && (
                            <span
                              data-testid={`strategy-match-badge-${strategy.id}`}
                              className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300 text-[10px] font-bold flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 text-red-700" />
                              Goal Slot ({currentGoalMeta.label}) — Not Supported
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-gray-800 mt-1.5">
                          {strategy.title}
                        </h3>
                        <p
                          className={`text-xs font-medium mt-0.5 ${
                            isUnsupported ? 'text-red-800' : 'text-gray-600'
                          }`}
                        >
                          {strategy.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Rotation Sequence Steps */}
                    <div className="p-3.5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                        Rotation Sequence
                      </span>
                      <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        {strategy.steps.map((step, idx) => (
                          <React.Fragment key={`${strategy.id}-dyn-step-${idx}`}>
                            <div
                              className={`flex-1 p-2.5 rounded-xl border text-xs flex flex-col justify-between ${
                                step.isUnverified
                                  ? 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
                                  : 'border-green-200 bg-green-50/40 text-gray-800'
                              }`}
                            >
                              <div>
                                <span className="text-[10px] font-semibold text-green-800 block">
                                  {step.phaseLabel}
                                </span>
                                <span className="font-semibold text-xs block mt-0.5 text-gray-800">
                                  {step.cropName}
                                </span>
                                <span className="text-[11px] text-gray-600 block mt-0.5">
                                  {step.roleLabel}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 mt-1.5 pt-1 border-t border-gray-200/60 block">
                                {step.note}
                              </span>
                            </div>
                            {idx < strategy.steps.length - 1 && (
                              <div className="flex items-center justify-center text-gray-400 py-0.5 sm:py-0">
                                <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0 flex-shrink-0" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Why This Rotation Is Considered */}
                    <div
                      className={`p-3 rounded-2xl border text-xs ${
                        isGoalMatch
                          ? 'bg-green-100/70 border-green-300 text-green-950'
                          : 'bg-gray-50 border-gray-200/80 text-gray-700'
                      }`}
                    >
                      <span className="font-semibold block mb-0.5">
                        Why This Rotation Is Considered:
                      </span>
                      <p className="leading-relaxed">{strategy.whyConsidered}</p>
                    </div>

                    {/* Expected Benefits & Key Limitations (Always concise) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                        <span className="font-semibold text-emerald-900 block mb-1">
                          Expected Agronomic Benefits
                        </span>
                        <ul className="space-y-1 text-gray-700">
                          {strategy.expectedBenefits.map((b, i) => (
                            <li key={i} className="leading-snug">
                              • {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-2xl bg-red-50/50 border border-red-100">
                        <span className="font-semibold text-red-900 block mb-1">
                          Key Limitations & Risks
                        </span>
                        <ul className="space-y-1 text-gray-700">
                          {strategy.limitationsAndRisks.map((r, i) => (
                            <li key={i} className="leading-snug">
                              • {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Progressive Disclosure Toggle for Missing Evidence & Uncertainty */}
                    <div>
                      <button
                        type="button"
                        data-testid={`strategy-expand-btn-${strategy.id}`}
                        onClick={() => toggleStrategyExpand(strategy.id)}
                        className="w-full px-3 py-2 rounded-xl bg-gray-100/80 hover:bg-gray-200/70 text-gray-700 text-xs font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>
                          {isExpanded
                            ? 'Hide Uncertainty & Evidence Gaps'
                            : 'Show Uncertainty & Missing Information Gaps'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-2xl bg-amber-50/50 border border-amber-200/70 text-[11px] text-amber-950">
                          <span className="font-semibold block mb-1">
                            Uncertainty & Missing Information Gaps:
                          </span>
                          <ul className="space-y-1">
                            {strategy.missingEvidenceGaps.map((gap, i) => (
                              <li key={i}>• {gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Explore Demo Mode: Original 4 Field Strategies */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {currentPlan.strategies.map((strategy) => {
              const isGoalMatch = strategy.alignedGoalId === selectedGoal;
              return (
                <article
                  key={strategy.id}
                  data-testid={`strategy-card-${strategy.id}`}
                  data-highlighted={isGoalMatch ? 'true' : 'false'}
                  className={`rounded-3xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                    isGoalMatch
                      ? 'border-green-700 bg-green-50/30 ring-2 ring-green-700/25 shadow-md'
                      : strategy.isBaseline
                      ? 'border-gray-200 bg-gray-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col gap-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isGoalMatch
                                ? 'bg-green-800 text-white'
                                : strategy.isBaseline
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {strategy.codeLabel}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[10px] font-medium">
                            {strategy.authenticityTag}
                          </span>
                          {isGoalMatch && (
                            <span
                              data-testid={`strategy-match-badge-${strategy.id}`}
                              className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              Highlighted for {currentGoalMeta.label}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-gray-800 mt-1.5">
                          {strategy.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">{strategy.subtitle}</p>
                      </div>
                    </div>

                    {strategy.baselineVerificationBanner && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <span>{strategy.baselineVerificationBanner}</span>
                      </div>
                    )}

                    <div className="p-3.5 rounded-2xl bg-white border border-gray-100 shadow-2xs">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2.5">
                        Rotation Sequence Visualization
                      </span>
                      <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        {strategy.sequenceSteps.map((step, idx) => (
                          <React.Fragment key={`${strategy.id}-step-${idx}`}>
                            <div
                              className={`flex-1 p-2.5 rounded-xl border text-xs flex flex-col justify-between ${
                                step.isUnverifiedHistory
                                  ? 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
                                  : 'border-green-200 bg-green-50/40 text-gray-800'
                              }`}
                            >
                              <div>
                                <span className="text-[10px] font-semibold text-green-800 block">
                                  {step.phaseLabel} • {step.seasonWindow}
                                </span>
                                <span className="font-semibold text-xs block mt-0.5 text-gray-800">
                                  {step.cropName}
                                </span>
                                <span className="text-[11px] text-gray-600 block mt-0.5">
                                  {step.functionalRole}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 mt-1.5 pt-1 border-t border-gray-200/60 block">
                                {step.verificationNote}
                              </span>
                            </div>
                            {idx < strategy.sequenceSteps.length - 1 && (
                              <div className="flex items-center justify-center text-gray-400 py-0.5 sm:py-0">
                                <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0 flex-shrink-0" />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border text-xs ${
                        isGoalMatch
                          ? 'bg-green-100/70 border-green-300 text-green-950'
                          : 'bg-gray-50 border-gray-200/80 text-gray-700'
                      }`}
                    >
                      <span className="font-semibold block mb-0.5">
                        Recommendation Explanation (for {currentGoalMeta.label}):
                      </span>
                      <p className="leading-relaxed">
                        {strategy.recommendationExplanation[selectedGoal]}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                        <span className="font-semibold text-emerald-900 block mb-1.5">
                          Expected Benefits (Illustrative)
                        </span>
                        <ul className="space-y-1.5 text-gray-700">
                          {strategy.expectedBenefits.map((b, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 rounded-2xl bg-red-50/50 border border-red-100">
                        <span className="font-semibold text-red-900 block mb-1.5">
                          Potential Risks
                        </span>
                        <ul className="space-y-1.5 text-gray-700">
                          {strategy.potentialRisks.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Interactive Qualitative Trade-off Matrix */}
      <section
        data-testid="tradeoff-matrix-section"
        className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 mb-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800">
                3. Rotation Strategy Trade-off Matrix ({activeContextLabel})
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold">
                Qualitative Evaluations — No Fabricated Yield/Revenue Forecasts
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ratings use qualitative levels (<strong>High</strong>, <strong>Medium</strong>, <strong>Low</strong>). Note that{' '}
              <strong className="text-red-700">Management Complexity uses inverted desirability</strong>{' '}
              (Low complexity = positive/emerald; High complexity = negative/red).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Favorable (High benefit / Low complexity)
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Moderate (Medium)
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Challenging (Low benefit / High complexity)
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-2xl border border-gray-200">
          <table
            data-testid="tradeoff-matrix-table"
            className="w-full min-w-[720px] text-left border-collapse"
          >
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-700">
                <th className="p-3.5 font-semibold w-[220px]">
                  Evaluation Dimension
                </th>
                {(isMyFarm ? dynamicStrategies : currentPlan.strategies).map((strategy) => {
                  const isGoalMatch = strategy.alignedGoalId === selectedGoal;
                  return (
                    <th
                      key={strategy.id}
                      data-testid={`matrix-col-header-${strategy.id}`}
                      data-highlighted={isGoalMatch ? 'true' : 'false'}
                      className={`p-3.5 font-semibold border-l border-gray-200 transition-colors ${
                        isGoalMatch
                          ? 'bg-green-100/90 text-green-950'
                          : 'bg-gray-50 text-gray-800'
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-green-800">
                            {strategy.codeLabel}
                          </span>
                          {isGoalMatch && (
                            <span className="px-2 py-0.5 rounded-full bg-green-800 text-white text-[10px] font-semibold">
                              Goal Match
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold">{strategy.title}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {TRADE_OFF_DIMENSIONS.map((dim) => {
                const DimIcon = DIMENSION_ICON_MAP[dim.key];
                const isEmphasizedRow = currentGoalMeta.emphasizedDimensions.includes(
                  dim.key
                );

                return (
                  <tr
                    key={dim.key}
                    data-testid={`matrix-row-${dim.key}`}
                    data-emphasized={isEmphasizedRow ? 'true' : 'false'}
                    className={
                      isEmphasizedRow ? 'bg-green-50/35' : 'bg-white hover:bg-gray-50/60'
                    }
                  >
                    <td className="p-3.5 align-top">
                      <div className="flex items-start gap-2">
                        <DimIcon className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-gray-800">
                              {dim.label}
                            </span>
                            {dim.invertedDesirability && (
                              <span
                                data-testid="inverted-complexity-badge"
                                className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold"
                              >
                                Inverted: High = Negative
                              </span>
                            )}
                            {isEmphasizedRow && (
                              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[10px] font-semibold">
                                Priority for {currentGoalMeta.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                            {dim.description}
                          </p>
                          <span className="text-[10px] text-gray-400 block mt-1">
                            {dim.desirabilityLegend}
                          </span>
                        </div>
                      </div>
                    </td>

                    {(isMyFarm ? dynamicStrategies : currentPlan.strategies).map((strategy) => {
                      const cell = strategy.tradeOffRatings[dim.key];
                      const style = getQualitativeRatingStyle(
                        cell.rating,
                        dim.invertedDesirability
                      );
                      const isGoalMatch = strategy.alignedGoalId === selectedGoal;

                      return (
                        <td
                          key={`${dim.key}-${strategy.id}`}
                          data-testid={`matrix-cell-${dim.key}-${strategy.id}`}
                          data-rating={cell.rating}
                          data-desirability={style.desirabilityLabel}
                          className={`p-3.5 align-top border-l border-gray-200 transition-colors ${
                            isGoalMatch ? 'bg-green-50/60' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style.badgeClass}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`}
                                />
                                {cell.rating}
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium">
                                ({style.desirabilityLabel})
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-600 leading-snug">
                              {cell.shortRationale}
                            </p>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
          <span>
            Active Context: <strong className="text-gray-600">{activeContextLabel}</strong> • Goal:{' '}
            <strong className="text-gray-600">{currentGoalMeta.label}</strong>
          </span>
          <span>
            Provenance:{' '}
            {isMyFarm
              ? 'Rule-Based Agronomic Evaluation + User Farm Inputs + NASA POWER Historical Archive'
              : 'Team-provided Demo Snapshot + Illustrative Rotation Strategy'}
          </span>
        </div>
      </section>
    </main>
  );
};

export default DecisionPlanner;
