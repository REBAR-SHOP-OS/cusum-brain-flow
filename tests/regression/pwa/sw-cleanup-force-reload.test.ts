// @vitest-environment node
/**
 * Regression: preview must fully release a stale `/sw.js` controller after
 * unregistering it, otherwise Chromium keeps retrying background SW updates
 * and the toast returns every few minutes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("virtual:pwa-register", () => ({
  registerSW: vi.fn(),
}));

describe("stale ServiceWorker cleanup", () => {
  const originalWindow = (globalThis as any).window;
  const originalNavigator = (globalThis as any).navigator;
  const originalSessionStorage = (globalThis as any).sessionStorage;

  const installBrowserMocks = ({
    hasController = true,
    storageHasReloadFlag = false,
  }: { hasController?: boolean; storageHasReloadFlag?: boolean } = {}) => {
    const storage = new Map<string, string>();
    if (storageHasReloadFlag) storage.set("app_sw_cleanup_reloaded_once", "1");

    const reload = vi.fn();
    const setIntervalSpy = vi.fn(() => 101);
    const unregister = vi.fn(async () => true);
    const postMessage = vi.fn();

    const registration = {
      scope: "https://id-preview--unit-test.lovable.app/",
      active: { scriptURL: "https://id-preview--unit-test.lovable.app/sw.js" },
      installing: null,
      waiting: null,
      unregister,
    };

    const sessionStorage = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    };

    const windowMock = {
      location: {
        hostname: "id-preview--unit-test.lovable.app",
        origin: "https://id-preview--unit-test.lovable.app",
        reload,
      },
      setInterval: setIntervalSpy,
      top: null,
      self: null,
    };
    windowMock.top = windowMock;
    windowMock.self = windowMock;

    Object.defineProperty(globalThis, "window", { value: windowMock, configurable: true });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: sessionStorage,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: {
        serviceWorker: {
          controller: hasController ? { postMessage } : null,
          getRegistrations: vi.fn(async () => [registration]),
        },
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "caches", {
      value: {
        keys: vi.fn(async () => ["workbox-precache-v2-https://id-preview--unit-test.lovable.app/"]),
        delete: vi.fn(async () => true),
      },
      configurable: true,
    });

    return { reload, unregister, postMessage, sessionStorage, setIntervalSpy };
  };

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: originalSessionStorage,
      configurable: true,
    });
    Reflect.deleteProperty(globalThis, "caches");
  });

  it("unregisters /sw.js and reloads preview once to release the active controller", async () => {
    const mocks = installBrowserMocks({ hasController: true });
    const { unregisterStaleAppSW } = await import("../../../src/lib/pwa/registerServiceWorker");

    await unregisterStaleAppSW();

    expect(mocks.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(mocks.sessionStorage.setItem).toHaveBeenCalledWith(
      "app_sw_cleanup_reloaded_once",
      "1",
    );
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    expect(mocks.setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("does not reload again after the one-shot cleanup flag is set", async () => {
    const mocks = installBrowserMocks({ hasController: true, storageHasReloadFlag: true });
    const { unregisterStaleAppSW } = await import("../../../src/lib/pwa/registerServiceWorker");

    await unregisterStaleAppSW();

    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});
