import React, { useState, useMemo } from 'react';
import { HiUserGroup, HiSearch, HiSortDescending, HiCalendar, HiCash } from 'react-icons/hi';

// Format number as AED currency
const formatAED = (amount) => {
  return new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Parse date string (DD/MM/YYYY) to Date object
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

export default function SalaryList({ salaries, loading, error, onEdit, onDelete }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [dateFilter, setDateFilter] = useState('all');

  // Filter and sort salaries
  const processedSalaries = useMemo(() => {
    let result = salaries;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.employeeName?.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      result = result.filter(s => {
        const salaryDate = parseDate(s.paymentDate);
        if (!salaryDate) return false;

        switch (dateFilter) {
          case 'this-month':
            return salaryDate.getMonth() === currentMonth && salaryDate.getFullYear() === currentYear;
          case 'last-month':
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return salaryDate.getMonth() === lastMonth && salaryDate.getFullYear() === lastMonthYear;
          case 'this-year':
            return salaryDate.getFullYear() === currentYear;
          default:
            return true;
        }
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (parseDate(b.paymentDate) || 0) - (parseDate(a.paymentDate) || 0);
        case 'date-asc':
          return (parseDate(a.paymentDate) || 0) - (parseDate(b.paymentDate) || 0);
        case 'amount-desc':
          return (b.netPay || 0) - (a.netPay || 0);
        case 'amount-asc':
          return (a.netPay || 0) - (b.netPay || 0);
        case 'name-asc':
          return (a.employeeName || '').localeCompare(b.employeeName || '');
        case 'name-desc':
          return (b.employeeName || '').localeCompare(a.employeeName || '');
        default:
          return 0;
      }
    });

    return result;
  }, [salaries, searchQuery, dateFilter, sortBy]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = processedSalaries.reduce((sum, s) => sum + (s.netPay || 0), 0);
    return {
      count: processedSalaries.length,
      amount: total,
    };
  }, [processedSalaries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading salaries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading salaries</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (salaries.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiUserGroup className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-slate-500 font-medium">No salary records yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "New Salary" to add your first record</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by employee name or position..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date Filter */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
          <HiCalendar className="w-4 h-4 text-slate-400 ml-2" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-transparent border-none focus:outline-none cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-year">This Year</option>
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
          <HiSortDescending className="w-4 h-4 text-slate-400 ml-2" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-transparent border-none focus:outline-none cursor-pointer"
          >
            <option value="date-desc">Date (Newest)</option>
            <option value="date-asc">Date (Oldest)</option>
            <option value="amount-desc">Amount (High → Low)</option>
            <option value="amount-asc">Amount (Low → High)</option>
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
          </select>
        </div>
      </div>

      {/* Totals Bar */}
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-3 border border-emerald-100">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Records</p>
            <p className="text-lg font-bold text-slate-800">{totals.count}</p>
          </div>
          <div className="h-8 w-px bg-emerald-200" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Paid</p>
            <p className="text-lg font-bold text-emerald-600">{formatAED(totals.amount)} AED</p>
          </div>
        </div>
        {processedSalaries.length !== salaries.length && (
          <p className="text-sm text-slate-500">
            Showing {processedSalaries.length} of {salaries.length}
          </p>
        )}
      </div>

      {/* No Results */}
      {processedSalaries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <HiSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No salaries found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFilter('all');
              }}
              className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}

      {/* Salary Cards */}
      {processedSalaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processedSalaries.map((salary) => (
            <div
              key={salary.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onEdit(salary)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-600 font-bold text-sm">
                      {salary.employeeName?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{salary.employeeName || 'Unknown'}</h3>
                    <p className="text-sm text-slate-500">{salary.position || 'No position'}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{salary.paymentDate}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1 text-slate-500">
                  <HiCash className="w-4 h-4" />
                  <span className="text-xs">{salary.paymentMethod}</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  {formatAED(salary.netPay)} AED
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
