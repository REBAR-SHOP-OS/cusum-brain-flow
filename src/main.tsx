import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

// Boot app
createRoot(document.getElementById("root")!).render(<App />);
