-- Kira: pendaftaran publik. Pendaftar menunggu (auth.signup), kursi beta (auth.beta_seat), daftar tunggu kabar
-- (auth.waitlist), kotak keluar email tanpa org (public_mail), dan email ternormalisasi untuk keunikan.
-- Semua tabel baru: RLS aktif, GRANT eksplisit (migrasi 0005 mematikan hak bawaan).

-- Satu alamat ternormalisasi (huruf kecil, titik dan +tag Gmail dibuang) hanya boleh punya satu akun.
-- Akun lama dibiarkan NULL (tidak menggagalkan migrasi pada data produksi); aplikasi mengisinya untuk akun baru.
ALTER TABLE auth.user_account ADD COLUMN IF NOT EXISTS email_norm text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS user_account_email_norm_uq ON auth.user_account (email_norm) WHERE email_norm IS NOT NULL;
--> statement-breakpoint

CREATE TABLE auth.signup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_norm text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  terms_version text NOT NULL,
  notice_version text NOT NULL,
  ip_hash text,
  sent_count integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signup_email_norm_uq UNIQUE (email_norm),
  CONSTRAINT signup_token_uq UNIQUE (token_hash)
);
--> statement-breakpoint
CREATE INDEX signup_expires_idx ON auth.signup (expires_at);
--> statement-breakpoint

-- Satu baris per kursi yang terpakai. Keluarga lama (tutor) tidak memakai kursi.
CREATE TABLE auth.beta_seat (
  org_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  email_norm text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_seat_email_uq UNIQUE (email_norm)
);
--> statement-breakpoint

CREATE TABLE auth.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_norm text NOT NULL,
  token text NOT NULL,
  source text NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'signup')),
  consent_text text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  invited_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_uq UNIQUE (email_norm),
  CONSTRAINT waitlist_token_uq UNIQUE (token)
);
--> statement-breakpoint

-- Kotak keluar untuk email yang belum punya org (verifikasi, konfirmasi kabar, undangan kursi).
CREATE TABLE public_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_addr text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  text text NOT NULL,
  kind text NOT NULL,
  list_unsubscribe text,
  send_after timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'no-smtp')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
--> statement-breakpoint
CREATE INDEX public_mail_queue_idx ON public_mail (status, send_after);
--> statement-breakpoint
ALTER TABLE public_mail ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public_mail FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Web hanya menulis; worker membaca dan memperbarui status. Tidak ada akses lain.
CREATE POLICY public_mail_app_insert ON public_mail FOR INSERT TO kira_app WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY public_mail_worker ON public_mail FOR ALL TO kira_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT INSERT ON public_mail TO kira_app;
--> statement-breakpoint
GRANT SELECT, UPDATE, DELETE ON public_mail TO kira_worker;
--> statement-breakpoint

-- Tabel auth: hanya kira_auth. RLS aktif; kira_owner melewati RLS.
ALTER TABLE auth.signup ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth.signup FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY signup_auth ON auth.signup TO kira_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE auth.beta_seat ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth.beta_seat FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY beta_seat_auth_read ON auth.beta_seat FOR SELECT TO kira_auth USING (true);
--> statement-breakpoint
ALTER TABLE auth.waitlist ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth.waitlist FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY waitlist_auth ON auth.waitlist TO kira_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.signup, auth.waitlist TO kira_auth;
--> statement-breakpoint
-- Kursi hanya dibuat oleh fungsi definer di bawah; kira_auth boleh menghitung.
GRANT SELECT ON auth.beta_seat TO kira_auth;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Jumlah kursi terpakai.
CREATE OR REPLACE FUNCTION kira_seats_taken() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT count(*)::int FROM auth.beta_seat
$$;
--> statement-breakpoint

-- Verifikasi email: buat keluarga dan ambil kursi dalam satu transaksi di bawah kunci, jadi batas tidak pernah
-- terlewati walau banyak verifikasi serentak. Status: ok, full, invalid, taken.
CREATE OR REPLACE FUNCTION kira_verify_signup(p_token_hash text, p_seats integer, p_family_name text)
RETURNS TABLE(status text, user_id uuid, org_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
  s auth.signup%ROWTYPE;
  v_org uuid;
  v_user uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kira_beta_seats'));
  SELECT * INTO s FROM auth.signup g WHERE g.token_hash = p_token_hash AND g.expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.user_account u WHERE u.email_norm = s.email_norm OR lower(u.email) = lower(s.email)) THEN
    DELETE FROM auth.signup WHERE id = s.id;
    RETURN QUERY SELECT 'taken'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM auth.beta_seat) >= p_seats THEN
    INSERT INTO auth.waitlist (email, email_norm, token, source, consent_text, confirmed_at)
    VALUES (s.email, s.email_norm, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'signup', 'Mendaftar ke Kira saat kursi penuh dan meminta dikabari.', now())
    ON CONFLICT (email_norm) DO UPDATE SET unsubscribed_at = NULL, confirmed_at = coalesce(auth.waitlist.confirmed_at, now());
    DELETE FROM auth.signup WHERE id = s.id;
    RETURN QUERY SELECT 'full'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  v_org := gen_random_uuid();
  v_user := gen_random_uuid();
  INSERT INTO public.org (id, name) VALUES (v_org, p_family_name);
  INSERT INTO auth.user_account (id, org_id, kind, role, email, email_norm, name, password_hash, password_changed_at)
    VALUES (v_user, v_org, 'adult', 'guardian', s.email, s.email_norm, s.name, s.password_hash, now());
  INSERT INTO public.member_profile (user_id, org_id, name, role, email) VALUES (v_user, v_org, s.name, 'guardian', s.email);
  INSERT INTO auth.beta_seat (org_id, user_id, email_norm) VALUES (v_org, v_user, s.email_norm);
  INSERT INTO public.audit_log (org_id, actor_id, actor_kind, action, target, meta) VALUES
    (v_org, v_user, 'guardian', 'org.created', v_org::text, '{"source":"signup"}'::jsonb),
    (v_org, v_user, 'guardian', 'terms.accepted', v_user::text,
      jsonb_build_object('termsVersion', s.terms_version, 'noticeVersion', s.notice_version, 'ipHash', s.ip_hash));
  UPDATE auth.waitlist w SET converted_at = now() WHERE w.email_norm = s.email_norm;
  DELETE FROM auth.signup WHERE id = s.id;
  RETURN QUERY SELECT 'ok'::text, v_user, v_org;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION kira_seats_taken(), kira_verify_signup(text, integer, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_seats_taken() TO kira_auth, kira_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_verify_signup(text, integer, text) TO kira_auth;
--> statement-breakpoint

-- Pembersihan harian: pendaftar yang tidak memverifikasi dalam 24 jam, konfirmasi kabar yang tidak diklik 14 hari,
-- baris kabar yang berhenti berlangganan lebih dari 30 hari, dan kotak keluar publik 90 hari.
CREATE OR REPLACE FUNCTION kira_purge_public() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE n integer := 0; c integer;
BEGIN
  DELETE FROM auth.signup WHERE expires_at < now(); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM auth.waitlist WHERE confirmed_at IS NULL AND created_at < now() - interval '14 days'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM auth.waitlist WHERE unsubscribed_at IS NOT NULL AND unsubscribed_at < now() - interval '30 days'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.public_mail WHERE created_at < now() - interval '90 days'; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN n;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION kira_purge_public() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_purge_public() TO kira_worker;
