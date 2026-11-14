import { AlertTriangle } from 'lucide-react';
import { sanitizeUserMessage } from '../../lib/errors/userError';
import type { ClassifyContext } from '../../lib/errors/classifyError';

/**
 * Compact, accessible message for ordinary form mistakes. Use this instead of a
 * full-page error state for validation and per-field problems.
 *
 * `message` may be a raw service string; it is sanitised before display so a
 * technical string can never slip through.
 */
export default function InlineError({
  message,
  context,
  domain,
  className = '',
}: {
  message?: string | null;
  context?: ClassifyContext & { source?: string };
  domain?: ClassifyContext['domain'];
  className?: string;
}) {
  if (!message) return null;
  const safe = sanitizeUserMessage(message, domain ? { domain, ...context } : context);
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium leading-relaxed text-[var(--text-danger)] dark:text-[#ff8a9b] ${className}`}
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{safe}</span>
    </p>
  );
}

