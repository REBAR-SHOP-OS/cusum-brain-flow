import { registerSW } from "virtual:pwa-register";

const SW_URL = "/sw.js";
const SW_CLEANUP_RELOAD_KEY = "app_sw_cleanup_reloaded_once";
const SW_CLEANUP_WATCHDOG_MS = 60 * 1000;

let cleanupWatchdogId: number | undefined;

function isPreviewOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.startsWith("id-preview--") || host.startsWith("preview--");
}

function getRegistrationScriptUrl(registration: ServiceWorkerRegistration): string {
  return (
    registration.active?.scriptURL ||
    registration.installing?.scriptURL ||
    registration.waiting?.scriptURL ||
    ""
  );
}

function matchesAppServiceWorker(registration: ServiceWorkerRegistration): boolean {
  const url = getRegistrationScriptUrl(registration);
  const originScope = typeof window !== "undefined" ? `${window.location.origin}/` : "";
  let scriptPath = "";
  try {
    scriptPath = url ? new URL(url).pathname : "";
  } catch {
    scriptPath = "";
  }

  if (scriptPath === SW_URL) return true;
  if (url.endsWith(SW_URL)) return true;
  if (originScope && registration.scope === originScope) return true;
  return false;
}

function reloadOnceToReleasePreviewController(): void {
  if (!isPreviewOrigin()) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!navigator.serviceWorker.controller) return;
  try {
    if (sessionStorage.getItem(SW_CLEANUP_RELOAD_KEY) === "1") return;
    sessionStorage.setItem(SW_CLEANUP_RELOAD_KEY, "1");
  } catch {
    return;
  }

  console.info("[sw-cleanup] reloaded to release controller");
  window.location.reload();
}

async function unregisterMatchingAppSWs(): Promise<boolean> {
  const regs = await navigator.serviceWorker.getRegistrations();
  const matches = regs.filter(matchesAppServiceWorker);
  await Promise.all(matches.map((r) => r.unregister().catch(() => false)));
  return matches.length > 0;
}

export function startStaleServiceWorkerWatchdog(): void {
  if (cleanupWatchdogId !== undefined) return;
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  cleanupWatchdogId = window.setInterval(() => {
    void unregisterMatchingAppSWs().catch(() => undefined);
  }, SW_CLEANUP_WATCHDOG_MS);
}

export function shouldRefuseRegistration(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.top !== window.self) return true;
  } catch {
    // Cross-origin access to window.top throws → we're in an iframe
    return true;
  }

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  if (new URLSearchParams(window.location.search).has("sw") &&
      new URLSearchParams(window.location.search).get("sw") === "off") {
    return true;
  }

  return false;
}

export async function unregisterStaleAppSW(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" });
  } catch {
    // best-effort
  }

  let removedAnyRegistration = false;
  try {
    removedAnyRegistration = await unregisterMatchingAppSWs();
  } catch {
    // best-effort
  }
  // Drop any app-shell caches the old worker created.
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    // best-effort
  }

  if (removedAnyRegistration) {
    startStaleServiceWorkerWatchdog();
    reloadOnceToReleasePreviewController();
  }
}
