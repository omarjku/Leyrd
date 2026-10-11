CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  image text,
  password_hash text,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city text NOT NULL DEFAULT 'Linz',
  lat double precision NOT NULL DEFAULT 48.3069,
  lon double precision NOT NULL DEFAULT 14.2858,
  timezone text NOT NULL DEFAULT 'Europe/Vienna',
  leave_time text NOT NULL DEFAULT '08:00',
  return_time text NOT NULL DEFAULT '18:00',
  commute_mode text NOT NULL DEFAULT 'transit',
  outdoor_minutes integer NOT NULL DEFAULT 30,
  thermal_type text NOT NULL DEFAULT 'neutral',
  default_occasion text NOT NULL DEFAULT 'uni',
  calibration_offset_c double precision NOT NULL DEFAULT 0,
  onboarded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slot text NOT NULL,
  kind text NOT NULL,
  warmth double precision NOT NULL,
  waterproof boolean NOT NULL DEFAULT false,
  windproof boolean NOT NULL DEFAULT false,
  occasions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'clean',
  status_until timestamptz,
  last_worn timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_idx ON wardrobe_items(user_id);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  rating text NOT NULL,
  offset_before double precision NOT NULL,
  offset_after double precision NOT NULL,
  adjusted_temp_c double precision,
  outfit jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

CREATE TABLE IF NOT EXISTS climatology_cache (
  key text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Additive migrations (keep idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
