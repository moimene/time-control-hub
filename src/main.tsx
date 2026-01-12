import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Ensure the service worker updates promptly so production users don't stay on stale bundles.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Proactively check for updates soon after load.
    setTimeout(() => {
      registration?.update().catch(() => undefined);
    }, 5_000);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
