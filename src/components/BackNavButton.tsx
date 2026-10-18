import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackNavButtonProps {
  fallbackUrl?: string;
  label?: string;
  className?: string;
}

/**
 * Intelligent hook to navigate back in history if within session,
 * otherwise navigate to the provided fallback URL.
 */
export function useSmartBack(fallbackUrl = '/') {
  const navigate = useNavigate();

  return () => {
    // Check if there is navigation history within the app session
    if (
      typeof window !== 'undefined' &&
      window.history.state &&
      typeof window.history.state.idx === 'number' &&
      window.history.state.idx > 0
    ) {
      navigate(-1);
    } else {
      navigate(fallbackUrl);
    }
  };
}

/**
 * Consistent, accessible mobile-first Back navigation button.
 * Features a recognizable left-pointing arrow and returns users to their
 * previous context rather than forcefully resetting to the home page.
 */
export default function BackNavButton({
  fallbackUrl = '/',
  label = 'Back',
  className = 'inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 hover:text-[#006C54] active:scale-95 transition-all cursor-pointer'
}: BackNavButtonProps) {
  const goBack = useSmartBack(fallbackUrl);

  return (
    <button
      type="button"
      onClick={goBack}
      className={className}
      aria-label={`Go back${label ? `: ${label}` : ''}`}
    >
      <ArrowLeft size={16} className="shrink-0 stroke-[2.4]" />
      <span>{label}</span>
    </button>
  );
}
