import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfile } from "./repo";
import { currentUserId } from "./session";

export async function requireSessionPage() {
  const session = await auth();
  const userId = await currentUserId();
  if (!session?.user || !userId) redirect("/login");
  return session;
}

export async function requireOnboardedPage() {
  const session = await requireSessionPage();
  const profile = await getProfile(session.user.id);
  if (!profile?.onboarded) redirect("/onboarding");
  return { session, profile };
}
