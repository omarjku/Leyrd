# Roadmap

Each milestone is developed on `omar`, tested (unit tests, plus an end-to-end run on a simulated phone), reviewed, and then merged into `main`, which auto-deploys.

## ✅ M1: Usable v0.1 (11 Oct 2026)
Login (email + Google-ready), questionnaire, layer engine with climatology floors, owned-item selection with wash state, occasion filter, feedback calibration, Claude chat, installable app, Render deploy.

## M2: Make it real (owner config, ~10 min)
- [ ] Attach `DATABASE_URL` (see SETUP.md)
- [ ] Google OAuth keys
- [ ] Anthropic API key
- [ ] Decide on Postgres after the free tier expires (10 Nov 2026)

## M3: Validate the engine (Leyrd PRD Stage 0 gate)
- [ ] Use it daily for 14 days with evening feedback
- [ ] Export the feedback log and backtest band choices against "felt right"; target ≥ 70% match
- [ ] Tune the band edges and the bike/wind penalties from the data; record changes in an engine revision log

## M4: Wardrobe from photos (questionnaire option 4b)
- [ ] Photo upload → Claude vision tags slot, warmth, waterproof and material; ask when unsure ("linen or cotton?")
- [ ] Five-outfit-photo cold start
- [ ] Per-item warmth learned from feedback

## M5: Voice and languages
- [ ] Push-to-talk in chat (browser speech-to-text), English / German / Egyptian Arabic
- [ ] Spoken reply option

## M6: Proactive morning
- [ ] Web push at a chosen time, only when today differs from normal (Leyrd "silent by default" principle)
- [ ] Calendar import for occasion and time outside

## M7: Comfort timeline (hackhub idea)
- [ ] Hour-by-hour comfort using ISO 9920 clo values (pythermalcomfort) vs the band baseline, e.g. "comfortable until 18:30, then add the jacket"

## Later
Trip-packing mode, native iOS widget (SwiftUI/WidgetKit), shared household wardrobes, gap shopping.
