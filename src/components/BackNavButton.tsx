import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { executeCentralizedBack } from '../lib/navigationHistory';

interface BackNavButtonProps {
  fallbackUrl?: string;
  label?: string;
  className?: string;
  variant?: 'default' | 'overlay' | 'minimal';
}

/**
 * Centralized hook to navigate back to the exact previous in-app history entry
 * (with its saved scroll position and page state), or fall back contextually
 * ONLY if the user landed directly on a deep link with no prior history.
 */
export function useSmartBack(fallbackUrl?: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    executeCentralizedBack(navigate, location, fallbackUrl);
  }, [navigate, location, fallbackUrl]);
}

/**
 * Clean, borderless Back button with hover/active feedback that uses the
 * centralized MshindiRoom navigation history & scroll restoration system.
 */
export default function BackNavButton({
  fallbackUrl,
  label = 'Back',
  className = '',
  variant = 'default',
}: BackNavButtonProps) {
  const goBack = useSmartBack(fallbackUrl);

  const baseStyles =
    'group inline-flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer select-none border-0 bg-transparent shadow-none p-0';

  const variantStyles = {
    default: 'text-slate-600 dark:text-[#B5BDB6] hover:text-[#006C54] dark:hover:text-[#F4F5EF]',
    overlay: 'text-white/90 hover:text-white drop-shadow-sm',
    minimal: 'text-cream-dim hover:text-gold',
  }[variant];

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      <ArrowLeft
        size={16}
        className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
      />
      <span>{label}</span>
    </button>
  );
}
