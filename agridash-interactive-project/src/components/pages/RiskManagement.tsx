import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  CloudRain,
  Database,
  Sliders,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  RefreshCw,
  Trash2,
  MapPin,
} from 'lucide-react';
import {
  CURRENT_CROP_OPTIONS,
  getSavedMyFarmProfile,
  getSharedFarmLocationState,
  IRRIGATION_OPTIONS,
  MyFarmProfile,
  resolveActiveHistoricalWindow,
  VerifiedFarmLocation,
} from '../../services/realFarmEngine';
import {
  fetchNasaPowerDaily,
  NasaPowerDailyResult,
} from '../../services/nasaPowerClient';
import {
  CompletedRiskActionRecord,
  EvaluatedRiskItem,
  evaluateExplainableRisks,
  getCompletedRiskActions,
  getMyFarmMultiFieldState,
  MyFarmMultiFieldState,
  recordCompletedRiskAction,
  removeCompletedRiskAction,
  RiskCategory,
  RiskSeverity,
  saveMyFarmMultiFieldState,
} from '../../services/riskAndFarmStore';
import {
  isLikelyUSCoordinate,
  Place,
  PLACES,
  useWeather,
} from '../../weather/useWeather';

interface RiskManagementProps {
  weatherPlace?: Place;
  onNavigate?: (page: string) => void;
}

function getSeverityStyles(severity: RiskSeverity) {
  switch (severity) {
    case 'High':
      return {
        badge: 'bg-red-100 text-red-800 border-red-200',
        border: 'border-red-200/80',
        dot: 'bg-red-500',
      };
    case 'Moderate':
      return {
        badge: 'bg-amber-100 text-amber-900 border-amber-200',
        border: 'border-amber-200/80',
        dot: 'bg-amber-500',
      };
    case 'Low':
      return {
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        border: 'border-emerald-200/80',
        dot: 'bg-emerald-500',
      };
  }
}

