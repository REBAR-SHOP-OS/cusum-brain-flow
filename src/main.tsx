import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import {
  shouldRefuseRegistration,
  unregisterStaleAppSW,
} from "@/lib/pwa/registerServiceWorker";
import { installServiceWorkerErrorSuppressor } from "@/lib/pwa/suppressServiceWorkerErrors";

// Suppress stale `/sw.js` update errors as early as possible (before React mounts
// and before any preview overlay listeners attach). See suppressServiceWorkerErrors.ts
installServiceWorkerErrorSuppressor();

if (shouldRefuseRegistration()) {
  void unregisterStaleAppSW();
} else {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateServiceWorker(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
    },
  });
}

// Boot app
createRoot(document.getElementById("root")!).render(<App />);
