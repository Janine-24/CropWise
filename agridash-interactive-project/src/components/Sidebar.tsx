import React, { useState } from 'react';
import {
  LayoutGrid,
  Leaf,
  Cloud,
  FileText,
  Users,
  Map,
  BarChart2,
  Settings,
  Info,
  Moon,
  ArrowLeft,
} from 'lucide-react';

interface SidebarProps {
  activeNav?: string;
  setActiveNav?: (id: string) => void;
  onNavigate?: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeNav: controlledActiveNav,
  setActiveNav: controlledSetActiveNav,
  onNavigate,
}) => {
  const [internalActiveNav, setInternalActiveNav] = useState('dashboard');
  const activeNav = controlledActiveNav ?? internalActiveNav;
  const handleNavigate = onNavigate ?? controlledSetActiveNav ?? setInternalActiveNav;

  const navItems = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { id: 'plants', icon: Leaf, label: 'Crop Recommendations' },
    { id: 'weather', icon: Cloud, label: 'Weather Forecast' },
    { id: 'reports', icon: FileText, label: 'Reports & History' },
    { id: 'team', icon: Users, label: 'Farm Management' },
    { id: 'map', icon: Map, label: 'Select Farm Location' },
    { id: 'analytics', icon: BarChart2, label: 'Decision Planner' },
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'info', icon: Info, label: 'Information' },
  ];

  return (
    <aside className="w-16 bg-white rounded-3xl flex flex-col items-center py-6 shadow-sm border border-gray-100 flex-shrink-0 relative z-10">
      {/* Logo */}
      <button
        type="button"
        onClick={() => handleNavigate('dashboard')}
        title="CropWise Overview"
        aria-label="CropWise Overview"
        className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mb-8 shadow-md cursor-pointer"
      >
        <Leaf className="text-white w-5 h-5" />
      </button>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-5 w-full items-center overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`sidebar-nav-${item.id}`}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleNavigate(item.id)}
              className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-green-800 text-white shadow-md'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={2} />
            </button>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className="mt-auto flex flex-col gap-4 items-center pt-4">
        <button
          type="button"
          title="Appearance (coming soon)"
          aria-label="Toggle Theme"
          disabled
          className="p-2 text-gray-300 cursor-not-allowed"
        >
          <Moon className="w-5 h-5" />
        </button>

        <button
          type="button"
          data-testid="sidebar-open-map-btn"
          title="Back to Farm Selection"
          aria-label="Back to Farm Selection"
          onClick={() => handleNavigate('map')}
          className="p-1.5 bg-red-100 text-red-500 rounded-full hover:bg-red-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <img
          src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix"
          alt="Profile"
          className="w-10 h-10 rounded-full bg-green-100 mt-2 border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
        />
      </div>
    </aside>
  );
};

export default Sidebar;
