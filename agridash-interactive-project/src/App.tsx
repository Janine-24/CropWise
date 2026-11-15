import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import RightPanel from './components/RightPanel';

export default function App() {
  const [activeField, setActiveField] = useState<string | null>('north-field-a1');

  return (
    <div className="flex h-screen w-full bg-[#ebf0ee] p-3 md:p-5 font-sans overflow-hidden">
      <Sidebar />
      <MainContent activeField={activeField} setActiveField={setActiveField} />
      <RightPanel />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}} />
    </div>
  );
}