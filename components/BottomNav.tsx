"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today", icon: "M12 3v2m0 14v2m9-9h-2M5 12H3m14.95-6.95-1.41 1.41M6.46 17.54l-1.41 1.41m0-13.9 1.41 1.41m11.08 11.08 1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
  { href: "/wardrobe", label: "Wardrobe", icon: "M12 4a2 2 0 0 0-2 2c0 .8.5 1.3 1.2 1.7L12 8.2 3.6 15a1.2 1.2 0 0 0 .8 2.1h15.2a1.2 1.2 0 0 0 .8-2.1L12 8.2" },
  { href: "/settings", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active ? "text-accent font-semibold" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-28" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {action}
      </header>
      {children}
      <BottomNav />
    </div>
  );
}
