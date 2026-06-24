import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/pwa/registerServiceWorker";
import { installServiceWorkerErrorSuppressor } from "@/lib/pwa/suppressServiceWorkerErrors";

// Suppress stale `/sw.js` update errors as early as possible (before React mounts
// and before any preview overlay listeners attach). See suppressServiceWorkerErrors.ts
installServiceWorkerErrorSuppressor();

registerServiceWorker();

// Boot app
createRoot(document.getElementById("root")!).render(<App />);
