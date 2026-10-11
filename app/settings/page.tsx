import { AppShell } from "@/components/BottomNav";
import { AccountActions } from "@/components/AccountActions";
import { Questionnaire } from "@/components/Questionnaire";
import { requireOnboardedPage } from "@/lib/page-guards";
import { recentFeedback } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { session, profile } = await requireOnboardedPage();
  const { saved } = await searchParams;
  const history = await recentFeedback(session.user.id, 7);
  const { onboarded: _o, calibrationOffsetC, ...editable } = profile;
  return (
    <AppShell title="Profile">
      <div className="space-y-6">
        <section className="card p-5">
          <p className="font-semibold">{session.user.name ?? "You"}</p>
          <p className="text-sm text-muted">{session.user.email}</p>
          <p className="mt-3 text-sm">
            Personal adjustment: <strong>{calibrationOffsetC > 0 ? "+" : ""}{calibrationOffsetC.toFixed(1)}°C</strong>
            <span className="text-muted"> (from {history.length} recent ratings)</span>
          </p>
          {history.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Last: {history.map((h) => (h.rating === "cold" ? "🥶" : h.rating === "warm" ? "🥵" : "👌")).join(" ")}
            </p>
          )}
        </section>
        {saved && <p className="rounded-xl bg-accent-soft px-4 py-2 text-sm text-accent">Saved.</p>}
        <section>
          <h2 className="mb-3 text-lg font-bold">Your answers</h2>
          <Questionnaire initial={editable} mode="edit" />
        </section>
        <AccountActions />
      </div>
    </AppShell>
  );
}
