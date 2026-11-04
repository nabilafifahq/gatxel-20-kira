-- Bahasa tampilan anak (ui_lang) per akun, dibaca bersama sesi supaya tidak ada query tambahan per request.
-- Baris yang sudah ada (keluarga lama) terisi 'en' dan tetap seperti sebelumnya; anak baru mulai dengan 'id'.
-- ADD COLUMN dengan DEFAULT konstan tidak menulis ulang tabel. Hak kira_auth atas tabel ini sudah mencakup kolom baru.
ALTER TABLE auth.user_account ADD COLUMN ui_lang text NOT NULL DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE auth.user_account ALTER COLUMN ui_lang SET DEFAULT 'id';
--> statement-breakpoint
ALTER TABLE auth.user_account ADD CONSTRAINT user_account_ui_lang_ck CHECK (ui_lang IN ('id', 'en'));
--> statement-breakpoint
ALTER TABLE auth.user_account ADD COLUMN ui_lang_switch boolean NOT NULL DEFAULT false;
