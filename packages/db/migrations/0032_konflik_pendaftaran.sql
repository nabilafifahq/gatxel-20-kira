-- Pendaftaran kedua untuk email yang masih menunggu konfirmasi tidak lagi menimpa password atau nama. Bila passwordnya
-- berbeda, baris diberi tanda conflict: tautan tidak mengaktifkan akun langsung, pemegang tautan membuat password baru dulu.
-- Tabel ini sudah memakai RLS dan GRANT per tabel (0012), jadi kolom baru ikut aturan yang sama.
ALTER TABLE auth.signup ADD COLUMN conflict boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- Parameter baru punya nilai bawaan, jadi kode lama yang memanggil dengan dua argumen tetap jalan selama pembaruan.
DROP FUNCTION kira_verify_signup(text, integer);
--> statement-breakpoint

CREATE FUNCTION kira_verify_signup(p_token_hash text, p_seats integer, p_new_password_hash text DEFAULT NULL)
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
  -- Ada pendaftaran dengan password berbeda: tanpa password baru tidak ada yang berubah, token dan kursi tetap utuh.
  IF s.conflict AND p_new_password_hash IS NULL THEN
    RETURN QUERY SELECT 'needs-password'::text, NULL::uuid, NULL::uuid;
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
  -- Baris bertanda memakai password baru, jadi semua password dari formulir daftar mati di transaksi yang sama.
  INSERT INTO auth.user_account (id, org_id, kind, role, email, email_norm, name, password_hash, password_changed_at)
    VALUES (v_user, v_org, 'adult', 'guardian', s.email, s.email_norm, s.name, CASE WHEN s.conflict THEN p_new_password_hash ELSE s.password_hash END, now());
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

REVOKE ALL ON FUNCTION kira_verify_signup(text, integer, text) FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kira_verify_signup(text, integer, text) TO kira_auth;
