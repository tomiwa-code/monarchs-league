import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../state/store';

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          {toast.kind === 'error' ? (
            <AlertCircle size={17} />
          ) : toast.kind === 'info' ? (
            <Info size={17} />
          ) : (
            <CheckCircle2 size={17} />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            className="close-modal"
            style={{ width: 22, height: 22, marginLeft: 'auto' }}
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
