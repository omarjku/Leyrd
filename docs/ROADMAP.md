# Roadmap

Each milestone is developed on `omar`, tested (unit tests, plus an end-to-end run on a simulated phone), reviewed for security and bugs, and then merged into `main`, which auto-deploys to https://leyrd.onrender.com.

_Last updated 15 Oct 2026 after Omar's first round of feedback on the MVP._

## ✅ Done
- **M1, v0.1 (11 Oct):** login, questionnaire, layer engine, wardrobe with wash status, occasion filter, feedback calibration, Claude chat, installable app.
- **M2, hardening (11 Oct):** security and bug-review fixes, embedded demo DB, docs.
- **Config (15 Oct, by Omar):** `DATABASE_URL` attached; logs show `schema applied`, so data is now persistent.

## P0: Fix now (small, this week)
- [ ] **Weather is down.** Open-Meteo returns `429 Daily API request limit exceeded`. Render's free servers share outbound IPs, so other apps use up the free quota. This is why Today was empty.
  - Fix: switch the forecast to MET Norway (free, global, needs a User-Agent) and keep Open-Meteo as fallback.
  - Cache forecasts per ~10 km grid cell and hour.
  - Show a clear "weather unavailable, here's a typical-day suggestion" state instead of an error.
- [ ] **Today first-run experience.** After onboarding, Today needs to explain itself: what the number means, what to tap, and when to rate. It also needs a fallback plan when weather fails.
- [ ] **Check Google sign-in.** The logs show one failed attempt before the keys took effect. Retest it.
- [ ] Merge the 2 pending commits on `omar` (setup docs, test-runner upgrade).

## M3: UX research and design system (do before redesigning screens)
- [ ] Research pass: onboarding, questionnaire and form UX; mobile tactile controls; weather and fashion app patterns; empty states; trust and explanation patterns.
  - Sources: articles from NN/g, Baymard, Material and Apple HIG, plus video transcripts.
  - The "watch videos" skill isn't installed in the build sessions so far. Install it, or send links to the talks or videos you want covered.
- [ ] User journey map: first open → onboarding → first recommendation → daily use → evening feedback → wardrobe upkeep.
- [ ] Design system: type scale, colour and weather palette, spacing, icons in the same simple style as the bottom-nav icons, motion, haptics where the browser supports them.
- [ ] Clickable prototype of the new onboarding, Today and Wardrobe screens for Omar to approve before coding.

## M4: Questionnaire v2
- [ ] **Getting around:** multi-select (walk, bike, e-scooter, tram, bus, train, car), with an optional "mostly…" share. The engine uses a weighted exposure: bike and scooter add wind chill, waiting at stops adds standing-still time.
- [ ] **Day timeline:** a draggable 24 h timeline with handles for leave and return, plus outdoor, transit and indoor segments. Tactile, with snap points and live feels-like temperatures under the bar.
- [ ] **Time indoors:** a slider of the same style; it feeds the "carry vs wear" logic.
- [ ] More questions (proposal):
  - Indoor temperature (office/uni hot or cold?)
  - Do you sweat easily / activity level
  - Do you change at the gym
  - Rain tolerance (umbrella vs hood)
  - Style preferences
  - Typical week, since days differ (uni vs work vs gym)
- [ ] Progressive onboarding: ask the minimum first, learn the rest over the first week. Show a live preview of today's outfit while answering.

## M5: Wardrobe v2
- [ ] **Item attributes:**
  - warmth / insulation (clo)
  - thickness
  - weight
  - breathability
  - wind resistance
  - water resistance (none / resistant / waterproof)
  - material and fabric blend
  - sleeve length
  - hood
  - fit / layerability (can go under or over)
  - sun protection
  - formality
  - occasions
  - colour
  - brand
  - drying time (drives the wash timer)
  - condition
  - last worn
  - photo
- [ ] Item detail page with edit; filters and sort; "how often worn" stats.
- [ ] **Add by photo:**
  1. Take a camera photo.
  2. Remove the background so every item looks standardised (square, neutral backdrop).
  3. Claude vision fills in the attributes and asks when it's unsure ("linen or cotton?").
  4. Omar confirms.
- [ ] Bulk add: several items from one photo or a closet video (later).
- [ ] Needs image storage: Cloudflare R2 or Supabase Storage (decision below).

## M6: Today v2
- [ ] Hero card: layers, a short reason, and the outfit as standardised item images.
- [ ] Day timeline with comfort along it, e.g. "comfortable until 18:30, then add the jacket" (ISO 9920 clo idea from hackhub).
- [ ] Quick re-plan chips: in the wash, too formal, I'm biking today, staying in.
- [ ] Better feedback: per body zone (cold hands / core / too sweaty), not just cold/right/warm.

## M7: Profile v2
- [ ] Calibration history chart; streaks; "what Leyrd knows about you" panel with edit and delete (privacy).
- [ ] Preferences: units, language (EN/DE/AR), notification time, home / uni / work places.

## M8: Engine v2
- [ ] Use the new attributes: a clo-based warmth budget, breathability for active commutes, wind resistance for bike and scooter, multi-mode exposure.
- [ ] Backtest against 14+ days of real feedback (Leyrd PRD Stage 0 gate: ≥ 70% "felt right").

## Later
Voice chat (EN/DE/Egyptian Arabic) · morning push notification · calendar import · trip packing · native iOS widget.

## Decisions needed from Omar
1. Weather provider: MET Norway (free) now. Upgrade to paid Open-Meteo later?
2. Image storage for wardrobe photos: Cloudflare R2 or Supabase Storage. Both have free tiers; check the current limits.
3. Stay an installable web app for v2? (Recommended: yes. Drag timelines and the camera work in mobile browsers.)
4. The Render free DB expires 10 Nov 2026: upgrade it or move it?
