import React from 'react';
import { WeatherPanel } from '../weather/WeatherUI';
import { Place, PLACES } from '../weather/useWeather';

interface RightPanelProps {
  place?: Place;
  onOpenWeather?: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  place = PLACES[0],
  onOpenWeather = () => {},
}) => {
  return (
    <aside className="w-[320px] flex flex-col gap-4 h-full overflow-y-auto pr-1 custom-scrollbar z-10 flex-shrink-0">
      <div data-testid="right-panel-weather">
        <WeatherPanel place={place} onOpen={onOpenWeather} />
      </div>
    </aside>
  );
};

export default RightPanel;
