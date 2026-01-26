import React from 'react';
import { HiDocumentText, HiPlus } from 'react-icons/hi';

export default function Header({ onNewVoucher }) {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      {/* Colorful gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <HiDocumentText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">BPV Manager</h1>
              <p className="text-xs text-slate-500">Newell Electromechanical Works LLC</p>
            </div>
          </div>

          {/* New Voucher Button */}
          <button
            onClick={onNewVoucher}
            className="btn-gradient-blue flex items-center gap-2"
          >
            <HiPlus className="w-5 h-5" />
            <span className="hidden sm:inline">New Voucher</span>
          </button>
        </div>
      </div>
    </header>
  );
}
