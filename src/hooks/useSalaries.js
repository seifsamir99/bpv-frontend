import { useState, useEffect, useCallback } from 'react';
import { salaryApi } from '../services/salaryApi';

export function useSalaries() {
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSalaries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await salaryApi.getAll();
      setSalaries(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch salaries');
      console.error('Error fetching salaries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalaries();
  }, [fetchSalaries]);

  const createSalary = async (salaryData) => {
    try {
      const result = await salaryApi.create(salaryData);
      if (result.success) {
        // Add to local state
        setSalaries(prev => [...prev, result.data]);
      }
      return result;
    } catch (err) {
      console.error('Error creating salary:', err);
      return { success: false, error: err.message };
    }
  };

  const updateSalary = async (id, salaryData) => {
    try {
      const result = await salaryApi.update(id, salaryData);
      if (result.success) {
        // Update local state
        setSalaries(prev => prev.map(s => s.id === id ? { ...s, ...salaryData } : s));
      }
      return result;
    } catch (err) {
      console.error('Error updating salary:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteSalary = async (id) => {
    try {
      const result = await salaryApi.delete(id);
      if (result.success) {
        // Remove from local state
        setSalaries(prev => prev.filter(s => s.id !== id));
      }
      return result;
    } catch (err) {
      console.error('Error deleting salary:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    salaries,
    loading,
    error,
    refetch: fetchSalaries,
    createSalary,
    updateSalary,
    deleteSalary,
  };
}

export default useSalaries;
