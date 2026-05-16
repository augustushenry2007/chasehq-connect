import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Code-splitting boundary doubles as the security gate: the web bundle contains
// landing + legal pages + react-router, but physically excludes auth, Supabase,
// and OAuth code. Vite tree-shakes anything not reachable from the entry — so an
// attacker opening DevTools on chasehq.app sees marketing/legal chunk JS only,
// not the Supabase anon key or the app surface.
if (Capacitor.isNativePlatform()) {
  import("./AppNative").then(({ default: AppNative }) => {
    root.render(<AppNative />);
  });
} else {
  import("./WebApp").then(({ default: WebApp }) => {
    root.render(<WebApp />);
  });
}
