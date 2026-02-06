import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BPVPage from './pages/BPVPage';
import SalariesPage from './pages/SalariesPage';
import AttendancePage from './pages/AttendancePage';
import EmployeesPage from './pages/EmployeesPage';
import MonthEndPage from './pages/MonthEndPage';
import PayrollPage from './pages/PayrollPage';

const LAST_PATH_KEY = 'bpv_last_path';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // On mount: restore last visited path
  useEffect(() => {
    const savedPath = localStorage.getItem(LAST_PATH_KEY);
    if (savedPath && savedPath !== '/' && location.pathname === '/') {
      navigate(savedPath, { replace: true });
    }
  }, []);

  // On route change: save current path
  useEffect(() => {
    if (location.pathname !== '/') {
      localStorage.setItem(LAST_PATH_KEY, location.pathname);
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/bpv" element={<BPVPage />} />
      <Route path="/salaries" element={<SalariesPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/employees" element={<EmployeesPage />} />
      <Route path="/month-end" element={<MonthEndPage />} />
      <Route path="/payroll" element={<PayrollPage />} />
    </Routes>
  );
}
