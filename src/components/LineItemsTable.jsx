import React from 'react';
import { HiPlus, HiMinus } from 'react-icons/hi';

export default function LineItemsTable({ items, onChange, maxItems = 5 }) {
  const addItem = () => {
    if (items.length >= maxItems) return;

    onChange([
      ...items,
      {
        srNo: items.length + 1,
        description: '',
        companyName: '',
        chequeNo: '',
        chequeDate: '',
        debit: '',
        credit: ''
      }
    ]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;

    const newItems = items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      srNo: i + 1
    }));
    onChange(newItems);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="input-label">Line Items</label>
        {items.length < maxItems && (
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <HiPlus className="w-4 h-4" />
            Add Row
          </button>
        )}
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            {/* Row header with remove button */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Item #{index + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <HiMinus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Description - full width textarea */}
            <div>
              <label className="text-xs text-slate-500">Description</label>
              <textarea
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                placeholder="Cost of project S# 104 - Cheque # 1040..."
                rows={2}
                className="input-field text-sm resize-none"
              />
            </div>

            {/* Company Name */}
            <div>
              <label className="text-xs text-slate-500">Company Name</label>
              <input
                type="text"
                value={item.companyName}
                onChange={(e) => updateItem(index, 'companyName', e.target.value)}
                placeholder="Company name"
                className="input-field text-sm"
              />
            </div>

            {/* Cheque details row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">CHQ No</label>
                <input
                  type="text"
                  value={item.chequeNo}
                  onChange={(e) => updateItem(index, 'chequeNo', e.target.value)}
                  placeholder="1040"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">CHQ Date</label>
                <input
                  type="text"
                  value={item.chequeDate}
                  onChange={(e) => updateItem(index, 'chequeDate', e.target.value)}
                  placeholder="21/04/2026"
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Amount row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Debit (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.debit}
                  onChange={(e) => updateItem(index, 'debit', e.target.value)}
                  placeholder="0.00"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Credit (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.credit}
                  onChange={(e) => updateItem(index, 'credit', e.target.value)}
                  placeholder="0.00"
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length >= maxItems && (
        <p className="text-xs text-slate-500 text-center">Maximum {maxItems} items per voucher</p>
      )}
    </div>
  );
}
