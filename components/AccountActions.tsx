"use client";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function AccountActions() {
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm("Delete your account, wardrobe and feedback permanently?")) return;
    setBusy(true);
    const r = await fetch("/api/account", { method: "DELETE" });
    if (r.ok) await signOut({ redirectTo: "/" });
    setBusy(false);
  }
  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="btn btn-ghost" onClick={() => signOut({ redirectTo: "/" })}>
        Sign out
      </button>
      <button type="button" className="btn btn-ghost text-warm" onClick={del} disabled={busy}>
        Delete account and data
      </button>
    </div>
  );
}
