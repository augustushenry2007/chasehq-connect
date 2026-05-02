import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { GoogleAuthSheet } from "@/components/auth/GoogleAuthSheet";

export default function AuthScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, hasCompletedOnboarding, authReady } = useApp();

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) return;
    if (hasCompletedOnboarding) navigate("/dashboard", { replace: true });
    else navigate("/onboarding", { replace: true });
  }, [authReady, isAuthenticated, hasCompletedOnboarding, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <GoogleAuthSheet
        open={true}
        onClose={() => navigate("/welcome", { replace: true })}
        variant="sign_in"
        flowEvent="REQUEST_AUTH"
        redirectPath="/"
      />
    </div>
  );
}
