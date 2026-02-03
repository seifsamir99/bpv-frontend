import { useState, useEffect, useCallback } from 'react';
import employeeApi from '../services/employeeApi';

export function useEmployees(type = null) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await employeeApi.getAll(type);
      if (response.success) {
        setEmployees(response.data);
      } else {
        setError(response.error || 'Failed to fetch employees');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = async (data) => {
    try {
      const response = await employeeApi.create(data);
      if (response.success) {
        await fetchEmployees(); // Refresh list
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateEmployee = async (id, data) => {
    try {
      const response = await employeeApi.update(id, data);
      if (response.success) {
        await fetchEmployees(); // Refresh list
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteEmployee = async (id) => {
    try {
      const response = await employeeApi.delete(id);
      if (response.success) {
        await fetchEmployees(); // Refresh list
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateOT = async (id, otHours) => {
    try {
      const response = await employeeApi.updateOT(id, otHours);
      if (response.success) {
        // Update local state
        setEmployees(prev => prev.map(emp =>
          emp.id === id ? { ...emp, otHours } : emp
        ));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const bulkUpdateOT = async (updates) => {
    try {
      const response = await employeeApi.bulkUpdateOT(updates);
      if (response.success) {
        await fetchEmployees(); // Refresh list
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    employees,
    loading,
    error,
    refresh: fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    updateOT,
    bulkUpdateOT,
  };
}

export default useEmployees;
