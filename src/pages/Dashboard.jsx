import React from 'react';
import { Link } from 'react-router-dom';
import { HiCurrencyDollar, HiUserGroup, HiDocumentText, HiChartBar, HiClipboardCheck, HiClock, HiCreditCard } from 'react-icons/hi';

const sections = [
  {
    id: 'accounts',
    title: 'Accounts',
    description: 'BPV Manager - Bank Payment Vouchers',
    icon: HiDocumentText,
    path: '/bpv',
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    hoverGradient: 'hover:from-blue-600 hover:to-blue-700',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 'attendance',
    title: 'Attendance',
    description: 'Daily Labour & Staff Attendance',
    icon: HiClipboardCheck,
    path: '/attendance',
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
    hoverGradient: 'hover:from-purple-600 hover:to-purple-700',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    id: 'employees',
    title: 'Employees',
    description: 'Employee Master Data & Salaries',
    icon: HiUserGroup,
    path: '/employees',
    color: 'green',
    gradient: 'from-emerald-500 to-emerald-600',
    hoverGradient: 'hover:from-emerald-600 hover:to-emerald-700',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'monthend',
    title: 'Month End',
    description: 'OT Hours & Deductions Entry',
    icon: HiClock,
    path: '/month-end',
    color: 'amber',
    gradient: 'from-amber-500 to-amber-600',
    hoverGradient: 'hover:from-amber-600 hover:to-amber-700',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: 'payroll',
    title: 'Payroll',
    description: 'Calculate & Export Monthly Payroll',
    icon: HiCurrencyDollar,
    path: '/payroll',
    color: 'orange',
    gradient: 'from-orange-500 to-orange-600',
    hoverGradient: 'hover:from-orange-600 hover:to-orange-700',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    id: 'pdc',
    title: 'PDC Tracker',
    description: 'Post-Dated Cheques Management',
    icon: HiCreditCard,
    path: '/pdc',
    color: 'cyan',
    gradient: 'from-cyan-500 to-cyan-600',
    hoverGradient: 'hover:from-cyan-600 hover:to-cyan-700',
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <HiChartBar className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Newell Electromechanical Works LLC</h1>
              <p className="text-sm text-slate-500">Management Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-700">Select a Module</h2>
          <p className="text-slate-500 mt-1">Choose a section to manage</p>
        </div>

        {/* Section Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => {
            const IconComponent = section.icon;
            return (
              <Link
                key={section.id}
                to={section.path}
                className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-transparent"
              >
                {/* Gradient accent bar */}
                <div className={`h-2 bg-gradient-to-r ${section.gradient}`} />

                <div className="p-6">
                  {/* Icon */}
                  <div className={`w-14 h-14 ${section.iconBg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className={`w-8 h-8 ${section.iconColor}`} />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{section.title}</h3>
                  <p className="text-slate-500 text-sm">{section.description}</p>

                  {/* Arrow indicator */}
                  <div className="mt-4 flex items-center text-slate-400 group-hover:text-slate-600 transition-colors">
                    <span className="text-sm font-medium">Open</span>
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Coming Soon Card */}
          <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
              <HiCurrencyDollar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400">More Coming Soon</h3>
            <p className="text-slate-400 text-sm mt-1">Finance, Inventory, Projects...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
