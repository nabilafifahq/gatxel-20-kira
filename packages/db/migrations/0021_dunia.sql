-- Kira World: dompet bintang, teman peliharaan, toko, album kartu, cerita mingguan, tantangan bos, ruang piala.
-- Semua tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).

-- Buku besar bintang. Jumlah positif = didapat, negatif = dipakai. Satu sumber hanya sekali per learner.
CREATE TABLE star_ledger (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  source text NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT star_ledger_amount_ck CHECK (amount <> 0 AND amount BETWEEN -1000 AND 1000),
  CONSTRAINT star_ledger_text_ck CHECK (char_length(reason) BETWEEN 1 AND 40 AND char_length(source) BETWEEN 1 AND 120),
  CONSTRAINT star_ledger_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT star_ledger_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX star_ledger_source_uq ON star_ledger (learner_id, source);
--> statement-breakpoint
CREATE INDEX star_ledger_day_idx ON star_ledger (learner_id, date);
--> statement-breakpoint

-- Keadaan dunia: teman, pilihan pakai, dan kemajuan cerita serta bos.
CREATE TABLE world_state (
  learner_id uuid PRIMARY KEY NOT NULL,
  org_id uuid NOT NULL,
  pet jsonb,
  equipped jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT world_state_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT world_state_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Barang yang dimiliki (pakaian, bingkai, latar, rumah dan barang teman). Dibeli atau dari hadiah.
CREATE TABLE world_item (
  learner_id uuid NOT NULL,
  org_id uuid NOT NULL,
  item_id text NOT NULL,
  source text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, item_id),
  CONSTRAINT world_item_text_ck CHECK (char_length(item_id) BETWEEN 1 AND 60),
  CONSTRAINT world_item_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT world_item_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Album kartu: didapat dari kemampuan, topik Quiz, dan menang lawan bos, bukan dari undian.
CREATE TABLE world_card (
  learner_id uuid NOT NULL,
  org_id uuid NOT NULL,
  card_id text NOT NULL,
  source text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, card_id),
  CONSTRAINT world_card_text_ck CHECK (char_length(card_id) BETWEEN 1 AND 60),
  CONSTRAINT world_card_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT world_card_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Medali lomba sungguhan yang dicatat orang tua.
CREATE TABLE contest_medal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  title text NOT NULL,
  medal text NOT NULL,
  earned_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CONSTRAINT contest_medal_title_ck CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT contest_medal_kind_ck CHECK (medal IN ('gold', 'silver', 'bronze', 'honour', 'participant')),
  CONSTRAINT contest_medal_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT contest_medal_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX contest_medal_learner_idx ON contest_medal (learner_id);
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['star_ledger','world_state','world_item','world_card','contest_medal'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id())', t || '_org', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO kira_app, kira_worker', t);
  END LOOP;
END $$;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE star_ledger_id_seq TO kira_app, kira_worker;
--> statement-breakpoint

-- Anak dan orang tua yang tertaut hanya melihat data anak itu. Anak menulis dunianya sendiri.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['star_ledger','world_state','world_item','world_card'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE USING (app_can_see_learner(learner_id)) WITH CHECK (app_can_see_learner(learner_id))', t || '_learner', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Medali lomba hanya ditulis tutor atau orang tua; anak hanya membaca.
CREATE POLICY contest_medal_learner ON contest_medal AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_role() IN ('tutor', 'guardian') AND app_can_see_learner(learner_id));
