import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
}

/** Accessible dialog: focus trap-ish, Escape to close, backdrop click to close. */
export function Modal({ title, icon, onClose, children, narrow }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    const firstField = ref.current?.querySelector<HTMLElement>(
      'input, textarea, select, button:not(.close-modal)',
    );
    firstField?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${narrow ? ' narrow' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="modal-header">
          <h3 className="modal-title" id={titleId}>
            {icon}
            {title}
          </h3>
          <button type="button" className="close-modal" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface SubmitProps {
  busy?: boolean;
  label: string;
  busyLabel?: string;
  icon?: ReactNode;
}

export function SubmitButton({ busy, label, busyLabel, icon }: SubmitProps) {
  return (
    <button type="submit" className="btn btn-primary" disabled={busy}>
      {busy ? (
        <>
          <span className="spinner" /> {busyLabel ?? 'Working…'}
        </>
      ) : (
        <>
          {icon} {label}
        </>
      )}
    </button>
  );
}
