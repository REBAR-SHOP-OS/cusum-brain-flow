/**
 * Regression: stale `/sw.js` update errors must not surface to the user.
 * See src/lib/pwa/suppressServiceWorkerErrors.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  installServiceWorkerErrorSuppressor,
  isStaleServiceWorkerError,
} from "@/lib/pwa/suppressServiceWorkerErrors";

describe("ServiceWorker error suppressor", () => {
  beforeEach(() => {
    // installer is idempotent module-level; calling again is a no-op
    installServiceWorkerErrorSuppressor();
  });

  it("matches the Chromium SW-redirect message", () => {
    const msg =
      "Failed to update a ServiceWorker for scope ('https://id-preview--x.lovable.app/') " +
      "with script ('https://id-preview--x.lovable.app/sw.js'): " +
      "The script resource is behind a redirect, which is disallowed.";
    expect(isStaleServiceWorkerError(msg)).toBe(true);
  });

  it("does NOT match unrelated rejections", () => {
    expect(isStaleServiceWorkerError("Network request failed")).toBe(false);
    expect(isStaleServiceWorkerError("TypeError: cannot read x")).toBe(false);
    expect(isStaleServiceWorkerError("")).toBe(false);
  });

  it("prevents default + stops propagation on a matching unhandledrejection", () => {
    const reason = new TypeError(
      "Failed to update a ServiceWorker for scope ('/'): " +
        "The script resource is behind a redirect, which is disallowed.",
    );

    const downstream = vi.fn();
    window.addEventListener("unhandledrejection", downstream);

    // Build a PromiseRejectionEvent-compatible payload (jsdom supports it via Event)
    const ev: any = new Event("unhandledrejection", { cancelable: true });
    ev.reason = reason;
    ev.promise = Promise.reject(reason);
    // Swallow the underlying rejection so vitest doesn't flag it
    ev.promise.catch(() => {});

    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(downstream).not.toHaveBeenCalled();

    window.removeEventListener("unhandledrejection", downstream);
  });

  it("ignores unrelated unhandledrejection events", () => {
    const downstream = vi.fn();
    window.addEventListener("unhandledrejection", downstream);

    const ev: any = new Event("unhandledrejection", { cancelable: true });
    ev.reason = new Error("totally unrelated");
    ev.promise = Promise.reject(ev.reason);
    ev.promise.catch(() => {});

    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(downstream).toHaveBeenCalledTimes(1);

    window.removeEventListener("unhandledrejection", downstream);
  });
});
