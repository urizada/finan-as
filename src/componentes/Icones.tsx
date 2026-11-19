// Ícones simples em SVG (traço), sem dependência externa.
type P = { className?: string };
const base = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.9,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24',
};

export const IconeHoje = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" /></svg>
);
export const IconeSaldos = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9.3h17M3.5 14.6h17M9.5 4v16" /></svg>
);
export const IconeTotais = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M4 20V11M10 20V5M16 20v-6M21 20H3" /></svg>
);
export const IconeMenu = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
);
export const IconeMais = ({ className }: P) => (
  <svg {...base} strokeWidth={2.4} className={className} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
export const IconeSeta = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
);
export const IconeVoltar = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
);
