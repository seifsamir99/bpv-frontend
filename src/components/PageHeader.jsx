import React from 'react';
import { Link } from 'react-router-dom';
import { HiArrowLeft, HiPlus } from 'react-icons/hi';

export default function PageHeader({ title, subtitle, icon: Icon, onAction, actionLabel, actionIcon: ActionIcon = HiPlus }) {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      {/* Colorful gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Back button, Logo and Title */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Back to Dashboard"
            >
              <HiArrowLeft className="w-5 h-5" />
            </Link>

            {Icon && (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Icon className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-800">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>

          {/* Action Button */}
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className="btn-gradient-blue flex items-center gap-2"
            >
              <ActionIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{actionLabel}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
