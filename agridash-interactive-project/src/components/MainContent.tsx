import React from 'react';
import {
  Calendar,
  ChevronDown,
  Check,
  Expand,
  Plus,
  Minus,
  Navigation,
  MoreVertical,
  MoreHorizontal,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import GaugeChart from './charts/GaugeChart';

// Base Demo Data (Preserved)
const baseFieldData = {
  'north-field-a1': {
    name: 'North Field A1',
    type: 'Corn Plantation',
    score: 70,
    humidity: '32%',
    ph: '2.8',
    area: '2.3',
    water: '1,250L',
    fertilizer: '87%',
    status: 'Active',
    statusColor: 'text-green-400',
    dotColor: 'bg-green-400',
  },
  'east-field-b2': {
    name: 'East Field B2',
    type: 'Wheat Plantation',
    score: 92,
    humidity: '45%',
    ph: '6.5',
    area: '4.1',
    water: '850L',
    fertilizer: '94%',
    status: 'Optimal',
    statusColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  'south-field-c3': {
    name: 'South Field C3',
    type: 'Soybean Plantation',
    score: 41,
    humidity: '18%',
    ph: '5.2',
    area: '1.8',
    water: '2,100L',
    fertilizer: '62%',
    status: 'Critical',
    statusColor: 'text-red-400',
    dotColor: 'bg-red-400',
  },
};

interface MainContentProps {
  activeField: string | null;
  setActiveField: (field: string | null) => void;
  selectedFarm?: any;
  onUseSelectedFarmForMyFarm?: () => void;
  onClearSelectedFarm?: () => void;
  myFarmTransferMessage?: string | null;
}

const MainContent: React.FC<MainContentProps> = ({
  activeField,
  setActiveField,
  selectedFarm,
  onUseSelectedFarmForMyFarm,
  onClearSelectedFarm,
  myFarmTransferMessage,
}) => {
  // Inject selected USDA farm data if selected from map, while preserving baseFieldData
  const fieldData = JSON.parse(JSON.stringify(baseFieldData));
  if (selectedFarm) {
    const props = selectedFarm.properties || {};
    const name =
      props.Field_ID || props.CSBID || props.OBJECTID
        ? `Farm ID: ${props.Field_ID || props.CSBID || props.OBJECTID}`
        : 'Selected Iowa Farm';
    const type =
      props.Crop_Name || props.Crop || props.Crop_Category || 'USDA 2024 Crop';
    const acres =
      props.Acres || props.ACRES || props.CSBACRES || props.Shape__Area || 0;
    const hectares = acres ? (Number(acres) * 0.404686).toFixed(2) : 'Unknown';

    fieldData['north-field-a1'] = {
      ...fieldData['north-field-a1'],
      name: name,
      type: type,
      area: hectares,
      score: 88,
      status: 'Monitored',
      statusColor: 'text-blue-400',
      dotColor: 'bg-blue-400',
    };
  }

  const currentData = activeField
    ? fieldData[activeField as keyof typeof fieldData]
    : null;

  return (
    <main
      data-testid="dashboard-main-content"
      className="flex-1 flex flex-col min-w-0 ml-5 mr-5 gap-5 relative h-full"
    >
      <div className="absolute -top-10 -left-10 -right-10 -bottom-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none z-0"></div>

      {/* Map Section */}
      <div className="relative w-full h-[55%] min-h-[350px] rounded-3xl overflow-hidden shadow-sm flex-shrink-0 z-10 bg-gradient-to-br from-[#77a134] via-[#5c8a24] to-[#c7b134]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-black"></div>

        {/* Selected Iowa USDA Parcel Actions Banner (Explicit My Farm Transfer + Preserve Demo Fields) */}
        {selectedFarm && (
          <div
            data-testid="selected-usda-farm-banner"
            className="absolute top-4 left-4 z-30 bg-white/95 backdrop-blur-md border border-blue-200 rounded-2xl px-3.5 py-2 shadow-lg flex flex-wrap items-center gap-2 max-w-[70%]"
          >
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{fieldData['north-field-a1'].name}</span>
              {typeof selectedFarm.location?.lat === 'number' &&
                typeof selectedFarm.location?.lon === 'number' && (
                  <span className="text-[11px] font-normal text-gray-600">
                    ({selectedFarm.location.lat.toFixed(4)}°,{' '}
                    {selectedFarm.location.lon.toFixed(4)}°)
                  </span>
                )}
            </span>

            {onUseSelectedFarmForMyFarm && (
              <button
                type="button"
                data-testid="use-iowa-farm-for-my-farm-btn"
                onClick={onUseSelectedFarmForMyFarm}
                className="px-2.5 py-1 rounded-xl bg-green-700 hover:bg-green-800 text-white text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Use This Location for My Farm
              </button>
            )}

            {onClearSelectedFarm && (
              <button
                type="button"
                data-testid="reset-selected-farm-btn"
                onClick={onClearSelectedFarm}
                className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Demo Field</span>
              </button>
            )}

            {myFarmTransferMessage && (
              <span
                data-testid="my-farm-transfer-confirmation"
                className="text-[11px] font-semibold text-green-800 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200"
              >
                {myFarmTransferMessage}
              </span>
            )}
          </div>
        )}

        {/* Top Actions */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="bg-white px-4 py-2 rounded-full text-sm font-semibold text-gray-700 shadow-md flex items-center hover:bg-gray-50 transition-colors cursor-pointer">
            Export
          </button>
          <button className="bg-white p-2 rounded-full text-gray-600 shadow-md hover:bg-gray-50 transition-colors cursor-pointer">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Map Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button className="bg-gray-900/70 backdrop-blur text-white p-2.5 rounded-xl hover:bg-gray-800 transition cursor-pointer">
            <Expand className="w-4 h-4" />
          </button>
          <button className="bg-gray-900/70 backdrop-blur text-white p-2.5 rounded-xl hover:bg-gray-800 transition cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
          <button className="bg-gray-900/70 backdrop-blur text-white p-2.5 rounded-xl hover:bg-gray-800 transition cursor-pointer">
            <Minus className="w-4 h-4" />
          </button>
          <button className="bg-gray-900/70 backdrop-blur text-white p-2.5 rounded-xl hover:bg-gray-800 transition cursor-pointer">
            <Navigation className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Hotspots */}
        <button
          onClick={() => setActiveField('north-field-a1')}
          className={`absolute top-[40%] left-[30%] group cursor-pointer ${
            activeField === 'north-field-a1' ? 'z-20' : 'z-10'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute w-8 h-8 rounded-full opacity-50 animate-ping-slow ${
                activeField === 'north-field-a1'
                  ? selectedFarm
                    ? 'bg-blue-400'
                    : 'bg-yellow-400'
                  : 'bg-white'
              }`}
            ></div>
            <div
              className={`relative w-4 h-4 rounded-full border-2 border-white shadow-lg transition-colors ${
                activeField === 'north-field-a1'
                  ? selectedFarm
                    ? 'bg-blue-500'
                    : 'bg-yellow-500'
                  : 'bg-gray-800 group-hover:bg-gray-600'
              }`}
            ></div>
          </div>
          <span className="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs font-bold text-white drop-shadow-md">
            {selectedFarm ? 'Selected USDA Farm' : 'North Field A1'}
          </span>
        </button>

        <button
          onClick={() => setActiveField('east-field-b2')}
          className={`absolute top-[25%] left-[65%] group cursor-pointer ${
            activeField === 'east-field-b2' ? 'z-20' : 'z-10'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute w-8 h-8 rounded-full opacity-50 animate-ping-slow ${
                activeField === 'east-field-b2' ? 'bg-emerald-400' : 'bg-white'
              }`}
            ></div>
            <div
              className={`relative w-4 h-4 rounded-full border-2 border-white shadow-lg transition-colors ${
                activeField === 'east-field-b2'
                  ? 'bg-emerald-500'
                  : 'bg-gray-800 group-hover:bg-gray-600'
              }`}
            ></div>
          </div>
          <span className="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs font-bold text-white drop-shadow-md">
            East Field B2
          </span>
        </button>

        <button
          onClick={() => setActiveField('south-field-c3')}
          className={`absolute bottom-[30%] left-[45%] group cursor-pointer ${
            activeField === 'south-field-c3' ? 'z-20' : 'z-10'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute w-8 h-8 rounded-full opacity-50 animate-ping-slow ${
                activeField === 'south-field-c3' ? 'bg-red-400' : 'bg-white'
              }`}
            ></div>
            <div
              className={`relative w-4 h-4 rounded-full border-2 border-white shadow-lg transition-colors ${
                activeField === 'south-field-c3'
                  ? 'bg-red-500'
                  : 'bg-gray-800 group-hover:bg-gray-600'
              }`}
            ></div>
          </div>
          <span className="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs font-bold text-white drop-shadow-md">
            South Field C3
          </span>
        </button>

        {/* Dynamic Glassmorphism Card */}
        {currentData && (
          <div
            data-testid="dashboard-active-field-card"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-[#161b18]/85 backdrop-blur-xl border border-white/10 p-5 rounded-[24px] shadow-2xl text-white z-30 transition-all duration-300"
          >
            <div className="flex justify-between items-center mb-1">
              <div>
                <h3 className="font-semibold text-sm">{currentData.name}</h3>
                <p className="text-[10px] text-gray-400">{currentData.type}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveField(null);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <GaugeChart score={currentData.score} />

            <div className="flex justify-center gap-4 text-[10px] text-gray-300 mt-2 mb-4">
              <span>
                <b className="text-white">{currentData.humidity}</b> Humidity
              </span>
              <span>
                <b className="text-white">{currentData.ph}</b> Ph Level
              </span>
              <span>
                <b className="text-white">{currentData.area}</b> Hectare
              </span>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/10 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Water Consumption</span>
                <span className="font-medium">{currentData.water}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Fertilizer Efficiency</span>
                <span className="font-medium">{currentData.fertilizer}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Equipment Status</span>
                <span
                  className={`flex items-center gap-1.5 font-medium ${currentData.statusColor}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${currentData.dotColor} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                  ></span>
                  {currentData.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-gray-50 flex flex-col z-10 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-semibold text-gray-800">
            Field Monitoring Overview
          </h2>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer">
              June 2026 <Calendar className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer">
              Filter <ChevronDown className="w-4 h-4" />
            </button>
            <button className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition cursor-pointer">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="pb-3 pl-2 font-medium w-10">
                  <div className="w-4 h-4 rounded bg-green-600 flex items-center justify-center cursor-pointer">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </th>
                <th className="pb-3 font-medium">Field Zone</th>
                <th className="pb-3 font-medium">Crop Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Soil Moisture</th>
                <th className="pb-3 font-medium">Temp.</th>
                <th className="pb-3 font-medium">Growth Stage</th>
                <th className="pb-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              <tr
                data-testid="dashboard-row-north-field-a1"
                onClick={() => setActiveField('north-field-a1')}
                className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition cursor-pointer ${
                  activeField === 'north-field-a1'
                    ? selectedFarm
                      ? 'bg-blue-50/50'
                      : 'bg-green-50/50'
                    : ''
                }`}
              >
                <td className="py-4 pl-2">
                  <div
                    className={`w-4 h-4 rounded border-2 ${
                      activeField === 'north-field-a1'
                        ? selectedFarm
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-green-500 bg-green-500'
                        : 'border-gray-200'
                    }`}
                  >
                    {activeField === 'north-field-a1' && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </td>
                <td className="py-4 font-medium">
                  {fieldData['north-field-a1'].name}
                </td>
                <td className="py-4 text-gray-500">
                  {fieldData['north-field-a1'].type}
                </td>
                <td className="py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedFarm
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {fieldData['north-field-a1'].status}
                  </span>
                </td>
                <td className="py-4 font-medium">68%</td>
                <td className="py-4 font-medium">26°C</td>
                <td className="py-4 text-gray-500">Vegetative</td>
                <td className="py-4 text-gray-400">
                  <MoreVertical className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                </td>
              </tr>
              <tr
                data-testid="dashboard-row-east-field-b2"
                onClick={() => setActiveField('east-field-b2')}
                className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition cursor-pointer ${
                  activeField === 'east-field-b2' ? 'bg-emerald-50/50' : ''
                }`}
              >
                <td className="py-4 pl-2">
                  <div
                    className={`w-4 h-4 rounded border-2 ${
                      activeField === 'east-field-b2'
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-gray-200'
                    }`}
                  >
                    {activeField === 'east-field-b2' && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </td>
                <td className="py-4 font-medium">East Field B2</td>
                <td className="py-4 text-gray-500">Wheat</td>
                <td className="py-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    Optimal
                  </span>
                </td>
                <td className="py-4 font-medium">72%</td>
                <td className="py-4 font-medium">24°C</td>
                <td className="py-4 text-gray-500">Flowering</td>
                <td className="py-4 text-gray-400">
                  <MoreVertical className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                </td>
              </tr>
              <tr
                data-testid="dashboard-row-south-field-c3"
                onClick={() => setActiveField('south-field-c3')}
                className={`hover:bg-gray-50/80 transition cursor-pointer ${
                  activeField === 'south-field-c3'
                    ? 'bg-red-50/30'
                    : 'opacity-60'
                }`}
              >
                <td className="py-4 pl-2">
                  <div
                    className={`w-4 h-4 rounded border-2 ${
                      activeField === 'south-field-c3'
                        ? 'border-red-500 bg-red-500'
                        : 'border-gray-200'
                    }`}
                  >
                    {activeField === 'south-field-c3' && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </td>
                <td className="py-4 font-medium">South Field C3</td>
                <td className="py-4 text-gray-500">Soybean</td>
                <td className="py-4">
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                    Critical
                  </span>
                </td>
                <td className="py-4 font-medium">41%</td>
                <td className="py-4 font-medium">29°C</td>
                <td className="py-4 text-gray-500">Seedling</td>
                <td className="py-4 text-gray-400">
                  <MoreVertical className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

export default MainContent;
