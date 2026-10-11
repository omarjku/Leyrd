import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoMark } from "@/components/LogoMark";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect("/today");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-10">
      <div className="flex items-center gap-2 text-lg font-bold">
        <LogoMark /> Leyrd
      </div>
      <section>
        <h1 className="text-4xl font-bold leading-tight tracking-tight">How many layers today?</h1>
        <p className="mt-4 text-lg text-muted">
          Leyrd reads the forecast and local climate history for your commute, then picks layers from your own
          wardrobe, skipping what&apos;s in the wash. Tell it when you were cold or warm and it learns.
        </p>
      </section>
      <div className="flex flex-col gap-3">
        <Link href="/signup" className="btn btn-primary w-full">
          Create account
        </Link>
        <Link href="/login" className="btn btn-ghost w-full">
          Sign in
        </Link>
      </div>
    </main>
  );
}
