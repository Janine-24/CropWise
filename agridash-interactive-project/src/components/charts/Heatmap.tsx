import React, { useState } from 'react';

const Heatmap = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const times = ['1 pm', '2 pm', '3 pm', '4 pm', '5 pm', '6 pm'];
  
  const [hoveredCell, setHoveredCell] = useState<{r: number, c: number} | null>(null);
  
  const data = [
    [0, 1, 1, 1, 1, 0, 0],
    [0, 1, 3, 3, 2, 0, 0],
    [0, 3, 4, 4, 3, 1, 0],
    [0, 1, 4, 4, 4, 3, 1],
    [0, 0, 2, 3, 3, 0, 0],
    [0, 0, 1, 2, 1, 0, 0],
  ];

  const getColor = (val: number) => {
    switch(val) {
      case 1: return 'bg-[#dcfce7] border-[#bbf7d0]';
      case 2: return 'bg-[#86efac] border-[#4ade80]';
      case 3: return 'bg-[#22c55e] border-[#16a34a]';
      case 4: return 'bg-[#166534] border-[#14532d]';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="w-full text-xs">
      <div className="flex mb-2">
        <div className="w-8"></div>
        {days.map(day => <div key={day} className="flex-1 text-center text-gray-400 font-medium">{day}</div>)}
      </div>
      <div className="flex flex-col gap-1.5 relative">
        {times.map((time, rIndex) => (
          <div key={time} className="flex items-center">
            <div className="w-8 text-gray-400 text-[10px] font-medium">{time}</div>
            <div className="flex-1 flex gap-1.5 justify-between">
              {data[rIndex].map((val, cIndex) => {
                const isHovered = hoveredCell?.r === rIndex && hoveredCell?.c === cIndex;
                return (
                  <div 
                    key={cIndex} 
                    onMouseEnter={() => setHoveredCell({r: rIndex, c: cIndex})}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`flex-1 aspect-[2/1] rounded-sm border cursor-pointer transition-all duration-200 ${getColor(val)} ${isHovered ? 'scale-125 shadow-md z-10' : ''}`}
                    title={`${days[cIndex]} ${time}: Activity level ${val}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end items-center gap-1.5 mt-4 text-[10px] text-gray-400 font-medium">
        <span>Less</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-gray-50 border border-gray-100"></div>
        <div className="w-2.5 h-2.5 rounded-sm bg-[#dcfce7] border border-[#bbf7d0]"></div>
        <div className="w-2.5 h-2.5 rounded-sm bg-[#86efac] border border-[#4ade80]"></div>
        <div className="w-2.5 h-2.5 rounded-sm bg-[#22c55e] border border-[#16a34a]"></div>
        <div className="w-2.5 h-2.5 rounded-sm bg-[#166534] border border-[#14532d]"></div>
        <span>More</span>
      </div>
    </div>
  );
};

export default Heatmap;