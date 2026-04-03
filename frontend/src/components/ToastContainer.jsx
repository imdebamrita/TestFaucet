import React from 'react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" id="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'loading' && <span className="spinner" />}
          {toast.type === 'success' && <span>✓</span>}
          {toast.type === 'error' && <span>✕</span>}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
