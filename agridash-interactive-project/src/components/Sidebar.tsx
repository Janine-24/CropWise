import React, { useState } from 'react';
import { LayoutGrid, Leaf, Cloud, FileText, Users, Map, BarChart2, Settings, Info, Moon, ArrowLeft } from 'lucide-react';

const Sidebar = () => {
  const [activeNav, setActiveNav] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', icon: LayoutGrid },
    { id: 'plants', icon: Leaf },
    { id: 'weather', icon: Cloud },
    { id: 'reports', icon: FileText },
    { id: 'team', icon: Users },
    { id: 'map', icon: Map },
    { id: 'analytics', icon: BarChart2 },
    { id: 'settings', icon: Settings },
    { id: 'info', icon: Info },
  ];

  return (
    <aside className="w-16 bg-white rounded-3xl flex flex-col items-center py-6 shadow-sm border border-gray-100 flex-shrink-0 relative z-10">
      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mb-8 shadow-md">
        <Leaf className="text-white w-5 h-5" />
      </div>
      
      <nav className="flex-1 flex flex-col gap-5 w-full items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-green-800 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
            >
              <Icon className="w-5 h-5" strokeWidth={2} />
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4 items-center">
        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Moon className="w-5 h-5" />
        </button>
        <button className="p-1.5 bg-red-100 text-red-500 rounded-full hover:bg-red-200 transition-colors">
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