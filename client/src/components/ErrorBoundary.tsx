import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Full error logging — visible in Xcode console and browser devtools
    console.error("[HILCOT ErrorBoundary] React render error caught:", JSON.stringify({
      type: error.constructor?.name ?? "Error",
      message: error.message,
      stack: error.stack,
      cause: error.cause ? String(error.cause) : undefined,
      componentStack: errorInfo.componentStack,
    }, null, 2));
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isCapacitor =
        window.location.protocol === "capacitor:" ||
        !!(window as unknown as Record<string, unknown>)["Capacitor"];

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle size={48} className="text-destructive mb-6 flex-shrink-0" />
            <h2 className="text-xl mb-2 font-semibold">An unexpected error occurred.</h2>
            {isCapacitor && (
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Running in native app context. Check Xcode console for full error details.
              </p>
            )}
            <div className="p-4 w-full rounded bg-muted overflow-auto mb-2 max-h-48">
              <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
                {error?.message ?? "Unknown error"}
              </pre>
            </div>
            {error?.stack && (
              <details className="w-full mb-4">
                <summary className="text-xs text-muted-foreground cursor-pointer mb-1">Stack trace</summary>
                <div className="p-3 rounded bg-muted overflow-auto max-h-48">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{error.stack}</pre>
                </div>
              </details>
            )}
            {errorInfo?.componentStack && (
              <details className="w-full mb-6">
                <summary className="text-xs text-muted-foreground cursor-pointer mb-1">Component stack</summary>
                <div className="p-3 rounded bg-muted overflow-auto max-h-32">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{errorInfo.componentStack}</pre>
                </div>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
