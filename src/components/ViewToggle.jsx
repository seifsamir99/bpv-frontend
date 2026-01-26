import React from 'react';
import { HiViewGrid, HiViewList } from 'react-icons/hi';

export default function ViewToggle({ view, onViewChange }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-1">
      <button
        onClick={() => onViewChange('table')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          view === 'table'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-800'
        }`}
      >
        <HiViewList className="w-4 h-4" />
        <span className="hidden sm:inline">Table</span>
      </button>
      <button
        onClick={() => onViewChange('cards')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          view === 'cards'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-800'
        }`}
      >
        <HiViewGrid className="w-4 h-4" />
        <span className="hidden sm:inline">Cards</span>
      </button>
    </div>
  );
}
