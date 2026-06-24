/**
 * Regression: stale `/sw.js` update errors must not surface to the user.
 * See src/lib/pwa/suppressServiceWorkerErrors.ts
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("ServiceWorker error suppressor", () => {
  type Listener = (event: any) => void;
  const listeners: Record<string, Array<{ fn: Listener; capture: boolean }>> = {};
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    listeners.unhandledrejection = [];
    listeners.error = [];
    (globalThis as any).window = {
      addEventListener: (type: string, fn: Listener, opts?: any) => {
        (listeners[type] ||= []).push({ fn, capture: !!(opts && opts.capture) });
      },
      removeEventListener: () => {},
    };
    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("matches the Chromium SW-redirect message", async () => {
    const { isStaleServiceWorkerError } = await import(
      "../../../src/lib/pwa/suppressServiceWorkerErrors"
    );
    const msg =
      "Failed to update a ServiceWorker for scope ('https://id-preview--x.lovable.app/') " +
      "with script ('https://id-preview--x.lovable.app/sw.js'): " +
      "The script resource is behind a redirect, which is disallowed.";
    expect(isStaleServiceWorkerError(msg)).toBe(true);
  });

  it("does NOT match unrelated rejections", async () => {
    const { isStaleServiceWorkerError } = await import(
      "../../../src/lib/pwa/suppressServiceWorkerErrors"
    );
    expect(isStaleServiceWorkerError("Network request failed")).toBe(false);
    expect(isStaleServiceWorkerError("Cannot read properties of undefined")).toBe(false);
    expect(isStaleServiceWorkerError("")).toBe(false);
  });

  it("registers capture-phase listeners on window for both error types", async () => {
    const mod = await import("../../../src/lib/pwa/suppressServiceWorkerErrors");
    mod.installServiceWorkerErrorSuppressor();

    expect(listeners.unhandledrejection).toHaveLength(1);
    expect(listeners.unhandledrejection[0].capture).toBe(true);
    expect(listeners.error).toHaveLength(1);
    expect(listeners.error[0].capture).toBe(true);
  });

  it("prevents default + stops propagation on matching SW rejection", async () => {
    const mod = await import("../../../src/lib/pwa/suppressServiceWorkerErrors");
    mod.installServiceWorkerErrorSuppressor();

    const ev = {
      reason: new TypeError(
        "Failed to update a ServiceWorker for scope ('/'): " +
          "The script resource is behind a redirect, which is disallowed.",
      ),
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    listeners.unhandledrejection[0].fn(ev);
    expect(ev.preventDefault).toHaveBeenCalledTimes(1);
    expect(ev.stopImmediatePropagation).toHaveBeenCalledTimes(1);
  });

  it("leaves unrelated rejections alone", async () => {
    const mod = await import("../../../src/lib/pwa/suppressServiceWorkerErrors");
    mod.installServiceWorkerErrorSuppressor();

    const ev = {
      reason: new Error("totally unrelated"),
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    listeners.unhandledrejection[0].fn(ev);
    expect(ev.preventDefault).not.toHaveBeenCalled();
    expect(ev.stopImmediatePropagation).not.toHaveBeenCalled();
  });
});
