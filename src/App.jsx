import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BPVPage from './pages/BPVPage';
import SalariesPage from './pages/SalariesPage';
import AttendancePage from './pages/AttendancePage';
import EmployeesPage from './pages/EmployeesPage';
import MonthEndPage from './pages/MonthEndPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/bpv" element={<BPVPage />} />
      <Route path="/salaries" element={<SalariesPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/employees" element={<EmployeesPage />} />
      <Route path="/month-end" element={<MonthEndPage />} />
    </Routes>
  );
}
