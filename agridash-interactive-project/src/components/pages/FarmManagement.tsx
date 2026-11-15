import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Leaf,
  BarChart2,
  ShieldAlert,
  Globe,
  RotateCcw,
} from 'lucide-react';
import {
  CURRENT_CROP_OPTIONS,
  CurrentCropKey,
  GLOBAL_QUICK_LOCATIONS,
  REAL_FARM_HISTORICAL_WINDOWS,
  HistoricalWindowId,
  IRRIGATION_OPTIONS,
  IrrigationAvailability,
  parseOptionalSoilPh,
  resetMyFarmProfileAndLocation,
  validateCoordinates,
} from '../../services/realFarmEngine';
import { PlannerGoalId } from '../../data/decisionPlannerData';
import {
  getMyFarmMultiFieldState,
  MAX_MY_FARM_FIELDS,
  MyFarmFieldSlot,
  MyFarmMultiFieldState,
  saveMyFarmMultiFieldState,
} from '../../services/riskAndFarmStore';

interface FarmManagementProps {
  onNavigate?: (page: string) => void;
}

const GOAL_OPTIONS: { id: PlannerGoalId; label: string; description: string }[] =
  [
    {
      id: 'earn-more',
      label: 'Earn More (Market Return Focus)',
      description:
        'Prioritizes higher-value cash crops and nitrogen-credit savings.',
    },
    {
      id: 'lower-risk',
      label: 'Lower Risk (Water & Input Buffer)',
      description:
        'Prioritizes drought-resilient, low-input crops with stable establishment.',
    },
    {
      id: 'more-crops',
      label: 'More Crops (Botanical Diversity)',
      description:
        'Prioritizes multi-family crop rotations that break pest Cycles.',
    },
  ];

