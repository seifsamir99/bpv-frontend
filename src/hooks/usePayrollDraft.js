import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_VERSION = 1;
const SAVE_DELAY = 500; // ms debounce

function getDraftKey(type, year, month) {
  return `payroll_draft_${type}_${year}_${month}`;
}

export function usePayrollDraft(type, year, month) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState(null);
  const timeoutRef = useRef(null);

  const draftKey = getDraftKey(type, year, month);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version === DRAFT_VERSION) {
          setHasDraft(true);
          setDraftTimestamp(parsed.savedAt);
          return {
            overrides: parsed.overrides || {},
            selectedIds: parsed.selectedIds || [],
            cashEmployeeIds: parsed.cashEmployeeIds || [],
          };
        }
      }
    } catch (e) {
      console.error('Error loading payroll draft:', e);
    }
    setHasDraft(false);
    setDraftTimestamp(null);
    return null;
  }, [draftKey]);

  // Save draft to localStorage (debounced)
  const saveDraft = useCallback((overrides, selectedIds, cashEmployeeIds = new Set()) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        const hasChanges = Object.keys(overrides).length > 0 || cashEmployeeIds.size > 0;
        if (hasChanges) {
          const data = {
            overrides,
            selectedIds: Array.from(selectedIds),
            cashEmployeeIds: Array.from(cashEmployeeIds),
            savedAt: new Date().toISOString(),
            version: DRAFT_VERSION,
          };
          localStorage.setItem(draftKey, JSON.stringify(data));
          setHasDraft(true);
          setDraftTimestamp(data.savedAt);
        } else {
          // No changes, remove draft
          localStorage.removeItem(draftKey);
          setHasDraft(false);
          setDraftTimestamp(null);
        }
      } catch (e) {
        console.error('Error saving payroll draft:', e);
      }
    }, SAVE_DELAY);
  }, [draftKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
      setHasDraft(false);
      setDraftTimestamp(null);
    } catch (e) {
      console.error('Error clearing payroll draft:', e);
    }
  }, [draftKey]);

  // Check for existing draft on mount or when key changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version === DRAFT_VERSION) {
          setHasDraft(true);
          setDraftTimestamp(parsed.savedAt);
        }
      } else {
        setHasDraft(false);
        setDraftTimestamp(null);
      }
    } catch (e) {
      setHasDraft(false);
      setDraftTimestamp(null);
    }
  }, [draftKey]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    hasDraft,
    draftTimestamp,
  };
}

export default usePayrollDraft;
