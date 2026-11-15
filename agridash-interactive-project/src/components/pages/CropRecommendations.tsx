import React, { useEffect, useState } from 'react';
import {
  Leaf,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  Globe,
  MapPin,
  Navigation,
  Compass,
  TrendingUp,
  ShieldCheck,
  Layers,
  Droplets,
  Sun,
  CloudRain,
  Info,
  RefreshCw,
  FileWarning,
  Sparkles,
  Database,
  BookOpen,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  UserCheck,
  Sliders,
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
  FIELD_CROP_RECOMMENDATIONS,
  PLANNER_GOALS,
  getFieldCropRecommendations,
  type PlannerGoalId,
  type QualitativeSuitabilityLabel,
  type VerifiedFarmLocation,
} from '../../data/cropRecommendationsData';
import {
  CURRENT_CROP_OPTIONS,
  GLOBAL_QUICK_LOCATIONS,
  IRRIGATION_OPTIONS,
  REAL_FARM_HISTORICAL_WINDOWS,
  evaluateFarmCandidates,
  generateDynamicRotationStrategies,
  getMaxHistoricalDateIso,
  getSavedMyFarmProfile,
  getSharedFarmLocationState,
  parseOptionalSoilPh,
  resetMyFarmProfileAndLocation,
  resolveActiveHistoricalWindow,
  saveMyFarmProfile,
  setSharedFarmLocationState,
  validateHistoricalDateRange,
  type CurrentCropKey,
  type EvaluationStatusLabel,
  type ExperienceMode,
  type HistoricalWindowId,
  type IrrigationAvailability,
  type MyFarmProfile,
} from '../../services/realFarmEngine';

interface CropRecommendationsProps {
  activeField?: string | null;
  onNavigateToDecisionPlanner?: () => void;
}

const GOAL_ICON_MAP: Record<PlannerGoalId, React.FC<{ className?: string }>> = {
  'earn-more': TrendingUp,
  'lower-risk': ShieldCheck,
  'more-crops': Layers,
};

function getEvaluationBadgeStyle(status: EvaluationStatusLabel): string {
  switch (status) {
    case 'Recommended Candidate (Requires Local Agronomic Review)':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Conditional Candidate (Action / Amendment Needed)':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Insufficient Data — Requires Local Review':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Not Recommended for Current Constraints':
      return 'bg-red-100 text-red-800 border-red-200';
  }
}

