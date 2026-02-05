import React, { useState, useMemo } from 'react';
import { HiClipboardCheck, HiCheck, HiRefresh, HiFilter, HiSearch, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useAttendance from '../hooks/useAttendance';

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Leave', 'Off', 'Sick', 'Joined'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const STATUS_COLORS = {
  'Present': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Absent': 'bg-red-100 text-red-700 border-red-200',
  'Leave': 'bg-amber-100 text-amber-700 border-amber-200',
  'Off': 'bg-slate-100 text-slate-600 border-slate-200',
  'Sick': 'bg-orange-100 text-orange-700 border-orange-200',
  'Joined': 'bg-blue-100 text-blue-700 border-blue-200',
  '': 'bg-white text-slate-400 border-slate-200',
};

export default function AttendancePage() {
  const today = new Date();
  const { attendance, loading, error, updateAttendance, markAllAs, refresh } = useAttendance();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [saving, setSaving] = useState({});

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

  // Handle status change for a single employee
  const handleStatusChange = async (employeeId, status) => {
    setSaving(prev => ({ ...prev, [employeeId]: true }));
    await updateAttendance(employeeId, selectedDay, status);
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
      status
    }));
    await markAllAs(selectedDay, updates);
    setSaving({});
  };

  // Day buttons for quick navigation
  const dayButtons = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dayButtons.push(i);
  }

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
            {dayButtons.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                  selectedDay === day
                    ? 'bg-purple-600 text-white shadow-md'
                    : isCurrentMonth && day === today.getDate()
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {day}
              </button>
            ))}
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

            {/* Bulk Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkAll('Present')}
                disabled={saving.all}
                className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Mark All Present
              </button>
              <button
                onClick={() => handleMarkAll('Off')}
                disabled={saving.all}
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Mark All Off
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              const currentStatus = record.days?.[selectedDay] || '';
              const isSaving = saving[record.employeeId];

              return (
                <div
                  key={record.employeeId}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Employee Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">#{record.employeeId}</span>
                        <span className="font-medium text-slate-800 truncate">{record.name}</span>
                      </div>
                      <span className="text-sm text-slate-500">{record.designation}</span>
                    </div>

                    {/* Status Selector */}
                    <div className="flex items-center gap-2">
                      {isSaving && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      )}
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(record.employeeId, e.target.value)}
                        disabled={isSaving}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 ${STATUS_COLORS[currentStatus] || STATUS_COLORS['']}`}
                      >
                        <option value="">Select...</option>
                        {ATTENDANCE_STATUSES.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
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
          {ATTENDANCE_STATUSES.map(status => {
            const count = filteredAttendance.filter(
              r => r.days?.[selectedDay]?.toLowerCase() === status.toLowerCase()
            ).length;
            return (
              <div
                key={status}
                className={`rounded-lg border p-3 ${STATUS_COLORS[status]}`}
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
