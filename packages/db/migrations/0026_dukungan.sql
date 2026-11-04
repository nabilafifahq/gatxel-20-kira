-- Halaman Bantuan: tabel pesan tanpa org (support_ticket) dan lampiran serta Reply-To di kotak keluar publik.
-- Aman untuk data produksi: tabel baru dan kolom nullable saja.

CREATE TABLE support_ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  category text NOT NULL CHECK (category IN ('bug', 'saran', 'koreksi', 'kemitraan', 'lainnya')),
  -- CR dan LF ditolak juga di database: subjek dan alamat ini masuk ke header email.
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 160 AND subject !~ '[[:cntrl:]]'),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  sender_email text NOT NULL CHECK (char_length(sender_email) BETWEEN 3 AND 254 AND sender_email !~ '[[:cntrl:][:space:]]'),
  account_id uuid REFERENCES auth.user_account(id) ON DELETE SET NULL,
  account_role text CHECK (account_role IN ('tutor', 'guardian')),
  user_agent text CHECK (char_length(user_agent) <= 400),
  screen text CHECK (char_length(screen) <= 20),
  app_version text CHECK (char_length(app_version) <= 40),
  page_from text CHECK (char_length(page_from) <= 200),
  ip_hash text,
  attachment_name text CHECK (char_length(attachment_name) <= 120),
  attachment_mime text CHECK (attachment_mime IN ('image/png', 'image/jpeg', 'application/pdf', 'video/mp4')),
  attachment_bytes integer CHECK (attachment_bytes BETWEEN 1 AND 5242880),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_reference_unique UNIQUE (reference)
);
--> statement-breakpoint
CREATE INDEX support_ticket_created_idx ON support_ticket (created_at);
--> statement-breakpoint
ALTER TABLE support_ticket ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_ticket FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Peran sempit: web hanya bisa menambah baris, tidak bisa membaca, mengubah, atau menghapus. Pengirim publik tidak punya org.
-- Pembacaan hanya lewat kira_owner (perintah admin), penghapusan lewat kira_purge_public().
CREATE POLICY support_ticket_app_insert ON support_ticket FOR INSERT TO kira_app WITH CHECK (true);
--> statement-breakpoint
GRANT INSERT ON support_ticket TO kira_app;
--> statement-breakpoint

ALTER TABLE public_mail ADD COLUMN reply_to text;
--> statement-breakpoint
ALTER TABLE public_mail ADD COLUMN attachment_path text;
--> statement-breakpoint
ALTER TABLE public_mail ADD COLUMN attachment_name text;
--> statement-breakpoint
ALTER TABLE public_mail ADD COLUMN attachment_mime text;
--> statement-breakpoint

-- Sama dengan versi 0012, ditambah pesan bantuan yang lebih tua dari 12 bulan.
CREATE OR REPLACE FUNCTION kira_purge_public() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE n integer := 0; c integer;
BEGIN
  DELETE FROM auth.signup WHERE expires_at < now(); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM auth.waitlist WHERE confirmed_at IS NULL AND created_at < now() - interval '14 days'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM auth.waitlist WHERE unsubscribed_at IS NOT NULL AND unsubscribed_at < now() - interval '30 days'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.public_mail WHERE created_at < now() - interval '90 days'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.support_ticket WHERE created_at < now() - interval '12 months'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN n;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION kira_purge_public() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_purge_public() TO kira_worker;
