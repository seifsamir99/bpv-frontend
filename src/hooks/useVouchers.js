import { useState, useEffect, useCallback } from 'react';
import { bpvApi } from '../services/api';

export function useVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await bpvApi.getAll();
      if (result.success) {
        setVouchers(result.data);
      } else {
        setError(result.error || 'Failed to fetch vouchers');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch vouchers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const getNextBpvNumber = async () => {
    try {
      const result = await bpvApi.getNextNumber();
      if (result.success) {
        return result.data.nextNumber;
      }
      return null;
    } catch (err) {
      console.error('Failed to get next BPV number:', err);
      return null;
    }
  };

  const createVoucher = async (data) => {
    try {
      const result = await bpvApi.create(data);
      if (result.success) {
        await fetchVouchers();
      }
      return result;
    } catch (err) {
      console.error('Create voucher error:', err);
      return { success: false, error: err.message || 'Failed to create voucher' };
    }
  };

  const updateVoucher = async (bpvNo, data) => {
    try {
      const result = await bpvApi.update(bpvNo, data);
      if (result.success) {
        // Update local state
        setVouchers(prev =>
          prev.map(v => v.id === parseInt(bpvNo) ? result.data : v)
        );
      } else {
        console.error('Update failed:', result.error);
        setError(result.error || 'Failed to update voucher');
      }
      return result;
    } catch (err) {
      console.error('Update voucher error:', err);
      setError(err.message || 'Failed to update voucher');
      return { success: false, error: err.message || 'Failed to update voucher' };
    }
  };

  const deleteVoucher = async (bpvNo) => {
    try {
      const result = await bpvApi.delete(bpvNo);
      if (result.success) {
        await fetchVouchers();
      }
      return result;
    } catch (err) {
      console.error('Delete voucher error:', err);
      return { success: false, error: err.message || 'Failed to delete voucher' };
    }
  };

  return {
    vouchers,
    loading,
    error,
    refetch: fetchVouchers,
    getNextBpvNumber,
    createVoucher,
    updateVoucher,
    deleteVoucher
  };
}
