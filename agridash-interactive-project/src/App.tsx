import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import RightPanel from './components/RightPanel';
import MapSelection from './components/MapSelection';
import CropRecommendations from './components/pages/CropRecommendations';
import DecisionPlanner from './components/pages/DecisionPlanner';
import ReportsHistory from './components/pages/ReportsHistory';
import { WeatherPage } from './weather/WeatherUI';
import { Place, PLACES } from './weather/useWeather';
import { validateCoordinates } from './services/nasaPowerClient';
import { setSharedFarmLocationState } from './data/decisionPlannerData';
import { getSavedMyFarmProfile, saveMyFarmProfile } from './services/realFarmEngine';

type ViewMode = 'map' | 'dashboard';

const unimplementedSectionTitles: Record<string, string> = {
  team: 'Farm Management',
  settings: 'Settings',
  info: 'Information',
};

export default function App() {
  // Default landing view: Dashboard (Iowa USDA Map remains accessible via Sidebar)
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  // Sidebar navigation
  const [activeNav, setActiveNav] = useState<string>('dashboard');

  // Selected Iowa USDA farm parcel (Dashboard state only; does not silently overwrite My Farm)
  const [selectedFarm, setSelectedFarm] = useState<any>(null);
  const [myFarmTransferMessage, setMyFarmTransferMessage] = useState<string | null>(null);

  // Dashboard active field
  const [activeField, setActiveField] = useState<string | null>('north-field-a1');

  // Shared weather location for NOAA / Open-Meteo WeatherPanel & WeatherPage
  const [weatherLocation, setWeatherLocation] = useState<Place>(PLACES[0]);

  // Called when user selects a farm parcel on the Iowa USDA Map
  const handleFarmSelect = (farm: any) => {
    setSelectedFarm(farm);
    setMyFarmTransferMessage(null);
    setActiveField('north-field-a1');

    if (
      typeof farm?.location?.lat === 'number' &&
      typeof farm?.location?.lon === 'number'
    ) {
      setWeatherLocation({
        name: 'Selected Iowa Farm',
        lat: farm.location.lat,
        lon: farm.location.lon,
      });
    }

    setActiveNav('dashboard');
    setViewMode('dashboard');
  };

  // Explicit user action to transfer selected Iowa USDA parcel coordinates to My Farm mode
  const handleUseSelectedFarmForMyFarm = () => {
    const rawLat = selectedFarm?.location?.lat;
    const rawLon = selectedFarm?.location?.lon;
    const validation = validateCoordinates(rawLat, rawLon);
    if (!validation.valid) {
      setMyFarmTransferMessage(
        validation.error || 'Selected parcel does not have valid coordinates.'
      );
      return;
    }

    const props = selectedFarm?.properties || {};
    const parcelId = props.Field_ID || props.CSBID || props.OBJECTID || 'Iowa USDA Parcel';
    const label = `Iowa USDA Parcel (${parcelId})`;

    setSharedFarmLocationState({
      verifiedLocation: {
        latitude: validation.latitude,
        longitude: validation.longitude,
        label,
        source: 'public-test-preset',
        updatedAtIso: new Date().toISOString(),
      },
      draftLatInput: String(validation.latitude),
      draftLonInput: String(validation.longitude),
    });

    const currentProfile = getSavedMyFarmProfile();
    saveMyFarmProfile({
      ...currentProfile,
      experienceMode: 'my-farm',
      farmName: label,
    });

    setMyFarmTransferMessage(
      `Saved (${validation.latitude.toFixed(4)}°, ${validation.longitude.toFixed(4)}°) to My Farm`
    );
  };

  const handleClearSelectedFarm = () => {
    setSelectedFarm(null);
    setMyFarmTransferMessage(null);
  };

  // Sidebar navigation handler
  const handleNavigate = (page: string) => {
    if (page === 'map') {
      setViewMode('map');
      return;
    }

    setActiveNav(page);
    setViewMode('dashboard');
  };

  // Full-screen Iowa USDA Farm Map Selection view
  if (viewMode === 'map') {
    return (
      <MapSelection
        onFarmSelect={handleFarmSelect}
        onBackToDashboard={() => setViewMode('dashboard')}
      />
    );
  }

  const renderMainView = () => {
    switch (activeNav) {
      case 'dashboard':
        return (
          <MainContent
            activeField={activeField}
            setActiveField={setActiveField}
            selectedFarm={selectedFarm}
            onUseSelectedFarmForMyFarm={handleUseSelectedFarmForMyFarm}
            onClearSelectedFarm={handleClearSelectedFarm}
            myFarmTransferMessage={myFarmTransferMessage}
          />
        );
      case 'plants':
        return (
          <CropRecommendations
            activeField={activeField}
            onNavigateToDecisionPlanner={() => setActiveNav('analytics')}
          />
        );
      case 'analytics':
        return <DecisionPlanner activeField={activeField} />;
      case 'reports':
        return <ReportsHistory activeField={activeField} />;
      case 'weather':
        return (
          <WeatherPage
            place={weatherLocation}
            onChange={setWeatherLocation}
          />
        );
      default: {
        const sectionTitle = unimplementedSectionTitles[activeNav] || activeNav;
        return (
          <main className="flex-1 flex flex-col min-w-0 ml-3 mr-3 md:ml-5 md:mr-5 gap-5 relative h-full overflow-y-auto pr-1 custom-scrollbar">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 flex-shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">{sectionTitle}</h1>
                  <p className="text-sm text-gray-500">
                    Module reserved for future team integration
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                  Coming Soon
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 flex-1 flex flex-col items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  {sectionTitle} View — Coming Soon
                </h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  The <code className="text-green-700 font-medium">{activeNav}</code> navigation slot is preserved for team development. Use the sidebar or the button below to return to the active Dashboard or NASA decision-support pages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="px-4 py-2 rounded-xl bg-green-800 text-white text-xs font-semibold shadow-sm hover:bg-green-700 transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </main>
        );
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#ebf0ee] p-3 md:p-5 font-sans overflow-hidden">
      <Sidebar
        activeNav={activeNav}
        setActiveNav={handleNavigate}
        onNavigate={handleNavigate}
      />

      {renderMainView()}

      {activeNav !== 'weather' && (
        <div
          className={
            activeNav === 'dashboard'
              ? 'h-full flex-shrink-0'
              : 'hidden lg:block h-full flex-shrink-0'
          }
        >
          <RightPanel
            place={weatherLocation}
            onOpenWeather={() => setActiveNav('weather')}
          />
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
          `,
        }}
      />
    </div>
  );
}
