import React from 'react';

const GaugeChart = ({ score }: { score: number }) => {
  const radius = 40;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine gradient colors based on score
  const isGood = score >= 70;
  const isWarning = score < 70 && score >= 40;
  
  const startColor = isGood ? '#4ade80' : isWarning ? '#facc15' : '#f87171'; // Green : Yellow : Red
  const endColor = isGood ? '#facc15' : isWarning ? '#fb923c' : '#ef4444';   // Yellow : Orange : Red-600

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-32">
      <svg className="w-full h-full" viewBox="0 0 100 60">
        <defs>
          <linearGradient id={`gaugeGradient-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke="#374151"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke={`url(#gaugeGradient-${score})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute bottom-4 flex flex-col items-center">
        <span className="text-3xl font-bold text-white transition-all">{score}%</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Health Score</span>
      </div>
    </div>
  );
};

export default GaugeChart;