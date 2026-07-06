import React, { useState, useEffect, useMemo } from 'react';
import { HiTrash, HiExclamationCircle } from 'react-icons/hi';
import AutocompleteInput from './AutocompleteInput';

export default function SalaryForm({ salary, onSave, onDelete, onClose, salaries = [] }) {
  const isNew = !salary?.id;
  const [saveError, setSaveError] = useState(null);

  // Extract unique suggestions from all salaries
  const employeeSuggestions = useMemo(() => {
    const names = salaries.map(s => s.employeeName).filter(Boolean);
    return [...new Set(names)].sort();
  }, [salaries]);

  const positionSuggestions = useMemo(() => {
    const positions = salaries.map(s => s.position).filter(Boolean);
    return [...new Set(positions)].sort();
  }, [salaries]);

  const [formData, setFormData] = useState({
    employeeName: '',
    position: '',
    basicSalary: '',
    housingAllowance: '',
    transportAllowance: '',
    otherAllowances: '',
    deductions: '',
    paymentDate: '',
    paymentMethod: 'Bank Transfer',
    bankName: '',
    chequeNumber: '',
    notes: '',
  });

  // Initialize form with salary data
  useEffect(() => {
    if (salary) {
      setFormData({
        employeeName: salary.employeeName || '',
        position: salary.position || '',
        basicSalary: salary.basicSalary || '',
        housingAllowance: salary.housingAllowance || '',
        transportAllowance: salary.transportAllowance || '',
        otherAllowances: salary.otherAllowances || '',
        deductions: salary.deductions || '',
        paymentDate: salary.paymentDate || '',
        paymentMethod: salary.paymentMethod || 'Bank Transfer',
        bankName: salary.bankName || '',
        chequeNumber: salary.chequeNumber || '',
        notes: salary.notes || '',
      });
    }
  }, [salary]);

  // Calculate net pay
  const netPay = useMemo(() => {
    const basic = parseFloat(formData.basicSalary) || 0;
    const housing = parseFloat(formData.housingAllowance) || 0;
    const transport = parseFloat(formData.transportAllowance) || 0;
    const other = parseFloat(formData.otherAllowances) || 0;
    const deduct = parseFloat(formData.deductions) || 0;
    return basic + housing + transport + other - deduct;
  }, [formData.basicSalary, formData.housingAllowance, formData.transportAllowance, formData.otherAllowances, formData.deductions]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveError(null);
    const dataToSave = { ...formData, netPay };

    try {
      let result;
      if (isNew) {
        result = await onSave(null, dataToSave);
      } else {
        result = await onSave(salary.id, dataToSave);
      }

      if (result && !result.success) {
        setSaveError(result.error || 'Error saving salary');
        return;
      }
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Error saving salary');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this salary record?')) {
      await onDelete(salary);
      onClose();
    }
  };

  const showBankFields = formData.paymentMethod === 'Bank Transfer' || formData.paymentMethod === 'Cheque';
  const showChequeField = formData.paymentMethod === 'Cheque';

  return (
    <div className="space-y-6">
      {/* Error display */}
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <HiExclamationCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{saveError}</span>
        </div>
      )}

      {/* Employee Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Employee Information</h3>

        <div>
          <label className="input-label">Employee Name</label>
          <AutocompleteInput
            value={formData.employeeName}
            onChange={(value) => handleFieldChange('employeeName', value)}
            suggestions={employeeSuggestions}
            placeholder="Full name"
            className="input-field"
          />
        </div>

        <div>
          <label className="input-label">Position / Job Title</label>
          <AutocompleteInput
            value={formData.position}
            onChange={(value) => handleFieldChange('position', value)}
            suggestions={positionSuggestions}
            placeholder="e.g., Electrician, Foreman, Engineer"
            className="input-field"
          />
        </div>
      </div>

      {/* Salary Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Salary Breakdown</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Basic Salary (AED)</label>
            <input
              type="number"
              step="0.01"
              value={formData.basicSalary}
              onChange={(e) => handleFieldChange('basicSalary', e.target.value)}
              placeholder="0.00"
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Housing Allowance (AED)</label>
            <input
              type="number"
              step="0.01"
              value={formData.housingAllowance}
              onChange={(e) => handleFieldChange('housingAllowance', e.target.value)}
              placeholder="0.00"
              className="input-field"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Transport Allowance (AED)</label>
            <input
              type="number"
              step="0.01"
              value={formData.transportAllowance}
              onChange={(e) => handleFieldChange('transportAllowance', e.target.value)}
              placeholder="0.00"
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Other Allowances (AED)</label>
            <input
              type="number"
              step="0.01"
              value={formData.otherAllowances}
              onChange={(e) => handleFieldChange('otherAllowances', e.target.value)}
              placeholder="0.00"
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="input-label">Deductions (AED)</label>
          <input
            type="number"
            step="0.01"
            value={formData.deductions}
            onChange={(e) => handleFieldChange('deductions', e.target.value)}
            placeholder="0.00"
            className="input-field"
          />
        </div>
      </div>

      {/* Net Pay Display */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">NET PAY (AED)</span>
          <span className="text-2xl font-bold text-emerald-600">
            {netPay.toLocaleString('en-AE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Payment Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Payment Date</label>
            <input
              type="text"
              value={formData.paymentDate}
              onChange={(e) => handleFieldChange('paymentDate', e.target.value)}
              placeholder="DD/MM/YYYY"
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Payment Method</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
              className="input-field"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        {showBankFields && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Bank Name</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => handleFieldChange('bankName', e.target.value)}
                placeholder="e.g., Emirates NBD"
                className="input-field"
              />
            </div>
            {showChequeField && (
              <div>
                <label className="input-label">Cheque Number</label>
                <input
                  type="text"
                  value={formData.chequeNumber}
                  onChange={(e) => handleFieldChange('chequeNumber', e.target.value)}
                  placeholder="e.g., 001234"
                  className="input-field"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="input-label">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
            className="input-field resize-none"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          className="btn-gradient-green flex-1"
        >
          {isNew ? 'Create Salary Record' : 'Save Changes'}
        </button>

        {!isNew && (
          <button
            onClick={handleDelete}
            className="btn-gradient-pink flex items-center gap-2"
          >
            <HiTrash className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
