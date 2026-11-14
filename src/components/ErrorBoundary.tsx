import { Component, ReactNode, ErrorInfo } from 'react';
import { hardRefreshPwa, triggerStaleChunkRecovery } from '../lib/swRegister';
import ErrorState from './errors/ErrorState';
import { classifyError } from '../lib/errors/classifyError';
import { reportError } from '../lib/errors/errorReporter';
import type { ErrorKind } from '../lib/errors/errorCatalog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Developer diagnostics: full detail, redacted. Never shown to users.
    reportError(error, {
      source: 'react.ErrorBoundary',
      extra: { componentStack: errorInfo?.componentStack },
    });

    const msg = String(error?.message || error || '');
    if (
      msg.includes('_result.default') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Stale chunk')
    ) {
      triggerStaleChunkRecovery();
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    void hardRefreshPwa();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Only the *kind* is derived from the error; its text is never displayed.
      const kind: ErrorKind = classifyError(this.state.error);

      return (
        <div className="min-h-dvh w-full flex items-center justify-center bg-ink">
          <ErrorState
            kind={kind === 'validation' ? 'unknown' : kind}
            variant="page"
            onRetry={this.handleReset}
            // Reloading the app shell is idempotent: it cannot repeat a payment or message.
            allowRetry
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
