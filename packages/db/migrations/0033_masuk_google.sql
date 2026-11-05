-- Masuk dan daftar dengan Google untuk orang tua. Yang disimpan hanya pengenal `sub` dari Google, tidak ada token.
-- Tabel baru: RLS aktif dan GRANT eksplisit. Satu akun Kira satu akun Google, dan sebaliknya. Terhapus bersama akunnya.
CREATE TABLE auth.google_identity (
  sub text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.user_account (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_identity_user_uq UNIQUE (user_id),
  CONSTRAINT google_identity_sub_len CHECK (char_length(sub) BETWEEN 1 AND 255)
);
--> statement-breakpoint
ALTER TABLE auth.google_identity ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth.google_identity FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY google_identity_auth ON auth.google_identity TO kira_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT, INSERT ON auth.google_identity TO kira_auth;
--> statement-breakpoint

-- Orang tua baru lewat Google: buat keluarga dan ambil kursi di bawah kunci yang sama dengan kira_verify_signup, jadi batas
-- kursi tidak pernah terlewati oleh kedua jalur. Akun dibuat tanpa password. Pendaftar menunggu dengan email yang sama
-- dibuang, tidak pernah diaktifkan dengan password tersimpannya, karena password itu bisa berasal dari orang lain.
-- Status: ok, full, taken. Saat kursi penuh tidak ada yang berubah; daftar tunggu butuh persetujuannya sendiri.
CREATE FUNCTION kira_google_signup(p_sub text, p_email text, p_email_norm text, p_name text, p_seats integer, p_terms_version text, p_notice_version text, p_ip_hash text, p_marketing boolean)
RETURNS TABLE(status text, user_id uuid, org_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kira_beta_seats'));
  IF EXISTS (SELECT 1 FROM auth.google_identity g WHERE g.sub = p_sub)
     OR EXISTS (SELECT 1 FROM auth.user_account u WHERE u.email_norm = p_email_norm OR lower(u.email) = lower(p_email)) THEN
    DELETE FROM auth.signup s WHERE s.email_norm = p_email_norm;
    RETURN QUERY SELECT 'taken'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM auth.beta_seat) >= p_seats THEN
    RETURN QUERY SELECT 'full'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  v_org := gen_random_uuid();
  v_user := gen_random_uuid();
  INSERT INTO public.org (id, name) VALUES (v_org, 'Keluarga Anda');
  INSERT INTO auth.user_account (id, org_id, kind, role, email, email_norm, name, password_hash, password_changed_at, marketing_opt_in, marketing_opt_in_at, marketing_notice_version, marketing_token)
    VALUES (v_user, v_org, 'adult', 'guardian', p_email, p_email_norm, p_name, NULL, NULL, p_marketing,
      CASE WHEN p_marketing THEN now() END,
      CASE WHEN p_marketing THEN p_notice_version END,
      CASE WHEN p_marketing THEN replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') END);
  INSERT INTO auth.google_identity (sub, user_id) VALUES (p_sub, v_user);
  INSERT INTO public.member_profile (user_id, org_id, name, role, email) VALUES (v_user, v_org, p_name, 'guardian', p_email);
  INSERT INTO auth.beta_seat (org_id, user_id, email_norm) VALUES (v_org, v_user, p_email_norm);
  INSERT INTO public.audit_log (org_id, actor_id, actor_kind, action, target, meta) VALUES
    (v_org, v_user, 'guardian', 'org.created', v_org::text, '{"source":"google"}'::jsonb),
    (v_org, v_user, 'guardian', 'terms.accepted', v_user::text,
      jsonb_build_object('termsVersion', p_terms_version, 'noticeVersion', p_notice_version, 'ipHash', p_ip_hash));
  IF p_marketing THEN
    INSERT INTO public.audit_log (org_id, actor_id, actor_kind, action, target, meta) VALUES
      (v_org, v_user, 'guardian', 'marketing.opted-in', v_user::text, jsonb_build_object('noticeVersion', p_notice_version, 'via', 'google'));
  END IF;
  UPDATE auth.waitlist w SET converted_at = now() WHERE w.email_norm = p_email_norm;
  DELETE FROM auth.signup s WHERE s.email_norm = p_email_norm;
  RETURN QUERY SELECT 'ok'::text, v_user, v_org;
EXCEPTION WHEN unique_violation THEN
  -- Undangan keluarga membuat akun di luar kunci ini: bila menang balapan untuk email yang sama, perlakukan sebagai sudah ada.
  RETURN QUERY SELECT 'taken'::text, NULL::uuid, NULL::uuid;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION kira_google_signup(text, text, text, text, integer, text, text, text, boolean) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kira_google_signup(text, text, text, text, integer, text, text, text, boolean) TO kira_auth;
