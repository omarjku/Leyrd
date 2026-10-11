"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CATALOG, type CatalogEntry } from "@/lib/catalog";
import type { CommuteMode, Occasion, Profile, Slot, ThermalType } from "@/lib/types";

type ProfileInput = Omit<Profile, "calibrationOffsetC">;

const DEFAULTS: ProfileInput = {
  city: "Linz",
  lat: 48.3069,
  lon: 14.2858,
  timezone: "Europe/Vienna",
  leaveTime: "08:00",
  returnTime: "18:00",
  commuteMode: "transit",
  outdoorMinutes: 30,
  thermalType: "neutral",
  defaultOccasion: "uni",
};

const COMMUTE: { v: CommuteMode; label: string; hint: string }[] = [
  { v: "walk", label: "Walk", hint: "On foot most of the way" },
  { v: "bike", label: "Bike / scooter", hint: "Wind chill counts: about 2°C colder" },
  { v: "transit", label: "Train / tram / bus", hint: "Short waits outside" },
  { v: "car", label: "Car", hint: "Barely outside" },
];
const THERMAL: { v: ThermalType; label: string; hint: string }[] = [
  { v: "runs_cold", label: "I get cold easily", hint: "We'll dress you about 1.5°C warmer" },
  { v: "neutral", label: "About average", hint: "" },
  { v: "runs_hot", label: "I run hot", hint: "We'll dress you about 1.5°C lighter" },
];
const OCC: { v: Occasion; label: string }[] = [
  { v: "casual", label: "Casual" },
  { v: "uni", label: "University" },
  { v: "work", label: "Work / office" },
  { v: "gym", label: "Gym / sport" },
  { v: "formal", label: "Formal" },
];
const OUTDOOR = [10, 20, 30, 45, 60, 90, 120];
const SLOT_LABEL: Record<Slot, string> = {
  base: "Base layers (next to skin)",
  mid: "Mid layers",
  outer: "Jackets & coats",
  accessory: "Accessories",
};
const STARTER = new Set(["tshirt", "long_sleeve", "hoodie", "sweater", "light_jacket", "mid_jacket", "winter_coat", "scarf", "gloves", "umbrella"]);

