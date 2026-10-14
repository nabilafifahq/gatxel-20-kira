-- Gerak: pilihan suara dan musik dari tutor, latar avatar, dan peti hadiah harian.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).

ALTER TABLE learner_profile ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE learner_profile ADD COLUMN IF NOT EXISTS music_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE learner_profile ADD COLUMN IF NOT EXISTS avatar_background text;
--> statement-breakpoint
ALTER TABLE learner_profile ADD CONSTRAINT learner_profile_background_ck CHECK (avatar_background IS NULL OR char_length(avatar_background) <= 40);

--> statement-breakpoint
-- Satu peti per learner per hari: hadiah dipilih di server, UNIQUE (learner_id, date) menolak peti kedua.
CREATE TABLE daily_chest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  date date NOT NULL,
  reward_kind text NOT NULL,
  reward_id text NOT NULL,
  is_new boolean NOT NULL DEFAULT true,
  opened_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_chest_kind_ck CHECK (reward_kind IN ('sticker', 'background', 'accessory')),
  CONSTRAINT daily_chest_reward_ck CHECK (char_length(reward_id) BETWEEN 1 AND 40),
  CONSTRAINT daily_chest_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT daily_chest_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX daily_chest_day_uq ON daily_chest (learner_id, date);
--> statement-breakpoint
CREATE INDEX daily_chest_owned_idx ON daily_chest (learner_id, reward_kind, reward_id);
--> statement-breakpoint
ALTER TABLE daily_chest ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE daily_chest FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY daily_chest_org ON daily_chest USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
-- Learner hanya miliknya, orang tua hanya membaca, tutor dan worker semua.
CREATE POLICY daily_chest_learner ON daily_chest AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_role() <> 'guardian' AND app_can_see_learner(learner_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_chest TO kira_app, kira_worker;
