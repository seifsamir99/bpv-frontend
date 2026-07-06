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
import AIChatWidget from './components/AIChatWidget';

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
      </Routes>
      <AIChatWidget />
    </>
  );
}
