-- Kira: tiga jalur XP, arena Quick Maths dan Quiz Arena, aksesori avatar.
--   xp_event.track        belajar (bawaan, kode lama tidak perlu berubah), hitung, pengetahuan
--   arena_session         satu ronde arena: seed, pengaturan, jawaban yang sudah masuk, hasil
--   arena_state           kemajuan per learner dan arena: level adaptif, rekor, fakta yang sudah dikenal
--   learner_profile.avatar_accessory   aksesori yang dipakai (didapat dari level jalur)
-- Tabel baru: RLS ENABLE dan FORCE, kebijakan org dan learner seperti tabel learner lain, GRANT eksplisit (aturan 13).

ALTER TABLE xp_event ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'belajar';
--> statement-breakpoint
ALTER TABLE xp_event ADD CONSTRAINT xp_event_track_ck CHECK (track IN ('belajar', 'hitung', 'pengetahuan'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS xp_event_track_idx ON xp_event (learner_id, track, date);
--> statement-breakpoint
-- XP arena paling banyak sekali per learner, alasan, dan ref (ronde, pelajaran strategi, atau misi harian).
CREATE UNIQUE INDEX IF NOT EXISTS xp_event_arena_once ON xp_event (learner_id, reason, ref) WHERE track <> 'belajar';
--> statement-breakpoint
ALTER TABLE learner_profile ADD COLUMN IF NOT EXISTS avatar_accessory text;
--> statement-breakpoint

CREATE TABLE arena_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  arena text NOT NULL,
  mode text NOT NULL,
  mission_step text,
  topic text,
  seed text NOT NULL,
  config jsonb NOT NULL,
  date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  total integer NOT NULL DEFAULT 0,
  answered integer,
  correct integer,
  duration_ms integer,
  ppm real,
  xp integer NOT NULL DEFAULT 0,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arena_session_arena_ck CHECK (arena IN ('hitung', 'pengetahuan')),
  CONSTRAINT arena_session_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT arena_session_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX arena_session_learner_idx ON arena_session (learner_id, arena, date) WHERE finished_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX arena_session_open_idx ON arena_session (learner_id, started_at) WHERE finished_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX arena_session_mission_once ON arena_session (learner_id, date, mission_step) WHERE mission_step IS NOT NULL AND finished_at IS NOT NULL;
--> statement-breakpoint

CREATE TABLE arena_state (
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  arena text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, arena),
  CONSTRAINT arena_state_arena_ck CHECK (arena IN ('hitung', 'pengetahuan')),
  CONSTRAINT arena_state_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT arena_state_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint

ALTER TABLE arena_session ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE arena_session FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY arena_session_org ON arena_session USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
CREATE POLICY arena_session_learner ON arena_session AS RESTRICTIVE USING (app_can_see_learner(learner_id)) WITH CHECK (app_can_see_learner(learner_id));
--> statement-breakpoint
ALTER TABLE arena_state ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE arena_state FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY arena_state_org ON arena_state USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
CREATE POLICY arena_state_learner ON arena_state AS RESTRICTIVE USING (app_can_see_learner(learner_id)) WITH CHECK (app_can_see_learner(learner_id));
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON arena_session, arena_state TO kira_app, kira_worker;
