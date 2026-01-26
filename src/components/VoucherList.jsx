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
  onEdit,
  onDelete
}) {
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {vouchers.length} voucher{vouchers.length !== 1 ? 's' : ''}
        </p>
        <ViewToggle view={view} onViewChange={onViewChange} />
      </div>

      {/* View */}
      {view === 'table' ? (
        <TableView vouchers={vouchers} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <CardView vouchers={vouchers} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}
