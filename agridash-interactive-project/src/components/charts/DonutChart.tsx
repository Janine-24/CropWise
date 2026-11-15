import React, { useEffect, useState } from 'react';

const DonutChart = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    // Small delay to trigger CSS animation on mount
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
        {/* Logistics & Distribution - Red */}
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ef4444" strokeWidth="15" 
          strokeDasharray="30 250" strokeDashoffset={isLoaded ? "0" : "250"} 
          className="transition-all duration-1000 ease-out cursor-pointer hover:stroke-[18px]" />
          
        {/* Pest Control - Yellow */}
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#facc15" strokeWidth="15" 
          strokeDasharray="45 250" strokeDashoffset={isLoaded ? "-30" : "250"} 
          className="transition-all duration-1000 delay-100 ease-out cursor-pointer hover:stroke-[18px]" />
          
        {/* Equipment Maintenance - Light Green */}
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#86efac" strokeWidth="15" 
          strokeDasharray="40 250" strokeDashoffset={isLoaded ? "-75" : "250"} 
          className="transition-all duration-1000 delay-200 ease-out cursor-pointer hover:stroke-[18px]" />
          
        {/* Crop Nutrition - Green */}
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#22c55e" strokeWidth="15" 
          strokeDasharray="60 250" strokeDashoffset={isLoaded ? "-115" : "250"} 
          className="transition-all duration-1000 delay-300 ease-out cursor-pointer hover:stroke-[18px]" />
          
        {/* Irrigation Systems - Dark Green */}
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#166534" strokeWidth="15" 
          strokeDasharray="75 250" strokeDashoffset={isLoaded ? "-175" : "250"} 
          className="transition-all duration-1000 delay-400 ease-out cursor-pointer hover:stroke-[18px]" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center rounded-full pointer-events-none">
         <div className="w-16 h-16 bg-white rounded-full shadow-inner flex items-center justify-center">
            <span className="text-[10px] font-semibold text-gray-500">Total</span>
         </div>
      </div>
    </div>
  );
};

export default DonutChart;