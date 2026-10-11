import { redirect } from "next/navigation";
import { googleEnabled } from "@/auth";
import { currentUserId } from "@/lib/session";
import { SignupForm } from "@/components/AuthForms";
import { LogoMark } from "@/components/LogoMark";

export default async function Page() {
  if (await currentUserId()) redirect("/today");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-center gap-2 text-lg font-bold">
        <LogoMark /> Leyrd
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <SignupForm googleEnabled={googleEnabled} />
    </main>
  );
}
