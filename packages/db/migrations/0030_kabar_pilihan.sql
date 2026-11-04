-- Email kabar produk (opsional, tidak pernah tercentang dari awal). Pilihan disimpan bersama waktunya di pendaftar yang
-- menunggu dan di akun setelah konfirmasi. Migrasi ini tidak mengirim email apa pun, dan akun lama tetap tidak berlangganan.
-- Tabel auth sudah ber-RLS dengan GRANT tingkat tabel untuk kira_auth, jadi kolom baru mengikutinya.
ALTER TABLE auth.signup
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;
--> statement-breakpoint
ALTER TABLE auth.user_account
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_notice_version text,
  ADD COLUMN IF NOT EXISTS marketing_token text;
--> statement-breakpoint
-- Berlangganan selalu punya bukti waktu.
ALTER TABLE auth.signup ADD CONSTRAINT signup_marketing_at_ck CHECK (NOT marketing_opt_in OR marketing_opt_in_at IS NOT NULL);
--> statement-breakpoint
ALTER TABLE auth.user_account ADD CONSTRAINT user_account_marketing_at_ck CHECK (NOT marketing_opt_in OR marketing_opt_in_at IS NOT NULL);
--> statement-breakpoint
-- Token untuk tautan berhenti satu klik di /kabar/berhenti, hanya ada pada akun yang pernah berlangganan.
CREATE UNIQUE INDEX IF NOT EXISTS user_account_marketing_token_uq ON auth.user_account (marketing_token) WHERE marketing_token IS NOT NULL;
--> statement-breakpoint

-- Sama dengan 0029, ditambah pilihan kabar yang dibawa dari pendaftar ke akun beserta catatan auditnya.
CREATE OR REPLACE FUNCTION kira_verify_signup(p_token_hash text, p_seats integer)
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
  INSERT INTO public.org (id, name) VALUES (v_org, 'Keluarga Anda');
  INSERT INTO auth.user_account (id, org_id, kind, role, email, email_norm, name, password_hash, password_changed_at, marketing_opt_in, marketing_opt_in_at, marketing_notice_version, marketing_token)
    VALUES (v_user, v_org, 'adult', 'guardian', s.email, s.email_norm, s.name, s.password_hash, now(), s.marketing_opt_in, s.marketing_opt_in_at,
      CASE WHEN s.marketing_opt_in THEN s.notice_version END,
      CASE WHEN s.marketing_opt_in THEN replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') END);
  INSERT INTO public.member_profile (user_id, org_id, name, role, email) VALUES (v_user, v_org, s.name, 'guardian', s.email);
  INSERT INTO auth.beta_seat (org_id, user_id, email_norm) VALUES (v_org, v_user, s.email_norm);
  INSERT INTO public.audit_log (org_id, actor_id, actor_kind, action, target, meta) VALUES
    (v_org, v_user, 'guardian', 'org.created', v_org::text, '{"source":"signup"}'::jsonb),
    (v_org, v_user, 'guardian', 'terms.accepted', v_user::text,
      jsonb_build_object('termsVersion', s.terms_version, 'noticeVersion', s.notice_version, 'ipHash', s.ip_hash));
  IF s.marketing_opt_in THEN
    INSERT INTO public.audit_log (org_id, actor_id, actor_kind, action, target, meta) VALUES
      (v_org, v_user, 'guardian', 'marketing.opted-in', v_user::text, jsonb_build_object('noticeVersion', s.notice_version, 'via', 'signup'));
  END IF;
  UPDATE auth.waitlist w SET converted_at = now() WHERE w.email_norm = s.email_norm;
  DELETE FROM auth.signup WHERE id = s.id;
  RETURN QUERY SELECT 'ok'::text, v_user, v_org;
END $$;
