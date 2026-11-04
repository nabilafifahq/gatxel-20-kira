-- Nama keluarga baru memakai kata netral. Kata pertama nama orang tua sering berupa sapaan ("Ibu Sari" menjadi "Keluarga Ibu").
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

-- Keluarga pendaftar yang masih memakai nama otomatis lama ikut berganti. Keluarga bertutor tidak punya kursi, jadi tidak tersentuh.
UPDATE public.org o SET name = 'Keluarga Anda'
FROM auth.beta_seat b JOIN auth.user_account u ON u.id = b.user_id
WHERE o.id = b.org_id AND o.name = left('Keluarga ' || split_part(btrim(u.name), ' ', 1), 80);
