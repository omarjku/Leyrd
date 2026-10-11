# Leyrd

Layer coach: tells you how many layers to wear today and which of your own clothes to put on. It uses the forecast for your commute, 10 years of local climate history, what's clean in your wardrobe, and your "too cold / too warm" feedback.

**Live:** https://leyrd.onrender.com (Render free tier; the first load after ~15 min idle takes ~30–60 s while it wakes up)

## Features (v0.1)
- Email + password sign-in. Google sign-in turns on when its keys are set ([docs/SETUP.md](docs/SETUP.md)).
- 6-step questionnaire: location, schedule and minutes outdoors, commute mode, how you feel the cold, typical occasion, wardrobe checklist.
- Today screen: number of layers, the outfit picked from your own items, the weather at leave and return times, an hourly feels-like strip, and the reasons behind the pick.
- **In the wash / Something else** re-plans instantly. Statuses expire on their own: wash 10 h, drying 12 h, away 7 days.
- Occasion chips (casual, uni, work, gym, formal) filter what's suggested.
- Feedback: too cold / just right / too warm shifts your personal adjustment by ±0.5 °C, capped at ±4 °C.
- Ask Leyrd: Claude chat ("my hoodie is in the wash, what else?"). Turns on when `ANTHROPIC_API_KEY` is set.
- Installable on your phone: open the site, then Share → Add to Home Screen.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind v4 · Auth.js v5 · Postgres (postgres.js; falls back to embedded PGlite when `DATABASE_URL` is unset) · Open-Meteo (forecast, archive, geocoding) · Anthropic SDK

## Develop
```bash
npm install
cp .env.example .env.local   # set AUTH_SECRET at least
npm run dev                  # without DATABASE_URL it uses an embedded DB
npm test                     # 80 unit tests (engine, selection, weather parsing, calibration)
```
`LEYRD_MOCK_WEATHER=1` uses fixed synthetic weather (for offline dev and e2e tests).

## How the engine works
`lib/engine.ts` ports the Leyrd engine spec:

1. **Adjusted temperature.** Start from the worst feels-like temperature of your two commute windows, then:
   - add your calibration;
   - ±1.5 °C if you run hot or cold;
   - −2 °C if wind is above 25 km/h;
   - −2 °C if you bike.
2. **Band.** The adjusted temperature maps to a band (hot → freezing) with per-slot warmth targets: base 0–2, mid 0–3, outer 0–3, plus accessories.
3. **Weather modifiers.** Rain means a waterproof layer or umbrella. UV means sun protection. Under 20 minutes outside means carry the jacket instead of wearing it.
4. **Climate safety floors.** From local history: a waterproof layer if this week is wet on 25% or more of days; a minimum jacket or sweater near the local cold tail (p10).
5. **Outfit.** `lib/select.ts` picks your available items closest to each target, prefers the occasion, and carries any deficit over to the next layer.

Branches: work happens on `omar`; tested milestones are merged into `main`, which auto-deploys.
