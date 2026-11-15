import React, { useState } from 'react';
import {
  LayoutGrid,
  Leaf,
  Cloud,
  FileText,
  Users,
  Map,
  BarChart2,
  ShieldAlert,
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
  const handleNavigate =
    onNavigate ?? controlledSetActiveNav ?? setInternalActiveNav;

  const navItems = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { id: 'map', icon: Map, label: 'Map Selection' },
    { id: 'team', icon: Users, label: 'Farm Management' },
    { id: 'weather', icon: Cloud, label: 'Weather Forecast' },
    { id: 'risks', icon: ShieldAlert, label: 'Risk Management' },
    { id: 'plants', icon: Leaf, label: 'Crop Recommendations' },
    { id: 'analytics', icon: BarChart2, label: 'Decision Planner' },
    { id: 'reports', icon: FileText, label: 'Reports & History' },
  ];

  return (
    <aside className="w-16 bg-white rounded-3xl flex flex-col items-center py-6 shadow-sm border border-gray-100 flex-shrink-0 relative z-10">
      {/* Logo */}
      <button
        type="button"
        onClick={() => handleNavigate('dashboard')}
        title="CropWise Dashboard"
        aria-label="CropWise Dashboard"
        className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center mb-6 shadow-sm cursor-pointer hover:bg-green-800 transition-colors"
      >
        <Leaf className="text-white w-5 h-5" />
      </button>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-3.5 w-full items-center overflow-y-auto custom-scrollbar">
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
                  ? 'bg-green-800 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={2} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
