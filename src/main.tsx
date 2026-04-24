import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";

if (!import.meta.env.DEV) {
  posthog.init("phc_wJX7KNbpWUKXJqhFqEfbyL1K6jrJXXbrbhUseThquMey", {
    api_host: "https://us.i.posthog.com",
  });
}

createRoot(document.getElementById("root")!).render(<App />);
