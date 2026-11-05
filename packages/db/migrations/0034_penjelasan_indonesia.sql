-- Setelan orang tua: penjelasan tampil dalam bahasa Indonesia lebih dulu. Dibaca bersama sesi, sama seperti ui_lang.
-- ADD COLUMN dengan DEFAULT konstan tidak menulis ulang tabel. Hak kira_auth atas tabel ini sudah mencakup kolom baru.
ALTER TABLE auth.user_account ADD COLUMN explain_id_first boolean NOT NULL DEFAULT false;
