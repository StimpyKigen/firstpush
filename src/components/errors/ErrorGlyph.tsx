import type { ErrorIconKey, ErrorSeverity } from '../../lib/errors/errorCatalog';

/**
 * Minimal line glyphs for the error system.
 *
 * Design rules (from the MshindiRoom error-system brief):
 *  - no circular plate behind the glyph,
 *  - rounded, friendly strokes,
 *  - a small status badge in the corner carries the severity colour,
 *  - colours come from the existing design tokens (emerald / gold / danger / cream).
 */

type BadgeMark = 'alert' | 'clock';

const BADGE_MARK_BY_ICON: Partial<Record<ErrorIconKey, BadgeMark>> = {
  server: 'clock',
  clock: 'alert',
};

function Glyph({ icon }: { icon: ErrorIconKey }) {
  switch (icon) {
    case 'wifi':
      return (
        <>
          <path d="M6 24c15-13 37-13 52 0" />
          <path d="M14 33c11-9 25-9 36 0" />
          <path d="M23 42c6-4.5 12-4.5 18 0" />
          <circle cx="32" cy="50" r="2.6" fill="currentColor" stroke="none" />
        </>
      );
    case 'server':
      return (
        <>
          <rect x="8" y="9" width="42" height="13" rx="4.5" />
          <rect x="8" y="26" width="42" height="13" rx="4.5" />
          <rect x="8" y="43" width="30" height="12" rx="4.5" />
          <circle cx="17" cy="15.5" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="17" cy="32.5" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'lock':
      return (
        <>
          <rect x="12" y="28" width="38" height="26" rx="7" />
          <path d="M19 28v-7a12 12 0 0 1 24 0v7" />
          <circle cx="31" cy="39.5" r="3" fill="currentColor" stroke="none" />
          <path d="M31 42v5" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="27" cy="27" r="17" />
          <path d="M40 40l14 14" />
        </>
      );
    case 'card':
      return (
        <>
          <rect x="5" y="13" width="46" height="32" rx="6" />
          <path d="M5 23h46" />
          <path d="M12 36h12" />
        </>
      );
    case 'warning':
      return (
        <>
          <path d="M32 8L58 52H6z" strokeLinejoin="round" />
          <path d="M32 24v14" />
          <circle cx="32" cy="45" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'upload':
      return (
        <>
          <path d="M30 38V12" />
          <path d="M19 22l11-11 11 11" />
          <path d="M8 42v6a5 5 0 0 0 5 5h34a5 5 0 0 0 5-5v-6" />
        </>
      );
    case 'file':
      return (
        <>
          <path d="M15 7h22l13 13v30a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V12a5 5 0 0 1 5-5z" />
          <path d="M37 7v13h13" />
          <path d="M19 33h22M19 42h14" />
        </>
      );
    case 'chat':
      return (
        <>
          <path d="M14 9h30a7 7 0 0 1 7 7v20a7 7 0 0 1-7 7H29l-12 10V43h-3a7 7 0 0 1-7-7V16a7 7 0 0 1 7-7z" />
          <circle cx="20" cy="26" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="29" cy="26" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="38" cy="26" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'calendar':
      return (
        <>
          <rect x="7" y="13" width="44" height="40" rx="7" />
          <path d="M7 25h44" />
          <path d="M19 8v10M39 8v10" />
          <circle cx="29" cy="39" r="5" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="29" cy="31" r="22" />
          <path d="M29 18v14l9 6" />
        </>
      );
    case 'coin':
      return (
        <>
          <circle cx="29" cy="31" r="22" />
          <circle cx="29" cy="31" r="13" />
          <path d="M29 25v12" />
        </>
      );
    default:
      return null;
  }
}

export interface ErrorGlyphProps {
  icon: ErrorIconKey;
  severity: ErrorSeverity;
  /** Pixel size of the glyph box. */
  size?: number;
  className?: string;
}

export default function ErrorGlyph({ icon, severity, size = 72, className = '' }: ErrorGlyphProps) {
  const mark: BadgeMark = BADGE_MARK_BY_ICON[icon] ?? 'alert';
  const badgeFill = severity === 'error' ? 'var(--color-danger)' : 'var(--color-gold)';
  const markStroke = severity === 'error' ? '#FFFFFF' : '#1c1e21';

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 text-emerald dark:text-cream ${className}`}
      data-error-icon={icon}
    >
      <Glyph icon={icon} />
      {/* Status badge: small, corner-anchored, carries the severity colour. */}
      <circle cx="51" cy="50" r="10" fill={badgeFill} stroke="var(--color-ink)" strokeWidth="2.4" />
      {mark === 'alert' ? (
        <>
          <path d="M51 44.5v6" stroke={markStroke} strokeWidth="2.6" />
          <circle cx="51" cy="55" r="1.4" fill={markStroke} stroke="none" />
        </>
      ) : (
        <path d="M51 44.5v6l3.6 2.2" stroke={markStroke} strokeWidth="2.4" />
      )}
    </svg>
  );
}