const FarmManagement: React.FC<FarmManagementProps> = ({ onNavigate }) => {
  const [state, setState] = useState<MyFarmMultiFieldState>(() =>
    getMyFarmMultiFieldState()
  );
  const activeSlot =
    state.fields.find((f) => f.fieldId === state.activeFieldId) ??
    state.fields[0];

  const [latDraft, setLatDraft] = useState<string>(
    activeSlot.latitude !== null ? String(activeSlot.latitude) : ''
  );
  const [lonDraft, setLonDraft] = useState<string>(
    activeSlot.longitude !== null ? String(activeSlot.longitude) : ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const syncDraftsFromSlot = (slot: MyFarmFieldSlot) => {
    setLatDraft(slot.latitude !== null ? String(slot.latitude) : '');
    setLonDraft(slot.longitude !== null ? String(slot.longitude) : '');
    setErrorMsg(null);
  };

  const commitSlotUpdate = (
    updater: (slot: MyFarmFieldSlot) => MyFarmFieldSlot,
    notice?: string
  ) => {
    const nextFields = state.fields.map((f) =>
      f.fieldId === activeSlot.fieldId ? updater(f) : f
    );
    const saved = saveMyFarmMultiFieldState({
      activeFieldId: activeSlot.fieldId,
      fields: nextFields,
    });
    setState(saved);
    if (notice) {
      setSavedNotice(notice);
    }
  };

  const handleSelectFieldSlot = (fieldId: string) => {
    const target = state.fields.find((f) => f.fieldId === fieldId);
    if (!target) return;
    const saved = saveMyFarmMultiFieldState({
      ...state,
      activeFieldId: fieldId,
    });
    setState(saved);
    syncDraftsFromSlot(target);
    setSavedNotice(
      `Switched active field to "${target.fieldName}". Synced to Crop Recommendations, Decision Planner, and Risk Management.`
    );
  };

  const handleAddFieldSlot = () => {
    if (state.fields.length >= MAX_MY_FARM_FIELDS) return;
    const nextIndex = state.fields.length + 1;
    const newSlot: MyFarmFieldSlot = {
      fieldId: `my-field-${Date.now()}`,
      fieldName: `My Farm Field ${nextIndex}`,
      latitude: activeSlot.latitude,
      longitude: activeSlot.longitude,
      locationLabel: activeSlot.locationLabel,
      currentCrop: 'wheat',
      soilPhInput: '',
      soilPh: null,
      irrigationAvailability: 'limited-supplemental',
      primaryGoal: 'earn-more',
      historicalWindow: '30d',
      notesConstraint: '',
      updatedAtIso: new Date().toISOString(),
    };
    const saved = saveMyFarmMultiFieldState({
      activeFieldId: newSlot.fieldId,
      fields: [...state.fields, newSlot],
    });
    setState(saved);
    syncDraftsFromSlot(newSlot);
    setSavedNotice(`Added "${newSlot.fieldName}" (${saved.fields.length}/${MAX_MY_FARM_FIELDS} fields).`);
  };

  const handleDeleteFieldSlot = (fieldId: string) => {
    if (state.fields.length <= 1) return;
    const remaining = state.fields.filter((f) => f.fieldId !== fieldId);
    const nextActive =
      state.activeFieldId === fieldId ? remaining[0].fieldId : state.activeFieldId;
    const saved = saveMyFarmMultiFieldState({
      activeFieldId: nextActive,
      fields: remaining,
    });
    setState(saved);
    const activeObj =
      saved.fields.find((f) => f.fieldId === saved.activeFieldId) ??
      saved.fields[0];
    syncDraftsFromSlot(activeObj);
    setSavedNotice('Removed field slot and updated active farm profile.');
  };

  const handleApplyCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    if (latDraft.trim() === '' && lonDraft.trim() === '') {
      commitSlotUpdate(
        (slot) => ({
          ...slot,
          latitude: null,
          longitude: null,
          locationLabel: 'Coordinates Not Verified',
          updatedAtIso: new Date().toISOString(),
        }),
        'Cleared coordinates for active field.'
      );
      setErrorMsg(null);
      return;
    }

    const check = validateCoordinates(latDraft, lonDraft);
    if (!check.valid) {
      setErrorMsg(check.error);
      return;
    }

    setErrorMsg(null);
    commitSlotUpdate(
      (slot) => ({
        ...slot,
        latitude: check.latitude,
        longitude: check.longitude,
        locationLabel: `${slot.fieldName} (${check.latitude}°, ${check.longitude}°)`,
        updatedAtIso: new Date().toISOString(),
      }),
      `Saved verified coordinates (${check.latitude}°, ${check.longitude}°) to ${activeSlot.fieldName}.`
    );
  };

  const handleSelectQuickLocation = (locId: string) => {
    const loc = GLOBAL_QUICK_LOCATIONS.find((l) => l.id === locId);
    if (!loc) return;
    setLatDraft(String(loc.latitude));
    setLonDraft(String(loc.longitude));
    setErrorMsg(null);
    commitSlotUpdate(
      (slot) => ({
        ...slot,
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationLabel: `${loc.label} — ${loc.climateHint}`,
        updatedAtIso: new Date().toISOString(),
      }),
      `Applied benchmark location: ${loc.label} (${loc.latitude}°, ${loc.longitude}°).`
    );
  };

  const handleSoilPhChange = (raw: string) => {
    const check = parseOptionalSoilPh(raw);
    if (!check.valid && raw.trim() !== '') {
      setErrorMsg(check.error);
    } else {
      setErrorMsg(null);
    }
    commitSlotUpdate((slot) => ({
      ...slot,
      soilPhInput: raw,
      soilPh: check.valid ? check.value : slot.soilPh,
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleResetAll = () => {
    const defaultProfile = resetMyFarmProfileAndLocation();
    const initialSlot: MyFarmFieldSlot = {
      fieldId: 'my-field-1',
      fieldName: defaultProfile.farmName,
      latitude: null,
      longitude: null,
      locationLabel: 'Coordinates Not Verified',
      currentCrop: defaultProfile.currentCrop,
      soilPhInput: '',
      soilPh: null,
      irrigationAvailability: defaultProfile.irrigationAvailability,
      primaryGoal: defaultProfile.primaryGoal,
      historicalWindow: defaultProfile.historicalWindow,
      notesConstraint: '',
      updatedAtIso: new Date().toISOString(),
    };
    const saved = saveMyFarmMultiFieldState({
      activeFieldId: initialSlot.fieldId,
      fields: [initialSlot],
    });
    setState(saved);
    syncDraftsFromSlot(initialSlot);
    setSavedNotice('Reset My Farm profile and location to defaults.');
  };

  return (
    <main
      data-testid="farm-management-page"
      className="flex-1 flex flex-col min-w-0 ml-3 mr-3 md:ml-5 md:mr-5 gap-5 relative h-full overflow-y-auto pr-1 custom-scrollbar pb-6"
    >
      {/* Header Card */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex-shrink-0 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-800 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-semibold text-gray-800">
                  Farm Management &amp; Multi-Field Setup
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                  Synced With Shared My Farm State
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                Configure up to {MAX_MY_FARM_FIELDS} farm fields. The active field automatically drives Crop Recommendations, Decision Planner, Risk Management, and Reports.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="farm-mgmt-reset-btn"
              onClick={handleResetAll}
              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            {onNavigate && (
              <>
                <button
                  type="button"
                  data-testid="farm-mgmt-go-recommendations-btn"
                  onClick={() => onNavigate('plants')}
                  className="px-3.5 py-1.5 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Leaf className="w-3.5 h-3.5" />
                  <span>Crop Recommendations</span>
                </button>
                <button
                  type="button"
                  data-testid="farm-mgmt-go-planner-btn"
                  onClick={() => onNavigate('analytics')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Decision Planner</span>
                </button>
                <button
                  type="button"
                  data-testid="farm-mgmt-go-risks-btn"
                  onClick={() => onNavigate('risks')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Risk Management</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Multi-Field Slot Tabs (Up to 5 Fields) */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">
              Configured Fields ({state.fields.length}/{MAX_MY_FARM_FIELDS}):
            </span>
            {state.fields.map((slot) => {
              const isSelected = slot.fieldId === activeSlot.fieldId;
              return (
                <div
                  key={slot.fieldId}
                  className={`flex items-center rounded-xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-green-800 text-white border-green-800 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-green-50'
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`farm-field-slot-btn-${slot.fieldId}`}
                    onClick={() => handleSelectFieldSlot(slot.fieldId)}
                    className="px-3 py-1.5 cursor-pointer"
                  >
                    {slot.fieldName}
                  </button>
                  {state.fields.length > 1 && (
                    <button
                      type="button"
                      data-testid={`farm-field-delete-btn-${slot.fieldId}`}
                      onClick={() => handleDeleteFieldSlot(slot.fieldId)}
                      title="Delete field slot"
                      className={`pr-2 pl-1 py-1.5 cursor-pointer ${
                        isSelected
                          ? 'text-green-200 hover:text-white'
                          : 'text-gray-400 hover:text-red-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="farm-add-field-slot-btn"
            disabled={state.fields.length >= MAX_MY_FARM_FIELDS}
            onClick={handleAddFieldSlot}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              state.fields.length >= MAX_MY_FARM_FIELDS
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-700 hover:bg-green-800 text-white cursor-pointer'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Field ({state.fields.length}/{MAX_MY_FARM_FIELDS})</span>
          </button>
        </div>

        {savedNotice && (
          <div
            data-testid="farm-mgmt-saved-banner"
            className="p-3 rounded-2xl bg-green-50 border border-green-200 text-xs text-green-900 flex items-center justify-between gap-2"
          >
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-700" />
              <span>{savedNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setSavedNotice(null)}
              className="text-green-800 font-bold px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Two-Column Editor */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Farm Name, Agronomic Profile, Soil pH, Irrigation, Goal */}
        <section className="xl:col-span-7 bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            1. Agronomic Profile &amp; Soil / Irrigation Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Farm / Field Name */}
            <div>
              <label
                htmlFor="farm-mgmt-name-input"
                className="block font-semibold text-gray-700 mb-1"
              >
                Farm / Field Name
              </label>
              <input
                id="farm-mgmt-name-input"
                data-testid="farm-mgmt-name-input"
                type="text"
                value={activeSlot.fieldName}
                onChange={(e) =>
                  commitSlotUpdate((slot) => ({
                    ...slot,
                    fieldName: e.target.value,
                    updatedAtIso: new Date().toISOString(),
                  }))
                }
                placeholder="e.g. Ames North Parcel"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 focus:outline-none focus:border-green-600"
              />
            </div>

            {/* Current Crop */}
            <div>
              <label
                htmlFor="farm-mgmt-crop-select"
                className="block font-semibold text-gray-700 mb-1"
              >
                Current / Previous Crop
              </label>
              <select
                id="farm-mgmt-crop-select"
                data-testid="farm-mgmt-crop-select"
                value={activeSlot.currentCrop}
                onChange={(e) =>
                  commitSlotUpdate(
                    (slot) => ({
                      ...slot,
                      currentCrop: e.target.value as CurrentCropKey,
                      updatedAtIso: new Date().toISOString(),
                    }),
                    `Updated current crop to ${e.target.value}.`
                  )
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 focus:outline-none focus:border-green-600 cursor-pointer"
              >
                {CURRENT_CROP_OPTIONS.map((crop) => (
                  <option key={crop.key} value={crop.key}>
                    {crop.label} ({crop.family})
                  </option>
                ))}
              </select>
            </div>

            {/* Soil pH */}
            <div>
              <label
                htmlFor="farm-mgmt-ph-input"
                className="block font-semibold text-gray-700 mb-1"
              >
                Soil pH (2.0 – 10.0, optional)
              </label>
              <input
                id="farm-mgmt-ph-input"
                data-testid="farm-mgmt-ph-input"
                type="text"
                value={activeSlot.soilPhInput}
                onChange={(e) => handleSoilPhChange(e.target.value)}
                placeholder="Leave blank if unmeasured (e.g. 6.4)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 focus:outline-none focus:border-green-600"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Parsed Soil pH:{' '}
                <b>
                  {activeSlot.soilPh !== null
                    ? activeSlot.soilPh.toFixed(1)
                    : 'Not provided (unmeasured)'}
                </b>
              </span>
            </div>

            {/* Irrigation Availability */}
            <div>
              <label
                htmlFor="farm-mgmt-irrigation-select"
                className="block font-semibold text-gray-700 mb-1"
              >
                Irrigation Availability
              </label>
              <select
                id="farm-mgmt-irrigation-select"
                data-testid="farm-mgmt-irrigation-select"
                value={activeSlot.irrigationAvailability}
                onChange={(e) =>
                  commitSlotUpdate(
                    (slot) => ({
                      ...slot,
                      irrigationAvailability:
                        e.target.value as IrrigationAvailability,
                      updatedAtIso: new Date().toISOString(),
                    }),
                    'Updated irrigation availability.'
                  )
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 focus:outline-none focus:border-green-600 cursor-pointer"
              >
                {IRRIGATION_OPTIONS.map((irr) => (
                  <option key={irr.id} value={irr.id}>
                    {irr.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Agricultural Goal */}
          <div className="pt-2">
            <span className="block text-xs font-semibold text-gray-700 mb-2">
              Primary Agricultural Goal
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {GOAL_OPTIONS.map((goal) => {
                const isSelected = activeSlot.primaryGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    data-testid={`farm-mgmt-goal-${goal.id}`}
                    onClick={() =>
                      commitSlotUpdate(
                        (slot) => ({
                          ...slot,
                          primaryGoal: goal.id,
                          updatedAtIso: new Date().toISOString(),
                        }),
                        `Updated primary goal to "${goal.label}".`
                      )
                    }
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? 'bg-green-800 text-white border-green-800 shadow-sm'
                        : 'bg-gray-50/70 text-gray-800 border-gray-200 hover:bg-green-50'
                    }`}
                  >
                    <span className="text-xs font-semibold">{goal.label}</span>
                    <span
                      className={`text-[11px] leading-snug ${
                        isSelected ? 'text-green-100' : 'text-gray-500'
                      }`}
                    >
                      {goal.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Historical NASA POWER Climate Window */}
          <div className="pt-2">
            <label
              htmlFor="farm-mgmt-window-select"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Historical Climate Screening Window (NASA POWER)
            </label>
            <select
              id="farm-mgmt-window-select"
              data-testid="farm-mgmt-window-select"
              value={activeSlot.historicalWindow}
              onChange={(e) =>
                commitSlotUpdate((slot) => ({
                  ...slot,
                  historicalWindow: e.target.value as HistoricalWindowId,
                  updatedAtIso: new Date().toISOString(),
                }))
              }
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-xs text-gray-900 cursor-pointer"
            >
              {Object.values(REAL_FARM_HISTORICAL_WINDOWS).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} ({w.startIso} to {w.endIso})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Right Column: Verified Latitude / Longitude & Global Quick Presets */}
        <section className="xl:col-span-5 bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-50 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-700" />
              <span>2. Farm Coordinates (Latitude &amp; Longitude)</span>
            </h2>

            <div className="p-3.5 rounded-2xl bg-green-50/70 border border-green-200 text-xs flex flex-col gap-1">
              <span className="font-semibold text-green-950">
                Active Coordinate Status:
              </span>
              <span
                data-testid="farm-mgmt-verified-coords-display"
                className="text-green-900 font-medium"
              >
                {activeSlot.latitude !== null && activeSlot.longitude !== null
                  ? `Verified: ${activeSlot.latitude.toFixed(4)}°, ${activeSlot.longitude.toFixed(4)}° (${activeSlot.locationLabel})`
                  : 'Not Verified — Enter coordinates below or select a benchmark location'}
              </span>
            </div>

            <form
              onSubmit={handleApplyCoordinates}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
            >
              <div>
                <label
                  htmlFor="farm-mgmt-lat-input"
                  className="block font-semibold text-gray-700 mb-1"
                >
                  Latitude (-90 to 90)
                </label>
                <input
                  id="farm-mgmt-lat-input"
                  data-testid="farm-mgmt-lat-input"
                  type="text"
                  value={latDraft}
                  onChange={(e) => setLatDraft(e.target.value)}
                  placeholder="e.g. 42.0308"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 focus:outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label
                  htmlFor="farm-mgmt-lon-input"
                  className="block font-semibold text-gray-700 mb-1"
                >
                  Longitude (-180 to 180)
                </label>
                <input
                  id="farm-mgmt-lon-input"
                  data-testid="farm-mgmt-lon-input"
                  type="text"
                  value={lonDraft}
                  onChange={(e) => setLonDraft(e.target.value)}
                  placeholder="e.g. -93.6319"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 focus:outline-none focus:border-green-600"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  data-testid="farm-mgmt-save-coords-btn"
                  className="px-4 py-2 rounded-xl bg-green-800 hover:bg-green-700 text-white font-semibold cursor-pointer"
                >
                  Save &amp; Verify Coordinates
                </button>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('map')}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold cursor-pointer"
                  >
                    Pick From Iowa USDA Map
                  </button>
                )}
              </div>
            </form>

            {/* Quick Global & US Benchmarks */}
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-green-700" />
                <span>Quick Test Coordinates:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {GLOBAL_QUICK_LOCATIONS.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    data-testid={`farm-mgmt-preset-${loc.id}`}
                    onClick={() => handleSelectQuickLocation(loc.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-green-50 border border-gray-200 text-xs font-medium text-gray-700 cursor-pointer"
                  >
                    {loc.label} ({loc.latitude}°, {loc.longitude}°)
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 pt-3 border-t border-gray-100">
            All changes persist to <code>localStorage</code> and synchronize immediately with <code>MyFarmProfile</code> and <code>VerifiedFarmLocation</code>.
          </p>
        </section>
      </div>
    </main>
  );
};

export default FarmManagement;
