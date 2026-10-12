-- Kira: retensi data harian, dipanggil worker setiap 03.15 WIB.
-- SECURITY DEFINER (pemilik kira_owner, BYPASSRLS) karena bekerja lintas org dan menyentuh skema auth.
-- Mengembalikan path berkas media yang barisnya dihapus; worker menghapus berkasnya dari KIRA_DATA_DIR.
--
-- Yang dihapus:
--   auth.login_attempt          lebih dari 30 hari
--   auth.session                dicabut atau kedaluwarsa lebih dari 7 hari lalu
--   auth.reset_token            dipakai atau kedaluwarsa lebih dari 1 hari lalu
--   auth.webauthn_challenge     sudah kedaluwarsa
--   auth.invite                 kedaluwarsa lebih dari 30 hari lalu
--   audit_log                   lebih dari 12 bulan
--   outbox_email                lebih dari 90 hari
--   job                         done atau failed, selesai lebih dari 30 hari lalu
--   member_profile dan akun auth orang dewasa yang dikeluarkan (removed_at) lebih dari 30 hari lalu
--   media                       expires_at lewat, atau audio/image/drawing milik learner berumur lebih dari 90 hari

CREATE OR REPLACE FUNCTION kira_retention() RETURNS TABLE(path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  DELETE FROM auth.login_attempt la WHERE la.at < now() - interval '30 days';
  DELETE FROM auth.session s
    WHERE (s.revoked_at IS NOT NULL AND s.revoked_at < now() - interval '7 days')
       OR s.expires_at < now() - interval '7 days';
  DELETE FROM auth.reset_token rt
    WHERE (rt.used_at IS NOT NULL AND rt.used_at < now() - interval '1 day')
       OR rt.expires_at < now() - interval '1 day';
  DELETE FROM auth.webauthn_challenge wc WHERE wc.expires_at < now();
  DELETE FROM auth.invite i WHERE i.expires_at < now() - interval '30 days';
  DELETE FROM audit_log a WHERE a.created_at < now() - interval '12 months';
  DELETE FROM outbox_email o WHERE o.created_at < now() - interval '90 days';
  DELETE FROM job j
    WHERE j.status IN ('done', 'failed') AND coalesce(j.finished_at, j.created_at) < now() - interval '30 days';
  WITH gone AS (
    DELETE FROM member_profile mp
      WHERE mp.removed_at IS NOT NULL AND mp.removed_at < now() - interval '30 days'
      RETURNING mp.user_id, mp.org_id
  )
  DELETE FROM auth.user_account u USING gone g
    WHERE u.id = g.user_id AND u.org_id = g.org_id AND u.kind = 'adult';
  RETURN QUERY
    WITH d AS (
      DELETE FROM media m
        WHERE m.expires_at < now()
           OR (m.kind IN ('audio', 'image', 'drawing') AND m.learner_id IS NOT NULL AND m.created_at < now() - interval '90 days')
        RETURNING m.path AS p
    )
    SELECT d.p FROM d;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION kira_retention() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_retention() TO kira_worker;