const RiskManagement: React.FC<RiskManagementProps> = ({
  weatherPlace = PLACES[0],
  onNavigate,
}) => {
  const [multiFieldState, setMultiFieldState] = useState<MyFarmMultiFieldState>(
    () => getMyFarmMultiFieldState()
  );
  const [farmProfile, setFarmProfile] = useState<MyFarmProfile>(() =>
    getSavedMyFarmProfile()
  );
  const [verifiedLocation, setVerifiedLocation] =
    useState<VerifiedFarmLocation | null>(
      () => getSharedFarmLocationState().verifiedLocation
    );

  const [nasaResult, setNasaResult] = useState<NasaPowerDailyResult | null>(
    null
  );
  const [nasaStatus, setNasaStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [nasaError, setNasaError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<'all' | RiskCategory>(
    'all'
  );
  const [completedActions, setCompletedActions] = useState<
    CompletedRiskActionRecord[]
  >(() => getCompletedRiskActions());
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [recentBanner, setRecentBanner] = useState<string | null>(null);

  // Determine effective weather place: use verified farm coordinates if available, else selected weatherPlace
  const effectiveWeatherPlace: Place = verifiedLocation
    ? {
        name: farmProfile.farmName || verifiedLocation.label,
        region: 'Verified Farm Location',
        lat: verifiedLocation.latitude,
        lon: verifiedLocation.longitude,
        isUS: isLikelyUSCoordinate(
          verifiedLocation.latitude,
          verifiedLocation.longitude
        ),
      }
    : weatherPlace;

  const {
    weather,
    loading: weatherLoading,
    error: weatherError,
    refresh: refreshWeather,
  } = useWeather(effectiveWeatherPlace);

  const activeWindow = resolveActiveHistoricalWindow(farmProfile);

  useEffect(() => {
    if (!verifiedLocation) {
      setNasaResult(null);
      setNasaStatus('idle');
      setNasaError(null);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    setNasaStatus('loading');
    setNasaError(null);

    fetchNasaPowerDaily({
      latitude: verifiedLocation.latitude,
      longitude: verifiedLocation.longitude,
      startDate: activeWindow.startDate,
      endDate: activeWindow.endDate,
      signal: controller.signal,
    })
      .then((res: NasaPowerDailyResult) => {
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
            : 'Unable to fetch NASA POWER climate series.'
        );
        setNasaStatus('error');
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [verifiedLocation, activeWindow.startIso, activeWindow.endIso]);

  const handleSwitchActiveField = (fieldId: string) => {
    const updated = saveMyFarmMultiFieldState({
      ...multiFieldState,
      activeFieldId: fieldId,
    });
    setMultiFieldState(updated);
    setFarmProfile(getSavedMyFarmProfile());
    setVerifiedLocation(getSharedFarmLocationState().verifiedLocation);
  };

  const risks = evaluateExplainableRisks({
    profile: farmProfile,
    verifiedLocation,
    weather,
    nasaResult,
    fieldId: multiFieldState.activeFieldId,
  });

  const filteredRisks =
    categoryFilter === 'all'
      ? risks
      : risks.filter((r) => r.category === categoryFilter);

  const forecastRisks = filteredRisks.filter((r) => r.category === 'forecast');
  const climateRisks = filteredRisks.filter(
    (r) => r.category === 'historical-climate'
  );
  const profileRisks = filteredRisks.filter(
    (r) => r.category === 'farm-profile'
  );

  const handleMarkCompleted = (risk: EvaluatedRiskItem) => {
    const note = noteDrafts[risk.id] ?? '';
    const updated = recordCompletedRiskAction(
      risk,
      farmProfile.currentCrop,
      note
    );
    setCompletedActions(updated);
    setNoteDrafts((prev) => ({ ...prev, [risk.id]: '' }));
    setRecentBanner(
      `Recorded completed action "${risk.recommendedActionTitle}" for ${risk.farmOrFieldName}. Synced to Reports & History.`
    );
  };

  const handleRemoveCompleted = (actionId: string) => {
    const updated = removeCompletedRiskAction(actionId);
    setCompletedActions(updated);
  };

  const renderRiskCard = (risk: EvaluatedRiskItem) => {
    const style = getSeverityStyles(risk.severity);
    const matchingRecords = completedActions.filter(
      (a) => a.riskId === risk.id
    );
    const latestRecord = matchingRecords[0] ?? null;

    return (
      <article
        key={risk.id}
        data-testid={`risk-card-${risk.id}`}
        className={`rounded-3xl bg-white p-5 shadow-sm border ${style.border} flex flex-col justify-between gap-4`}
      >
        <div className="flex flex-col gap-3">
          {/* Header Row: Severity, Category, Farm/Field */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid={`risk-severity-${risk.id}`}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${style.badge}`}
              >
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span>{risk.severity} Severity</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                {risk.categoryLabel}
              </span>
            </div>

            <span className="text-xs font-semibold text-green-900 bg-green-50 px-2.5 py-1 rounded-xl border border-green-100">
              {risk.farmOrFieldName} · {risk.cropLabel}
            </span>
          </div>

          <h3 className="text-base font-semibold text-gray-900">
            {risk.title}
          </h3>

          {/* Supporting Data */}
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 block mb-1.5">
              Supporting Data
            </span>
            <ul className="space-y-1 text-xs text-gray-700">
              {risk.supportingData.map((line, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-green-700 font-bold">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Explainable Risk Reasoning */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 block mb-1">
              Explainable Risk Reasoning
            </span>
            <p className="text-xs text-gray-700 leading-relaxed">
              {risk.reasoning}
            </p>
          </div>

          {/* Recommended Action Box */}
          <div className="rounded-2xl bg-green-50/70 border border-green-200/80 p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-green-800">
                Recommended Agronomic Action
              </span>
              {latestRecord && (
                <span
                  data-testid={`risk-completed-badge-${risk.id}`}
                  className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Action Logged ({matchingRecords.length})</span>
                </span>
              )}
            </div>
            <h4 className="text-xs font-semibold text-gray-900 mb-1">
              {risk.recommendedActionTitle}
            </h4>
            <p className="text-xs text-gray-700 leading-relaxed">
              {risk.recommendedActionDetail}
            </p>
          </div>
        </div>

        {/* Action Tracking & Provenance Footer */}
        <div className="pt-3 border-t border-gray-100 flex flex-col gap-3">
          {/* Optional Note + Mark as Completed Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              data-testid={`risk-action-notes-${risk.id}`}
              value={noteDrafts[risk.id] ?? ''}
              onChange={(e) =>
                setNoteDrafts((prev) => ({
                  ...prev,
                  [risk.id]: e.target.value,
                }))
              }
              placeholder="Optional operator note (e.g. lime applied, drainage cleared)..."
              className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/70 text-xs text-gray-800 focus:outline-none focus:border-green-600"
            />
            <button
              type="button"
              data-testid={`mark-completed-btn-${risk.id}`}
              onClick={() => handleMarkCompleted(risk)}
              className="px-3.5 py-1.5 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark as Completed</span>
            </button>
          </div>

          {/* Recorded Completion Log (Does NOT auto-resolve underlying risk) */}
          {latestRecord && (
            <div
              data-testid={`risk-completion-record-${risk.id}`}
              className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs flex flex-col gap-1"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-amber-950 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    Completed{' '}
                    {new Date(latestRecord.completedAtIso).toLocaleString()}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 text-[10px] font-semibold">
                  {latestRecord.verificationStatusLabel}
                </span>
              </div>
              {latestRecord.userNotes && (
                <p className="text-gray-700 text-[11px] mt-0.5">
                  <b>Operator Note:</b> {latestRecord.userNotes}
                </p>
              )}
              <p className="text-[10px] text-amber-900/90 mt-0.5">
                Recording action completion logs your field intervention in Reports &amp; History; it does not automatically eliminate the underlying {risk.severity.toLowerCase()} risk without field verification.
              </p>
            </div>
          )}

          {/* Data Source & Timestamp */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>
              <b>Source:</b> {risk.dataSourceLabel} ({risk.sourceTimestampLabel})
            </span>
            <span className="text-[10px] text-gray-400">
              {risk.scientificBoundaryNote}
            </span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <main
      data-testid="risk-management-page"
      className="flex-1 flex flex-col min-w-0 ml-3 mr-3 md:ml-5 md:mr-5 gap-5 relative h-full overflow-y-auto pr-1 custom-scrollbar pb-6"
    >
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-semibold text-gray-800">
                  Risk Management &amp; Action Tracking
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                  Explainable Rule-Based Assessment
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                Separates Weather Forecast Risks, NASA POWER Historical Climate Constraints, and My Farm Profile Constraints
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <>
                <button
                  type="button"
                  data-testid="risk-nav-to-farm-management-btn"
                  onClick={() => onNavigate('team')}
                  className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Edit Farm Setup
                </button>
                <button
                  type="button"
                  data-testid="risk-nav-to-reports-btn"
                  onClick={() => onNavigate('reports')}
                  className="px-3.5 py-1.5 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Reports &amp; History ({completedActions.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Multi-Field Selector & Current Context Strip */}
        <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-green-700" />
              <span>Active Farm / Field:</span>
            </span>
            {multiFieldState.fields.map((slot) => {
              const isSelected = slot.fieldId === multiFieldState.activeFieldId;
              return (
                <button
                  key={slot.fieldId}
                  type="button"
                  data-testid={`risk-field-tab-${slot.fieldId}`}
                  onClick={() => handleSwitchActiveField(slot.fieldId)}
                  className={`px-3 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-green-800 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-green-50'
                  }`}
                >
                  {slot.fieldName}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200">
              Crop:{' '}
              <b>
                {CURRENT_CROP_OPTIONS.find(
                  (c) => c.key === farmProfile.currentCrop
                )?.label ?? farmProfile.currentCrop}
              </b>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200">
              Soil pH:{' '}
              <b>
                {farmProfile.soilPh !== null
                  ? farmProfile.soilPh.toFixed(1)
                  : 'Not provided'}
              </b>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200">
              Irrigation:{' '}
              <b>
                {IRRIGATION_OPTIONS.find(
                  (i) => i.id === farmProfile.irrigationAvailability
                )?.shortLabel ?? farmProfile.irrigationAvailability}
              </b>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200">
              Coordinates:{' '}
              <b>
                {verifiedLocation
                  ? `${verifiedLocation.latitude.toFixed(3)}°, ${verifiedLocation.longitude.toFixed(3)}°`
                  : 'Unverified'}
              </b>
            </span>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Risk category filter"
          >
            {[
              { id: 'all', label: `All Risks (${risks.length})` },
              {
                id: 'forecast',
                label: `1. Weather Forecast Risks (${
                  risks.filter((r) => r.category === 'forecast').length
                })`,
              },
              {
                id: 'historical-climate',
                label: `2. Historical Climate Constraints (${
                  risks.filter((r) => r.category === 'historical-climate').length
                })`,
              },
              {
                id: 'farm-profile',
                label: `3. Farm Profile Constraints (${
                  risks.filter((r) => r.category === 'farm-profile').length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`risk-filter-${tab.id}`}
                onClick={() =>
                  setCategoryFilter(tab.id as 'all' | RiskCategory)
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-green-800 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={refreshWeather}
            className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-green-700 ${
                weatherLoading || nasaStatus === 'loading' ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh Live Sources</span>
          </button>
        </div>

        {recentBanner && (
          <div
            data-testid="risk-action-completed-banner"
            className="p-3 rounded-2xl bg-green-50 border border-green-200 text-xs text-green-900 flex items-center justify-between gap-2"
          >
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-700" />
              <span>{recentBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => setRecentBanner(null)}
              className="text-green-800 font-bold px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {(weatherError || nasaError) && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col gap-1">
            {weatherError && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  <b>Weather Forecast Notice:</b> {weatherError}
                </span>
              </div>
            )}
            {nasaError && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  <b>NASA POWER Notice:</b> {nasaError}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 1: Weather Forecast Risks */}
      {forecastRisks.length > 0 && (
        <section
          data-testid="risk-section-forecast"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 px-1">
            <CloudRain className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">
              1. Short-Range Weather Forecast Risks (NOAA / Open-Meteo)
            </h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {forecastRisks.map(renderRiskCard)}
          </div>
        </section>
      )}

      {/* Section 2: Historical Climate Constraints */}
      {climateRisks.length > 0 && (
        <section
          data-testid="risk-section-historical-climate"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 px-1">
            <Database className="w-4 h-4 text-green-700" />
            <h2 className="text-sm font-semibold text-gray-800">
              2. Historical Climate Constraints (NASA POWER Agroclimatology)
            </h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {climateRisks.map(renderRiskCard)}
          </div>
        </section>
      )}

      {/* Section 3: Farm Profile Constraints */}
      {profileRisks.length > 0 && (
        <section
          data-testid="risk-section-farm-profile"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 px-1">
            <Sliders className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-gray-800">
              3. Farm Profile &amp; Agronomic Constraints (Soil pH, Rotation &amp; Irrigation)
            </h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {profileRisks.map(renderRiskCard)}
          </div>
        </section>
      )}

      {/* Completed Risk Actions Log Summary */}
      <section
        data-testid="risk-completed-actions-log"
        className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Completed Risk Mitigation Actions ({completedActions.length})
            </h2>
            <p className="text-xs text-gray-500">
              Persisted in localStorage and integrated directly with Reports &amp; History (My Farm mode)
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-green-800 hover:underline cursor-pointer"
            >
              Open Reports &amp; History →
            </button>
          )}
        </div>

        {completedActions.length === 0 ? (
          <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-500">
            No risk actions have been marked as completed yet. Click{' '}
            <b>Mark as Completed</b> on any recommended action above to record an intervention.
          </div>
        ) : (
          <div className="space-y-2.5">
            {completedActions.map((rec) => (
              <div
                key={rec.id}
                data-testid={`completed-action-row-${rec.id}`}
                className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-wrap items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {rec.recommendedActionTitle}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-semibold">
                      {rec.fieldName} ({rec.cropLabel})
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-semibold">
                      {rec.verificationStatusLabel}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    Addresses: <b>{rec.riskTitle}</b> ({rec.riskCategoryLabel} ·{' '}
                    {rec.riskSeverityAtCompletion} Severity)
                  </p>
                  {rec.userNotes && (
                    <p className="text-gray-700">
                      <b>Operator Note:</b> {rec.userNotes}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400">
                    Completed: {new Date(rec.completedAtIso).toLocaleString()} · Source:{' '}
                    {rec.dataSourceLabel}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveCompleted(rec.id)}
                  title="Remove recorded action"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default RiskManagement;
