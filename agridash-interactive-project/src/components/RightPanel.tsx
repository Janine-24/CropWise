import React, { useState } from 'react';
import { Search, MapPin, Sun, Droplets, CloudRain, Wind, ArrowUpRight } from 'lucide-react';
import DonutChart from './charts/DonutChart';
import Heatmap from './charts/Heatmap';

const RightPanel = () => {
  const [timeframe, setTimeframe] = useState('week');

  return (
    <aside className="w-[340px] flex flex-col gap-5 h-full overflow-y-auto pr-2 custom-scrollbar z-10 flex-shrink-0">
      {/* Search */}
      <div className="bg-white rounded-full px-5 py-3.5 flex items-center shadow-sm border border-gray-50 focus-within:ring-2 focus-within:ring-green-500/20 transition-shadow">
        <Search className="w-5 h-5 text-gray-400 mr-3" />
        <input 
          type="text" 
          placeholder="Type to search..." 
          className="bg-transparent border-none outline-none w-full text-sm text-gray-700 placeholder-gray-400 font-medium"
        />
      </div>

      {/* Weather Widget */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
        <div className="flex items-center text-gray-600 text-sm font-medium mb-4 cursor-pointer hover:text-green-600 transition-colors">
          <MapPin className="w-4 h-4 mr-1.5" /> Purwokerto, Central Java, Indonesia
        </div>
        
        <div className="flex justify-between items-end mb-6">
          <h1 className="text-[56px] leading-none font-medium text-gray-900 tracking-tighter">26°C</h1>
          <div className="text-right flex flex-col items-end">
            <div className="flex items-center text-gray-800 font-semibold mb-1">
              <Sun className="w-5 h-5 mr-1.5 text-yellow-500 animate-[spin_10s_linear_infinite]" /> Sunny Day
            </div>
            <span className="text-xs text-gray-400 font-medium">8.45 AM | Jan 26</span>
          </div>
        </div>

        <div className="flex justify-between pt-5 border-t border-gray-100">
          <div className="flex flex-col items-center">
            <Droplets className="w-5 h-5 text-gray-400 mb-2" />
            <span className="text-[11px] text-gray-400 font-medium mb-1">Humidity</span>
            <span className="font-semibold text-gray-800">35%</span>
          </div>
          <div className="flex flex-col items-center">
            <CloudRain className="w-5 h-5 text-gray-400 mb-2" />
            <span className="text-[11px] text-gray-400 font-medium mb-1">Rain Forecast</span>
            <span className="font-semibold text-gray-800">26°C</span>
          </div>
          <div className="flex flex-col items-center">
            <Wind className="w-5 h-5 text-gray-400 mb-2" />
            <span className="text-[11px] text-gray-400 font-medium mb-1">Wind</span>
            <span className="font-semibold text-gray-800">8m/s</span>
          </div>
        </div>
      </div>

      {/* Resource Monitoring */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50">
        <h3 className="font-semibold text-gray-800 mb-4">Resource Monitoring</h3>
        
        <div className="flex bg-gray-50 rounded-lg p-1 mb-6">
          <button 
            onClick={() => setTimeframe('week')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${timeframe === 'week' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >Week</button>
          <button 
            onClick={() => setTimeframe('month')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${timeframe === 'month' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >Month</button>
          <button 
            onClick={() => setTimeframe('year')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${timeframe === 'year' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >Year</button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-2.5 flex-1">
            {[
              { label: 'Irrigation Systems', color: 'bg-[#166534]' },
              { label: 'Crop Nutrition', color: 'bg-[#22c55e]' },
              { label: 'Equipment Maintenance', color: 'bg-[#86efac]' },
              { label: 'Pest Control', color: 'bg-[#facc15]' },
              { label: 'Logistics & Distribution', color: 'bg-[#ef4444]' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <div className={`w-3 h-3 rounded ${item.color}`}></div>
                <span className="text-xs text-gray-500 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
          <DonutChart key={timeframe} /> {/* Key forces re-render/animation on tab switch */}
        </div>
      </div>

      {/* Weekly Performance */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-50 relative group cursor-pointer">
        <button className="absolute top-6 right-6 p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
           <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
        </button>
        <h3 className="font-semibold text-gray-800 mb-5 group-hover:text-green-600 transition-colors">Weekly Performance</h3>
        <Heatmap />
      </div>
      
    </aside>
  );
};

export default RightPanel;