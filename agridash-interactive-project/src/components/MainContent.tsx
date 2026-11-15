import React, { useState } from 'react';
import {
  Check,
  MapPin,
  Plus,
  Trash2,
  Leaf,
  BarChart2,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import FarmMapPreview from './FarmMapPreview';
import {
  CURRENT_CROP_OPTIONS,
  IRRIGATION_OPTIONS,
} from '../services/realFarmEngine';
import {
  MAX_MY_FARM_FIELDS,
  MyFarmFieldSlot,
} from '../services/riskAndFarmStore';

const DEMO_FIELDS = [
  {
    id: 'north-field-a1',
    name: 'North Field A1 (Demo)',
    crop: 'Corn',
    area: '2.3 ha',
    note: 'Illustrative demo zone',
  },
  {
    id: 'east-field-b2',
    name: 'East Field B2 (Demo)',
    crop: 'Wheat',
    area: '4.1 ha',
    note: 'Illustrative demo zone',
  },
  {
    id: 'south-field-c3',
    name: 'South Field C3 (Demo)',
    crop: 'Soybean',
    area: '1.8 ha',
    note: 'Illustrative demo zone',
  },
];

interface MainContentProps {
  selectedFields: MyFarmFieldSlot[];
  activeFieldId: string;
  onSelectField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onOpenFullMap: () => void;
  onNavigate: (page: string) => void;
  activeDemoField?: string | null;
  setActiveDemoField?: (fieldId: string | null) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  selectedFields,
  activeFieldId,
  onSelectField,
  onRemoveField,
  onOpenFullMap,
  onNavigate,
  activeDemoField = 'north-field-a1',
  setActiveDemoField,
}) => {
  const [showDemoPreview, setShowDemoPreview] = useState(false);

  return (
    <main
      data-testid="dashboard-main-content"
      className="flex-1 flex flex-col min-w-0 ml-4 mr-4 gap-4 relative h-full"
    >
      {/* 1. Interactive Multi-Field Leaflet Map */}
      <div className="relative w-full h-[56%] min-h-[340px] rounded-3xl overflow-hidden shadow-sm flex-shrink-0 z-10 border border-gray-100 bg-gray-100">
        <FarmMapPreview
          selectedFields={selectedFields}
          activeFieldId={activeFieldId}
          onSelectField={onSelectField}
          onOpenFullMap={onOpenFullMap}
        />
      </div>

      {/* 2. Clean My Fields List & Quick Decision Actions */}
      <section
        data-testid="dashboard-my-fields-section"
        className="flex-1 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col z-10 overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-gray-900 text-base">
              My Fields ({selectedFields.length}/{MAX_MY_FARM_FIELDS})
            </h2>
            {selectedFields.length > 0 && (
              <span className="text-xs text-gray-500">
                Select a row to set the active field for Weather, Recommendations &amp; Risks
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="dashboard-add-edit-fields-btn"
              onClick={onOpenFullMap}
              className="px-3 py-1.5 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {selectedFields.length > 0 ? 'Add / Edit Fields' : 'Select Your Farm'}
              </span>
            </button>

            {selectedFields.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('team')}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Farm Setup</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('plants')}
                  className="px-3 py-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Leaf className="w-3.5 h-3.5" />
                  <span>Recommendations</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('analytics')}
                  className="px-3 py-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Planner</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('risks')}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Risks</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Selected Fields Table or Clean Empty State */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {selectedFields.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="pb-2.5 pl-2 font-medium w-8">Active</th>
                  <th className="pb-2.5 font-medium">Field Name</th>
                  <th className="pb-2.5 font-medium">Coordinates</th>
                  <th className="pb-2.5 font-medium">Boundary / Area</th>
                  <th className="pb-2.5 font-medium">Current Crop</th>
                  <th className="pb-2.5 font-medium">Soil pH</th>
                  <th className="pb-2.5 font-medium">Irrigation</th>
                  <th className="pb-2.5 font-medium text-right pr-2">Remove</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 divide-y divide-gray-50">
                {selectedFields.map((slot) => {
                  const isActive = slot.fieldId === activeFieldId;
                  const cropLabel =
                    CURRENT_CROP_OPTIONS.find((c) => c.key === slot.currentCrop)
                      ?.label.split(' (')[0] ?? slot.currentCrop;
                  const irrLabel =
                    IRRIGATION_OPTIONS.find(
                      (i) => i.id === slot.irrigationAvailability
                    )?.shortLabel ?? slot.irrigationAvailability;

                  return (
                    <tr
                      key={slot.fieldId}
                      data-testid={`dashboard-field-row-${slot.fieldId}`}
                      onClick={() => onSelectField(slot.fieldId)}
                      className={`transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-green-50/70 font-medium'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="py-3 pl-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isActive
                              ? 'bg-green-700 border-green-700 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3" />}
                        </div>
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        {slot.fieldName}
                      </td>
                      <td className="py-3 text-gray-600">
                        {slot.latitude !== null && slot.longitude !== null
                          ? `${slot.latitude.toFixed(4)}°, ${slot.longitude.toFixed(4)}°`
                          : '—'}
                      </td>
                      <td className="py-3 text-gray-600">
                        {slot.geometry ? (
                          <span className="text-green-800 font-medium">
                            USDA Parcel
                            {slot.areaHa ? ` · ${slot.areaHa} ha` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            Point Only (No Polygon)
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-700">{cropLabel}</td>
                      <td className="py-3 text-gray-600">
                        {slot.soilPh !== null
                          ? slot.soilPh.toFixed(1)
                          : 'Not set'}
                      </td>
                      <td className="py-3 text-gray-600">{irrLabel}</td>
                      <td className="py-3 text-right pr-2">
                        <button
                          type="button"
                          data-testid={`dashboard-remove-field-${slot.fieldId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveField(slot.fieldId);
                          }}
                          title="Remove field"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div
              data-testid="dashboard-no-fields-state"
              className="h-full flex flex-col justify-between gap-4"
            >
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-green-700" />
                    <span>No Farm Fields Selected</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Select up to {MAX_MY_FARM_FIELDS} real USDA parcels or coordinate points on the map to begin analysis.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="dashboard-empty-select-farm-btn"
                    onClick={onOpenFullMap}
                    className="px-4 py-2 rounded-xl bg-green-800 hover:bg-green-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Select Your Farm
                  </button>
                  <button
                    type="button"
                    data-testid="dashboard-toggle-demo-btn"
                    onClick={() => setShowDemoPreview((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold cursor-pointer"
                  >
                    {showDemoPreview ? 'Hide Demo Fields' : 'Explore Demo'}
                  </button>
                </div>
              </div>

              {showDemoPreview && (
                <div
                  data-testid="dashboard-demo-fields-preview"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
                >
                  {DEMO_FIELDS.map((df) => {
                    const isSelected = activeDemoField === df.id;
                    return (
                      <button
                        key={df.id}
                        type="button"
                        onClick={() =>
                          setActiveDemoField && setActiveDemoField(df.id)
                        }
                        className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/70 border-amber-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900">
                            {df.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            Demo Only
                          </span>
                        </div>
                        <p className="text-gray-500">
                          {df.crop} · {df.area} ({df.note})
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default MainContent;
