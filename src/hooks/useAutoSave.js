import { useState, useEffect, useRef, useCallback } from 'react';

export function useAutoSave(saveFunction, delay = 1000) {
  const [status, setStatus] = useState('idle'); // idle, saving, saved, error
  const [lastSaved, setLastSaved] = useState(null);
  const timeoutRef = useRef(null);
  const lastDataRef = useRef(null);

  const save = useCallback(async (data) => {
    // Skip if data hasn't changed
    if (JSON.stringify(data) === JSON.stringify(lastDataRef.current)) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the save
    timeoutRef.current = setTimeout(async () => {
      try {
        setStatus('saving');
        await saveFunction(data);
        lastDataRef.current = data;
        setLastSaved(new Date());
        setStatus('saved');

        // Reset to idle after 2 seconds
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        console.error('Auto-save error:', err);
        setStatus('error');

        // Reset to idle after 3 seconds
        setTimeout(() => setStatus('idle'), 3000);
      }
    }, delay);
  }, [saveFunction, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { status, lastSaved, save };
}