function getDemoSuitabilityBadgeStyle(label: QualitativeSuitabilityLabel): string {
  switch (label) {
    case 'High Illustrative Fit (Local Validation Required)':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Conditional Fit (Soil / Moisture Action Required)':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Targeted Buffer / Cover Fit (Illustrative)':
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}

function getFactorPillClass(status: string): string {
  if (status === 'Favorable' || status === 'Strong Break Crop') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (
    status === 'Marginal' ||
    status === 'Marginal (Amend pH)' ||
    status === 'Complementary Follow-On'
  ) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (
    status === 'Unsuitable' ||
    status === 'Constraint Flag' ||
    status === 'Same-Family Caution'
  ) {
    return 'bg-red-50 text-red-800 border-red-200';
  }
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

interface MiniSparklineProps {
  points: NasaDailyObservationPoint[];
  mode: 'line' | 'bar';
  strokeColor: string;
  fillColor: string;
  unit: string;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({
  points,
  mode,
  strokeColor,
  fillColor,
  unit,
}) => {
  const validPoints = points.filter((p) => !p.isMissing && p.value !== null);
  if (validPoints.length === 0) {
    return (
      <div className="h-14 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-400">
        No valid daily observations in selected window
      </div>
    );
  }

  const values = validPoints.map((p) => p.value as number);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;
  const width = 260;
  const height = 52;
  const padX = 8;
  const padY = 6;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-13 overflow-visible"
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

const CropRecommendations: React.FC<CropRecommendationsProps> = ({
  activeField,
  onNavigateToDecisionPlanner,
}) => {
  // 1. Persisted My Farm Profile & Experience Mode ('my-farm' | 'explore-demo')
  const [profile, setProfile] = useState<MyFarmProfile>(() => getSavedMyFarmProfile());
  const [phError, setPhError] = useState<string | null>(null);
  const [customStartInput, setCustomStartInput] = useState<string>(
    () => getSavedMyFarmProfile().customStartDate
  );
  const [customEndInput, setCustomEndInput] = useState<string>(
    () => getSavedMyFarmProfile().customEndDate
  );
  const [customDateError, setCustomDateError] = useState<string | null>(null);

  // Progressive disclosure states
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [showAllRankedCrops, setShowAllRankedCrops] = useState<boolean>(false);

  // 2. Demo Mode Field Selection (preserved for Explore Demo mode)
  const [selectedFieldId, setSelectedFieldId] = useState<FieldId>(() =>
    isFieldId(activeField) ? activeField : FIELD_IDS[0]
  );

  useEffect(() => {
    if (isFieldId(activeField)) {
      setSelectedFieldId(activeField);
    }
  }, [activeField]);

  // 3. Shared Global Farm Location Context (persisted in localStorage)
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

  // 4. NASA POWER Historical Climate Fetch State
  const [nasaStatus, setNasaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() =>
    initialSharedLoc.verifiedLocation ? 'loading' : 'idle'
  );
  const [nasaError, setNasaError] = useState<string | null>(null);
  const [nasaResult, setNasaResult] = useState<NasaPowerDailyResult | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);

  // Helper to update My Farm profile and persist to localStorage
  const updateProfile = (patch: Partial<MyFarmProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveMyFarmProfile(next);
      return next;
    });
  };

  const handleExperienceModeSwitch = (mode: ExperienceMode) => {
    updateProfile({ experienceMode: mode });
  };

  const handleSoilPhChange = (val: string) => {
    const check = parseOptionalSoilPh(val);
    if (!check.valid) {
      setPhError(check.error);
      setProfile((prev) => ({ ...prev, soilPhInput: val }));
      return;
    }
    setPhError(null);
    updateProfile({
      soilPhInput: val,
      soilPh: check.value,
    });
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

  // Resolve active historical window (either 2025 preset or validated custom date range)
  const currentWindowMeta = React.useMemo(
    () => resolveActiveHistoricalWindow(profile),
    [profile]
  );

  // Fetch real NASA POWER climate data ONLY when verifiedLocation is present
  useEffect(() => {
    if (!verifiedLocation) {
      setNasaStatus('idle');
      setNasaResult(null);
      setNasaError(null);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();

    // Immediately invalidate previous coordinate/window NASA results
    setNasaResult(null);
    setNasaStatus('loading');
    setNasaError(null);

    fetchNasaPowerDaily({
      latitude: verifiedLocation.latitude,
      longitude: verifiedLocation.longitude,
      startDate: currentWindowMeta.startDate,
      endDate: currentWindowMeta.endDate,
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
  }, [verifiedLocation, currentWindowMeta.startDate, currentWindowMeta.endDate, retryToken]);

  // Location handlers
  const handleUseBrowserGeolocation = () => {
    setCoordError(null);

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatusMessage({
        type: 'warning',
        text: 'Browser Geolocation API is not available in this environment. Manual coordinate entry remains fully available below.',
      });
      return;
    }

    setIsLocatingDevice(true);
    setGeoStatusMessage({
      type: 'info',
      text: 'Requesting approximate device coordinates... (You can deny permission or manually refine coordinates at any time.)',
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingDevice(false);
        const check = validateCoordinates(position.coords.latitude, position.coords.longitude);
        if (!check.valid) {
          setCoordError(check.error);
          return;
        }
        const nextLoc: VerifiedFarmLocation = {
          latitude: check.latitude,
          longitude: check.longitude,
          label: `Browser Device Coordinates (${check.latitude}°, ${check.longitude}° — Editable)`,
          source: 'browser-geolocation',
          updatedAtIso: new Date().toISOString(),
        };
        setLatInput(String(check.latitude));
        setLonInput(String(check.longitude));
        setVerifiedLocation(nextLoc);
        setSharedFarmLocationState({ verifiedLocation: nextLoc });
        setGeoStatusMessage({
          type: 'success',
          text: `Device coordinates populated (${check.latitude}°, ${check.longitude}°). You may manually edit and refine these coordinates below at any time.`,
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
          text: `${reason} Manual latitude/longitude entry and quick reference locations remain fully available below.`,
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

  const handleSelectQuickLocation = (loc: {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    climateHint: string;
  }) => {
    setCoordError(null);
    setGeoStatusMessage({
      type: 'info',
      text: `Loaded ${loc.label} (${loc.latitude}°, ${loc.longitude}°). Fetching real NASA POWER historical climate...`,
    });
    const nextLoc: VerifiedFarmLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      label: `${loc.label} (${loc.latitude}°, ${loc.longitude}°)`,
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
      text: 'Cleared verified coordinates. NASA climate data is now unloaded until new coordinates are verified.',
    });
  };

  const handleResetAllMyFarm = () => {
    const fresh = resetMyFarmProfileAndLocation();
    setProfile(fresh);
    setCustomStartInput(fresh.customStartDate);
    setCustomEndInput(fresh.customEndDate);
    setCustomDateError(null);
    setVerifiedLocation(null);
    setLatInput('');
    setLonInput('');
    setPhError(null);
    setCoordError(null);
    setGeoStatusMessage({
      type: 'info',
      text: 'Reset My Farm profile and cleared saved coordinates.',
    });
  };

  const toggleCardDetails = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Run genuine rule-based evaluation engine for My Farm mode
  const evaluation = React.useMemo(
    () =>
      evaluateFarmCandidates(
        profile,
        verifiedLocation,
        nasaStatus === 'success' ? nasaResult : null
      ),
    [profile, verifiedLocation, nasaStatus, nasaResult]
  );

  const dynamicStrategies = React.useMemo(
    () => generateDynamicRotationStrategies(profile, evaluation),
    [profile, evaluation]
  );

  // Demo Mode data for Explore Demo mode
  const demoFieldBundle = getFieldCropRecommendations(selectedFieldId);
  const demoGoalSection = demoFieldBundle.byGoal[profile.primaryGoal];
  const currentGoalMeta =
    PLANNER_GOALS.find((g) => g.id === profile.primaryGoal) ?? PLANNER_GOALS[0];

  return (
    <main
      data-testid="crop-recommendations-page"
      className="flex-1 flex flex-col min-w-0 ml-3 mr-3 md:ml-5 md:mr-5 gap-5 relative h-full overflow-y-auto pr-1 custom-scrollbar"
    >
      {/* 1. Hero Section + Experience Mode Switch (My Farm vs Explore Demo) */}
      <section
        data-testid="crop-recommendations-hero"
        className="rounded-3xl bg-gradient-to-br from-[#143326] via-[#1b4332] to-[#0f291e] text-white p-5 md:p-6 shadow-sm flex-shrink-0 min-w-0 overflow-hidden"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/15 text-emerald-300 flex items-center justify-center flex-shrink-0 border border-white/10">
              <Leaf className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 text-[11px] font-semibold">
                  CropWise • NASA Space Apps 2026 (Field Shift)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-gray-200 text-[11px] font-medium">
                  No Login Required
                </span>
              </div>
              <h1
                data-testid="hero-title"
                className="text-xl md:text-2xl font-bold text-white mt-1.5 tracking-tight"
              >
                Smarter Crops for Your Farm
              </h1>
              <p className="text-xs md:text-sm text-gray-200 mt-1 max-w-2xl leading-relaxed">
                Combine real <strong className="text-emerald-200">NASA POWER historical climate data</strong>, your farm’s crop, soil pH, and irrigation conditions, and your primary goal to evaluate candidate crops and rotation strategies.
              </p>
            </div>
          </div>

          {/* Experience Switch: My Farm vs Explore Demo */}
          <div className="flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">
              Experience Mode Switch
            </span>
            <div
              role="group"
              aria-label="Experience mode switch"
              className="flex bg-black/25 p-1 rounded-2xl border border-white/15"
            >
              <button
                type="button"
                data-testid="mode-switch-my-farm"
                onClick={() => handleExperienceModeSwitch('my-farm')}
                aria-pressed={profile.experienceMode === 'my-farm'}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  profile.experienceMode === 'my-farm'
                    ? 'bg-emerald-400 text-green-950 shadow-sm'
                    : 'text-gray-200 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>My Farm (Real Input + NASA)</span>
              </button>
              <button
                type="button"
                data-testid="mode-switch-explore-demo"
                onClick={() => handleExperienceModeSwitch('explore-demo')}
                aria-pressed={profile.experienceMode === 'explore-demo'}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  profile.experienceMode === 'explore-demo'
                    ? 'bg-emerald-400 text-green-950 shadow-sm'
                    : 'text-gray-200 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Explore Demo (3 Team Fields)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Status Strip */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-200">
          <div className="flex flex-wrap items-center gap-2.5">
            {profile.experienceMode === 'my-farm' ? (
              <>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-400/20 text-emerald-200 font-semibold">
                  My Farm Mode Active
                </span>
                <span>
                  Farm: <strong className="text-white">{profile.farmName}</strong>
                </span>
                <span>•</span>
                <span>
                  Current Crop: <strong className="text-white">{evaluation.currentCropMeta.label}</strong>
                </span>
                <span>•</span>
                <span>
                  Soil pH:{' '}
                  <strong className="text-white">
                    {profile.soilPh !== null ? profile.soilPh.toFixed(1) : 'Not provided'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Date Window:{' '}
                  <strong className="text-emerald-200">
                    {currentWindowMeta.startIso} to {currentWindowMeta.endIso}
                  </strong>
                </span>
              </>
            ) : (
              <>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-200 font-semibold">
                  Explore Demo Mode Active
                </span>
                <span>
                  Demo Field:{' '}
                  <strong className="text-white">
                    {demoFieldBundle.fieldName} ({demoFieldBundle.currentCropType})
                  </strong>
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] text-emerald-200/90">
            Provisional Rule-Based Screening • Local Agronomic Review Required
          </span>
        </div>

        {/* 4-Category Data Provenance Distinction Strip */}
        <div
          data-testid="provenance-distinction-strip"
          className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[11px]"
        >
          <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
            <span className="font-semibold text-emerald-200 block">
              1. Real NASA POWER Climate Data
            </span>
            <span className="text-gray-200">
              Historical modeled T2M &amp; PRECTOTCORR ({currentWindowMeta.startIso} to {currentWindowMeta.endIso})
            </span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
            <span className="font-semibold text-blue-200 block">
              2. User-Provided Farm Inputs
            </span>
            <span className="text-gray-200">
              Coordinates, {evaluation.currentCropMeta.label}, pH ({profile.soilPh !== null ? profile.soilPh.toFixed(1) : 'Not provided'}), irrigation &amp; goal
            </span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
            <span className="font-semibold text-amber-200 block">
              3. Provisional Suitability Rules
            </span>
            <span className="text-gray-200">
              Unvalidated heuristic screening thresholds — not a yield or profit model
            </span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
            <span className="font-semibold text-purple-200 block">
              4. Simulated Demo Data
            </span>
            <span className="text-gray-200">
              {profile.experienceMode === 'my-farm'
                ? 'Excluded in My Farm mode (isolated to Explore Demo)'
                : 'Active in Explore Demo mode (3 Purwokerto team fields)'}
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BRANCH A: MY FARM MODE (Genuine Input-Driven + Real NASA POWER Engine)
         ===================================================================== */}
      {profile.experienceMode === 'my-farm' ? (
        <>
          {/* STEP 1 (Farmer Questions 1 & 2): Where is my farm? & What am I growing? */}
          <section
            data-testid="my-farm-setup-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 min-w-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">
                    Where Is My Farm &amp; What Am I Growing?
                  </h2>
                  <p className="text-xs text-gray-500">
                    Set your farm coordinates, historical NASA analysis period, current crop, soil pH, irrigation, and goal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="reset-my-farm-btn"
                onClick={handleResetAllMyFarm}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset / Clear Saved Farm</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Q1 — Where is my farm? + Historical NASA Date Selection */}
              <div className="lg:col-span-6 flex flex-col gap-3 bg-gray-50/80 p-4 rounded-2xl border border-gray-100 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-green-700" />
                    Q1. Where Is My Farm? &amp; Historical Date Window
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Lat [-90, 90] • Lon [-180, 180]
                  </span>
                </div>

                {/* Quick Global Test Presets (London, Cairo, Putrajaya) */}
                <div>
                  <span className="text-[11px] text-gray-500 block mb-1.5">
                    Quick Global Test Locations (or enter any coordinates below):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {GLOBAL_QUICK_LOCATIONS.map((loc) => {
                      const isSelected =
                        verifiedLocation &&
                        verifiedLocation.latitude === loc.latitude &&
                        verifiedLocation.longitude === loc.longitude;
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          data-testid={`rec-preset-${loc.id}`}
                          onClick={() => handleSelectQuickLocation(loc)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-green-800 text-white border-green-800 shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-green-400'
                          }`}
                        >
                          {loc.label} ({loc.latitude}°, {loc.longitude}°)
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleApplyManualCoordinates} className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="rec-lat-input"
                        className="block text-[11px] font-medium text-gray-600 mb-1"
                      >
                        Latitude (°N / °S)
                      </label>
                      <input
                        id="rec-lat-input"
                        data-testid="rec-lat-input"
                        type="text"
                        inputMode="decimal"
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                        placeholder="e.g. 51.5074 or 30.0444"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="rec-lon-input"
                        className="block text-[11px] font-medium text-gray-600 mb-1"
                      >
                        Longitude (°E / °W)
                      </label>
                      <input
                        id="rec-lon-input"
                        data-testid="rec-lon-input"
                        type="text"
                        inputMode="decimal"
                        value={lonInput}
                        onChange={(e) => setLonInput(e.target.value)}
                        placeholder="e.g. -0.1278 or 31.2357"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="rec-window-select"
                      className="block text-[11px] font-medium text-gray-600 mb-1"
                    >
                      Historical NASA POWER Analysis Period (2025 Presets or Custom Dates)
                    </label>
                    <select
                      id="rec-window-select"
                      data-testid="rec-window-select"
                      value={profile.historicalWindow}
                      onChange={(e) => {
                        setCustomDateError(null);
                        updateProfile({
                          historicalWindow: e.target.value as HistoricalWindowId,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                    >
                      {Object.values(REAL_FARM_HISTORICAL_WINDOWS).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                      <option value="custom">
                        Custom Historical Date Range ({profile.customStartDate} to {profile.customEndDate})
                      </option>
                    </select>
                  </div>

                  {/* Custom Historical Start / End Date Selector */}
                  <div
                    data-testid="rec-custom-date-box"
                    className="p-3 rounded-xl bg-white border border-gray-200/90 flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-gray-700">
                        Custom Historical Start &amp; End Dates (YYYY-MM-DD, up to 366 days)
                      </span>
                      <span
                        data-testid="rec-active-date-badge"
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800"
                      >
                        Active: {currentWindowMeta.startIso} to {currentWindowMeta.endIso} (
                        {currentWindowMeta.daySpan}d)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <div>
                        <label
                          htmlFor="rec-custom-start-date"
                          className="block text-[10px] font-medium text-gray-500 mb-0.5"
                        >
                          Start Date
                        </label>
                        <input
                          id="rec-custom-start-date"
                          data-testid="rec-custom-start-date"
                          type="date"
                          min="1981-01-01"
                          max={getMaxHistoricalDateIso()}
                          value={customStartInput}
                          onChange={(e) => setCustomStartInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="rec-custom-end-date"
                          className="block text-[10px] font-medium text-gray-500 mb-0.5"
                        >
                          End Date
                        </label>
                        <input
                          id="rec-custom-end-date"
                          data-testid="rec-custom-end-date"
                          type="date"
                          min="1981-01-01"
                          max={getMaxHistoricalDateIso()}
                          value={customEndInput}
                          onChange={(e) => setCustomEndInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                        />
                      </div>
                      <button
                        type="button"
                        data-testid="rec-apply-custom-dates-btn"
                        onClick={handleApplyCustomDates}
                        className="px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-900 border border-green-300 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Apply Custom Window
                      </button>
                    </div>
                    {customDateError && (
                      <div
                        data-testid="rec-custom-date-error"
                        role="alert"
                        className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{customDateError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="submit"
                      data-testid="rec-fetch-nasa-btn"
                      className="px-3.5 py-2 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Verify Coordinates &amp; Fetch NASA POWER
                    </button>

                    <button
                      type="button"
                      data-testid="rec-browser-geo-btn"
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
                        data-testid="rec-clear-coords-btn"
                        onClick={handleClearVerifiedLocation}
                        className="px-2.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Clear Coordinates
                      </button>
                    )}
                  </div>
                </form>

                {coordError && (
                  <div
                    data-testid="rec-coord-error"
                    role="alert"
                    className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{coordError}</span>
                  </div>
                )}

                {geoStatusMessage && (
                  <div
                    data-testid="rec-geo-status"
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
              </div>

              {/* Right Column: Q2 — What am I growing? + Soil pH, Irrigation & Goal */}
              <div className="lg:col-span-6 flex flex-col gap-3 bg-gray-50/80 p-4 rounded-2xl border border-gray-100 min-w-0">
                <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-green-700" />
                  Q2. What Am I Growing? &amp; Farm Constraints
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="my-farm-name-input"
                      className="block text-[11px] font-medium text-gray-600 mb-1"
                    >
                      Farm / Parcel Name
                    </label>
                    <input
                      id="my-farm-name-input"
                      data-testid="my-farm-name-input"
                      type="text"
                      value={profile.farmName}
                      onChange={(e) => updateProfile({ farmName: e.target.value })}
                      placeholder="e.g. North River Parcel"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="my-farm-current-crop"
                      className="block text-[11px] font-medium text-gray-600 mb-1"
                    >
                      Current Crop in Field
                    </label>
                    <select
                      id="my-farm-current-crop"
                      data-testid="my-farm-current-crop"
                      value={profile.currentCrop}
                      onChange={(e) =>
                        updateProfile({ currentCrop: e.target.value as CurrentCropKey })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                    >
                      {CURRENT_CROP_OPTIONS.map((crop) => (
                        <option key={crop.key} value={crop.key}>
                          {crop.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="my-farm-ph-input"
                        className="text-[11px] font-medium text-gray-600"
                      >
                        Soil pH (Optional)
                      </label>
                      <span
                        data-testid="my-farm-ph-status-badge"
                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          profile.soilPh !== null
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {profile.soilPh !== null
                          ? `pH ${profile.soilPh.toFixed(1)}`
                          : 'Not provided'}
                      </span>
                    </div>
                    <input
                      id="my-farm-ph-input"
                      data-testid="my-farm-ph-input"
                      type="text"
                      inputMode="decimal"
                      value={profile.soilPhInput}
                      onChange={(e) => handleSoilPhChange(e.target.value)}
                      placeholder="Leave blank if unknown (e.g. 6.4)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                    />
                    {phError && (
                      <span className="text-[10px] text-red-600 block mt-1">{phError}</span>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="my-farm-irrigation-select"
                      className="block text-[11px] font-medium text-gray-600 mb-1"
                    >
                      Irrigation Availability
                    </label>
                    <select
                      id="my-farm-irrigation-select"
                      data-testid="my-farm-irrigation-select"
                      value={profile.irrigationAvailability}
                      onChange={(e) =>
                        updateProfile({
                          irrigationAvailability: e.target.value as IrrigationAvailability,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-700"
                    >
                      {IRRIGATION_OPTIONS.map((irr) => (
                        <option key={irr.id} value={irr.id}>
                          {irr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Primary Goal Selector */}
                <div className="pt-1">
                  <span className="block text-[11px] font-medium text-gray-600 mb-1.5">
                    Primary Farming Goal (Earn More / Lower Risk / More Crops)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {PLANNER_GOALS.map((g) => {
                      const Icon = GOAL_ICON_MAP[g.id];
                      const active = profile.primaryGoal === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          data-testid={`rec-goal-btn-${g.id}`}
                          onClick={() => updateProfile({ primaryGoal: g.id })}
                          aria-pressed={active}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                            active
                              ? 'bg-green-800 text-white border-green-800 shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-green-400'
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs font-semibold truncate">{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2 (Farmer Question 3): What is the local historical climate? */}
          <section
            data-testid="rec-nasa-climate-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 min-w-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">
                    Q3. What Is the Local Historical Climate? (NASA POWER)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Selected Historical Window:{' '}
                    <strong className="text-gray-700">
                      {currentWindowMeta.startIso} to {currentWindowMeta.endIso}
                    </strong>{' '}
                    ({currentWindowMeta.daySpan} days) • {currentWindowMeta.scopeNote}
                  </p>
                </div>
              </div>
              {verifiedLocation && nasaStatus === 'success' && (
                <span className="px-2.5 py-1 rounded-full bg-green-800 text-white text-[11px] font-semibold">
                  Real NASA POWER Historical Data ({currentWindowMeta.startIso} → {currentWindowMeta.endIso})
                </span>
              )}
            </div>

            {nasaStatus === 'idle' && (
              <div
                data-testid="rec-nasa-demo-mode"
                className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <FileWarning className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-amber-950">
                      Coordinates Not Verified Yet — Climate Suitability Unverified
                    </h3>
                    <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                      CropWise never fabricates climate observations in My Farm mode. Enter your latitude/longitude above or select a quick location (London, Cairo, Putrajaya) to fetch real historical NASA POWER <code className="font-semibold">T2M</code> and <code className="font-semibold">PRECTOTCORR</code> data.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-white text-amber-900 border border-amber-300 text-[11px] font-semibold flex-shrink-0">
                  Insufficient Climate Data
                </span>
              </div>
            )}

            {nasaStatus === 'loading' && (
              <div
                data-testid="rec-nasa-loading"
                className="p-5 rounded-2xl bg-green-50/40 border border-green-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-green-700 animate-spin flex-shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-gray-800">
                      Querying Real NASA POWER API ({verifiedLocation?.latitude}°, {verifiedLocation?.longitude}°)...
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Window: {currentWindowMeta.startIso} to {currentWindowMeta.endIso} ({currentWindowMeta.daySpan} days)
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-green-800">Live Request</span>
              </div>
            )}

            {nasaStatus === 'error' && (
              <div
                data-testid="rec-nasa-error"
                className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-red-900">
                      NASA POWER Request Failed — Climate Suitability Marked as Insufficient Data
                    </h3>
                    <p className="text-xs text-red-700 mt-0.5">{nasaError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRetryToken((c) => c + 1)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-100 text-red-800 border border-red-200 text-xs font-semibold cursor-pointer flex-shrink-0"
                >
                  Retry NASA Fetch
                </button>
              </div>
            )}

            {nasaStatus === 'success' && nasaResult && (
              <div
                data-testid="rec-nasa-loaded"
                className="p-4 rounded-2xl bg-green-50/40 border border-green-200/80 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700">
                  <div>
                    <strong>Verified Location:</strong> {verifiedLocation?.label} (
                    {verifiedLocation?.latitude}°, {verifiedLocation?.longitude}°) •{' '}
                    <strong>Date Window:</strong> {currentWindowMeta.startIso} to{' '}
                    {currentWindowMeta.endIso}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    API {nasaResult.apiVersion} ({nasaResult.sources.join(', ') || 'MERRA2'}) •{' '}
                    {nasaResult.spatialResolution} • Valid Days: {evaluation.validClimateDays} (Missing:{' '}
                    {evaluation.missingClimateDays})
                  </div>
                </div>

                {evaluation.missingClimateDays > 0 && (
                  <div
                    data-testid="rec-nasa-missing-days-notice"
                    className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                    <span>
                      NASA POWER returned {evaluation.missingClimateDays} missing day(s) (<code className="font-semibold">-999</code> fill values). Missing days are excluded from averages and never replaced with fabricated values.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Temperature T2M */}
                  <div className="p-3.5 rounded-2xl bg-white border border-gray-100 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                        <Sun className="w-4 h-4 text-amber-600" />
                        Daily Mean Temperature (T2M)
                      </span>
                      <span
                        data-testid="rec-nasa-t2m-mean"
                        className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200"
                      >
                        {evaluation.observedT2mMean !== null
                          ? `Mean: ${evaluation.observedT2mMean.toFixed(2)}°C`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center justify-between">
                      <span>
                        Min / Max:{' '}
                        <strong className="text-gray-700">
                          {evaluation.observedT2mMin !== null && evaluation.observedT2mMax !== null
                            ? `${evaluation.observedT2mMin.toFixed(1)}°C / ${evaluation.observedT2mMax.toFixed(1)}°C`
                            : 'N/A'}
                        </strong>
                      </span>
                      <span>
                        {nasaResult.series.T2M.validCount} valid / {nasaResult.series.T2M.missingCount} missing
                      </span>
                    </div>
                    <MiniSparkline
                      points={nasaResult.series.T2M.points}
                      mode="line"
                      strokeColor="#d97706"
                      fillColor="#fef3c7"
                      unit="°C"
                    />
                  </div>

                  {/* Precipitation PRECTOTCORR */}
                  <div className="p-3.5 rounded-2xl bg-white border border-gray-100 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                        <CloudRain className="w-4 h-4 text-blue-600" />
                        Corrected Precipitation (PRECTOTCORR)
                      </span>
                      <span
                        data-testid="rec-nasa-prec-total"
                        className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200"
                      >
                        {evaluation.observedPrecipTotalMm !== null
                          ? `Total: ${evaluation.observedPrecipTotalMm.toFixed(2)} mm`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center justify-between">
                      <span>
                        Daily Mean:{' '}
                        <strong className="text-gray-700">
                          {evaluation.observedPrecipMeanMmPerDay !== null
                            ? `${evaluation.observedPrecipMeanMmPerDay.toFixed(2)} mm/day`
                            : 'N/A'}
                        </strong>
                      </span>
                      <span>
                        Rainy Days (≥1mm):{' '}
                        <strong className="text-gray-700">
                          {evaluation.observedRainyDays ?? 0} days
                        </strong>
                      </span>
                    </div>
                    <MiniSparkline
                      points={nasaResult.series.PRECTOTCORR.points}
                      mode="bar"
                      strokeColor="#2563eb"
                      fillColor="#dbeafe"
                      unit="mm/day"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 3 (Farmer Question 4): Which crops warrant further consideration? */}
          <section
            data-testid="top-candidate-crops-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 min-w-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">
                    Q4. Which Crops Warrant Further Consideration for {profile.farmName}? (Goal: {currentGoalMeta.label})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Screened against {currentWindowMeta.startIso} to {currentWindowMeta.endIso}, current crop ({evaluation.currentCropMeta.label}), soil pH ({profile.soilPh !== null ? profile.soilPh.toFixed(1) : 'Not provided'}), irrigation ({IRRIGATION_OPTIONS.find((i) => i.id === profile.irrigationAvailability)?.shortLabel}), and goal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="rec-toggle-all-candidates-btn"
                onClick={() => setShowAllRankedCrops((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                {showAllRankedCrops
                  ? evaluation.hasViableCandidates
                    ? 'Show Viable Top Candidates Only'
                    : 'Hide Rejected Candidate Diagnostic List'
                  : evaluation.hasViableCandidates
                  ? `Inspect All ${evaluation.rankedCandidates.length} Evaluated Candidates (${evaluation.viableCandidates.length} Viable, ${evaluation.rejectedCandidates.length} Rejected)`
                  : `Inspect All ${evaluation.rejectedCandidates.length} Rejected Candidates & Constraint Flags`}
              </button>
            </div>

            {/* Key Result + Historical Date Window + Growing-Season Scope & Uncertainty Strip */}
            <div
              data-testid="key-result-uncertainty-strip"
              className={`mb-4 p-3.5 rounded-2xl border text-xs flex flex-col gap-1.5 ${
                evaluation.hasViableCandidates
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : 'bg-red-50/80 border-red-200 text-red-950'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">
                  Key Screening Result:{' '}
                  {evaluation.hasViableCandidates
                    ? `${evaluation.viableCandidates.length} of ${evaluation.rankedCandidates.length} candidate crops pass screening (${evaluation.rejectedCandidates.length} rejected)`
                    : `0 of ${evaluation.rankedCandidates.length} candidate crops pass current constraints (All 12 marked Not Recommended)`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/90 border border-gray-200 text-[11px] font-semibold text-gray-800">
                  Data Window: {currentWindowMeta.startIso} to {currentWindowMeta.endIso} ({currentWindowMeta.daySpan} days)
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                <strong>Uncertainty &amp; Scope Notice:</strong> {evaluation.shortWindowScopeDisclaimer}
              </p>
            </div>

            {/* Honest Unsuitable-Conditions / No Viable Candidates State */}
            {!evaluation.hasViableCandidates && (
              <div
                data-testid="no-viable-candidates-banner"
                role="region"
                aria-label="No viable candidate crops under current constraints"
                className="p-5 rounded-3xl bg-red-50/70 border border-red-200 mb-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-700 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-red-950">
                      No Viable Candidate Crops for Current Constraints — CropWise Will Not Recommend Unsuitable Crops
                    </h3>
                    <p className="text-xs text-red-900 mt-1 leading-relaxed">
                      {evaluation.allCandidatesUnsuitableReason}
                    </p>
                    <p className="text-xs text-red-800 mt-2 leading-relaxed">
                      <strong>What you can do next:</strong> Verify whether supplemental or full irrigation is available on your farm, check soil pH amendments (e.g. agricultural lime for extreme acidity), or select a different seasonal historical date window above. You can also click{' '}
                      <button
                        type="button"
                        onClick={() => setShowAllRankedCrops((prev) => !prev)}
                        className="underline font-bold cursor-pointer text-red-950"
                      >
                        {showAllRankedCrops
                          ? 'Hide Rejected Candidate Diagnostic List'
                          : 'Inspect All 12 Rejected Candidates & Constraint Flags'}
                      </button>{' '}
                      to review the exact constraint that blocked each crop.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(evaluation.hasViableCandidates || showAllRankedCrops) && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {(showAllRankedCrops
                  ? evaluation.rankedCandidates
                  : evaluation.topCandidates
                ).map((cand) => {
                  const isExpanded = !!expandedCardIds[cand.spec.id];
                  const badgeStyle = getEvaluationBadgeStyle(cand.evaluationStatus);
                  const isRejected =
                    cand.evaluationStatus === 'Not Recommended for Current Constraints';

                  return (
                    <article
                      key={cand.spec.id}
                      data-testid={`evaluated-crop-card-${cand.spec.id}`}
                      data-rank={cand.rank}
                      className={`rounded-3xl p-5 border transition-all flex flex-col justify-between gap-3.5 min-w-0 ${
                        isRejected
                          ? 'border-red-200 bg-red-50/15'
                          : cand.rank <= 3
                          ? 'border-green-700 bg-green-50/20 ring-1 ring-green-700/20 shadow-2xs'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isRejected
                                ? 'bg-red-800 text-white'
                                : 'bg-green-800 text-white'
                            }`}
                          >
                            {isRejected
                              ? `Rejected (#${cand.rank}) • ${cand.spec.rotationRole}`
                              : `Viable #${cand.rank} • ${cand.spec.rotationRole}`}
                          </span>
                          <span
                            data-testid={`crop-eval-status-${cand.spec.id}`}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeStyle}`}
                          >
                            {cand.evaluationStatus}
                          </span>
                        </div>

                        <div>
                          <h3
                            data-testid={`crop-card-title-${cand.spec.id}`}
                            className="text-base font-bold text-gray-800"
                          >
                            {cand.spec.cropName}
                          </h3>
                          <p className="text-xs text-gray-500 italic">
                            {cand.spec.botanicalName} •{' '}
                            <span className="not-italic font-medium text-green-800">
                              {cand.spec.categoryLabel} ({cand.spec.family})
                            </span>
                          </p>
                        </div>

                        {/* 4 Interpretable Factor Pills */}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border ${getFactorPillClass(
                              cand.thermalFit.status
                            )}`}
                          >
                            <span className="block text-[10px] opacity-75">Temperature Fit</span>
                            <span className="font-semibold">{cand.thermalFit.status}</span>
                          </div>
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border ${getFactorPillClass(
                              cand.waterFit.status
                            )}`}
                          >
                            <span className="block text-[10px] opacity-75">Water / Irrigation</span>
                            <span className="font-semibold">{cand.waterFit.status}</span>
                          </div>
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border ${getFactorPillClass(
                              cand.soilPhFit.status
                            )}`}
                          >
                            <span className="block text-[10px] opacity-75">Soil pH Check</span>
                            <span className="font-semibold">{cand.soilPhFit.status}</span>
                          </div>
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border ${getFactorPillClass(
                              cand.rotationFit.status
                            )}`}
                          >
                            <span className="block text-[10px] opacity-75">Rotation Role</span>
                            <span className="font-semibold">{cand.rotationFit.status}</span>
                          </div>
                        </div>

                        {/* Essential Summary (Always Visible) */}
                        <div className="p-3 rounded-2xl bg-white border border-gray-100 text-xs space-y-1.5">
                          <p className="text-gray-700 leading-snug">
                            <strong className="text-gray-900">Rotation Fit:</strong>{' '}
                            {cand.rotationFit.explanation}
                          </p>
                          <p className="text-gray-700 leading-snug">
                            <strong className="text-gray-900">Climate &amp; Water:</strong>{' '}
                            {cand.thermalFit.explanation} {cand.waterFit.explanation}
                          </p>
                          <p className="text-gray-700 leading-snug">
                            <strong className="text-gray-900">Soil pH:</strong>{' '}
                            {cand.soilPhFit.explanation}
                          </p>
                        </div>

                        {/* Expandable Agronomic Details (Progressive Disclosure) */}
                        {isExpanded && (
                          <div
                            data-testid={`crop-details-${cand.spec.id}`}
                            className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 text-xs flex flex-col gap-2.5"
                          >
                            <div>
                              <span className="font-semibold text-gray-800 block">
                                Goal &amp; Agronomic Overview:
                              </span>
                              <p className="text-gray-600 mt-0.5">
                                {cand.goalFitExplanation} {cand.spec.agronomicSummary}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-800 block">
                                Water &amp; Soil Considerations:
                              </span>
                              <p className="text-gray-600 mt-0.5">
                                {cand.spec.waterGuidance} {cand.spec.soilGuidance}
                              </p>
                            </div>
                            <div>
                              <span className="font-semibold text-red-900 block">
                                Key Risks &amp; Limitations:
                              </span>
                              <ul className="text-gray-600 mt-0.5 space-y-1">
                                {cand.spec.keyRisks.map((r, idx) => (
                                  <li key={idx}>• {r}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="font-semibold text-amber-900 block">
                                Rule Provenance &amp; Missing Information:
                              </span>
                              <ul className="text-amber-900/90 mt-0.5 space-y-1 text-[11px]">
                                {cand.missingInputsAndUncertainty.map((u, idx) => (
                                  <li key={idx}>• {u}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        data-testid={`toggle-details-${cand.spec.id}`}
                        onClick={() => toggleCardDetails(cand.spec.id)}
                        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-green-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <span>
                          {isExpanded
                            ? 'Hide Detailed Agronomic Breakdown'
                            : 'View Detailed Agronomic Breakdown & Provenance'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* STEP 4 (Farmer Question 5): Why were those crops selected or rejected? */}
          <section
            data-testid="why-these-crops-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 min-w-0 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Q5. Why Were Those Crops Selected or Rejected?
                </h2>
                <p className="text-xs text-gray-500">
                  Transparent rule trace showing how your inputs and NASA climate window ({currentWindowMeta.startIso} to {currentWindowMeta.endIso}) shaped the evaluation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80">
                <span className="font-semibold text-emerald-950 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  Active Rule Evaluation Trace
                </span>
                <ul className="space-y-2 text-gray-700">
                  {evaluation.whyTheseCropsSummary.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 mt-0.5 flex-shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                <span className="font-semibold text-amber-950 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Missing Information &amp; Scope Limitations
                </span>
                {evaluation.missingInputWarnings.length > 0 ? (
                  <ul
                    data-testid="missing-input-warnings-list"
                    className="space-y-2 text-amber-950/90"
                  >
                    {evaluation.missingInputWarnings.map((warn, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                        <span>{warn}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-700 leading-relaxed">
                    Location, NASA climate window ({currentWindowMeta.startIso} to {currentWindowMeta.endIso}), current crop, soil pH ({profile.soilPh?.toFixed(1)}), and irrigation ({profile.irrigationAvailability}) are all supplied. {evaluation.shortWindowScopeDisclaimer}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* STEP 5 (Farmer Question 6): Which rotation options can I compare? */}
          <section
            data-testid="compare-rotations-preview-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 min-w-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">
                    Q6. Which Rotation Options Can I Compare?
                  </h2>
                  <p className="text-xs text-gray-500">
                    {evaluation.hasViableCandidates
                      ? `Assembled exclusively from viable candidate crops for ${profile.farmName}.`
                      : 'Preserves the 4-strategy comparison structure while marking unsupported strategies under current constraints.'}
                  </p>
                </div>
              </div>

              {onNavigateToDecisionPlanner && (
                <button
                  type="button"
                  data-testid="view-in-decision-planner-btn"
                  onClick={onNavigateToDecisionPlanner}
                  className="px-4 py-2 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <span>View in Decision Planner</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
              {dynamicStrategies.map((st) => {
                const isGoalMatch = st.alignedGoalId === profile.primaryGoal;
                const isUnsupported =
                  st.supportStatusLabel ===
                  'Not Supported — No Viable Candidate Crops for Current Constraints';
                return (
                  <div
                    key={st.id}
                    data-testid={`rec-strategy-preview-${st.id}`}
                    className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 ${
                      isUnsupported
                        ? 'border-red-200 bg-red-50/30'
                        : isGoalMatch
                        ? 'border-green-700 bg-green-50/40 ring-1 ring-green-700/20'
                        : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isUnsupported ? 'text-red-800' : 'text-green-800'
                          }`}
                        >
                          {st.codeLabel}
                        </span>
                        {isUnsupported ? (
                          <span className="px-2 py-0.2 rounded-full bg-red-100 text-red-800 border border-red-200 text-[10px] font-semibold">
                            Not Recommended
                          </span>
                        ) : (
                          isGoalMatch && (
                            <span className="px-2 py-0.2 rounded-full bg-green-800 text-white text-[10px] font-semibold">
                              Matches Goal
                            </span>
                          )
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-800">{st.title}</h3>
                      <p
                        className={`text-[11px] mt-1 font-medium ${
                          isUnsupported ? 'text-red-800' : 'text-gray-600'
                        }`}
                      >
                        {st.subtitle}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] pt-2 border-t ${
                        isUnsupported
                          ? 'text-red-700 border-red-200/70 font-semibold'
                          : 'text-gray-500 border-gray-200/70'
                      }`}
                    >
                      {st.supportStatusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* STEP 6: Data Sources & Scientific Limitations */}
          <section
            data-testid="data-sources-limitations-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 mb-2 min-w-0 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm">
                6
              </div>
              <h2 className="text-base font-semibold text-gray-800">
                Data Sources, Provenance &amp; Scientific Limitations
              </h2>
            </div>
            <div className="text-xs text-gray-600 space-y-1.5 leading-relaxed">
              <p>
                • <strong>Real NASA POWER Historical Climate Data:</strong> Temperature (<code className="text-gray-800">T2M</code>) and Precipitation (<code className="text-gray-800">PRECTOTCORR</code>) are retrieved live from the NASA Langley Research Center POWER Daily API (<code className="text-gray-800">0.5° × 0.625°</code> regional assimilation grid) for the selected window (<code className="text-gray-800">{currentWindowMeta.startIso} to {currentWindowMeta.endIso}</code>). Historical windows are not real-time weather forecasts.
              </p>
              <p>
                • <strong>Growing-Season Window Scope:</strong> {evaluation.shortWindowScopeDisclaimer}
              </p>
              <p>
                • <strong>Provisional Crop Suitability Rules:</strong> Crop thermal, rainfall, pH, and rotation rules use transparent, provisional screening assumptions. They do not predict crop yield, farm profit, or guaranteed agronomic success.
              </p>
            </div>
          </section>
        </>
      ) : (
        /* =====================================================================
           BRANCH B: EXPLORE DEMO MODE (Preserves Existing 3 Team Fields Intact)
           ===================================================================== */
        <>
          <section
            data-testid="explore-demo-fields-section"
            className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 min-w-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Explore Team Demo Fields (Purwokerto Scenario)
                </h2>
                <p className="text-xs text-gray-500">
                  Original CropWise three-field snapshot preserved verbatim from <code className="text-green-800">cropwiseFields.ts</code>.
                </p>
              </div>
              {onNavigateToDecisionPlanner && (
                <button
                  type="button"
                  data-testid="view-in-decision-planner-btn"
                  onClick={onNavigateToDecisionPlanner}
                  className="px-3.5 py-2 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>View in Decision Planner</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {FIELD_IDS.map((fieldId) => {
                const field = cropwiseFields[fieldId];
                const bundle = FIELD_CROP_RECOMMENDATIONS[fieldId];
                const isSelected = selectedFieldId === fieldId;
                const overviewStatus = getFieldOverviewStatus(field.status);
                const badgeClass = getFieldBadgeClass(field.status);

                return (
                  <button
                    key={fieldId}
                    type="button"
                    data-testid={`rec-field-btn-${fieldId}`}
                    onClick={() => setSelectedFieldId(fieldId)}
                    aria-pressed={isSelected}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-green-700 bg-green-50/50 ring-2 ring-green-700/20 shadow-xs'
                        : 'border-gray-100 bg-gray-50/60 hover:bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-semibold text-sm text-gray-800 truncate">
                        {field.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeClass}`}
                      >
                        {overviewStatus}
                      </span>
                    </div>
                    <div className="text-xs text-green-800 font-medium mb-2">
                      {field.type} • {field.area} ha ({bundle.tableGrowthStage})
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-gray-500 pt-2 border-t border-gray-200/60">
                      <div>Score: <b>{field.score}</b></div>
                      <div>Hum: <b>{field.humidity}</b></div>
                      <div>pH: <b>{field.ph}</b></div>
                      <div>Water: <b>{field.water}</b></div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Goal Selector in Demo Mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-4">
              {PLANNER_GOALS.map((goal) => {
                const active = profile.primaryGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    data-testid={`rec-goal-btn-${goal.id}`}
                    onClick={() => updateProfile({ primaryGoal: goal.id })}
                    className={`p-3 rounded-2xl border text-left text-xs font-semibold cursor-pointer ${
                      active
                        ? 'bg-green-800 text-white border-green-800'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {goal.label} — {goal.tagline}
                  </button>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-green-50/40 border border-green-200/80 mb-4">
              <h3
                data-testid="rec-goal-headline"
                className="text-sm font-semibold text-gray-800"
              >
                {demoGoalSection.recommendationHeadline}
              </h3>
              <p className="text-xs text-gray-600 mt-1">{demoGoalSection.recommendationExplanation}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {demoGoalSection.recommendations.map((card) => (
                <article
                  key={card.id}
                  data-testid={`crop-rec-card-${card.id}`}
                  className="rounded-3xl p-4 border border-gray-200 bg-white flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border mb-1.5 ${getDemoSuitabilityBadgeStyle(
                        card.suitabilityBadge
                      )}`}
                    >
                      {card.suitabilityBadge}
                    </span>
                    <h4
                      data-testid={`crop-card-title-${card.id}`}
                      className="text-sm font-bold text-gray-800"
                    >
                      {card.cropName}
                    </h4>
                    <p className="text-[11px] text-gray-500 italic">{card.botanicalName}</p>
                    <p className="text-gray-600 mt-2">{card.currentFieldContext}</p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                    {card.dataProvenance.primaryTag} • {card.dataProvenance.fieldContextTag}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default CropRecommendations;
