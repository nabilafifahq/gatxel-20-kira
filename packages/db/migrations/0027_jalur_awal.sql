-- Onboarding dua jalur: pilihan jalur per anak (rekomendasi, atur sendiri, lewati), walkthrough pertama anak,
-- dan laporan pertama yang dibuka orang tua untuk daftar langkah di beranda keluarga.
-- Kolom baru tanpa default, aman untuk baris lama. Hak tabel tidak berubah: learner_profile dan member_profile sudah punya GRANT.
ALTER TABLE learner_profile ADD COLUMN setup_path text;
--> statement-breakpoint
ALTER TABLE learner_profile ADD CONSTRAINT learner_setup_path_ck CHECK (setup_path IN ('recommended', 'custom', 'skipped'));
--> statement-breakpoint
ALTER TABLE learner_profile ADD COLUMN first_run_done_at timestamptz;
--> statement-breakpoint
ALTER TABLE member_profile ADD COLUMN first_report_seen_at timestamptz;
--> statement-breakpoint
-- Anak yang sudah ada tidak melihat walkthrough, dan saklar fiturnya dianggap sudah dipilih.
UPDATE learner_profile SET setup_path = 'custom', first_run_done_at = now();
