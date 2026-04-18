import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
    // TODO(prod): forward to analytics
  }

  handleReload = () => {
    try {
      localStorage.removeItem("onboarding_state");
      localStorage.removeItem("flow_state_v1");
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center">
          <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={this.handleReload}
            className="mt-5 w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
