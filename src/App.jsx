import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BPVPage from './pages/BPVPage';
import SalariesPage from './pages/SalariesPage';
import AttendancePage from './pages/AttendancePage';
import EmployeesPage from './pages/EmployeesPage';
import MonthEndPage from './pages/MonthEndPage';
import PayrollPage from './pages/PayrollPage';
import PDCPage from './pages/PDCPage';
import CDCPage from './pages/CDCPage';
import LPOPage from './pages/LPOPage';
import JobOrderPage from './pages/JobOrderPage';
import PaymentCertPage from './pages/PaymentCertPage';
import TaxInvoicesPage from './pages/TaxInvoicesPage';
import SupplierLedgerPage from './pages/SupplierLedgerPage';
import TimeLogPage from './pages/TimeLogPage';
import SiteLogPage from './pages/SiteLogPage';
import CreditFormPage from './pages/CreditFormPage';
import AIChatWidget from './components/AIChatWidget';

// Note: the engineer-facing pages (/checkin/:token and the labour sheet
// /crew/:token) intentionally live on a separate deployment (bpv-checkin, its
// own Vercel project) — not here — so a leaked link can never lead into this
// app. /site-log below is the office's read/correct view of what they filled.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bpv" element={<BPVPage />} />
        <Route path="/salaries" element={<SalariesPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/month-end" element={<MonthEndPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/pdc" element={<PDCPage />} />
        <Route path="/cdc" element={<CDCPage />} />
        <Route path="/lpo" element={<LPOPage />} />
        <Route path="/job-order" element={<JobOrderPage />} />
        <Route path="/payment-cert" element={<PaymentCertPage />} />
        <Route path="/tax-invoices" element={<TaxInvoicesPage />} />
        <Route path="/supplier-ledger" element={<SupplierLedgerPage />} />
        <Route path="/time-log" element={<TimeLogPage />} />
        <Route path="/site-log" element={<SiteLogPage />} />
        <Route path="/credit-form" element={<CreditFormPage />} />
      </Routes>
      <AIChatWidget />
    </>
  );
}
