-- Atur sesi: aturan hari bawaan per learner (Mati, Opsional, Wajib per hari, mapel, dan sesi), slot rencana yang
-- menggantikan atau mematikan sesi dasar, dan tanggal awal hitungan streak untuk fitur atur ulang streak.
-- Tabel baru: ENABLE dan FORCE RLS, kebijakan org dan learner, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).

-- preset: penuh (9 sesi wajib), seimbang (Latihan wajib, Tes dan Paper opsional), ringan (hanya Latihan), kustom (lihat rules).
-- rules hanya terisi untuk kustom: {"1": {"math": {"latihan": "required", "tes": "optional", "paper": "off"}, ...}, ...} dengan kunci hari 1 sampai 6.
CREATE TABLE day_rules (
  learner_id uuid PRIMARY KEY NOT NULL,
  org_id uuid NOT NULL,
  preset text NOT NULL DEFAULT 'seimbang',
  rules jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_rules_preset_ck CHECK (preset IN ('penuh', 'seimbang', 'ringan', 'kustom')),
  CONSTRAINT day_rules_org_fk FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE,
  CONSTRAINT day_rules_learner_fk FOREIGN KEY (learner_id) REFERENCES learner_profile(user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX day_rules_org_idx ON day_rules (org_id);
--> statement-breakpoint
ALTER TABLE day_rules ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE day_rules FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY day_rules_org ON day_rules USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
--> statement-breakpoint
-- Learner membaca aturannya sendiri (untuk menyusun Today), tutor dan orang tua yang tertaut boleh mengubah.
CREATE POLICY day_rules_learner ON day_rules AS RESTRICTIVE
  USING (app_can_see_learner(learner_id))
  WITH CHECK (app_role() IN ('tutor', 'guardian') AND app_can_see_learner(learner_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON day_rules TO kira_app, kira_worker;
--> statement-breakpoint

-- Learner yang sudah ada memakai Seimbang: hari belajar terlalu panjang dengan 9 sesi wajib.
INSERT INTO day_rules (learner_id, org_id, preset)
SELECT user_id, org_id, 'seimbang' FROM learner_profile WHERE deleted_at IS NULL
ON CONFLICT (learner_id) DO NOTHING;
--> statement-breakpoint

-- Slot rencana: base = menggantikan sesi dasar yang sama (Wajib atau Opsional), off = sesi dasar itu dimatikan.
-- Slot wajib yang sudah ada sejak dulu menggantikan sesi dasar, jadi base diisi dari required.
ALTER TABLE plan_slot ADD COLUMN IF NOT EXISTS base boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE plan_slot ADD COLUMN IF NOT EXISTS off boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE plan_slot SET base = true WHERE required AND kind = 'quest';
--> statement-breakpoint

-- Atur ulang streak: hari sebelum tanggal ini tidak dihitung lagi. Kosong berarti sejak started_on.
ALTER TABLE learner_profile ADD COLUMN IF NOT EXISTS streak_since date;
--> statement-breakpoint

-- Keluarga tanpa tutor (pendaftaran publik): soal tulis, bicara, gambar, dan foto tidak menunggu tutor, orang
-- tua boleh melihat dan menilainya. Anak tidak boleh membaca member_profile, jadi pemeriksaannya lewat fungsi ini.
CREATE OR REPLACE FUNCTION app_family_has_tutor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM member_profile WHERE org_id = app_org_id() AND role = 'tutor' AND removed_at IS NULL)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_family_has_tutor() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_family_has_tutor() TO kira_app, kira_worker;
