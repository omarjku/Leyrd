import { DemoBanner } from "@/components/DemoBanner";
import { AppShell } from "@/components/BottomNav";
import { WardrobeView } from "@/components/WardrobeView";
import { requireOnboardedPage } from "@/lib/page-guards";

export default async function WardrobePage() {
  await requireOnboardedPage();
  return (
    <AppShell title="Wardrobe">
      <DemoBanner />
      <WardrobeView />
    </AppShell>
  );
}
