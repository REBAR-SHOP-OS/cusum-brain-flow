/**
 * Early, capture-phase suppressor for stale ServiceWorker update/registration
 * errors that originate from a legacy `/sw.js` registration the current app
 * no longer owns.
 *
 * Root cause: Lovable preview origins 302-redirect `/sw.js` to an auth-bridge
 * URL. Browsers that still have the old registration keep trying to update it
 * in the background, and the SW spec disallows redirects on the script
 * resource → `TypeError: Failed to update a ServiceWorker ... The script
 * resource is behind a redirect, which is disallowed.`
 *
 * We install this BEFORE React mounts so the rejection is marked
 * `defaultPrevented` and propagation is stopped before the Lovable preview
 * overlay listener (or our own React-mounted handler) can render a toast.
 *
 * Filter is intentionally narrow — only matches SW-redirect/registration
 * strings — so unrelated rejections are untouched.
 */

const SW_ERROR_PATTERNS = [
  "Failed to update a ServiceWorker",
  "Failed to register a ServiceWorker",
  "script resource is behind a redirect",
  "ServiceWorker script",
  "with script ('",
  "/sw.js",
];

function messageOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === "object" && "message" in (value as Record<string, unknown>)) {
    const m = (value as { message?: unknown }).message;
    return typeof m === "string" ? m : "";
  }
  try {
    return String(value);
  } catch {
    return "";
  }
}

export function isStaleServiceWorkerError(message: string): boolean {
  if (!message) return false;
  return SW_ERROR_PATTERNS.some((p) => message.includes(p));
}

let installed = false;

export function installServiceWorkerErrorSuppressor(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const onRejection = (event: PromiseRejectionEvent) => {
    const msg = messageOf(event.reason);
    if (isStaleServiceWorkerError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const onError = (event: ErrorEvent) => {
    const msg = event.message || messageOf(event.error);
    if (isStaleServiceWorkerError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  window.addEventListener("unhandledrejection", onRejection, { capture: true });
  window.addEventListener("error", onError, { capture: true });
}