interface GeoResult {
  city: string;
  label: string;
  lat: number;
  lon: number;
  timezone: string;
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`card flex flex-col items-start px-4 py-3 text-left ${value === o.v ? "!border-accent ring-2 ring-accent" : ""}`}
        >
          <span className="font-semibold">{o.label}</span>
          {o.hint && <span className="text-sm text-muted">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Questionnaire({ initial, mode }: { initial: ProfileInput | null; mode: "onboarding" | "edit" }) {
  const router = useRouter();
  const [p, setP] = useState<ProfileInput>(initial ?? DEFAULTS);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(STARTER));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [geoMsg, setGeoMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const steps = mode === "onboarding" ? 6 : 5;
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`).catch(() => null);
      const j = r?.ok ? await r.json() : { results: [] };
      setResults(j.results ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoMsg("Location isn't available on this device.");
      return;
    }
    setGeoMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setP((x) => ({
          ...x,
          city: "My location",
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lon: Math.round(pos.coords.longitude * 1000) / 1000,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || x.timezone,
        }));
        setGeoMsg("Using your current location.");
      },
      () => setGeoMsg("Couldn't get your location. Search for your city instead."),
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  const grouped = useMemo(() => {
    const g: Record<Slot, CatalogEntry[]> = { base: [], mid: [], outer: [], accessory: [] };
    for (const c of CATALOG) g[c.slot].push(c);
    return g;
  }, []);

  function toggle(kind: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(kind)) n.delete(kind);
      else n.add(kind);
      return n;
    });
  }

  async function finish() {
    setBusy(true);
    setError("");
    const items =
      mode === "onboarding"
        ? CATALOG.filter((c) => selected.has(c.kind)).map((c) => ({
            name: c.label,
            slot: c.slot,
            kind: c.kind,
            warmth: c.warmth,
            waterproof: c.waterproof,
            windproof: c.windproof,
            occasions: c.occasions,
          }))
        : undefined;
    const r = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: p, items, completeOnboarding: mode === "onboarding" }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setError("Couldn't save. Check your answers and try again.");
      return;
    }
    router.replace(mode === "onboarding" ? "/today" : "/settings?saved=1");
    router.refresh();
  }

  const titles = [
    "Where do you spend your day?",
    "When are you out?",
    "How do you get around?",
    "How do you feel the cold?",
    "What's a typical day?",
    "What's in your wardrobe?",
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: steps }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <p className="text-sm text-muted">
          Step {step + 1} of {steps}
        </p>
        <h2 className="text-2xl font-bold tracking-tight">{titles[step]}</h2>
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <div className="card px-4 py-3">
            <p className="text-sm text-muted">Current</p>
            <p className="font-semibold">{p.city}</p>
            <p className="text-xs text-muted">
              {p.lat.toFixed(2)}, {p.lon.toFixed(2)} · {p.timezone}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={useMyLocation}>
            Use my current location
          </button>
          {geoMsg && <p className="text-sm text-muted">{geoMsg}</p>}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Or search a city
            <input className="input" placeholder="e.g. Ried im Innkreis" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {results.length > 0 && (
            <ul className="card divide-y divide-line">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left"
                    onClick={() => {
                      setP((x) => ({ ...x, city: r.city, lat: r.lat, lon: r.lon, timezone: r.timezone }));
                      setQuery("");
                      setResults([]);
                      setGeoMsg("");
                    }}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              I usually leave at
              <input className="input" type="time" value={p.leaveTime} onChange={(e) => set("leaveTime", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              and get home at
              <input className="input" type="time" value={p.returnTime} onChange={(e) => set("returnTime", e.target.value)} />
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Total time outdoors on a normal day</p>
            <div className="flex flex-wrap gap-2">
              {OUTDOOR.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={p.outdoorMinutes === m} onClick={() => set("outdoorMinutes", m)}>
                  {m >= 120 ? "2h+" : `${m} min`}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Under 20 minutes and we&apos;ll tell you to carry the jacket rather than wear it.</p>
          </div>
        </div>
      )}

      {step === 2 && <Choice options={COMMUTE} value={p.commuteMode} onChange={(v) => set("commuteMode", v)} />}
      {step === 3 && <Choice options={THERMAL} value={p.thermalType} onChange={(v) => set("thermalType", v)} />}
      {step === 4 && (
        <div>
          <p className="mb-2 text-sm text-muted">Sets the dress code we pick from. You can change it each day.</p>
          <Choice options={OCC} value={p.defaultOccasion} onChange={(v) => set("defaultOccasion", v)} />
        </div>
      )}

      {step === 5 && mode === "onboarding" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Tick what you own. You can rename items, add more and mark things as in the wash later.</p>
          {(Object.keys(grouped) as Slot[]).map((slot) => (
            <section key={slot}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{SLOT_LABEL[slot]}</h3>
              <div className="flex flex-wrap gap-2">
                {grouped[slot].map((c) => (
                  <button key={c.kind} type="button" className="chip" aria-pressed={selected.has(c.kind)} onClick={() => toggle(c.kind)}>
                    {c.label}
                    {c.waterproof && c.slot !== "accessory" ? " ☂" : ""}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <p className="text-sm text-muted">{selected.size} items selected</p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-warm">{error}</p>}

      <div className={`${mode === "onboarding" ? "sticky bottom-0" : ""} -mx-4 flex gap-3 bg-bg px-4 pb-4 pt-2`} style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
        {step > 0 && (
          <button type="button" className="btn btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < steps - 1 ? (
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 1 && (!p.leaveTime || !p.returnTime || p.returnTime <= p.leaveTime)}
          >
            Next
          </button>
        ) : (
          <button type="button" className="btn btn-primary flex-1" onClick={finish} disabled={busy || (mode === "onboarding" && selected.size === 0)}>
            {busy ? "Saving…" : mode === "onboarding" ? "See today's layers" : "Save"}
          </button>
        )}
      </div>
      {step === 1 && (!p.leaveTime || !p.returnTime || p.returnTime <= p.leaveTime) && (
        <p className="text-sm text-warm">Set both times; home time should be after leave time.</p>
      )}
    </div>
  );
}
