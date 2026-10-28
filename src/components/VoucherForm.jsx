import React, { useState, useEffect, useMemo } from 'react';
import { HiTrash, HiPrinter, HiDocumentDownload, HiExclamationCircle } from 'react-icons/hi';
import LineItemsTable from './LineItemsTable';
import { bpvApi } from '../services/api';

export default function VoucherForm({ voucher, onSave, onDelete, onClose, suggestedBpvNo, vouchers = [] }) {
  // An edit always receives a voucher object; a new voucher receives null.
  // Do NOT key this on voucher.id — an optimistic update can transiently drop
  // the id, which used to flip Edit into Create and duplicate the voucher.
  const isNew = !voucher;
  // Stable key for updates: the backend routes PUT /api/bpv/<bpvNo> on bpv_no.
  const voucherKey = voucher?.bpvNo ?? voucher?.id;
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Extract unique suggestions from all vouchers
  const companySuggestions = useMemo(() => {
    const names = vouchers.flatMap(v => v.lineItems?.map(i => i.companyName) || []);
    return [...new Set(names.filter(Boolean))].sort();
  }, [vouchers]);

  const descriptionSuggestions = useMemo(() => {
    const descriptions = vouchers.flatMap(v => v.lineItems?.map(i => i.description) || []);
    return [...new Set(descriptions.filter(Boolean))].sort();
  }, [vouchers]);

  const [formData, setFormData] = useState({
    bpvNo: '',
    date: '',
    pdcType: 'PDC',
    lineItems: [
      {
        srNo: 1,
        description: '',
        companyName: '',
        chequeNo: '',
        chequeDate: '',
        debit: '',
        credit: ''
      }
    ]
  });

  // Initialize form with voucher data or suggested BPV number
  useEffect(() => {
    if (voucher) {
      setFormData({
        bpvNo: voucher.bpvNo || '',
        date: voucher.date || '',
        pdcType: voucher.pdcType || 'PDC',
        lineItems: voucher.lineItems?.length > 0
          ? voucher.lineItems
          : [{
              srNo: 1,
              description: '',
              companyName: '',
              chequeNo: '',
              chequeDate: '',
              debit: '',
              credit: ''
            }]
      });
    } else if (suggestedBpvNo) {
      // For new vouchers, pre-fill with the suggested BPV number
      setFormData(prev => ({
        ...prev,
        bpvNo: String(suggestedBpvNo)
      }));
    }
  }, [voucher, suggestedBpvNo]);

  // Calculate total
  const totalAmount = useMemo(() => {
    return formData.lineItems.reduce((sum, item) => {
      const debit = parseFloat(item.debit) || 0;
      return sum + debit;
    }, 0);
  }, [formData.lineItems]);

  // No auto-save: the user saves explicitly with the button. This is the only
  // write path, so there is never more than one in-flight write per voucher.

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemsChange = (newItems) => {
    setFormData(prev => ({ ...prev, lineItems: newItems }));
  };

  const handleSave = async () => {
    if (saving) return; // guard against double-submit
    setSaveError(null);
    setSaving(true);
    const dataToSave = { ...formData, totalAmount };

    try {
      let result;
      if (isNew) {
        result = await onSave(null, dataToSave);
      } else {
        result = await onSave(voucherKey, dataToSave);
      }

      if (result && !result.success) {
        setSaveError(result.error || 'Error saving voucher');
        return; // Don't close on error
      }
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Error saving voucher');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      await onDelete(voucher);
      onClose();
    }
  };

  const handlePrint = () => {
    if (voucher?.id) {
      window.open(bpvApi.getPdfUrl(voucher.id), '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Error display */}
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <HiExclamationCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{saveError}</span>
        </div>
      )}

      {/* Header Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">BPV Number</label>
          <input
            type="text"
            value={formData.bpvNo}
            onChange={(e) => handleFieldChange('bpvNo', e.target.value)}
            placeholder="e.g., 31"
            readOnly={!isNew}
            title={!isNew ? 'BPV number cannot be changed after creation' : undefined}
            className={`input-field ${!isNew ? 'bg-slate-100 cursor-not-allowed' : ''}`}
          />
        </div>
        <div>
          <label className="input-label">Date</label>
          <input
            type="text"
            value={formData.date}
            onChange={(e) => handleFieldChange('date', e.target.value)}
            placeholder="DD/MM/YYYY"
            className="input-field"
          />
        </div>
      </div>

      {/* PDC/CDC Toggle */}
      <div>
        <label className="input-label">Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleFieldChange('pdcType', 'PDC')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              formData.pdcType === 'PDC'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            PDC
            <span className="block text-xs opacity-75">Post-Dated Cheque</span>
          </button>
          <button
            type="button"
            onClick={() => handleFieldChange('pdcType', 'CDC')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              formData.pdcType === 'CDC'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            CDC
            <span className="block text-xs opacity-75">Current-Dated Cheque</span>
          </button>
        </div>
      </div>

      {/* Line Items */}
      <LineItemsTable
        items={formData.lineItems}
        onChange={handleLineItemsChange}
        companySuggestions={companySuggestions}
        descriptionSuggestions={descriptionSuggestions}
      />

      {/* Total */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">TOTAL AMOUNT AED</span>
          <span className="text-2xl font-bold text-slate-800">
            {totalAmount.toLocaleString('en-AE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-gradient-green flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : (isNew ? 'Create Voucher' : 'Save Changes')}
        </button>

        {!isNew && (
          <>
            <button
              onClick={handlePrint}
              className="btn-gradient-purple flex items-center gap-2"
            >
              <HiPrinter className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleDelete}
              className="btn-gradient-pink flex items-center gap-2"
            >
              <HiTrash className="w-4 h-4" />
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
