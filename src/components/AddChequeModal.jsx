import React, { useState } from 'react';
import SlideOutPanel from './SlideOutPanel';
import { HiPlus } from 'react-icons/hi';

function AddChequeModal({ isOpen, onClose, onSave, type }) {
  const [formData, setFormData] = useState({
    company: '',
    chequeNo: '',
    chequeDate: '',
    amount: '',
    status: type === 'PDC' ? 'Not Released' : 'Pending'
  });
  const [errors, setErrors] = useState({});

  const statusOptions = type === 'PDC'
    ? ['Not Released', 'Released']
    : ['Pending', 'Cleared'];

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate
    const newErrors = {};
    if (!formData.company.trim()) newErrors.company = 'Company name is required';
    if (!formData.chequeNo.trim()) newErrors.chequeNo = 'Cheque number is required';
    if (!formData.chequeDate) newErrors.chequeDate = 'Cheque date is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save
    onSave({
      ...formData,
      amount: parseFloat(formData.amount),
      id: `manual-${Date.now()}`,
      bpvNo: '',
      description: '',
    });

    // Reset and close
    setFormData({
      company: '',
      chequeNo: '',
      chequeDate: '',
      amount: '',
      status: type === 'PDC' ? 'Not Released' : 'Pending'
    });
    setErrors({});
    onClose();
  };

  return (
    <SlideOutPanel isOpen={isOpen} onClose={onClose} title={`Add ${type} Cheque`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Name */}
        <div>
          <label className="input-label">Company Name *</label>
          <input
            type="text"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            className={`input-field ${errors.company ? 'border-red-500' : ''}`}
            placeholder="Enter company name"
            autoFocus
          />
          {errors.company && <p className="text-red-500 text-sm mt-1">{errors.company}</p>}
        </div>

        {/* Cheque Number */}
        <div>
          <label className="input-label">Cheque Number *</label>
          <input
            type="text"
            value={formData.chequeNo}
            onChange={(e) => setFormData({ ...formData, chequeNo: e.target.value })}
            className={`input-field ${errors.chequeNo ? 'border-red-500' : ''}`}
            placeholder="Enter cheque number"
          />
          {errors.chequeNo && <p className="text-red-500 text-sm mt-1">{errors.chequeNo}</p>}
        </div>

        {/* Cheque Date */}
        <div>
          <label className="input-label">Cheque Date *</label>
          <input
            type="date"
            value={formData.chequeDate}
            onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
            className={`input-field ${errors.chequeDate ? 'border-red-500' : ''}`}
          />
          {errors.chequeDate && <p className="text-red-500 text-sm mt-1">{errors.chequeDate}</p>}
        </div>

        {/* Amount */}
        <div>
          <label className="input-label">Amount (AED) *</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className={`input-field ${errors.amount ? 'border-red-500' : ''}`}
            placeholder="0.00"
          />
          {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
        </div>

        {/* Status */}
        <div>
          <label className="input-label">Status *</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="input-field"
          >
            {statusOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 btn-gradient-blue flex items-center justify-center gap-2"
          >
            <HiPlus className="w-5 h-5" />
            Add Cheque
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </SlideOutPanel>
  );
}

export default AddChequeModal;
