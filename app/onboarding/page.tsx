import { Questionnaire } from "@/components/Questionnaire";
import { requireSessionPage } from "@/lib/page-guards";
import { getProfile } from "@/lib/repo";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await requireSessionPage();
  const profile = await getProfile(session.user.id);
  if (profile?.onboarded) redirect("/today");
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4" style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}>
      <p className="mb-4 text-sm text-muted">Hi{session.user.name ? ` ${session.user.name.split(" ")[0]}` : ""}! Six quick questions.</p>
      <Questionnaire initial={null} mode="onboarding" />
    </main>
  );
}
