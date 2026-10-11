import { TodayView } from "@/components/TodayView";
import { AppShell } from "@/components/BottomNav";
import { chatEnabled } from "@/lib/chat";
import { requireOnboardedPage } from "@/lib/page-guards";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { profile } = await requireOnboardedPage();
  return (
    <AppShell title="Today">
      <TodayView chatEnabled={chatEnabled()} leaveTime={profile.leaveTime} returnTime={profile.returnTime} />
    </AppShell>
  );
}
