-- Ruang Baca: kemajuan membaca per buku, bab yang selesai dengan nilai kuisnya, kuis bab yang sedang berjalan
-- (soal dipilih server, kunci tidak dikirim ke perangkat), dan menit membaca per hari.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).

CREATE TABLE book_progress (
  learner_id uuid NOT NULL,
  book_id text NOT NULL,
  org_id uuid NOT NULL,
  chapter_id text NOT NULL,
  sentence_idx integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (learner_id, book_id),
  CONSTRAINT book_progress_sentence_ck CHECK (sentence_idx >= 0 AND sentence_idx < 5000),
  CONSTRAINT book_progress_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT book_progress_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE book_chapter (
  learner_id uuid NOT NULL,
  book_id text NOT NULL,
  chapter_id text NOT NULL,
  org_id uuid NOT NULL,
  quiz_count integer NOT NULL DEFAULT 0,
  best_correct integer NOT NULL DEFAULT 0,
  best_total integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, book_id, chapter_id),
  CONSTRAINT book_chapter_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT book_chapter_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE book_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  book_id text NOT NULL,
  chapter_id text NOT NULL,
  org_id uuid NOT NULL,
  question_ids text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  correct integer,
  CONSTRAINT book_quiz_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT book_quiz_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX book_quiz_learner_idx ON book_quiz (learner_id, book_id, chapter_id, created_at);
--> statement-breakpoint
CREATE TABLE reading_day (
  learner_id uuid NOT NULL,
  date date NOT NULL,
  org_id uuid NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  last_at timestamptz,
  PRIMARY KEY (learner_id, date),
  CONSTRAINT reading_day_seconds_ck CHECK (seconds >= 0 AND seconds <= 86400),
  CONSTRAINT reading_day_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT reading_day_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX book_progress_org_idx ON book_progress (org_id);
--> statement-breakpoint
CREATE INDEX book_chapter_org_idx ON book_chapter (org_id);
--> statement-breakpoint
CREATE INDEX book_quiz_org_idx ON book_quiz (org_id);
--> statement-breakpoint
CREATE INDEX reading_day_org_idx ON reading_day (org_id);
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['book_progress','book_chapter','book_quiz','reading_day'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id())', t || '_org', t);
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE USING (app_can_see_learner(learner_id)) WITH CHECK (app_can_see_learner(learner_id))', t || '_learner', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO kira_app, kira_worker', t);
  END LOOP;
END $$;
