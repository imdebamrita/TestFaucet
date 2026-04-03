import { useState, useCallback, useRef } from 'react';

let toastId = 0;

/**
 * Custom hook for toast notifications.
 * Provides show/dismiss and auto-dismiss after 5 seconds.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback((message, type = 'loading', duration = 5000) => {
    const id = ++toastId;

    setToasts((prev) => [...prev, { id, message, type }]);

    if (type !== 'loading' && duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, [dismiss]);

  const update = useCallback((id, message, type) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, message, type } : t))
    );

    // Auto-dismiss after update if not loading
    if (type !== 'loading') {
      if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
      timersRef.current[id] = setTimeout(() => {
        dismiss(id);
      }, 4000);
    }
  }, [dismiss]);

  return { toasts, show, update, dismiss };
}
