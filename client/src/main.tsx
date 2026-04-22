import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// =============================================================================
// CAPACITOR DETECTION
// When running inside a Capacitor native WebView (iOS / Android), the page is
// served from capacitor://localhost/ — there is no local Express server.
// All API calls must be routed to the live production server instead.
// =============================================================================
const isCapacitor =
  window.location.protocol === "capacitor:" ||
  !!(window as unknown as Record<string, unknown>)["Capacitor"];

// The production API base URL. Used by native builds to reach the backend.
// Falls back to relative path for web (dev + production web).
const PRODUCTION_API_BASE = "https://hilcotflow.com";

function getApiBase(): string {
  if (isCapacitor) return PRODUCTION_API_BASE;
  return ""; // relative path works in web context
}

// =============================================================================
// FULL ERROR INSTRUMENTATION
// Capture ALL uncaught errors and unhandled promise rejections before React
// mounts. This surfaces the real error in Xcode console instead of [error] - {}
// =============================================================================
function serializeError(err: unknown): string {
  if (err instanceof Error) {
    return JSON.stringify({
      type: err.constructor?.name ?? "Error",
      message: err.message,
      stack: err.stack,
      cause: err.cause ? String(err.cause) : undefined,
    }, null, 2);
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

window.onerror = function (message, source, lineno, colno, error) {
  console.error("[HILCOT STARTUP ERROR] window.onerror:", JSON.stringify({
    message,
    source,
    lineno,
    colno,
    error: error ? serializeError(error) : null,
  }));
  return false; // don't suppress default handling
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("[HILCOT STARTUP ERROR] unhandledrejection:", JSON.stringify({
    reason: serializeError(event.reason),
    promise: String(event.promise),
  }));
});

// Log Capacitor context at startup for diagnostics
console.info("[HILCOT] Startup context:", JSON.stringify({
  isCapacitor,
  protocol: window.location.protocol,
  href: window.location.href,
  hasCapacitorGlobal: !!(window as unknown as Record<string, unknown>)["Capacitor"],
  apiBase: getApiBase() || "(relative)",
  userAgent: navigator.userAgent.substring(0, 100),
}));

// =============================================================================
// QUERY CLIENT
// =============================================================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: isCapacitor ? 1 : 3,
      retryDelay: 1000,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", serializeError(error));
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", serializeError(error));
  }
});

// =============================================================================
// tRPC CLIENT
// In Capacitor: use absolute URL to production server
// In web: use relative path (works in both dev and production web)
// =============================================================================
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getApiBase()}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

// =============================================================================
// ANALYTICS — web browser only, never in Capacitor native builds
// =============================================================================
(function injectAnalytics() {
  if (isCapacitor) return; // Never run analytics in native builds

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "";
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID ?? "";
  const isValidEndpoint =
    endpoint.startsWith("http://") || endpoint.startsWith("https://");

  if (!isValidEndpoint || !websiteId) return;

  try {
    const script = document.createElement("script");
    script.defer = true;
    script.src = `${endpoint}/umami`;
    script.setAttribute("data-website-id", websiteId);
    document.head.appendChild(script);
  } catch (err) {
    console.warn("[Analytics] Failed to inject analytics script:", err);
  }
})();

// =============================================================================
// REACT MOUNT
// =============================================================================
try {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("Root element #root not found in DOM");
  }

  createRoot(rootEl).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );

  console.info("[HILCOT] React mounted successfully");
} catch (err) {
  console.error("[HILCOT FATAL] React mount failed:", serializeError(err));
  // Show a minimal fallback UI without depending on React
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <h2 style="margin-bottom:16px;">Hilcot TaskFlow</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">Failed to start. Please check your connection and try again.</p>
        <pre style="background:#1e293b;padding:16px;border-radius:8px;font-size:12px;color:#f87171;max-width:600px;overflow:auto;white-space:pre-wrap;">${serializeError(err)}</pre>
        <button onclick="window.location.reload()" style="margin-top:24px;padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
          Reload
        </button>
      </div>
    `;
  }
}
