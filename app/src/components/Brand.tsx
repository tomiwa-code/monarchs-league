/** The League Arena shield mark, drawn inline so it scales crisply anywhere. */
export function ShieldMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 2.5c3.4 1.4 5.6 1.8 7.4 2v5.8c0 4.9-3 7.9-7.4 9.7-4.4-1.8-7.4-4.8-7.4-9.7V4.5c1.8-.2 4-.6 7.4-2Z"
        fill="currentColor"
      />
      <path d="M9 8.5h1.5v6h3.2v1.4H9V8.5Zm5.6 0h3.1l1.2 7.4h-1.5l-.25-1.7h-1.9l-.25 1.7H14l.6-7.4Zm.6 4.4h1.4l-.5-3.4-.9 3.4Z" fill="#0b1120" />
    </svg>
  );
}

export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="navbar-brand" onClick={onClick} aria-label="League Arena home">
      <ShieldMark size={24} />
      League&nbsp;<span>Arena</span>
    </button>
  );
}
