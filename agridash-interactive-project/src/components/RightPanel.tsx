
import React, { useState } from "react";

import {
  Search,
  ArrowUpRight,
} from "lucide-react";

import DonutChart from "./charts/DonutChart";
import Heatmap from "./charts/Heatmap";

import { WeatherPanel } from "../weather/WeatherUI";
import { Place } from "../weather/useWeather";

interface RightPanelProps {
  place: Place;
  onOpenWeather: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  place,
  onOpenWeather,
}) => {
  const [timeframe, setTimeframe] =
    useState("week");

  return (
    <aside className="w-[340px] flex flex-col gap-5 h-full overflow-y-auto pr-2 custom-scrollbar z-10 flex-shrink-0">

      {/* Search Bar */}
      <div className="bg-white rounded-full px-5 py-3.5 flex items-center shadow-sm border border-gray-50 focus-within:ring-2 focus-within:ring-green-500/20 transition-shadow">

        <Search className="w-5 h-5 text-gray-400 mr-3" />

        <input
          type="text"
          placeholder="Type to search..."
          className="bg-transparent border-none outline-none w-full text-sm text-gray-700 placeholder-gray-400 font-medium"
        />
      </div>

      {/* Real NOAA Weather */}
      <WeatherPanel
        place={place}
        onOpen={onOpenWeather}
      />

      {/* Resource Monitoring */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">

        <h3 className="font-semibold text-gray-800 mb-4">
          Resource Monitoring
        </h3>

        <div className="flex bg-gray-50 rounded-lg p-1 mb-6">

          <button
            type="button"
            onClick={() => setTimeframe("week")}
            className={`
              flex-1 py-1.5 text-sm font-medium
              rounded-md transition-all
              ${
                timeframe === "week"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            Week
          </button>

          <button
            type="button"
            onClick={() => setTimeframe("month")}
            className={`
              flex-1 py-1.5 text-sm font-medium
              rounded-md transition-all
              ${
                timeframe === "month"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            Month
          </button>

          <button
            type="button"
            onClick={() => setTimeframe("year")}
            className={`
              flex-1 py-1.5 text-sm font-medium
              rounded-md transition-all
              ${
                timeframe === "year"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            Year
          </button>

        </div>

        <div className="flex items-center gap-6">

          <div className="flex flex-col gap-2.5 flex-1">

            {[
              {
                label: "Irrigation Systems",
                color: "bg-[#166534]",
              },
              {
                label: "Crop Nutrition",
                color: "bg-[#22c55e]",
              },
              {
                label: "Equipment Maintenance",
                color: "bg-[#86efac]",
              },
              {
                label: "Pest Control",
                color: "bg-[#facc15]",
              },
              {
                label: "Logistics & Distribution",
                color: "bg-[#ef4444]",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2"
              >
                <div
                  className={`w-3 h-3 rounded ${item.color}`}
                />

                <span className="text-xs text-gray-500 font-medium">
                  {item.label}
                </span>
              </div>
            ))}

          </div>

          <DonutChart key={timeframe} />

        </div>
      </div>

      {/* Weekly Performance */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50 relative group">

        <div className="absolute top-6 right-6 p-1.5 rounded-lg">
          <ArrowUpRight className="w-4 h-4 text-gray-400" />
        </div>

        <h3 className="font-semibold text-gray-800 mb-5">
          Weekly Performance
        </h3>

        <Heatmap />

      </div>

    </aside>
  );
};

export default RightPanel;
