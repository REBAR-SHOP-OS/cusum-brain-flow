import { registerSW } from "virtual:pwa-register";

const SW_URL = "/sw.js";

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
    const regs = await navigator.serviceWorker.getRegistrations();
    const originScope = typeof window !== "undefined" ? `${window.location.origin}/` : "";
    await Promise.all(
      regs
        .filter((r) => {
          const url =
            r.active?.scriptURL ||
            r.installing?.scriptURL ||
            r.waiting?.scriptURL ||
            "";
          // Match by script path (any worker named sw.js) OR by scope on this origin.
          let scriptPath = "";
          try {
            scriptPath = url ? new URL(url).pathname : "";
          } catch {
            scriptPath = "";
          }
          if (scriptPath === SW_URL) return true;
          if (url.endsWith(SW_URL)) return true;
          if (originScope && r.scope === originScope) return true;
          return false;
        })
        .map((r) => r.unregister().catch(() => false)),
    );
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
}
