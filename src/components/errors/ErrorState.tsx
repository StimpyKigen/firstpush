import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import ErrorGlyph from './ErrorGlyph';
import {
  ACTION_LABELS,
  ERROR_CATALOG,
  SUPPORT_EMAIL,
  type ErrorActionId,
  type ErrorKind,
} from '../../lib/errors/errorCatalog';
import { toUserError } from '../../lib/errors/userError';
import type { ClassifyContext } from '../../lib/errors/classifyError';

export type ErrorStateVariant = 'page' | 'section' | 'compact';

export interface ErrorStateProps {
  /** Explicit catalogue kind. Takes precedence over `error`. */
  kind?: ErrorKind;
  /** Any thrown value / failed response; it is classified and reported, never displayed. */
  error?: unknown;
  /** Domain hint used when classifying `error` (payment, upload, chat…). */
  context?: ClassifyContext & { source?: string };
  /** Overrides catalogue copy. Must already be safe (use `resolveServiceError`). */
  title?: string;
  message?: string;
  variant?: ErrorStateVariant;
  /** Re-runs the failed operation. Only rendered for retry-safe kinds unless `allowRetry`. */
  onRetry?: () => void | Promise<unknown>;
  /** Assert that retrying this specific operation is idempotent. */
  allowRetry?: boolean;
  onCheckPayment?: () => void | Promise<unknown>;
  onCheckBalance?: () => void | Promise<unknown>;
  /** Defaults to navigating to /auth. */
  onSignIn?: () => void;
  /** Restrict which actions may appear (intersected with the catalogue's list). */
  actions?: ErrorActionId[];
  className?: string;
  children?: ReactNode;
}

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-full bg-emerald hover:bg-emerald-2 ' +
  'text-white text-sm font-bold shadow-[0_8px_18px_-8px_rgba(0,108,84,0.65)] ' +
  'transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:cursor-wait ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-ink dark:ring-1 dark:ring-white/10';

const LINK_BUTTON =
  'inline-flex items-center justify-center min-h-9 px-2 text-xs font-semibold text-cream underline ' +
  'underline-offset-4 decoration-cream/40 hover:decoration-cream transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded';

const SIZES: Record<ErrorStateVariant, { glyph: number; wrap: string; title: string; text: string }> = {
  page: {
    glyph: 76,
    wrap: 'min-h-[min(60dvh,34rem)] justify-center px-5 py-10 sm:py-14',
    title: 'text-xl sm:text-2xl',
    text: 'text-sm',
  },
  section: {
    glyph: 56,
    wrap:
      'rounded-3xl border border-line bg-panel px-5 py-7 sm:px-8 sm:py-9 ' +
      'shadow-[0_10px_30px_-18px_rgba(10,19,23,0.35)]',
    title: 'text-lg',
    text: 'text-sm',
  },
  compact: { glyph: 40, wrap: 'px-4 py-4', title: 'text-sm', text: 'text-xs' },
};

