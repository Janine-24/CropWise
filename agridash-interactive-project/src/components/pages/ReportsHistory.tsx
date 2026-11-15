import React, { useEffect, useState } from 'react';
import {
  FileText,
  Droplets,
  Sun,
  CloudRain,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Globe,
  Layers,
  ShieldAlert,
  ArrowRight,
  MapPin,
  Database,
} from 'lucide-react';
import GaugeChart from '../charts/GaugeChart';
import { validateCoordinates } from '../../services/nasaPowerClient';
import {
  getSharedFarmLocationState,
  setSharedFarmLocationState,
  type VerifiedFarmLocation,
} from '../../data/decisionPlannerData';
import {
  CURRENT_CROP_OPTIONS,
  GLOBAL_QUICK_LOCATIONS,
  IRRIGATION_OPTIONS,
  getSavedMyFarmProfile,
  saveMyFarmProfile,
  type ExperienceMode,
  type MyFarmProfile,
} from '../../services/realFarmEngine';
import {
  demoReportsHistoryProvider,
  NASA_HISTORICAL_WINDOWS,
  NASA_PUBLIC_TEST_LOCATIONS,
  type ActivityCategory,
  type DataMode,
  type EnvMetricKey,
  type FieldEnvTrendSeries,
  type ReportsHistoryBundle,
  type ReportsHistoryDataProvider,
  type SimulatedRiskLevel,
  type TimeRangeKey,
} from '../../data/reportsHistoryData';

interface ReportsHistoryProps {
  activeField?: string | null;
  dataProvider?: ReportsHistoryDataProvider;
}

const TIME_RANGE_OPTIONS: { id: TimeRangeKey; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'season', label: 'Season' },
];

const METRIC_OPTIONS: {
  id: EnvMetricKey;
  label: string;
  shortUnit: string;
  nasaSupported: boolean;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'soilMoisture', label: 'Soil Moisture', shortUnit: '%', nasaSupported: false, icon: Droplets },
  { id: 'ndvi', label: 'NDVI', shortUnit: 'Index', nasaSupported: false, icon: Activity },
  { id: 'rainfall', label: 'Rainfall', shortUnit: 'mm/day', nasaSupported: true, icon: CloudRain },
  { id: 'temperature', label: 'Temperature', shortUnit: '°C', nasaSupported: true, icon: Sun },
];

const ACTIVITY_CATEGORY_OPTIONS: { id: ActivityCategory; label: string }[] = [
  { id: 'all', label: 'All Logs' },
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'nutrition', label: 'Nutrition & Soil' },
  { id: 'inspection', label: 'Inspection' },
];

function getSimulatedRiskStyle(risk: SimulatedRiskLevel): {
  badgeBg: string;
  cellBg: string;
  dotBg: string;
} {
  switch (risk) {
    case 'Low Risk (Simulated)':
      return {
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        cellBg: 'bg-[#dcfce7] border-[#bbf7d0] text-green-900',
        dotBg: 'bg-emerald-500',
      };
    case 'Moderate Risk (Simulated)':
      return {
        badgeBg: 'bg-green-100 text-green-800 border-green-200',
        cellBg: 'bg-[#86efac]/60 border-[#4ade80] text-green-950',
        dotBg: 'bg-green-600',
      };
    case 'Elevated Watch (Simulated)':
      return {
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        cellBg: 'bg-amber-100 border-amber-300 text-amber-900',
        dotBg: 'bg-amber-500',
      };
    case 'High Risk (Simulated)':
      return {
        badgeBg: 'bg-red-100 text-red-800 border-red-200',
        cellBg: 'bg-red-100 border-red-300 text-red-900',
        dotBg: 'bg-red-500',
      };
  }
}

function formatMetricValue(metric: EnvMetricKey, value: number, dataMode: DataMode): string {
  switch (metric) {
    case 'soilMoisture':
      return `${value}%`;
    case 'ndvi':
      return value.toFixed(2);
    case 'rainfall':
      return dataMode === 'nasa-power' ? `${value.toFixed(2)} mm/day` : `${value} mm`;
    case 'temperature':
      return dataMode === 'nasa-power' ? `${value.toFixed(2)}°C` : `${value}°C`;
  }
}

interface EnvTrendSvgChartProps {
  metric: EnvMetricKey;
  dataMode: DataMode;
  seriesList: FieldEnvTrendSeries[];
}

