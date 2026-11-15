
import React, { useState } from "react";

import MapSelection from "./components/MapSelection";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightPanel from "./components/RightPanel";

import { WeatherPage } from "./weather/WeatherUI";
import { Place, PLACES } from "./weather/useWeather";

type ViewMode = "map" | "dashboard";

export default function App() {
  // First screen: search and select an Iowa farm
  const [viewMode, setViewMode] =
    useState<ViewMode>("map");

  // Sidebar navigation
  const [activeNav, setActiveNav] =
    useState<string>("dashboard");

  // Selected farm data
  const [selectedFarm, setSelectedFarm] =
    useState<any>(null);

  // Active dashboard field
  const [activeField, setActiveField] =
    useState<string | null>("north-field-a1");

  // Shared weather location
  const [weatherLocation, setWeatherLocation] =
    useState<Place>(PLACES[0]);

  // User clicks "Select this Farm"
  const handleFarmSelect = (farm: any) => {
    setSelectedFarm(farm);
    setActiveField("north-field-a1");

    if (
      typeof farm.location?.lat === "number" &&
      typeof farm.location?.lon === "number"
    ) {
      setWeatherLocation({
        name: "Selected Iowa Farm",
        lat: farm.location.lat,
        lon: farm.location.lon,
      });
    }

    // Automatically enter Overview
    setActiveNav("dashboard");
    setViewMode("dashboard");
  };

  // Sidebar navigation
  const handleNavigate = (page: string) => {
    if (page === "map") {
      setViewMode("map");
      return;
    }

    setActiveNav(page);
    setViewMode("dashboard");
  };

  // PAGE 1: Search Location + Select Farm
  if (viewMode === "map") {
    return (
      <MapSelection
        onFarmSelect={handleFarmSelect}
      />
    );
  }

  // PAGE 2: Dashboard / Weather Forecast
  return (
    <div className="flex h-screen w-full bg-[#ebf0ee] p-3 md:p-5 font-sans overflow-hidden">

      <Sidebar
        activeNav={activeNav}
        onNavigate={handleNavigate}
      />

      {activeNav === "weather" ? (
        <WeatherPage
          place={weatherLocation}
          onChange={setWeatherLocation}
        />
      ) : (
        <>
          <MainContent
            activeField={activeField}
            setActiveField={setActiveField}
            selectedFarm={selectedFarm}
          />

          <RightPanel
            place={weatherLocation}
            onOpenWeather={() =>
              setActiveNav("weather")
            }
          />
        </>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }

            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }

            .custom-scrollbar::-webkit-scrollbar-thumb {
              background-color: #cbd5e1;
              border-radius: 20px;
            }
          `,
        }}
      />
    </div>
  );
}
