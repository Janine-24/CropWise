
import React from "react";

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
} from "lucide-react";

interface SidebarProps {
  activeNav: string;
  onNavigate: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavigate,
}) => {
  const navItems = [
    {
      id: "dashboard",
      label: "Overview",
      icon: LayoutGrid,
    },
    {
      id: "plants",
      label: "Crops",
      icon: Leaf,
    },
    {
      id: "weather",
      label: "Weather Forecast",
      icon: Cloud,
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
    },
    {
      id: "team",
      label: "Farm Management",
      icon: Users,
    },
    {
      id: "map",
      label: "Select Farm Location",
      icon: Map,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart2,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
    {
      id: "info",
      label: "Information",
      icon: Info,
    },
  ];

  return (
    <aside className="w-16 bg-white rounded-3xl flex flex-col items-center py-6 shadow-sm border border-gray-100 flex-shrink-0 relative z-10">

      {/* Logo */}
      <button
        onClick={() => onNavigate("dashboard")}
        title="FieldShift AI Overview"
        className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mb-8 shadow-md"
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
              title={item.label}
              aria-label={item.label}
              onClick={() => onNavigate(item.id)}
              className={`
                p-2.5 rounded-xl
                transition-all duration-200
                ${
                  isActive
                    ? "bg-green-800 text-white shadow-md"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                }
              `}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={2}
              />
            </button>
          );
        })}

      </nav>

      {/* Bottom Controls */}
      <div className="mt-auto flex flex-col gap-4 items-center pt-4">

        <button
          type="button"
          title="Appearance (coming soon)"
          disabled
          className="p-2 text-gray-300 cursor-not-allowed"
        >
          <Moon className="w-5 h-5" />
        </button>

        <button
          type="button"
          title="Back to Farm Selection"
          onClick={() => onNavigate("map")}
          className="p-1.5 bg-red-100 text-red-500 rounded-full hover:bg-red-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <img
          src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix"
          alt="Profile"
          className="w-10 h-10 rounded-full bg-green-100 mt-2 border-2 border-white shadow-sm"
        />

      </div>
    </aside>
  );
};

export default Sidebar;
