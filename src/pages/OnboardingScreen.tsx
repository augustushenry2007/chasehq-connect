import { Navigate } from "react-router-dom";

// Onboarding has been replaced by the /quickstart flow.
// This redirect preserves any old links / bookmarks.
export default function OnboardingScreen() {
  return <Navigate to="/quickstart/welcome" replace />;
}
