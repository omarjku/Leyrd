import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfile } from "./repo";

export async function requireSessionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireOnboardedPage() {
  const session = await requireSessionPage();
  const profile = await getProfile(session.user.id);
  if (!profile?.onboarded) redirect("/onboarding");
  return { session, profile };
}
