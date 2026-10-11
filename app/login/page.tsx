import { redirect } from "next/navigation";
import { googleEnabled } from "@/auth";
import { currentUserId } from "@/lib/session";
import { LoginForm } from "@/components/AuthForms";
import { LogoMark } from "@/components/LogoMark";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUserId()) redirect("/today");
  const { error } = await searchParams;
  const message = error ? (error === "AccessDenied" ? "Google sign-in was denied or the email is not verified." : "Sign-in failed. Try again.") : undefined;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-center gap-2 text-lg font-bold">
        <LogoMark /> Leyrd
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <LoginForm googleEnabled={googleEnabled} error={message} />
    </main>
  );
}
