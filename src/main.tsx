import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Code-splitting boundary doubles as the security gate: the web bundle physically
// does not contain auth, Supabase, OAuth, or routing code. Vite tree-shakes anything
// not reachable from the entry — so an attacker opening DevTools on chasehq.app sees
// only landing chunk JS, not the Supabase anon key or the app surface.
if (Capacitor.isNativePlatform()) {
  import("./AppNative").then(({ default: AppNative }) => {
    root.render(<AppNative />);
  });
} else {
  import("./pages/LandingPage").then(({ default: LandingPage }) => {
    root.render(<LandingPage />);
  });
}
