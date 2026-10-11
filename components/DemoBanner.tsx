import { isDemoDb } from "@/lib/db";

export function DemoBanner() {
  if (!isDemoDb()) return null;
  return (
    <p className="mb-4 rounded-xl bg-warn-soft px-4 py-2 text-xs text-warn">
      Demo mode: no database is connected yet, so accounts and wardrobes reset when the server restarts.
    </p>
  );
}
