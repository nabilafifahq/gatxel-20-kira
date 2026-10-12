-- Hak bawaan dari 0001 (ALTER DEFAULT PRIVILEGES) dicabut. pg_restore --clean membuat ulang tabel saat hak
-- bawaan masih aktif, sehingga REVOKE di 0001 hilang setelah pemulihan cadangan: consent_event dan audit_log
-- tidak lagi append-only dan kira_app bisa membaca schedule_state. Tanpa hak bawaan, pemulihan memasang hak
-- persis seperti di cadangan. Setiap migrasi yang membuat tabel atau sequence baru wajib memberi GRANT eksplisit.
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM kira_app, kira_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM kira_app, kira_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA auth REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM kira_auth;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kira_owner IN SCHEMA auth REVOKE USAGE, SELECT ON SEQUENCES FROM kira_auth;
--> statement-breakpoint
-- Perbaiki database yang pernah dipulihkan sebelum migrasi ini.
REVOKE UPDATE, DELETE ON consent_event, audit_log FROM kira_app, kira_worker;
--> statement-breakpoint
REVOKE ALL ON schedule_state FROM kira_app;
