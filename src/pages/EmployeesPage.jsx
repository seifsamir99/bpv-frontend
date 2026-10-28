import React, { useState, useMemo, useEffect } from 'react';
import { HiUserGroup, HiPlus, HiSearch, HiFilter, HiPencil, HiTrash, HiX, HiExclamationCircle, HiSwitchHorizontal, HiRefresh, HiLink, HiCheck, HiClipboardList, HiLocationMarker } from 'react-icons/hi';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import SlideOutPanel from '../components/SlideOutPanel';
import useEmployees from '../hooks/useEmployees';

import { API_BASE as API_BASE_URL } from '../services/apiBase';

const DESIGNATIONS = [
  'ELECTRICIAN', 'PLUMBER', 'A/C TECHNICIAN', 'Electric foreman', 'Plumber foreman',
  'FIREFIGHTER', 'Labour', 'Driver', 'DUCT FITTER', 'DUCT MAN', 'Ductman',
  'HR', 'Accountant', 'Secretary', 'General manager', 'A/C Engineer',
  'Plumping engineer', 'Mechanical Engineer', 'Drawings', 'Purchaser'
];

export default function EmployeesPage() {
  const { employees, loading, error, createEmployee, updateEmployee, deleteEmployee, refresh } = useEmployees();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');

  // Validation state
  const [validationIssues, setValidationIssues] = useState([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // The check-in page lives on its own separate deployment (bpv-checkin) —
  // never this domain — so a leaked link can't lead into the accounting app.
  const CHECKIN_BASE_URL = import.meta.env.VITE_CHECKIN_BASE_URL || 'http://localhost:3010';

  const handleCopyCheckInLink = (employee) => {
    const link = `${CHECKIN_BASE_URL}/checkin/${employee.checkinToken}`;
    navigator.clipboard.writeText(link);
    setCopiedId(employee.employeeId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyCrewLink = (employee) => {
    const link = `${CHECKIN_BASE_URL}/crew/${employee.checkinToken}`;
    navigator.clipboard.writeText(link);
    setCopiedId(`crew-${employee.employeeId}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Who gets a /checkin/<token> link. Removing it makes the old link stop
  // opening and drops them from the Time Log roster; adding it back re-uses
  // the same link (the token is shared with /crew, so it is never rotated).
  const handleToggleTimeLog = async (employee) => {
    const on = !employee.timeLogEnabled;
    if (!window.confirm(on
      ? `Give ${employee.name} a check-in link?\n\n`
        + 'They will appear on the Time Log and be auto-marked Absent on days they do not check in.'
      : `Remove ${employee.name}'s check-in link?\n\n`
        + 'Their existing link will stop working. Past time entries are kept.')) return;
    try {
      await axios.post(`${API_BASE_URL}/employees/${employee.employeeId}/time-log`, { enabled: on });
      refresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not change check-in access');
    }
  };

  // Who may fill the labour sheet at /crew/<token>. Deliberately independent of
  // the Time Log check-in flag: foremen mark the crew without being engineers.
  const handleToggleCrewSheet = async (employee) => {
    const on = !employee.crewSheetEnabled;
    if (on && !window.confirm(
      `Let ${employee.name} fill the labour attendance sheet?\n\n`
      + 'They will be able to mark Present/Absent, OT hours and site for every labour.')) return;
    try {
      await axios.post(`${API_BASE_URL}/employees/${employee.employeeId}/crew-sheet`, { enabled: on });
      refresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not change labour sheet access');
    }
  };

  // Fetch validation issues
  const fetchValidation = async () => {
    setValidationLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/employees/validation`);
      if (res.data.success) {
        setValidationIssues(res.data.issues);
      }
    } catch (err) {
      console.error('Error fetching validation:', err);
    } finally {
      setValidationLoading(false);
    }
  };

  useEffect(() => {
    fetchValidation();
  }, [employees]);

  // Move employee between Labour/Staff
  const handleMove = async (employeeId, targetType) => {
    setActionLoading(employeeId);
    try {
      const res = await axios.post(`${API_BASE_URL}/employees/${employeeId}/move`, { targetType });
      if (res.data.success) {
        refresh();
        fetchValidation();
      } else {
        alert(res.data.error || 'Failed to move employee');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Fix missing salary record
  const handleFixMissing = async (issue) => {
    setActionLoading(issue.employeeId);
    try {
      const res = await axios.post(`${API_BASE_URL}/employees/${issue.employeeId}/fix-missing`, {
        targetType: issue.attendanceType,
        ratePerDay: 0,
        ratePerHour: 0
      });
      if (res.data.success) {
        refresh();
        fetchValidation();
      } else {
        alert(res.data.error || 'Failed to fix employee');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = !searchQuery ||
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId?.toString().includes(searchQuery);
      const matchesType = !filterType || emp.type?.toLowerCase() === filterType.toLowerCase();
      const matchesDesignation = !filterDesignation ||
        emp.designation?.toLowerCase() === filterDesignation.toLowerCase();
      return matchesSearch && matchesType && matchesDesignation;
    });
  }, [employees, searchQuery, filterType, filterDesignation]);

  // Extract unique designations
  const designations = useMemo(() => {
    const desigs = employees.map(e => e.designation).filter(Boolean);
    return [...new Set(desigs)].sort();
  }, [employees]);

  const handleNewEmployee = () => {
    setSelectedEmployee(null);
    setIsPanelOpen(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setIsPanelOpen(true);
  };

  const handleDeleteEmployee = async (employee) => {
    if (!window.confirm(`Delete employee "${employee.name}" (ID: ${employee.employeeId})?`)) {
      return;
    }
    const res = await deleteEmployee(employee.employeeId);
    if (!res.success) {
      alert(res.error || 'Failed to delete employee');
    }
  };

  const handleSave = async (formData) => {
    if (selectedEmployee) {
      // Check if type changed - need to move employee between sheets
      const oldType = selectedEmployee.type?.toLowerCase();
      const newType = formData.type?.toLowerCase();
      if (oldType && newType && oldType !== newType) {
        // Move employee to new sheet first
        try {
          const moveRes = await axios.post(`${API_BASE_URL}/employees/${selectedEmployee.employeeId}/move`, {
            targetType: newType
          });
          if (!moveRes.data.success) {
            return { success: false, error: moveRes.data.error || 'Failed to move employee' };
          }
          // After move, update with new data
          refresh();
          return { success: true };
        } catch (err) {
          return { success: false, error: err.response?.data?.error || err.message };
        }
      }
      return await updateEmployee(selectedEmployee.employeeId, formData);
    } else {
      return await createEmployee(formData);
    }
  };

  // Stats
  const labourCount = employees.filter(e => e.type?.toLowerCase() === 'labour').length;
  const staffCount = employees.filter(e => e.type?.toLowerCase() === 'staff').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <PageHeader
          title="Employees"
          subtitle="Employee Master Data"
          icon={HiUserGroup}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} Total (${labourCount} Labour, ${staffCount} Staff)`}
        icon={HiUserGroup}
        onAction={handleNewEmployee}
        actionLabel="Add Employee"
        actionIcon={HiPlus}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Types</option>
              <option value="labour">Labour</option>
              <option value="staff">Staff</option>
            </select>

            {/* Designation Filter */}
            <select
              value={filterDesignation}
              onChange={(e) => setFilterDesignation(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Designations</option>
              {designations.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Validation Warnings */}
        {validationIssues.length > 0 && showWarnings && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-700">
                <HiExclamationCircle className="w-5 h-5" />
                <span className="font-medium">{validationIssues.length} Data Sync Issues Found</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchValidation}
                  disabled={validationLoading}
                  className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <HiRefresh className={`w-4 h-4 ${validationLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowWarnings(false)}
                  className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <HiX className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {validationIssues.map((issue, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{issue.name} <span className="text-slate-400 text-sm">#{issue.employeeId}</span></div>
                    <div className="text-sm text-amber-600">
                      {issue.type === 'missing_salary' && `In ${issue.attendanceType} attendance but missing from salary sheet`}
                      {issue.type === 'missing_attendance' && `In ${issue.salaryType} salary but missing from attendance sheet`}
                      {issue.type === 'type_mismatch' && `Type mismatch: ${issue.attendanceType} attendance vs ${issue.salaryType} salary`}
                    </div>
                  </div>
                  {issue.type === 'missing_salary' && (
                    <button
                      onClick={() => handleFixMissing(issue)}
                      disabled={actionLoading === issue.employeeId}
                      className="ml-3 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      {actionLoading === issue.employeeId ? 'Fixing...' : 'Add to Salary'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsed warnings indicator */}
        {validationIssues.length > 0 && !showWarnings && (
          <button
            onClick={() => setShowWarnings(true)}
            className="mb-4 flex items-center gap-2 text-amber-600 hover:text-amber-700 text-sm"
          >
            <HiExclamationCircle className="w-4 h-4" />
            {validationIssues.length} issues hidden - click to show
          </button>
        )}

        {/* Employee List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Rate/Day</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">OT Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(employee => (
                  <tr key={employee.employeeId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-500">#{employee.employeeId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{employee.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {employee.designation}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        employee.type?.toLowerCase() === 'staff'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {employee.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {employee.ratePerDay?.toFixed(2)} AED
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {employee.otHours || 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleMove(
                            employee.employeeId,
                            employee.type?.toLowerCase() === 'staff' ? 'labour' : 'staff'
                          )}
                          disabled={actionLoading === employee.employeeId}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={`Move to ${employee.type?.toLowerCase() === 'staff' ? 'Labour' : 'Staff'}`}
                        >
                          {actionLoading === employee.employeeId ? (
                            <HiRefresh className="w-4 h-4 animate-spin" />
                          ) : (
                            <HiSwitchHorizontal className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleTimeLog(employee)}
                          className={`p-2 rounded-lg transition-colors ${
                            employee.timeLogEnabled
                              ? 'text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100'
                              : 'text-slate-300 hover:text-fuchsia-600 hover:bg-fuchsia-50'
                          }`}
                          title={employee.timeLogEnabled
                            ? 'Has a check-in link — click to remove it'
                            : 'Give this person a check-in link'}
                        >
                          <HiLocationMarker className="w-4 h-4" />
                        </button>
                        {employee.timeLogEnabled && (
                          <button
                            onClick={() => handleCopyCheckInLink(employee)}
                            disabled={!employee.checkinToken}
                            className="p-2 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition-colors disabled:opacity-30"
                            title="Copy Check-in Link"
                          >
                            {copiedId === employee.employeeId ? (
                              <HiCheck className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <HiLink className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleCrewSheet(employee)}
                          className={`p-2 rounded-lg transition-colors ${
                            employee.crewSheetEnabled
                              ? 'text-lime-600 bg-lime-50 hover:bg-lime-100'
                              : 'text-slate-300 hover:text-lime-600 hover:bg-lime-50'
                          }`}
                          title={employee.crewSheetEnabled
                            ? 'Fills the labour attendance sheet — click to remove access'
                            : 'Let this person fill the labour attendance sheet'}
                        >
                          <HiClipboardList className="w-4 h-4" />
                        </button>
                        {employee.crewSheetEnabled && (
                          <button
                            onClick={() => handleCopyCrewLink(employee)}
                            disabled={!employee.checkinToken}
                            className="p-2 text-slate-400 hover:text-lime-600 hover:bg-lime-50 rounded-lg transition-colors disabled:opacity-30"
                            title="Copy Labour Sheet Link"
                          >
                            {copiedId === `crew-${employee.employeeId}` ? (
                              <HiCheck className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <HiLink className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleEditEmployee(employee)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <HiPencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No employees found matching your filters.
            </div>
          )}
        </div>
      </main>

      {/* Employee Form Panel */}
      <SlideOutPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={selectedEmployee ? 'Edit Employee' : 'Add Employee'}
      >
        <EmployeeForm
          employee={selectedEmployee}
          onSave={handleSave}
          onClose={() => setIsPanelOpen(false)}
        />
      </SlideOutPanel>
    </div>
  );
}

// Employee Form Component
function EmployeeForm({ employee, onSave, onClose }) {
  const isNew = !employee;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: employee?.name || '',
    designation: employee?.designation || '',
    type: employee?.type || 'Labour',
    ratePerDay: employee?.ratePerDay || '',
    ratePerHour: employee?.ratePerHour || '',
    otHours: employee?.otHours || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate rate per hour when rate per day changes
      if (field === 'ratePerDay' && value) {
        updated.ratePerHour = (parseFloat(value) / 8).toFixed(2);
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await onSave(formData);
      if (result?.success) {
        onClose();
      } else {
        setError(result?.error || 'Failed to save employee');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="input-label">Employee Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Full name"
          className="input-field"
        />
      </div>

      <div>
        <label className="input-label">Type *</label>
        <select
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="input-field"
        >
          <option value="Labour">Labour</option>
          <option value="Staff">Staff</option>
        </select>
      </div>

      <div>
        <label className="input-label">Designation *</label>
        <select
          required
          value={formData.designation}
          onChange={(e) => handleChange('designation', e.target.value)}
          className="input-field"
        >
          <option value="">Select designation...</option>
          {DESIGNATIONS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Rate per Day (AED) *</label>
          <input
            type="number"
            required
            step="0.01"
            value={formData.ratePerDay}
            onChange={(e) => handleChange('ratePerDay', e.target.value)}
            placeholder="0.00"
            className="input-field"
          />
        </div>
        <div>
          <label className="input-label">Rate per Hour (AED)</label>
          <input
            type="number"
            step="0.01"
            value={formData.ratePerHour}
            onChange={(e) => handleChange('ratePerHour', e.target.value)}
            placeholder="Auto-calculated"
            className="input-field bg-slate-50"
            readOnly
          />
        </div>
      </div>

      {formData.type === 'Labour' && (
        <div>
          <label className="input-label">OT Hours (this month)</label>
          <input
            type="number"
            step="0.5"
            value={formData.otHours}
            onChange={(e) => handleChange('otHours', e.target.value)}
            placeholder="0"
            className="input-field"
          />
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 btn-gradient-green disabled:opacity-50"
        >
          {saving ? 'Saving...' : isNew ? 'Add Employee' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