const EnvTrendSvgChart: React.FC<EnvTrendSvgChartProps> = ({ metric, dataMode, seriesList }) => {
  if (seriesList.length === 0 || seriesList[0].points.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-400">
        No trend series available for the current filter.
      </div>
    );
  }

  const allValues = seriesList.flatMap((s) => s.points.map((p) => p.value));
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = rawMax === rawMin ? (rawMax === 0 ? 1 : rawMax * 0.1) : (rawMax - rawMin) * 0.2;
  const minVal =
    metric === 'ndvi' ? Math.max(0, rawMin - padding) : Math.max(0, Math.floor(rawMin - padding));
  const maxVal =
    metric === 'ndvi' ? Math.min(1, rawMax + padding) : Math.ceil(rawMax + padding);
  const span = maxVal - minVal || 1;

  const width = 560;
  const height = 195;
  const padLeft = 46;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 36;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const pointCount = seriesList[0].points.length;
  const getX = (idx: number) =>
    pointCount <= 1 ? padLeft + plotWidth / 2 : padLeft + (idx / (pointCount - 1)) * plotWidth;
  const getY = (val: number) => padTop + plotHeight - ((val - minVal) / span) * plotHeight;

  const yTicks = [minVal, minVal + span / 2, maxVal];
  const labelStep = pointCount > 14 ? Math.ceil(pointCount / 6) : 1;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-48 sm:h-52 overflow-visible"
        role="img"
        aria-label={`${metric} trend chart (${dataMode})`}
      >
        {/* Horizontal Grid Lines */}
        {yTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-gray-400 text-[10px] font-medium"
              >
                {metric === 'ndvi' ? tick.toFixed(2) : Math.round(tick)}
              </text>
            </g>
          );
        })}

        {/* X-Axis Slot / Date Labels (sampled cleanly for 30d / 60d windows) */}
        {seriesList[0].points.map((pt, idx) => {
          const isLast = idx === pointCount - 1;
          const shouldShowLabel = idx % labelStep === 0 || isLast;
          if (!shouldShowLabel) return null;
          const x = getX(idx);
          return (
            <text
              key={`${pt.pointLabel}-${idx}`}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className={`text-[10px] ${
                isLast ? 'fill-green-800 font-semibold' : 'fill-gray-400 font-medium'
              }`}
            >
              {pt.pointLabel}
            </text>
          );
        })}

        {/* Lines and Points per Series */}
        {seriesList.map((series) => {
          const coords = series.points.map((pt, idx) => ({
            x: getX(idx),
            y: getY(pt.value),
            pt,
          }));
          const pathD = coords
            .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
            .join(' ');

          return (
            <g key={series.fieldId}>
              <path
                d={pathD}
                fill="none"
                stroke={series.strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {coords.map((c, idx) => {
                const isSolidNode =
                  c.pt.origin === 'Team-provided Demo Snapshot' ||
                  c.pt.origin === 'NASA POWER Modeled / Assimilated Data';
                const radius = pointCount > 20 ? 3 : isSolidNode ? 5 : 4;
                return (
                  <g key={idx}>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={radius}
                      fill={isSolidNode ? series.strokeColor : '#ffffff'}
                      stroke={series.strokeColor}
                      strokeWidth="2"
                    >
                      <title>{`${series.fieldName} • ${
                        c.pt.isoDate ?? c.pt.pointLabel
                      }: ${formatMetricValue(metric, c.pt.value, dataMode)} (${
                        c.pt.origin
                      })`}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
        <div className="flex flex-wrap items-center gap-3">
          {seriesList.map((s) => (
            <div key={s.fieldId} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: s.strokeColor }}
              />
              <span className="font-medium text-gray-700">{s.fieldName}</span>
              <span className="text-gray-400">
                (Latest:{' '}
                {formatMetricValue(metric, s.points[s.points.length - 1].value, dataMode)})
              </span>
            </div>
          ))}
        </div>
        {dataMode === 'nasa-power' ? (
          <div className="text-[10px] text-green-800 font-semibold">
            Solid nodes: Real NASA POWER Modeled / Assimilated Daily Archive
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border-2 border-green-700 bg-white inline-block" />
              Hollow node: Simulated Demo Data
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
              Solid final node: Team-provided Demo Snapshot
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportsHistory: React.FC<ReportsHistoryProps> = ({
  activeField,
  dataProvider = demoReportsHistoryProvider,
}) => {
  // Shared verified farm location state (restored from localStorage / shared store; null if unverified)
  const initialShared = getSharedFarmLocationState();
  const [farmProfile, setFarmProfile] = useState<MyFarmProfile>(() => getSavedMyFarmProfile());

  // Data Mode ('demo' vs 'nasa-power')
  const [dataMode, setDataMode] = useState<DataMode>(() =>
    initialShared.verifiedLocation || farmProfile.experienceMode === 'my-farm'
      ? 'nasa-power'
      : 'demo'
  );

  // NASA POWER coordinate inputs & committed query coordinates (never silently defaults to a preset unless verified)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    if (!initialShared.verifiedLocation) return 'none';
    const match = NASA_PUBLIC_TEST_LOCATIONS.find(
      (p) =>
        p.latitude === initialShared.verifiedLocation!.latitude &&
        p.longitude === initialShared.verifiedLocation!.longitude
    );
    return match ? match.id : 'custom';
  });
  const [latInput, setLatInput] = useState<string>(initialShared.draftLatInput);
  const [lonInput, setLonInput] = useState<string>(initialShared.draftLonInput);
  const [coordValidationError, setCoordValidationError] = useState<string | null>(null);
  const [committedNasaCoords, setCommittedNasaCoords] = useState<VerifiedFarmLocation | null>(
    initialShared.verifiedLocation
  );

  // Filter states
  const [fieldFilter, setFieldFilter] = useState<string | 'all'>(() =>
    activeField ? activeField : 'north-field-a1'
  );
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('7d');
  const [metric, setMetric] = useState<EnvMetricKey>(() =>
    initialShared.verifiedLocation || farmProfile.experienceMode === 'my-farm'
      ? 'temperature'
      : 'soilMoisture'
  );
  const [activityCategory, setActivityCategory] = useState<ActivityCategory>('all');
  const [focusedEffectFieldId, setFocusedEffectFieldId] = useState<string | null>(null);

  // UI disclosure states
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [showNasaMetadata, setShowNasaMetadata] = useState(false);
  const [showGlobalContextPanel, setShowGlobalContextPanel] = useState(false);
  const [simulateState, setSimulateState] = useState<'normal' | 'empty' | 'error'>('normal');
  const [retryCounter, setRetryCounter] = useState(0);

  // Async lifecycle states
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ReportsHistoryBundle | null>(null);

  const isMyFarm = farmProfile.experienceMode === 'my-farm';

  const handleSelectExperienceMode = (mode: ExperienceMode) => {
    setFarmProfile((prev) => {
      const next: MyFarmProfile = { ...prev, experienceMode: mode };
      saveMyFarmProfile(next);
      return next;
    });
    if (mode === 'my-farm') {
      setDataMode('nasa-power');
      if (metric === 'soilMoisture' || metric === 'ndvi') {
        setMetric('temperature');
      }
    }
  };

  // Sync with parent Dashboard activeField when it changes
  useEffect(() => {
    if (activeField) {
      setFieldFilter(activeField);
    }
  }, [activeField]);

  // Handle mode switching
  const handleSelectDataMode = (nextMode: DataMode) => {
    setDataMode(nextMode);
    setCoordValidationError(null);
    if (nextMode === 'demo' && farmProfile.experienceMode === 'my-farm') {
      handleSelectExperienceMode('explore-demo');
    }
    // When switching to NASA POWER mode, default to Temperature (T2M) if currently on an unsupported metric
    if (nextMode === 'nasa-power' && (metric === 'soilMoisture' || metric === 'ndvi')) {
      setMetric('temperature');
    }
  };

  const handleSelectQuickGlobalLocation = (locId: string) => {
    const loc = GLOBAL_QUICK_LOCATIONS.find((l) => l.id === locId);
    if (!loc) return;
    const nextLoc: VerifiedFarmLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      label: `${loc.label} — ${loc.climateHint}`,
      source: 'public-test-preset',
      updatedAtIso: new Date().toISOString(),
    };
    setSelectedPresetId('custom');
    setLatInput(String(loc.latitude));
    setLonInput(String(loc.longitude));
    setCoordValidationError(null);
    setBundle(null);
    setStatus('loading');
    setCommittedNasaCoords(nextLoc);
    setSharedFarmLocationState({ verifiedLocation: nextLoc });
    if (dataMode !== 'nasa-power') {
      setDataMode('nasa-power');
    }
    if (metric === 'soilMoisture' || metric === 'ndvi') {
      setMetric('temperature');
    }
  };

  // Handle public test location preset selection
  const handleSelectTestPreset = (presetId: string) => {
    const preset = NASA_PUBLIC_TEST_LOCATIONS.find((p) => p.id === presetId);
    if (!preset) return;
    const nextLoc: VerifiedFarmLocation = {
      latitude: preset.latitude,
      longitude: preset.longitude,
      label: preset.label,
      source: 'public-test-preset',
      updatedAtIso: new Date().toISOString(),
    };
    setSelectedPresetId(preset.id);
    setLatInput(String(preset.latitude));
    setLonInput(String(preset.longitude));
    setCoordValidationError(null);
    // Invalidate old displayed NASA results immediately
    setBundle(null);
    setStatus('loading');
    setCommittedNasaCoords(nextLoc);
    setSharedFarmLocationState({ verifiedLocation: nextLoc });
    if (dataMode !== 'nasa-power') {
      setDataMode('nasa-power');
    }
    if (metric === 'soilMoisture' || metric === 'ndvi') {
      setMetric('temperature');
    }
  };

  // Handle manual coordinate submission
  const handleApplyCustomCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateCoordinates(latInput, lonInput);
    if (!check.valid) {
      setCoordValidationError(check.error);
      return;
    }
    const nextLoc: VerifiedFarmLocation = {
      latitude: check.latitude,
      longitude: check.longitude,
      label: `Custom Coordinates (${check.latitude}°, ${check.longitude}°)`,
      source: 'manual-input',
      updatedAtIso: new Date().toISOString(),
    };
    setCoordValidationError(null);
    setSelectedPresetId('custom');
    setLatInput(String(check.latitude));
    setLonInput(String(check.longitude));
    // Invalidate old displayed NASA results immediately
    setBundle(null);
    setStatus('loading');
    setCommittedNasaCoords(nextLoc);
    setSharedFarmLocationState({ verifiedLocation: nextLoc });
    if (dataMode !== 'nasa-power') {
      setDataMode('nasa-power');
    }
    if (metric === 'soilMoisture' || metric === 'ndvi') {
      setMetric('temperature');
    }
  };

  // Handle clearing verified coordinates
  const handleClearVerifiedCoordinates = () => {
    setCommittedNasaCoords(null);
    setLatInput('');
    setLonInput('');
    setSelectedPresetId('none');
    setCoordValidationError(null);
    setSharedFarmLocationState({ verifiedLocation: null });
    setBundle(null);
    setStatus('loading');
  };

  // Async fetch effect with stale-response & AbortController protection
  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();

    // Immediately invalidate previous bundle when coordinates or mode change
    setBundle(null);
    setStatus('loading');
    setErrorMessage(null);

    const effectiveMode: DataMode =
      dataMode === 'nasa-power' && committedNasaCoords !== null ? 'nasa-power' : 'demo';

    dataProvider
      .fetchReportsBundle(
        {
          dataMode: effectiveMode,
          nasaLatitude: committedNasaCoords?.latitude,
          nasaLongitude: committedNasaCoords?.longitude,
          nasaLocationLabel: committedNasaCoords?.label,
          fieldFilter,
          timeRange,
          metric,
          activityCategory,
          simulateState,
        },
        { signal: controller.signal }
      )
      .then((res) => {
        if (!isCurrent) return;
        const isEmptyBundle =
          res.actionEffects.length === 0 &&
          res.environmentalTrend.seriesByField.length === 0 &&
          res.riskHistory.length === 0;
        setBundle(res);
        setStatus(isEmptyBundle ? 'empty' : 'success');
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load reports history data.'
        );
        setStatus('error');
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [
    dataProvider,
    dataMode,
    committedNasaCoords,
    fieldFilter,
    timeRange,
    metric,
    activityCategory,
    simulateState,
    retryCounter,
  ]);

  const farmContext = bundle?.farmContext;
  const availableFields = farmContext?.fields ?? [];
  const actionRecords = bundle?.actionEffects ?? [];
  const activeEffectRecord =
    actionRecords.find((r) => r.fieldId === focusedEffectFieldId) ??
    actionRecords[0] ??
    null;

  const envTrend = bundle?.environmentalTrend;
  const nasaLive = envTrend?.nasaLiveDetails;

  return (
    <main className="flex-1 flex flex-col min-w-0 ml-3 mr-3 md:ml-5 md:mr-5 gap-5 relative h-full overflow-y-auto pr-1 custom-scrollbar pb-4">
      {/* 1. Top Header & Mode / Filter Controls Card */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-green-100 text-green-700 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-semibold text-gray-800 truncate">
                  Reports &amp; History
                </h1>
                {dataMode === 'nasa-power' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                    NASA POWER Historical Archive Active
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                    Demo Snapshot + Simulated History
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                Action effect tracking, NASA POWER agroclimatology trends, risk history, and activity logs
              </p>
            </div>
          </div>

          {/* Right Header Actions: Experience Mode Switcher, Data Mode Switcher, Global Context Toggle & Export Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Explicit My Farm vs Explore Demo Switcher */}
            <div
              data-testid="reports-experience-mode-switch"
              className="flex bg-gray-100 rounded-full p-1 border border-gray-200"
              role="group"
              aria-label="Experience mode"
            >
              <button
                type="button"
                data-testid="reports-mode-btn-my-farm"
                onClick={() => handleSelectExperienceMode('my-farm')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isMyFarm
                    ? 'bg-green-800 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                My Farm
              </button>
              <button
                type="button"
                data-testid="reports-mode-btn-explore-demo"
                onClick={() => handleSelectExperienceMode('explore-demo')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  !isMyFarm
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Explore Demo
              </button>
            </div>

            {/* Explicit Demo Data vs NASA Data Mode Toggle */}
            <div
              className="flex bg-gray-100 rounded-full p-1 border border-gray-200"
              role="group"
              aria-label="Data source mode"
            >
              <button
                type="button"
                onClick={() => handleSelectDataMode('demo')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  dataMode === 'demo'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Demo Data
              </button>
              <button
                type="button"
                onClick={() => handleSelectDataMode('nasa-power')}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  dataMode === 'nasa-power'
                    ? 'bg-green-800 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>NASA Data</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGlobalContextPanel((prev) => !prev)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/70 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-green-700" />
              <span>Global Farm &amp; NASA Context</span>
              {showGlobalContextPanel ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowExportNotice((prev) => !prev)}
              aria-label="Export Report"
              className="bg-white px-4 py-1.5 rounded-full text-xs font-semibold text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Export Report
            </button>
          </div>
        </div>

        {/* Honest Export Not Available Banner */}
        {showExportNotice && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs"
          >
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Not Available in Demo: </span>
                <span>
                  Report export (PDF/CSV) is not yet implemented in this prototype. No file was generated.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowExportNotice(false)}
              className="text-amber-700 hover:text-amber-950 font-semibold px-1.5 cursor-pointer"
              aria-label="Close export notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* NASA POWER Coordinate & Test Location Control Panel (Visible in NASA Data Mode) */}
        {dataMode === 'nasa-power' && (
          <div
            aria-label="NASA POWER Location Controls"
            className="p-4 rounded-2xl bg-green-50/60 border border-green-200/80 flex flex-col gap-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-green-950">
                <MapPin className="w-4 h-4 text-green-700" />
                <span>NASA POWER Agroclimatology Query (T2M &amp; PRECTOTCORR Historical Archive)</span>
              </div>
              <span className="text-[11px] font-medium text-green-800">
                Archive Window: <b>{NASA_HISTORICAL_WINDOWS[timeRange].displayRange}</b>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-gray-600 font-medium">Global Benchmarks:</span>
              {GLOBAL_QUICK_LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  data-testid={`reports-quick-loc-${loc.id}`}
                  onClick={() => handleSelectQuickGlobalLocation(loc.id)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white text-green-800 border border-green-200 hover:bg-green-50 transition-colors cursor-pointer"
                >
                  {loc.label} ({loc.latitude}°, {loc.longitude}°)
                </button>
              ))}
              {NASA_PUBLIC_TEST_LOCATIONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectTestPreset(preset.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'bg-green-800 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {preset.label} ({preset.latitude}°, {preset.longitude}°)
                </button>
              ))}
            </div>

            <form
              onSubmit={handleApplyCustomCoordinates}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end pt-1"
            >
              <div>
                <label
                  htmlFor="nasa-lat-input"
                  className="block text-[11px] font-medium text-gray-600 mb-1"
                >
                  Latitude (-90 to 90)
                </label>
                <input
                  id="nasa-lat-input"
                  type="text"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="e.g. 2.9264"
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-600"
                />
              </div>
              <div>
                <label
                  htmlFor="nasa-lon-input"
                  className="block text-[11px] font-medium text-gray-600 mb-1"
                >
                  Longitude (-180 to 180)
                </label>
                <input
                  id="nasa-lon-input"
                  type="text"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  placeholder="e.g. 101.6964"
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-green-600"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  data-testid="reports-query-nasa-btn"
                  className="px-4 py-1.5 rounded-xl bg-green-800 text-white text-xs font-semibold hover:bg-green-700 transition-colors cursor-pointer h-[32px]"
                >
                  Query NASA POWER
                </button>
                {committedNasaCoords && (
                  <button
                    type="button"
                    data-testid="reports-clear-coords-btn"
                    onClick={handleClearVerifiedCoordinates}
                    className="px-3 py-1.5 rounded-xl bg-white text-gray-600 border border-gray-200 text-xs font-medium hover:bg-gray-100 transition-colors cursor-pointer h-[32px]"
                  >
                    Clear Coordinates
                  </button>
                )}
              </div>
            </form>

            {coordValidationError && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium flex items-center gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{coordValidationError}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-600 leading-snug">
              <b>Location Separation Note:</b> Team demo plots (North Field A1, East Field B2, South Field C3 in Purwokerto) have unconfirmed coordinates (<code className="text-gray-800">null</code>). Public test coordinates query regional NASA POWER climate grids (<code className="text-gray-800">0.5° × 0.625°</code>) and are never bound as in-field sensor readings.
            </p>
          </div>
        )}

        {/* Collapsible Global Farm Context & Async State Inspector */}
        {showGlobalContextPanel && farmContext && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-gray-800">
                <Layers className="w-4 h-4 text-green-700" />
                <span>Global Farm Location Context &amp; Data Provenance</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-semibold">
                {farmContext.authenticity}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white border border-gray-100">
                <span className="text-gray-400 block">Team Demo Preset</span>
                <span className="font-semibold text-gray-800">{farmContext.regionLabel}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-gray-100">
                <span className="text-gray-400 block">Team Preset Coordinates</span>
                <span className="font-semibold text-gray-700">
                  {farmContext.latitude === null && farmContext.longitude === null
                    ? 'null / null (Unconfirmed in team snapshot)'
                    : `${farmContext.latitude}, ${farmContext.longitude}`}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-gray-100">
                <span className="text-gray-400 block">Timezone &amp; Geometry</span>
                <span className="font-semibold text-gray-700">
                  Timezone: {farmContext.timezone ?? 'null'} • Boundary: {farmContext.boundaryReference ?? 'null'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-gray-100">
                <span className="text-gray-400 block">Adapter Provider</span>
                <span className="font-semibold text-green-800">{dataProvider.providerLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200/70 text-[11px] text-gray-500">
              <span>
                <b className="text-gray-700">Date Reference Note:</b> {farmContext.dateDiscrepancyNote}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Async State Test:</span>
                {(['normal', 'empty', 'error'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSimulateState(mode)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize cursor-pointer transition-colors ${
                      simulateState === mode
                        ? 'bg-green-800 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar: Field Selector & Time Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          {/* Dynamic Field Selector populated from Provider FarmContext */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Field filter">
            <button
              type="button"
              onClick={() => {
                setFieldFilter('all');
                setFocusedEffectFieldId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                fieldFilter === 'all'
                  ? 'bg-green-800 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Fields (Compare {availableFields.length || 3})
            </button>
            {availableFields.map((f) => {
              const isSelected = fieldFilter === f.fieldId;
              return (
                <button
                  key={f.fieldId}
                  type="button"
                  onClick={() => {
                    setFieldFilter(f.fieldId);
                    setFocusedEffectFieldId(f.fieldId);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-green-800 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{f.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : f.badgeClass
                    }`}
                  >
                    {f.shortCropLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Segmented Time Range Filter */}
          <div
            className="flex bg-gray-50 rounded-lg p-1 border border-gray-100"
            role="group"
            aria-label="Time range filter"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeRange(opt.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  timeRange === opt.id
                    ? 'bg-white shadow-sm text-gray-800 font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Async State Handling: Error / Empty / Loading */}
      {status === 'error' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Unable to Load Reports &amp; History Bundle</span>
          </div>
          <p className="text-xs text-gray-600">{errorMessage}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSimulateState('normal');
                setRetryCounter((c) => c + 1);
              }}
              className="px-4 py-2 rounded-xl bg-green-800 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-green-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Loading</span>
            </button>
            {dataMode === 'nasa-power' && (
              <button
                type="button"
                onClick={() => {
                  setSimulateState('normal');
                  handleSelectDataMode('demo');
                }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Switch to Demo Data Mode
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'empty' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
            <Info className="w-5 h-5 text-green-700" />
            <span>No Observation or History Records Found</span>
          </div>
          <p className="text-xs text-gray-500">
            No records match the current filter or provider state. Reset filters to view the Team Demo Preset.
          </p>
          <button
            type="button"
            onClick={() => {
              setSimulateState('normal');
              setDataMode('demo');
              setFieldFilter('north-field-a1');
              setTimeRange('7d');
              setActivityCategory('all');
            }}
            className="px-4 py-2 rounded-xl bg-green-800 text-white text-xs font-semibold hover:bg-green-700 transition-colors cursor-pointer"
          >
            Reset to Default Demo View
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 flex items-center gap-3 text-xs text-gray-600 flex-shrink-0">
          <RefreshCw className="w-4 h-4 text-green-700 animate-spin" />
          <span>
            {dataMode === 'nasa-power' && committedNasaCoords
              ? `Querying NASA POWER Daily API (${committedNasaCoords.latitude}°, ${committedNasaCoords.longitude}°) for ${NASA_HISTORICAL_WINDOWS[timeRange].displayRange}...`
              : 'Loading field observation snapshot and simulated history bundle...'}
          </span>
        </div>
      )}

      {/* Main 4 Modules Content */}
      {bundle && envTrend && status !== 'error' && status !== 'empty' && (
        <>
          {/* 2. MODULE A: Action Effect Tracking (Visual Focal Point — Dark Glassmorphism Card) */}
          {isMyFarm ? (
            <section
              data-testid="my-farm-no-actions-banner"
              aria-label="Action Effect Tracking"
              className="bg-[#161b18]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl text-white flex-shrink-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3 pb-3 border-b border-white/10">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-green-400 font-semibold">
                      My Farm Mode • Action Effect Tracking
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 text-[10px] font-semibold border border-emerald-400/30">
                      Real Farm Profile (Demo Snapshots Excluded)
                    </span>
                  </div>
                  <h2 className="text-base md:text-lg font-semibold mt-1">
                    {farmProfile.farmName} — Current Crop:{' '}
                    {CURRENT_CROP_OPTIONS.find((c) => c.key === farmProfile.currentCrop)?.label ??
                      farmProfile.currentCrop}
                  </h2>
                </div>
                <button
                  type="button"
                  data-testid="switch-to-explore-demo-actions-btn"
                  onClick={() => handleSelectExperienceMode('explore-demo')}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 cursor-pointer"
                >
                  Explore Demo Field Action Chains
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-300">
                    No recorded farm actions yet
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    In <strong>My Farm</strong> mode, CropWise does not mix the team’s simulated demo field snapshots (<em>North Field A1, East Field B2, South Field C3</em>) or simulated post-action outcomes into your real farm analysis. Real NASA POWER historical climate trends (<code className="text-green-300">T2M</code> and <code className="text-green-300">PRECTOTCORR</code>) for your farm coordinates are displayed below.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-gray-300 flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/10">
                    Soil pH:{' '}
                    <strong className="text-white">
                      {farmProfile.soilPh !== null
                        ? farmProfile.soilPh.toFixed(1)
                        : 'Not provided'}
                    </strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/10">
                    Irrigation:{' '}
                    <strong className="text-white">
                      {IRRIGATION_OPTIONS.find((i) => i.id === farmProfile.irrigationAvailability)
                        ?.label ?? farmProfile.irrigationAvailability}
                    </strong>
                  </span>
                </div>
              </div>
            </section>
          ) : (
            activeEffectRecord && (
              <section
                aria-label="Action Effect Tracking"
                className="bg-[#161b18]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl text-white flex-shrink-0"
              >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-green-400 font-semibold">
                      Visual Focus • Action Effect Tracking
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 text-[10px] font-semibold border border-amber-400/30">
                      {activeEffectRecord.scenarioAuthenticity} (Unverified Outcome)
                    </span>
                  </div>
                  <h2 className="text-base md:text-lg font-semibold mt-1">
                    {activeEffectRecord.fieldName} — {activeEffectRecord.cropType} (
                    {activeEffectRecord.timeWindowLabel})
                  </h2>
                </div>

                {/* Risk State Transition Pill */}
                <div className="flex flex-wrap items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl text-xs">
                  <span className="text-gray-400 text-[11px]">Simulated Risk Shift:</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-200 font-medium text-[11px]">
                    {activeEffectRecord.priorSimulatedRisk}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-green-400" />
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-400/30 font-semibold text-[11px]">
                    {activeEffectRecord.currentSimulatedRisk}
                  </span>
                </div>
              </div>

              {fieldFilter === 'all' && actionRecords.length > 1 && (
                <div className="mb-4 p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-300">
                    <b className="text-white">All Fields Mode:</b> Select a field zone below to inspect its 4-step action chain (fields are compared individually, never averaged):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {actionRecords.map((rec) => {
                      const isFocused = rec.fieldId === activeEffectRecord.fieldId;
                      return (
                        <button
                          key={rec.fieldId}
                          type="button"
                          onClick={() => setFocusedEffectFieldId(rec.fieldId)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isFocused
                              ? 'bg-green-600 text-white shadow'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {rec.fieldName} ({rec.snapshotScore}%)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
                {/* Left Snapshot Gauge Box */}
                <div className="xl:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between text-[11px] text-gray-300 mb-1">
                    <span className="font-semibold text-white">{activeEffectRecord.fieldName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-green-300">
                      {activeEffectRecord.snapshotAuthenticity}
                    </span>
                  </div>

                  <GaugeChart score={activeEffectRecord.snapshotScore} />

                  <div className="w-full pt-3 border-t border-white/10 text-[11px] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Equipment Status:</span>
                      <span className="font-semibold text-white">
                        {activeEffectRecord.equipmentStatusSnapshot}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Overview Badge:</span>
                      <span className="font-semibold text-green-300">
                        {activeEffectRecord.overviewDisplayStatus}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-snug pt-1">
                      Gauge score reflects static team snapshot, not a verified post-action measurement.
                    </p>
                  </div>
                </div>

                {/* Right 4-Step Closed Loop */}
                <div className="xl:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-red-300 font-semibold mb-2">
                        <span>1. ISSUE</span>
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-semibold text-white mb-1.5">
                        {activeEffectRecord.issue.title}
                      </h3>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        {activeEffectRecord.issue.detail}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-gray-400">
                      {activeEffectRecord.issue.snapshotReference}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-amber-300 font-semibold mb-2">
                        <span>2. RECOMMENDED</span>
                        <Info className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-semibold text-white mb-1.5">
                        {activeEffectRecord.recommended.title}
                      </h3>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        {activeEffectRecord.recommended.detail}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-amber-300/90">
                      Advisory Type: Simulated Decision Rule
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold mb-2">
                        <span>3. ACTION TAKEN</span>
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-semibold text-white mb-1.5">
                        {activeEffectRecord.actionTaken.title}
                      </h3>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        {activeEffectRecord.actionTaken.detail}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-emerald-300 flex items-center justify-between">
                      <span>{activeEffectRecord.actionTaken.loggedWindow}</span>
                      <span className="font-semibold">{activeEffectRecord.actionTaken.statusLabel}</span>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-green-300 font-semibold mb-2">
                        <span>4. OBSERVATION</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-semibold text-white mb-1.5">
                        {activeEffectRecord.observation.title}
                      </h3>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        {activeEffectRecord.observation.detail}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-amber-200/90 leading-snug">
                      {activeEffectRecord.observation.causalityDisclaimer}
                    </div>
                  </div>
                </div>
              </div>
              </section>
            )
          )}

          {/* 3. Asymmetric Two-Column Desktop Layout (Modules B & C on Left, Module D on Right) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Left Primary Column (7/12 on desktop): Module B + Module C */}
            <div className="xl:col-span-7 flex flex-col gap-5 min-w-0">
              {/* MODULE B: Environmental Trend */}
              <section
                aria-label="Environmental Trend"
                className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-gray-800 text-base">
                        Environmental Trend
                      </h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          envTrend.dataMode === 'nasa-power' &&
                          envTrend.metricAvailability === 'available'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {envTrend.metadata.seriesAuthenticity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {envTrend.dataMode === 'nasa-power'
                        ? `NASA POWER Historical Archive (${envTrend.metadata.label} in ${envTrend.metadata.unit})`
                        : fieldFilter === 'all'
                        ? 'Multi-field comparison curves (plotted per zone without cross-field averaging)'
                        : `Selected field trend (${envTrend.metadata.label} in ${envTrend.metadata.unit})`}
                    </p>
                  </div>

                  {/* 4-Metric Selector Tabs */}
                  <div
                    className="grid grid-cols-2 sm:flex bg-gray-50 rounded-xl p-1 gap-1 border border-gray-100 w-full sm:w-auto"
                    role="group"
                    aria-label="Environmental metric selector"
                  >
                    {METRIC_OPTIONS.map((m) => {
                      const Icon = m.icon;
                      const isActive = metric === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMetric(m.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isActive
                              ? 'bg-green-800 text-white shadow-sm font-semibold'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{m.label}</span>
                          {dataMode === 'nasa-power' && m.nasaSupported && (
                            <span
                              className={`text-[9px] px-1 rounded ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              NASA
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Branch 0: NASA POWER mode selected but no verified coordinates set yet */}
                {dataMode === 'nasa-power' && !committedNasaCoords && (
                  <div
                    data-testid="reports-nasa-unverified"
                    className="p-5 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-xs flex flex-col items-start gap-2"
                  >
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                      <Info className="w-4 h-4 text-green-700 flex-shrink-0" />
                      <span>No Verified Farm Coordinates Selected Yet</span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Team demo fields have unconfirmed exact coordinates (<code className="text-gray-800">null</code>). Enter latitude and longitude in the NASA POWER Location Controls above or select a Public Test Location to fetch real historical <code className="text-gray-800">T2M</code> and <code className="text-gray-800">PRECTOTCORR</code> data.
                    </p>
                  </div>
                )}

                {/* Branch 1: Metric Unavailable in NASA POWER Mode (Soil Moisture / NDVI) */}
                {(!dataMode || dataMode !== 'nasa-power' || committedNasaCoords) &&
                  envTrend.metricAvailability === 'unavailable-in-nasa-power' && (
                  <div
                    role="region"
                    aria-label="Metric Not Connected in NASA POWER Mode"
                    className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs flex flex-col items-start gap-3"
                  >
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                      <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>
                        {envTrend.metadata.label} — Not Connected in NASA POWER Mode
                      </span>
                    </div>
                    <p className="text-amber-900/90 leading-relaxed">
                      {envTrend.unavailableReason}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMetric('temperature')}
                        className="px-3.5 py-1.5 rounded-xl bg-green-800 text-white text-xs font-semibold hover:bg-green-700 transition-colors cursor-pointer"
                      >
                        View NASA Temperature (T2M)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMetric('rainfall')}
                        className="px-3.5 py-1.5 rounded-xl bg-green-700 text-white text-xs font-semibold hover:bg-green-600 transition-colors cursor-pointer"
                      >
                        View NASA Rainfall (PRECTOTCORR)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDataMode('demo')}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        Switch to Demo Data Mode
                      </button>
                    </div>
                  </div>
                )}

                {/* Branch 2: All points were missing fill_value (-999) */}
                {(!dataMode || dataMode !== 'nasa-power' || committedNasaCoords) &&
                  envTrend.metricAvailability === 'no-valid-points' && (
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 text-xs flex flex-col gap-2">
                    <div className="font-semibold text-gray-800">
                      No Valid Observations in Requested Window (All Fill Values)
                    </div>
                    <p className="text-gray-600">{envTrend.unavailableReason}</p>
                  </div>
                )}

                {/* Branch 3: Available Trend Series (Demo or Live NASA POWER) */}
                {(!dataMode || dataMode !== 'nasa-power' || committedNasaCoords) &&
                  envTrend.metricAvailability === 'available' && (
                  <>
                    <EnvTrendSvgChart
                      metric={metric}
                      dataMode={envTrend.dataMode}
                      seriesList={envTrend.seriesByField}
                    />

                    {/* Summary Strip */}
                    {envTrend.dataMode === 'nasa-power' && nasaLive ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-gray-400 text-[10px] block">
                            Parameter &amp; Unit
                          </span>
                          <span className="font-semibold text-gray-800">
                            {nasaLive.parameterCode} ({nasaLive.displayUnit}, raw: {nasaLive.rawUnit})
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-gray-400 text-[10px] block">
                            Historical Date Window
                          </span>
                          <span className="font-semibold text-gray-800">
                            {nasaLive.startDateIso} to {nasaLive.endDateIso}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-gray-400 text-[10px] block">
                            Grid Coordinates &amp; Elevation
                          </span>
                          <span className="font-semibold text-gray-800">
                            {nasaLive.returnedLatitude ?? nasaLive.requestedLatitude}°,{' '}
                            {nasaLive.returnedLongitude ?? nasaLive.requestedLongitude}° (
                            {nasaLive.elevationMeters !== null
                              ? `${nasaLive.elevationMeters}m`
                              : 'N/A'}
                            )
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-gray-400 text-[10px] block">
                            Valid vs Missing (fill_value: {nasaLive.fillValue})
                          </span>
                          <span className="font-semibold text-green-800">
                            {nasaLive.validCount} Valid • {nasaLive.missingCount} Missing
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {envTrend.seriesByField.map((s) => {
                          const vals = s.points.map((p) => p.value);
                          const minV = Math.min(...vals);
                          const maxV = Math.max(...vals);
                          return (
                            <div
                              key={s.fieldId}
                              className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-800">{s.fieldName}</span>
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: s.strokeColor }}
                                />
                              </div>
                              <div className="text-[11px] text-gray-600">
                                <span>Snapshot Ref: </span>
                                <b className="text-gray-800">{s.snapshotValueLabel}</b>
                              </div>
                              <div className="text-[10px] text-gray-400">
                                Simulated Window Range: {formatMetricValue(metric, minV, 'demo')} –{' '}
                                {formatMetricValue(metric, maxV, 'demo')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Compact NASA Provenance Bar with Expandable Details */}
                <div className="p-3.5 rounded-2xl bg-green-50/50 border border-green-100 text-xs flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-green-900">
                        {envTrend.dataMode === 'nasa-power'
                          ? 'NASA POWER Source:'
                          : 'Planned NASA Integration:'}
                      </span>
                      <span className="text-green-800">
                        {envTrend.metadata.plannedNasaProducts.join(' • ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNasaMetadata((prev) => !prev)}
                      className="text-green-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <span>{showNasaMetadata ? 'Hide Provenance' : 'Provenance & Caveats'}</span>
                      {showNasaMetadata ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-600">
                    <b>Provenance Note:</b> {envTrend.metadata.metricDistinctionNote}
                  </p>

                  {showNasaMetadata && (
                    <div className="pt-2.5 mt-1 border-t border-green-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-gray-700">
                      <div>
                        <span className="text-gray-400 block">Current Data Provider:</span>
                        <span className="font-medium">
                          {envTrend.metadata.currentProvider}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Observation Date &amp; Resolution:</span>
                        <span className="font-medium">
                          Date: {envTrend.metadata.observationDate ?? 'null'} • Spatial:{' '}
                          {envTrend.metadata.knownSpatialResolution ?? 'null'} • Temporal:{' '}
                          {envTrend.metadata.knownTemporalResolution ?? 'null'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Spatial &amp; Temporal Scale:</span>
                        <span>
                          {envTrend.metadata.plannedNasaSpatialResolutionNote} (
                          {envTrend.metadata.plannedNasaTemporalResolutionNote})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Processing &amp; Limitations:</span>
                        <span>{envTrend.metadata.uncertaintyAndLimitations}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* MODULE C: Risk History */}
              <section
                aria-label="Risk History"
                className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-gray-800 text-base">Risk History</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                        {isMyFarm ? 'My Farm Mode' : 'Simulated Demo Data'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isMyFarm
                        ? `Historical risk log for ${farmProfile.farmName} (demo snapshots excluded)`
                        : `Simulated risk evolution across ${timeRange.toUpperCase()} window (Equipment status "Active" is not treated as verified crop health)`}
                    </p>
                  </div>
                </div>

                {isMyFarm ? (
                  <div
                    data-testid="my-farm-no-risk-history"
                    className="p-5 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-600 flex flex-col gap-1.5"
                  >
                    <span className="font-semibold text-gray-800">
                      No recorded farm actions yet
                    </span>
                    <p className="leading-relaxed">
                      Simulated risk history from the three demo fields is excluded in <strong>My Farm</strong> mode. Switch to <strong>Explore Demo</strong> if you wish to inspect the team’s illustrative risk timeline.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {bundle.riskHistory.map((row) => (
                      <div
                        key={row.fieldId}
                        className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100 flex flex-col gap-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-800">
                              {row.fieldName}
                            </span>
                            <span className="text-xs text-gray-500">({row.cropType})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 font-medium">
                              Team Snapshot Score: <b>{row.snapshotScore}%</b>
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                              Equipment Status: <b>{row.equipmentStatusSnapshot}</b>
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-2">
                          {row.nodes.map((node, idx) => {
                            const style = getSimulatedRiskStyle(node.simulatedRisk);
                            return (
                              <div
                                key={idx}
                                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 ${style.cellBg}`}
                                title={`${node.slotLabel}: ${node.simulatedRisk} — ${node.summary}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold opacity-80">
                                    {node.slotLabel}
                                  </span>
                                  <span className={`w-2 h-2 rounded-full ${style.dotBg}`} />
                                </div>
                                <div className="text-[11px] font-semibold leading-tight">
                                  {node.simulatedRisk.replace(' (Simulated)', '')}
                                </div>
                                <div className="text-[9px] opacity-75 leading-tight line-clamp-2">
                                  {node.summary}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Secondary Column (5/12 on desktop): Module D (Activity Timeline) */}
            <div className="xl:col-span-5 flex flex-col gap-5 min-w-0">
              <section
                aria-label="Activity Timeline"
                className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-1 flex flex-col justify-between gap-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-gray-800 text-base">
                          Activity Timeline
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                          {isMyFarm ? 'My Farm Mode' : 'Simulated Demo Data'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isMyFarm
                          ? `Operation logs for ${farmProfile.farmName}`
                          : `Unverified demo farm operation logs (${bundle.activityTimeline.length} records in window)`}
                      </p>
                    </div>
                  </div>

                  {isMyFarm ? (
                    <div
                      data-testid="my-farm-no-activity-timeline"
                      className="p-6 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-600 flex flex-col gap-1.5"
                    >
                      <span className="font-semibold text-gray-800">
                        No recorded farm actions yet
                      </span>
                      <p className="leading-relaxed">
                        No real field operations have been recorded for <strong>{farmProfile.farmName}</strong>. CropWise does not display simulated demo activity logs when <strong>My Farm</strong> mode is active.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Activity Category Filter Tabs */}
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="group"
                        aria-label="Activity category filter"
                      >
                        {ACTIVITY_CATEGORY_OPTIONS.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActivityCategory(cat.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              activityCategory === cat.id
                                ? 'bg-green-800 text-white font-semibold shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {bundle.activityTimeline.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-400">
                          No simulated activity logs match the selected field, time range, and category.
                        </div>
                      ) : (
                        <div className="relative pl-4 border-l-2 border-green-100 flex flex-col gap-3.5">
                          {bundle.activityTimeline.map((item) => (
                            <div
                              key={item.id}
                              className="relative p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-green-200 transition-colors"
                            >
                              <span className="absolute -left-[21px] top-4 w-3 h-3 rounded-full bg-green-600 border-2 border-white shadow-sm" />
                              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                <span className="text-[11px] font-semibold text-green-800">
                                  {item.relativeTimeLabel}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-900 text-[10px] font-semibold">
                                  {item.statusLabel}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <span className="text-xs font-semibold text-gray-800">
                                  {item.fieldName}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 font-medium">
                                  {item.categoryLabel}
                                </span>
                              </div>

                              <h3 className="text-xs font-semibold text-gray-800 mb-1">
                                {item.operationTitle}
                              </h3>
                              <p className="text-[11px] text-gray-500 leading-relaxed">
                                {item.operationDetail}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-start gap-2 text-[11px] text-gray-400">
                  <ShieldAlert className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>
                    All timeline entries are <b className="text-gray-600">Simulated Demo Data</b>{' '}
                    (Observation date: <code className="text-gray-600">null</code>). They illustrate
                    the CropWise tracking interface and are not verified historical farm records.
                  </span>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default ReportsHistory;
