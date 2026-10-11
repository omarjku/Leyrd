"use client";
import { useEffect, useState } from "react";
import { CATALOG, CATALOG_BY_KIND } from "@/lib/catalog";
import type { ItemStatus, Slot, WardrobeItem } from "@/lib/types";

const SLOT_LABEL: Record<Slot, string> = { base: "Base layers", mid: "Mid layers", outer: "Jackets & coats", accessory: "Accessories" };
const STATUS: { v: ItemStatus; label: string }[] = [
  { v: "clean", label: "Clean" },
  { v: "in_wash", label: "In wash" },
  { v: "drying", label: "Drying" },
  { v: "unavailable", label: "Away" },
];
const STATUS_STYLE: Record<ItemStatus, string> = {
  clean: "bg-accent-soft text-accent",
  in_wash: "bg-warn-soft text-warn",
  drying: "bg-warn-soft text-warn",
  unavailable: "bg-line text-muted",
};

function until(iso: string | null) {
  if (!iso) return "";
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
  return h < 1 ? "back soon" : h < 48 ? `back in ~${h}h` : `back in ~${Math.round(h / 24)}d`;
}

export function WardrobeView() {
  const [items, setItems] = useState<WardrobeItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState(CATALOG[0].kind);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const r = await fetch("/api/wardrobe");
    if (r.ok) setItems((await r.json()).items);
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/wardrobe/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      const { item } = await r.json();
      setItems((xs) => xs?.map((x) => (x.id === id ? item : x)) ?? null);
    }
  }
  async function remove(id: string) {
    if (!confirm("Remove this item?")) return;
    const r = await fetch(`/api/wardrobe/${id}`, { method: "DELETE" });
    if (r.ok) setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const c = CATALOG_BY_KIND[kind];
    const r = await fetch("/api/wardrobe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ name: name.trim() || c.label, slot: c.slot, kind: c.kind, warmth: c.warmth, waterproof: c.waterproof, windproof: c.windproof, occasions: c.occasions }],
      }),
    });
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? "Couldn't add item");
      return;
    }
    setItems((await r.json()).items);
    setName("");
    setAdding(false);
  }

  if (!items) return <div className="card h-64 animate-pulse" aria-busy="true" />;

  const bySlot = (["base", "mid", "outer", "accessory"] as Slot[]).map((s) => [s, items.filter((i) => i.slot === s)] as const);
  const away = items.filter((i) => i.status !== "clean").length;

  return (
    <div className="space-y-5">
      <p className="-mt-2 text-sm text-muted">
        {items.length} items{away ? ` · ${away} not available right now` : ""}
      </p>

      {adding ? (
        <form onSubmit={add} className="card space-y-3 p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Type
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {(["base", "mid", "outer", "accessory"] as Slot[]).map((s) => (
                <optgroup key={s} label={SLOT_LABEL[s]}>
                  {CATALOG.filter((c) => c.slot === s).map((c) => (
                    <option key={c.kind} value={c.kind}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name <span className="font-normal text-muted">(optional, e.g. &quot;Black Timberland jacket&quot;)</span>
            <input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p className="text-sm text-warm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn btn-primary flex-1">Add</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-primary w-full" onClick={() => setAdding(true)}>
          Add an item
        </button>
      )}

      {bySlot.map(([slot, list]) =>
        list.length === 0 ? null : (
          <section key={slot}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{SLOT_LABEL[slot]}</h2>
            <ul className="card divide-y divide-line">
              {list.map((it) => (
                <li key={it.id} className="px-4 py-3">
                  <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{it.name}</p>
                      <p className="text-xs text-muted">
                        warmth {it.warmth}
                        {it.waterproof ? " · waterproof" : ""}
                        {it.status !== "clean" && it.statusUntil ? ` · ${until(it.statusUntil)}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[it.status]}`}>
                      {STATUS.find((s) => s.v === it.status)?.label}
                    </span>
                  </button>
                  {open === it.id && (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
                        {STATUS.map((s) => (
                          <button key={s.v} type="button" className="chip" aria-pressed={it.status === s.v} onClick={() => patch(it.id, { status: s.v })}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={it.waterproof} onChange={(e) => patch(it.id, { waterproof: e.target.checked })} />
                          Waterproof
                        </label>
                        <label className="flex items-center gap-2">
                          Warmth
                          <select
                            className="rounded-lg border border-line bg-card px-2 py-1"
                            value={it.warmth}
                            onChange={(e) => patch(it.id, { warmth: Number(e.target.value) })}
                          >
                            {(it.slot === "accessory" ? [0, 0.5, 1] : it.slot === "base" ? [0, 0.5, 1, 1.5, 2] : [0, 0.5, 1, 1.5, 2, 2.5, 3]).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="ml-auto text-warm" onClick={() => remove(it.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
      <p className="text-xs text-muted">Items in the wash come back automatically after ~10 hours (drying 12h, away 7 days).</p>
    </div>
  );
}
