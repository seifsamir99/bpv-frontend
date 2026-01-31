import React from 'react';
import { HiDocumentText } from 'react-icons/hi';
import TableView from './TableView';
import CardView from './CardView';
import ViewToggle from './ViewToggle';

export default function VoucherList({
  vouchers,
  loading,
  error,
  view,
  onViewChange,
  typeFilter,
  onTypeFilterChange,
  onEdit,
  onDelete
}) {
  // Filter vouchers based on type
  const filteredVouchers = typeFilter === 'all'
    ? vouchers
    : vouchers.filter(v => v.pdcType === typeFilter);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading vouchers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading vouchers</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (vouchers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiDocumentText className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">No vouchers yet</p>
          <p className="text-sm text-slate-400 mt-1">Create your first BPV to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-slate-500">
          {filteredVouchers.length === vouchers.length
            ? `${vouchers.length} voucher${vouchers.length !== 1 ? 's' : ''}`
            : `Showing ${filteredVouchers.length} of ${vouchers.length} vouchers`}
        </p>

        <div className="flex items-center gap-4">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
            <button
              onClick={() => onTypeFilterChange('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onTypeFilterChange('PDC')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === 'PDC'
                  ? 'bg-blue-500 text-white'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              PDC
            </button>
            <button
              onClick={() => onTypeFilterChange('CDC')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === 'CDC'
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-600 hover:bg-orange-50'
              }`}
            >
              CDC
            </button>
          </div>

          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* View */}
      {view === 'table' ? (
        <TableView vouchers={filteredVouchers} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <CardView vouchers={filteredVouchers} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}
