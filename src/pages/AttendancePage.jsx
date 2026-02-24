import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { HiClipboardCheck, HiCheck, HiRefresh, HiFilter, HiSearch, HiChevronLeft, HiChevronRight, HiX, HiChevronDown } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useAttendance from '../hooks/useAttendance';

const DEFAULT_STATUSES = ['Present', 'Absent', 'Leave', 'Off', 'Sick', 'Joined'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_STATUS_HEX = {
  Present: '#16a34a',
  Absent: '#dc2626',
  Leave: '#d97706',
  Off: '#64748b',
  Sick: '#ea580c',
  Joined: '#2563eb',
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getLightStyle(hex) {
  return { backgroundColor: hexToRgba(hex, 0.12), color: hex, borderColor: hexToRgba(hex, 0.3) };
}

function getBoldStyle(hex) {
  return { backgroundColor: hex, color: '#ffffff' };
}

function StatusDropdown({ currentStatus, statuses, onSelect, onCustom, disabled, statusColors }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hex = statusColors[currentStatus] || '#94a3b8';
  const btnStyle = currentStatus ? getLightStyle(hex) : { backgroundColor: '#fff', color: '#94a3b8', borderColor: '#e2e8f0' };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-50"
        style={btnStyle}
      >
        {currentStatus || 'Select...'}
        <HiChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 max-h-60 overflow-y-auto">
          <button
            onClick={() => { onSelect(''); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
          {statuses.map(status => {
            const sHex = statusColors[status] || '#a855f7';
            return (
              <button
                key={status}
                onClick={() => { onSelect(status); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm font-medium rounded-sm transition-colors hover:opacity-80"
                style={{
                  ...getLightStyle(sHex),
                  boxShadow: currentStatus === status ? 'inset 0 0 0 2px #a855f7' : 'none',
                }}
              >
                {status}
              </button>
            );
          })}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={() => { onCustom(); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm text-purple-600 font-medium hover:bg-purple-50 transition-colors"
            >
              + Custom...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const today = new Date();
  const [selectedType, setSelectedType] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const { attendance, loading, error, updateAttendance, markAllAs, refresh, autoFillSundays } = useAttendance(selectedType, selectedMonth, selectedYear);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [saving, setSaving] = useState({});
  const [customInput, setCustomInput] = useState({});
  const [sundaysFilled, setSundaysFilled] = useState(false);
  const [fillingMessage, setFillingMessage] = useState('');
  const [showBulkDropdown, setShowBulkDropdown] = useState(false);
  const bulkDropdownRef = useRef(null);

  // Custom status colors persisted in localStorage
  const [statusColors, setStatusColors] = useState(() => {
    try {
      const saved = localStorage.getItem('attendance_status_colors');
      return saved ? { ...DEFAULT_STATUS_HEX, ...JSON.parse(saved) } : DEFAULT_STATUS_HEX;
    } catch { return DEFAULT_STATUS_HEX; }
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('attendance_status_colors', JSON.stringify(statusColors));
  }, [statusColors]);

  useEffect(() => {
    const close = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setShowColorPicker(false);
    };
    if (showColorPicker) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showColorPicker]);

  useEffect(() => {
    const close = (e) => {
      if (bulkDropdownRef.current && !bulkDropdownRef.current.contains(e.target)) setShowBulkDropdown(false);
    };
    if (showBulkDropdown) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showBulkDropdown]);

  // Collect all unique statuses from existing data (includes custom ones)
  // Deduplicates case-insensitively — keeps DEFAULT_STATUSES casing as canonical
  const allStatuses = useMemo(() => {
    const found = new Set(DEFAULT_STATUSES);
    const lowerSet = new Set(DEFAULT_STATUSES.map(s => s.toLowerCase()));
    attendance.forEach(record => {
      Object.values(record.days || {}).forEach(val => {
        if (val && !lowerSet.has(val.toLowerCase())) {
          found.add(val);
          lowerSet.add(val.toLowerCase());
        }
      });
    });
    return [...found];
  }, [attendance]);

  // Derived month info
  const monthName = MONTH_NAMES[selectedMonth];
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();

  // Navigate months
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
    setSelectedDay(1);
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
    setSelectedDay(1);
  };

  const goToToday = () => {
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
    setSelectedDay(today.getDate());
  };

  // Extract unique designations for filter
  const designations = useMemo(() => {
    const desigs = attendance.map(a => a.designation).filter(Boolean);
    return [...new Set(desigs)].sort();
  }, [attendance]);

  // Filter attendance records
  const filteredAttendance = useMemo(() => {
    return attendance.filter(record => {
      const matchesSearch = !searchQuery ||
        record.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.employeeId?.toString().includes(searchQuery);
      const matchesDesignation = !filterDesignation || record.designation === filterDesignation;
      return matchesSearch && matchesDesignation;
    });
  }, [attendance, searchQuery, filterDesignation]);

  // Single employee mode for day button coloring
  const isSingleEmployee = filteredAttendance.length === 1;
  const singleEmployeeDays = isSingleEmployee ? (filteredAttendance[0].days || {}) : {};

  // Auto-fill Sundays as Off
  useEffect(() => {
    setSundaysFilled(false);
  }, [selectedMonth, selectedYear, selectedType]);

  useEffect(() => {
    const doAutoFill = async () => {
      if (!loading && attendance.length > 0 && !sundaysFilled) {
        setSundaysFilled(true);

        // Check if there are empty Sundays
        const sundays = [];
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(selectedYear, selectedMonth, d).getDay() === 0) sundays.push(d);
        }

        let hasSundaysToFix = false;
        for (const record of attendance) {
          for (const sunday of sundays) {
            if (record.days?.[sunday]?.toLowerCase() !== 'off') {
              hasSundaysToFix = true;
              break;
            }
          }
          if (hasSundaysToFix) break;
        }

        if (hasSundaysToFix) {
          setFillingMessage('Auto-filling Sundays as Off...');
          await autoFillSundays(selectedYear, selectedMonth);
          setFillingMessage('');
        }
      }
    };
    doAutoFill();
  }, [loading, attendance.length, sundaysFilled, selectedYear, selectedMonth, daysInMonth, autoFillSundays]);

  // Handle status change for a single employee
  const handleStatusChange = async (employeeId, status, employeeType) => {
    setSaving(prev => ({ ...prev, [employeeId]: true }));
    await updateAttendance(employeeId, selectedDay, status, employeeType);
    setSaving(prev => ({ ...prev, [employeeId]: false }));
  };

  // Handle mark all as a specific status
  const handleMarkAll = async (status) => {
    if (!window.confirm(`Mark all ${filteredAttendance.length} employees as "${status}" for day ${selectedDay}?`)) {
      return;
    }
    setSaving({ all: true });
    const updates = filteredAttendance.map(record => ({
      employeeId: record.employeeId,
      status,
      type: record.type || 'labour'
    }));
    await markAllAs(selectedDay, updates);
    setSaving({});
  };

  // Day buttons for quick navigation
  const dayButtons = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dayButtons.push(i);
  }

  // Check if a day is Sunday in the selected month/year
  const isSunday = (day) => new Date(selectedYear, selectedMonth, day).getDay() === 0;

  // Get day button style — returns { className, style } for dynamic colors
  const getDayButtonStyle = (day) => {
    const sunday = isSunday(day);
    const ring = selectedDay === day ? 'ring-2 ring-purple-600 ring-offset-2 shadow-md' : '';

    if (isSingleEmployee) {
      // Force Off (grey) on Sundays regardless of sheet data
      const dayStatus = sunday ? 'Off' : (singleEmployeeDays[day] || '');
      const hex = statusColors[dayStatus] || '#94a3b8';
      return {
        className: ring,
        style: dayStatus ? getBoldStyle(hex) : { backgroundColor: '#f1f5f9', color: '#475569' },
      };
    }

    // Multi-employee mode
    if (selectedDay === day) {
      return { className: 'shadow-md', style: sunday ? getBoldStyle('#94a3b8') : { backgroundColor: '#9333ea', color: '#fff' } };
    }
    if (isCurrentMonth && day === today.getDate()) {
      return { className: '', style: { backgroundColor: '#ede9fe', color: '#7e22ce' } };
    }
    if (sunday) {
      return { className: '', style: { backgroundColor: '#e2e8f0', color: '#94a3b8' } };
    }
    return { className: '', style: { backgroundColor: '#f1f5f9', color: '#475569' } };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <PageHeader
          title="Attendance"
          subtitle={`${monthName} ${selectedYear}`}
          icon={HiClipboardCheck}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <PageHeader
          title="Attendance"
          subtitle={`${monthName} ${selectedYear}`}
          icon={HiClipboardCheck}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Error loading attendance: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader
        title="Attendance"
        subtitle={`${monthName} ${selectedYear}`}
        icon={HiClipboardCheck}
        onAction={refresh}
        actionLabel="Refresh"
        actionIcon={HiRefresh}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Auto-fill indicator */}
        {fillingMessage && (
          <div className="mb-4 flex items-center gap-2 text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            {fillingMessage}
          </div>
        )}

        {/* Type Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 mb-6 inline-flex gap-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'labour', label: 'Labour' },
            { value: 'staff', label: 'Staff' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setSelectedType(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === tab.value
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Month & Day Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <HiChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setSelectedDay(1); }}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setSelectedDay(1); }}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {!isCurrentMonth && (
                <button
                  onClick={goToToday}
                  className="ml-2 px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                >
                  Today
                </button>
              )}
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <HiChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Buttons */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 font-medium">Select Day</span>
            <span className="text-sm text-slate-500">
              Day {selectedDay} of {daysInMonth}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dayButtons.map(day => {
              const DAY_ABBRS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
              const abbr = DAY_ABBRS[new Date(selectedYear, selectedMonth, day).getDay()];
              const { className: btnClass, style: btnStyle } = getDayButtonStyle(day);
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`w-9 h-11 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center leading-none gap-0.5 ${btnClass}`}
                  style={btnStyle}
                >
                  <span className="text-xs opacity-60">{abbr}</span>
                  <span>{day}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters and Bulk Actions */}
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
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Designation Filter */}
            <div className="flex items-center gap-2">
              <HiFilter className="text-slate-400 w-5 h-5" />
              <select
                value={filterDesignation}
                onChange={(e) => setFilterDesignation(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Designations</option>
                {designations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Bulk Actions + Color Picker */}
            <div className="flex gap-2">
              <div className="relative" ref={bulkDropdownRef}>
                <button
                  onClick={() => !saving.all && !isSunday(selectedDay) && setShowBulkDropdown(!showBulkDropdown)}
                  disabled={saving.all || isSunday(selectedDay)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Mark All As…
                  <HiChevronDown className={`w-4 h-4 transition-transform ${showBulkDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showBulkDropdown && (
                  <div className="absolute left-0 mt-1 z-50 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                    {allStatuses.map(status => {
                      const sHex = statusColors[status] || '#a855f7';
                      return (
                        <button
                          key={status}
                          onClick={() => { setShowBulkDropdown(false); handleMarkAll(status); }}
                          className="w-full text-left px-3 py-1.5 text-sm font-medium rounded-sm transition-colors hover:opacity-80"
                          style={getLightStyle(sHex)}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative" ref={colorPickerRef}>
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                  title="Customize status colors"
                >
                  Colors
                </button>
                {showColorPicker && (
                  <div className="absolute right-0 mt-2 z-50 bg-white rounded-xl shadow-lg border border-slate-200 p-4 w-64">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-700">Status Colors</span>
                      <button
                        onClick={() => setStatusColors(DEFAULT_STATUS_HEX)}
                        className="text-xs text-purple-600 hover:text-purple-800"
                      >
                        Reset all
                      </button>
                    </div>
                    {DEFAULT_STATUSES.map(status => (
                      <div key={status} className="flex items-center gap-3 py-1.5">
                        <input
                          type="color"
                          value={statusColors[status] || DEFAULT_STATUS_HEX[status]}
                          onChange={(e) => setStatusColors(prev => ({ ...prev, [status]: e.target.value }))}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-200"
                        />
                        <span className="text-sm text-slate-700 flex-1">{status}</span>
                        <button
                          onClick={() => setStatusColors(prev => ({ ...prev, [status]: DEFAULT_STATUS_HEX[status] }))}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Reset
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">
                {filteredAttendance.length} Employees
              </span>
              <span className="text-sm text-slate-500">
                Day {selectedDay}, {monthName} {selectedYear}
              </span>
            </div>
          </div>

          {/* Mobile-friendly card layout */}
          <div className="divide-y divide-slate-100">
            {filteredAttendance.map(record => {
              const rawStatus = record.days?.[selectedDay] || '';
              // Sundays are always Off regardless of sheet data; otherwise normalize casing
              const currentStatus = isSunday(selectedDay) ? 'Off' : (DEFAULT_STATUSES.find(s => s.toLowerCase() === rawStatus.toLowerCase()) || rawStatus);
              const isSaving = saving[record.employeeId];

              return (
                <div
                  key={`${record.type}-${record.employeeId}`}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Employee Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">#{record.employeeId}</span>
                        <span className="font-medium text-slate-800 truncate">{record.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          record.type === 'staff'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {record.type === 'staff' ? 'Staff' : 'Labour'}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500">{record.designation}</span>
                    </div>

                    {/* Status Selector */}
                    <div className="flex items-center gap-2">
                      {isSaving && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      )}
                      {customInput[record.employeeId] !== undefined ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={customInput[record.employeeId]}
                            onChange={(e) => setCustomInput(prev => ({ ...prev, [record.employeeId]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customInput[record.employeeId].trim()) {
                                handleStatusChange(record.employeeId, customInput[record.employeeId].trim(), record.type);
                                setCustomInput(prev => { const n = { ...prev }; delete n[record.employeeId]; return n; });
                              }
                              if (e.key === 'Escape') {
                                setCustomInput(prev => { const n = { ...prev }; delete n[record.employeeId]; return n; });
                              }
                            }}
                            placeholder="Type status..."
                            className="w-28 px-2 py-1.5 rounded-lg border border-purple-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            onClick={() => {
                              if (customInput[record.employeeId].trim()) {
                                handleStatusChange(record.employeeId, customInput[record.employeeId].trim(), record.type);
                              }
                              setCustomInput(prev => { const n = { ...prev }; delete n[record.employeeId]; return n; });
                            }}
                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          >
                            <HiCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCustomInput(prev => { const n = { ...prev }; delete n[record.employeeId]; return n; })}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                          >
                            <HiX className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <StatusDropdown
                          currentStatus={currentStatus}
                          statuses={allStatuses}
                          onSelect={(status) => handleStatusChange(record.employeeId, status, record.type)}
                          onCustom={() => setCustomInput(prev => ({ ...prev, [record.employeeId]: '' }))}
                          disabled={isSaving || isSunday(selectedDay)}
                          statusColors={statusColors}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAttendance.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No employees found matching your filters.
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {allStatuses.map(status => {
            const count = filteredAttendance.filter(r => {
              const effective = isSunday(selectedDay) ? 'off' : (r.days?.[selectedDay] || '').toLowerCase();
              return effective === status.toLowerCase();
            }).length;
            if (count === 0 && !DEFAULT_STATUSES.includes(status)) return null;
            const cardHex = statusColors[status] || '#a855f7';
            return (
              <div
                key={status}
                className="rounded-lg border p-3"
                style={getLightStyle(cardHex)}
              >
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm">{status}</div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
