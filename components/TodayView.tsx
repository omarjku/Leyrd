"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Climatology, DayWeather, FeedbackRating, Occasion, OutfitPick, Recommendation } from "@/lib/types";

interface PlanResponse {
  date: string;
  occasion: Occasion;
  weather: DayWeather;
  climatology: Climatology | null;
  recommendation: Recommendation;
  calibrationOffsetC: number;
  city: string;
}

const OCC: { v: Occasion; label: string }[] = [
  { v: "casual", label: "Casual" },
  { v: "uni", label: "Uni" },
  { v: "work", label: "Work" },
  { v: "gym", label: "Gym" },
  { v: "formal", label: "Formal" },
];
const SLOT_LABEL = { base: "Base", mid: "Mid", outer: "Outer", accessory: "Extra" } as const;
const BAND_LABEL: Record<string, string> = {
  hot: "Hot",
  warm: "Warm",
  mild: "Mild",
  cool: "Cool",
  cold: "Cold",
  freezing: "Freezing",
};

function fmtDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}
const r0 = (n: number) => Math.round(n);

function HourlyStrip({ feels, rain, leave, back }: { feels: number[]; rain: number[]; leave: string; back: string }) {
  if (!feels?.length) return null;
  const lo = Math.min(...feels);
  const hi = Math.max(...feels);
  const span = Math.max(1, hi - lo);
  const lh = parseInt(leave, 10);
  const bh = parseInt(back, 10);
  return (
    <div>
      <div className="flex h-16 items-end gap-[2px]" aria-label="Feels-like temperature by hour">
        {feels.map((t, h) => {
          const out = h === lh || h === bh;
          return (
            <div key={h} className="flex flex-1 flex-col items-center justify-end" title={`${h}:00 · feels ${r0(t)}°C · rain ${rain[h] ?? 0}%`}>
              <div
                className={`w-full rounded-sm ${out ? "bg-accent" : "bg-line"}`}
                style={{ height: `${12 + ((t - lo) / span) * 48}px`, opacity: h >= 6 && h <= 22 ? 1 : 0.5 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

function PickRow({
  pick,
  onWash,
  onSwap,
  busy,
}: {
  pick: OutfitPick;
  onWash: (id: string) => void;
  onSwap: (id: string) => void;
  busy: boolean;
}) {
  const it = pick.item;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{SLOT_LABEL[pick.slot]}</span>
      <div className="min-w-0 flex-1">
        {it ? (
          <p className="font-semibold">{it.name}</p>
        ) : (
          <p className="font-semibold text-muted italic">
            {pick.generic} <span className="text-xs not-italic">(not in your wardrobe)</span>
          </p>
        )}
        {pick.note && <p className="text-xs text-muted">{pick.note}</p>}
        {it && (
          <div className="mt-1.5 flex gap-2">
            <button type="button" disabled={busy} className="chip !min-h-8 !px-3 !py-1 text-xs" onClick={() => onWash(it.id)} aria-label={`${it.name} is in the wash`}>
              In the wash
            </button>
            <button type="button" disabled={busy} className="chip !min-h-8 !px-3 !py-1 text-xs" onClick={() => onSwap(it.id)} aria-label={`Swap ${it.name}`}>
              Something else
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function ChatSheet({
  open,
  onClose,
  occasion,
  onPlan,
}: {
  open: boolean;
  onClose: () => void;
  occasion: Occasion;
  onPlan: (p: PlanResponse) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  async function send(e?: React.FormEvent, preset?: string) {
    e?.preventDefault();
    const content = (preset ?? text).trim();
    if (!content || busy) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setText("");
    setBusy(true);
    setNote("");
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: next.slice(-20), occasion }),
    }).catch(() => null);
    setBusy(false);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setNote(j.error ?? "Chat failed. Try again.");
      return;
    }
    setMsgs([...next, { role: "assistant", content: j.reply }]);
    if (j.plan) onPlan(j.plan);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/30" onClick={onClose}>
      <div
        className="mx-auto mt-auto flex h-[80dvh] w-full max-w-md flex-col rounded-t-2xl bg-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chat with Leyrd"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-semibold">Ask Leyrd</p>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {msgs.length === 0 && (
            <div className="space-y-2 text-sm text-muted">
              <p>Tell me what&apos;s changed and I&apos;ll re-plan. For example:</p>
              {["My hoodie is in the wash, what else?", "I have a presentation today, make it smarter", "Do I really need gloves?"].map((s) => (
                <button key={s} type="button" className="chip block text-left" onClick={() => send(undefined, s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-accent text-accent-ink" : "bg-bg"}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="w-16 rounded-2xl bg-bg px-3 py-2 text-sm text-muted">…</div>}
          {note && <p className="text-sm text-warn">{note}</p>}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-line p-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
          <input className="input flex-1" placeholder="e.g. my fleece is drying" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export function TodayView({ chatEnabled, leaveTime, returnTime }: { chatEnabled: boolean; leaveTime: string; returnTime: string }) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [exclude, setExclude] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ rating: FeedbackRating; offset: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async (occ: Occasion | null, ex: string[]) => {
    setBusy(true);
    setError("");
    const r = await fetch("/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(occ ? { occasion: occ } : {}), excludeIds: ex }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setLoading(false);
    if (r?.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!r || !r.ok || !j.recommendation) {
      setError(j.error ?? "Couldn't load today's plan. Check your connection and try again.");
      return;
    }
    setError("");
    setPlan(j);
    setOccasion(j.occasion);
  }, []);

  useEffect(() => {
    load(null, []);
  }, [load]);

  async function markWash(id: string) {
    setBusy(true);
    const r = await fetch(`/api/wardrobe/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "in_wash" }),
    }).catch(() => null);
    if (!r?.ok) {
      setBusy(false);
      setError("Couldn't update that item. Try again.");
      return;
    }
    await load(occasion, exclude);
  }
  async function swap(id: string) {
    const ex = [...exclude, id];
    setExclude(ex);
    await load(occasion, ex);
  }
  async function changeOccasion(o: Occasion) {
    await load(o, exclude);
  }
  async function rate(rating: FeedbackRating) {
    if (!plan) return;
    const itemIds = plan.recommendation.outfit.flatMap((p) => (p.item ? [p.item.id] : []));
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planDate: plan.date, rating, adjustedTempC: plan.recommendation.target.adjustedTempC, itemIds }),
    }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      setFeedback({ rating, offset: j.calibrationOffsetC });
    } else {
      setError("Couldn't save your rating. Try again.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="card h-40 animate-pulse" />
        <div className="card h-56 animate-pulse" />
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="card p-5">
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => load(occasion, exclude)}>
          Try again
        </button>
      </div>
    );
  }

  const rec = plan.recommendation;
  const t = rec.target;
  const w = plan.weather;
  const torso = rec.outfit.filter((p) => p.slot !== "accessory");
  const extras = rec.outfit.filter((p) => p.slot === "accessory");

  return (
    <div className={`space-y-4 ${busy ? "opacity-70" : ""}`}>
      <p className="-mt-2 text-sm text-muted">
        {fmtDate(plan.date)} · {plan.city}
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Occasion">
        {OCC.map((o) => (
          <button key={o.v} type="button" className="chip shrink-0" aria-pressed={occasion === o.v} onClick={() => changeOccasion(o.v)} disabled={busy}>
            {o.label}
          </button>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-muted">{BAND_LABEL[t.band]} · feels like {r0(t.adjustedTempC)}°C for you</p>
            <p className="text-5xl font-bold tracking-tight">
              {rec.layerCount} <span className="text-2xl font-semibold">{rec.layerCount === 1 ? "layer" : "layers"}</span>
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <p>confidence</p>
            <p className="text-lg font-semibold text-ink">{Math.round(t.confidence * 100)}%</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {t.needsWaterproof && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium">Waterproof</span>}
          {t.umbrella && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium">Umbrella</span>}
          {t.carryOuter && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium">Carry the jacket</span>}
          {t.sunProtection && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium">Sun protection</span>}
        </div>
      </section>

      <section className="card px-5 py-2">
        <ul className="divide-y divide-line">
          {torso.map((p, i) => (
            <PickRow key={`${p.slot}-${i}`} pick={p} onWash={markWash} onSwap={swap} busy={busy} />
          ))}
          {extras.map((p, i) => (
            <PickRow key={`x-${i}`} pick={p} onWash={markWash} onSwap={swap} busy={busy} />
          ))}
        </ul>
        {exclude.length > 0 && (
          <button
            type="button"
            className="mb-2 text-sm font-medium text-accent"
            onClick={() => {
              setExclude([]);
              load(occasion, []);
            }}
          >
            Undo {exclude.length} swap{exclude.length > 1 ? "s" : ""}
          </button>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-warn-soft px-5 py-3 text-sm text-warn">
          {error}
        </p>
      )}

      {rec.warnings.length > 0 && (
        <section className="rounded-2xl bg-warn-soft px-5 py-3 text-sm text-warn">
          {rec.warnings.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </section>
      )}

      <section className="card p-5">
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted">Leave {leaveTime}</p>
            <p className="text-xl font-semibold">{r0(w.morning.feelsLikeC)}°</p>
            <p className="text-xs text-muted">actual {r0(w.morning.tempC)}°</p>
          </div>
          <div>
            <p className="text-xs text-muted">Home {returnTime}</p>
            <p className="text-xl font-semibold">{r0(w.evening.feelsLikeC)}°</p>
            <p className="text-xs text-muted">actual {r0(w.evening.tempC)}°</p>
          </div>
          <div>
            <p className="text-xs text-muted">Rain / wind</p>
            <p className="text-xl font-semibold">{r0(w.worst.precipProb)}%</p>
            <p className="text-xs text-muted">{r0(w.worst.windKph)} km/h</p>
          </div>
        </div>
        <HourlyStrip feels={w.hourlyFeelsLikeC} rain={w.hourlyPrecipProb} leave={leaveTime} back={returnTime} />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Why this recommendation</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {t.reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
            {plan.climatology && (
              <li>
                Typical for this week ({plan.climatology.years} yrs): feels like {r0(plan.climatology.medianFeelsLikeC)}°C, cold days{" "}
                {r0(plan.climatology.p10FeelsLikeC)}°C, rain on {Math.round(plan.climatology.wetDayFreq * 100)}% of days
              </li>
            )}
            <li>Your personal adjustment: {plan.calibrationOffsetC > 0 ? "+" : ""}{plan.calibrationOffsetC.toFixed(1)}°C</li>
          </ul>
        </details>
      </section>

      <section className="card p-5">
        <p className="font-semibold">How did it feel?</p>
        <p className="text-sm text-muted">Tap after you&apos;re home. Leyrd adjusts by 0.5°C each time.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["cold", "Too cold", "text-cold"],
              ["right", "Just right", "text-accent"],
              ["warm", "Too warm", "text-warm"],
            ] as const
          ).map(([v, label, cls]) => (
            <button key={v} type="button" className={`btn btn-ghost ${cls} ${feedback?.rating === v ? "!border-current" : ""}`} onClick={() => rate(v)}>
              {label}
            </button>
          ))}
        </div>
        {feedback && (
          <p className="mt-2 text-sm text-muted">
            Saved. Your adjustment is now {feedback.offset > 0 ? "+" : ""}
            {feedback.offset.toFixed(1)}°C.
          </p>
        )}
      </section>

      {rec.outfit.some((p) => !p.item) && (
        <p className="text-center text-sm text-muted">
          Missing something? <Link href="/wardrobe" className="font-semibold text-accent">Add it to your wardrobe</Link>
        </p>
      )}

      {chatEnabled ? (
        <>
          <button
            type="button"
            className="btn btn-primary fixed right-4 z-20 shadow-lg"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
            onClick={() => setChatOpen(true)}
          >
            Ask Leyrd
          </button>
          <ChatSheet
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            occasion={occasion ?? plan.occasion}
            onPlan={(p) => {
              setPlan(p);
              setOccasion(p.occasion);
            }}
          />
        </>
      ) : (
        <p className="text-center text-xs text-muted">AI chat turns on once an Anthropic API key is configured.</p>
      )}
    </div>
  );
}
