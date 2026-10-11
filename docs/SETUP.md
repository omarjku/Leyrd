# Setup: three switches to flip (≈10 minutes total)

The app is live at **https://leyrd.onrender.com** and works now in *demo mode*. These steps make it permanent and turn on the extras. Every value goes into **Render → `leyrd` service → Environment → Add environment variable**. Saving redeploys the app automatically (~2 min).

## 1. Make data permanent (required, 1 min)
Right now there is no database URL, so the app runs on an embedded database that **resets whenever the server restarts**. The free server sleeps after ~15 min idle, so data can be lost.

1. Render dashboard → **leyrd-db** (Postgres, Frankfurt) → **Connect** → copy the **Internal Database URL**.
2. `leyrd` service → Environment → add `DATABASE_URL` = that URL → Save.

Tables are created on startup. After that you can delete `LEYRD_DEMO` (it only allows the embedded fallback). ⚠️ Render's free Postgres **expires on 10 Nov 2026** (30 days). Before then, upgrade it to a paid plan in Render, or move to another Postgres host and change `DATABASE_URL`.

## 2. Google sign-in (optional, 5 min)
1. https://console.cloud.google.com → create or select a project → **APIs & Services → OAuth consent screen**. Choose External, enter the app name "Leyrd" and your email, and add yourself (and testers) under **Test users**.
2. **Credentials → Create credentials → OAuth client ID**, type **Web application**.
   - Authorized JavaScript origin: `https://leyrd.onrender.com`
   - Authorized redirect URI: `https://leyrd.onrender.com/api/auth/callback/google`
3. Copy the Client ID and Client secret into Render as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

The "Continue with Google" button appears automatically after the redeploy. If someone registered with a password using the same email, signing in with Google merges into that account and removes the unverified password (anti-hijack).

## 3. AI chat (optional, 1 min)
Create a key at https://console.anthropic.com → API keys, then add `ANTHROPIC_API_KEY` in Render. The **Ask Leyrd** button then appears on the Today screen.

The chat uses `claude-opus-5-5` at low effort, rate-limited to 20 messages/min and 300/day per user. Without the key, the "In the wash" and "Something else" buttons do the same re-planning without AI.

## Already set
`AUTH_SECRET` (random), `AUTH_URL=https://leyrd.onrender.com`, `AUTH_TRUST_HOST=true`, `NODE_VERSION=22`, `LEYRD_DEMO=1` (allows the embedded demo DB until `DATABASE_URL` is set).

Optional tuning: `CHAT_USER_DAILY_TOKENS` (default 200k) and `CHAT_GLOBAL_DAILY_TOKENS` (default 3M) cap AI chat spend.

## Install on your phone
- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → ⋮ → **Install app**.