function usePendingAction() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async (fn?: () => void | Promise<unknown>) => {
    if (!fn || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

function goBack() {
  if (typeof window === 'undefined') return;
  if (window.history.length > 1) window.history.back();
  else window.location.assign('/');
}

export default function ErrorState(props: ErrorStateProps) {
  const {
    kind,
    error,
    context,
    title,
    message,
    variant = 'section',
    onRetry,
    allowRetry = false,
    onCheckPayment,
    onCheckBalance,
    onSignIn,
    actions,
    className = '',
    children,
  } = props;

  const inRouter = useInRouterContext();
  const { busy, run } = usePendingAction();

  // Classification happens once per render; it is cheap and side-effect free
  // unless `error` is provided (then it is reported to developers, redacted).
  const resolvedKind: ErrorKind = kind ?? toUserError(error, context).kind;
  const def = ERROR_CATALOG[resolvedKind];
  const size = SIZES[variant];

  const allowed = actions ? def.actions.filter((a) => actions.includes(a)) : def.actions;

  type RenderedAction =
    | { id: ErrorActionId; type: 'button'; onClick: () => void; busy?: boolean }
    | { id: ErrorActionId; type: 'nav'; to: string }
    | { id: ErrorActionId; type: 'mail'; href: string };

  const rendered: RenderedAction[] = [];
  for (const id of allowed) {
    switch (id) {
      case 'retry':
        if (onRetry && (def.retrySafe || allowRetry)) {
          rendered.push({ id, type: 'button', onClick: () => void run(onRetry), busy });
        }
        break;
      case 'check-payment':
        if (onCheckPayment) rendered.push({ id, type: 'button', onClick: () => void run(onCheckPayment), busy });
        break;
      case 'check-balance':
        if (onCheckBalance) rendered.push({ id, type: 'button', onClick: () => void run(onCheckBalance), busy });
        break;
      case 'sign-in':
        if (onSignIn) rendered.push({ id, type: 'button', onClick: onSignIn });
        else rendered.push({ id, type: 'nav', to: '/auth' });
        break;
      case 'home':
        rendered.push({ id, type: 'nav', to: '/' });
        break;
      case 'browse-matches':
        rendered.push({ id, type: 'nav', to: '/free' });
        break;
      case 'back':
        rendered.push({ id, type: 'button', onClick: goBack });
        break;
      case 'reload':
        rendered.push({ id, type: 'button', onClick: () => window.location.reload() });
        break;
      case 'support':
        rendered.push({
          id,
          type: 'mail',
          href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MshindiRoom support request')}`,
        });
        break;
    }
  }

  const [primary, ...rest] = rendered;

  const renderNav = (to: string, label: string, cls: string) =>
    inRouter ? (
      <Link to={to} className={cls}>
        {label}
      </Link>
    ) : (
      <a href={to} className={cls}>
        {label}
      </a>
    );

  const renderAction = (a: RenderedAction, isPrimary: boolean) => {
    const label = ACTION_LABELS[a.id];
    const cls = isPrimary ? PRIMARY_BUTTON : LINK_BUTTON;
    if (a.type === 'nav') return renderNav(a.to, label, cls);
    if (a.type === 'mail') {
      return (
        <a href={a.href} className={cls}>
          {label}
        </a>
      );
    }
    const isBusy = a.busy === true;
    return (
      <button type="button" onClick={a.onClick} disabled={isBusy} aria-busy={isBusy} className={cls}>
        {isPrimary && (a.id === 'retry' || a.id === 'check-payment' || a.id === 'check-balance') && (
          <RefreshCw size={15} className={isBusy ? 'animate-spin' : ''} aria-hidden="true" />
        )}
        <span>{isBusy ? 'Checking…' : label}</span>
      </button>
    );
  };

  if (variant === 'compact') {
    return (
      <div
        role={def.severity === 'error' ? 'alert' : 'status'}
        data-error-kind={resolvedKind}
        className={`error-state-enter flex w-full items-center gap-3 rounded-2xl border border-line bg-panel ${size.wrap} ${className}`}
      >
        <ErrorGlyph icon={def.icon} severity={def.severity} size={size.glyph} />
        <div className="min-w-0 flex-1">
          <p className={`font-display font-bold text-cream ${size.title}`}>{title ?? def.title}</p>
          <p className={`mt-0.5 break-words text-cream-dim ${size.text}`}>{message ?? def.message}</p>
        </div>
        {primary && <div className="shrink-0 [&>*]:min-h-9 [&>*]:px-4 [&>*]:text-xs">{renderAction(primary, true)}</div>}
      </div>
    );
  }

  return (
    <div
      role={def.severity === 'error' ? 'alert' : 'status'}
      data-error-kind={resolvedKind}
      className={`error-state-enter mx-auto flex w-full max-w-sm flex-col items-center text-center ${size.wrap} ${className}`}
      style={variant === 'page' ? { paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' } : undefined}
    >
      <ErrorGlyph icon={def.icon} severity={def.severity} size={size.glyph} />

      <h2 className={`mt-4 font-display font-bold tracking-tight text-cream ${size.title}`}>{title ?? def.title}</h2>
      <p className={`mt-1.5 max-w-[22rem] break-words leading-relaxed text-cream-dim ${size.text}`}>
        {message ?? def.message}
      </p>

      {children}

      {primary && (
        <div className="mt-6 flex w-full flex-col items-center gap-2">
          {renderAction(primary, true)}
          {rest.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4">
              {rest.map((a) => (
                <span key={a.id}>{renderAction(a, false)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {def.footnote && (
        <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-cream-dim">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          {def.footnote}
        </p>
      )}
    </div>
  );
}

