import { useApp } from "@/context/AppContext";
import { useFlow } from "@/flow/FlowMachine";
import { supabase } from "@/integrations/supabase/client";
import { EducationCarousel } from "@/components/onboarding/EducationCarousel";

async function markTourCompleted(userId: string) {
  await supabase.from("profiles").update({ tour_completed: true }).eq("user_id", userId);
}

export default function FeatureTourScreen() {
  const { user } = useApp();
  const { send } = useFlow();

  async function handleDone() {
    if (user) await markTourCompleted(user.id);
    send("TOUR_DONE");
  }

  async function handleSkip() {
    if (user) await markTourCompleted(user.id);
    send("TOUR_SKIP");
  }

  return (
    <div className="h-screen bg-background flex flex-col pt-[env(safe-area-inset-top,0px)]">
      <EducationCarousel onDone={handleDone} onSkip={handleSkip} />
    </div>
  );
}
