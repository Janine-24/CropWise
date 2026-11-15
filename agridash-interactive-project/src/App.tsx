import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import RightPanel from './components/RightPanel';
import MapSelection from './components/MapSelection';
import CropRecommendations from './components/pages/CropRecommendations';
import DecisionPlanner from './components/pages/DecisionPlanner';
import ReportsHistory from './components/pages/ReportsHistory';
import RiskManagement from './components/pages/RiskManagement';
import FarmManagement from './components/pages/FarmManagement';
import { WeatherPage } from './weather/WeatherUI';
import { isLikelyUSCoordinate, Place, PLACES } from './weather/useWeather';
import { getSharedFarmLocationState } from './data/decisionPlannerData';
import {
  getMyFarmMultiFieldState,
  getSelectedMapFields,
  MyFarmMultiFieldState,
  removeSelectedFieldSlot,
  saveMyFarmMultiFieldState,
} from './services/riskAndFarmStore';

type ViewMode = 'map' | 'dashboard';

export default function App() {
  const [multiFieldState, setMultiFieldState] = useState<MyFarmMultiFieldState>(
    () => getMyFarmMultiFieldState()
  );

  const selectedFields = useMemo(
    () => getSelectedMapFields(multiFieldState),
    [multiFieldState]
  );

  const hasInitialSavedFarm =
    selectedFields.length > 0 ||
    getSharedFarmLocationState().verifiedLocation !== null;

  // Map-First for visitors without a saved farm; Dashboard directly for returning visitors with saved fields
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    hasInitialSavedFarm ? 'dashboard' : 'map'
  );

  const [activeNav, setActiveNav] = useState<string>('dashboard');

  // Optional demo field id used only when user switches to Explore Demo mode
  const [activeDemoField, setActiveDemoField] = useState<string | null>(
    'north-field-a1'
  );

  // Shared weather location for NOAA / Open-Meteo WeatherPanel & WeatherPage
  const [weatherLocation, setWeatherLocation] = useState<Place>(() => {
    const activeSlot =
      selectedFields.find((f) => f.fieldId === multiFieldState.activeFieldId) ??
      selectedFields[0];
    if (
      activeSlot &&
      activeSlot.latitude !== null &&
      activeSlot.longitude !== null
    ) {
      return {
        name: activeSlot.fieldName,
        region: isLikelyUSCoordinate(activeSlot.latitude, activeSlot.longitude)
          ? 'US Farm Coordinate'
          : 'Global Coordinate',
        lat: activeSlot.latitude,
        lon: activeSlot.longitude,
        isUS: isLikelyUSCoordinate(activeSlot.latitude, activeSlot.longitude),
      };
    }

    const initialLoc = getSharedFarmLocationState().verifiedLocation;
    if (initialLoc) {
      return {
        name: initialLoc.label.split('—')[0].trim(),
        region: isLikelyUSCoordinate(initialLoc.latitude, initialLoc.longitude)
          ? 'US Farm Coordinate'
          : 'Global Coordinate',
        lat: initialLoc.latitude,
        lon: initialLoc.longitude,
        isUS: isLikelyUSCoordinate(initialLoc.latitude, initialLoc.longitude),
      };
    }

    return PLACES[0];
  });

  // Synchronize multi-field state and weather location whenever fields or coordinates change anywhere in the app
  useEffect(() => {
    const syncStateFromStorage = () => {
      const latestMulti = getMyFarmMultiFieldState();
      setMultiFieldState(latestMulti);

      const latestSelected = getSelectedMapFields(latestMulti);
      const activeSlot =
        latestSelected.find((f) => f.fieldId === latestMulti.activeFieldId) ??
        latestSelected[0];

      if (
        activeSlot &&
        activeSlot.latitude !== null &&
        activeSlot.longitude !== null
      ) {
        setWeatherLocation({
          name: activeSlot.fieldName,
          region: isLikelyUSCoordinate(
            activeSlot.latitude,
            activeSlot.longitude
          )
            ? 'US Farm Coordinate'
            : 'Global Coordinate',
          lat: activeSlot.latitude,
          lon: activeSlot.longitude,
          isUS: isLikelyUSCoordinate(activeSlot.latitude, activeSlot.longitude),
        });
        return;
      }

      const latestLoc = getSharedFarmLocationState().verifiedLocation;
      if (latestLoc) {
        setWeatherLocation({
          name: latestLoc.label.split('—')[0].trim(),
          region: isLikelyUSCoordinate(
            latestLoc.latitude,
            latestLoc.longitude
          )
            ? 'US Farm Coordinate'
            : 'Global Coordinate',
          lat: latestLoc.latitude,
          lon: latestLoc.longitude,
          isUS: isLikelyUSCoordinate(latestLoc.latitude, latestLoc.longitude),
        });
      }
    };

    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('cropwise-fields-changed', syncStateFromStorage);
      window.addEventListener(
        'cropwise-farm-location-changed',
        syncStateFromStorage
      );
      return () => {
        window.removeEventListener(
          'cropwise-fields-changed',
          syncStateFromStorage
        );
        window.removeEventListener(
          'cropwise-farm-location-changed',
          syncStateFromStorage
        );
      };
    }
  }, []);

  const handleSelectActiveField = (fieldId: string) => {
    const updated = saveMyFarmMultiFieldState({
      ...multiFieldState,
      activeFieldId: fieldId,
    });
    setMultiFieldState(updated);
  };

  const handleRemoveField = (fieldId: string) => {
    const updated = removeSelectedFieldSlot(fieldId);
    setMultiFieldState(updated);
  };

  const handleNavigate = (page: string) => {
    if (page === 'map') {
      setViewMode('map');
      return;
    }

    setActiveNav(page);
    setViewMode('dashboard');
  };

  if (viewMode === 'map') {
    return (
      <MapSelection
        onDoneSelection={() => {
          setMultiFieldState(getMyFarmMultiFieldState());
          setActiveNav('dashboard');
          setViewMode('dashboard');
        }}
        onBackToDashboard={() => {
          setMultiFieldState(getMyFarmMultiFieldState());
          setViewMode('dashboard');
        }}
        onContinueWithoutFarm={() => {
          setActiveNav('dashboard');
          setViewMode('dashboard');
        }}
      />
    );
  }

  const renderMainView = () => {
    switch (activeNav) {
      case 'plants':
        return (
          <CropRecommendations
            activeField={activeDemoField}
            onNavigateToDecisionPlanner={() => setActiveNav('analytics')}
          />
        );
      case 'analytics':
        return <DecisionPlanner activeField={activeDemoField} />;
      case 'risks':
        return (
          <RiskManagement
            weatherPlace={weatherLocation}
            onNavigate={handleNavigate}
          />
        );
      case 'team':
        return <FarmManagement onNavigate={handleNavigate} />;
      case 'reports':
        return (
          <ReportsHistory
            activeField={activeDemoField}
            onNavigate={handleNavigate}
          />
        );
      case 'weather':
        return (
          <WeatherPage
            place={weatherLocation}
            onChange={setWeatherLocation}
          />
        );
      case 'dashboard':
      default:
        return (
          <MainContent
            selectedFields={selectedFields}
            activeFieldId={multiFieldState.activeFieldId}
            onSelectField={handleSelectActiveField}
            onRemoveField={handleRemoveField}
            onOpenFullMap={() => setViewMode('map')}
            onNavigate={handleNavigate}
            activeDemoField={activeDemoField}
            setActiveDemoField={setActiveDemoField}
          />
        );
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
