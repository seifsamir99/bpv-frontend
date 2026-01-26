import React from 'react';
import { HiCheck, HiExclamation } from 'react-icons/hi';

export default function AutoSaveIndicator({ status }) {
  if (status === 'idle') return null;

  const statusConfig = {
    saving: {
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      icon: <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse-dot" />,
      text: 'Saving...'
    },
    saved: {
      color: 'text-green-600 bg-green-50 border-green-200',
      icon: <HiCheck className="w-4 h-4" />,
      text: 'Saved'
    },
    error: {
      color: 'text-red-600 bg-red-50 border-red-200',
      icon: <HiExclamation className="w-4 h-4" />,
      text: 'Error saving'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium animate-fade-in ${config.color}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
