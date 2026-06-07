export function OurizonLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#7C5CFC" />
      <line x1="6" y1="31" x2="42" y2="31" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.5" />
      <path d="M11 31 A13 13 0 0 1 37 31" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="31" r="3" fill="#FFD166" />
      <line x1="24" y1="11" x2="24" y2="16" stroke="#FFD166" strokeWidth="2" strokeLinecap="round" />
      <line x1="12.5" y1="16.5" x2="15.5" y2="19.5" stroke="#FFD166" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="35.5" y1="16.5" x2="32.5" y2="19.5" stroke="#FFD166" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7" y1="23.5" x2="11.5" y2="24.8" stroke="#FFD166" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="41" y1="23.5" x2="36.5" y2="24.8" stroke="#FFD166" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
