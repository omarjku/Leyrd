import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";

// Proxies Open-Meteo geocoding so the client never calls third parties directly.
export async function GET(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return NextResponse.json({ results: [] });
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&format=json&name=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as {
      results?: { name: string; latitude: number; longitude: number; timezone: string; country?: string; admin1?: string }[];
    };
    return NextResponse.json({
      results: (j.results ?? []).map((x) => ({
        city: x.name,
        label: [x.name, x.admin1, x.country].filter(Boolean).join(", "),
        lat: x.latitude,
        lon: x.longitude,
        timezone: x.timezone,
      })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Geocoding unavailable" }, { status: 502 });
  }
}
