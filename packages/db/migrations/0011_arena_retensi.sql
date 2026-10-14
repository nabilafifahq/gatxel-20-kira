-- Kira: retensi rincian ronde arena (arena_session) 90 hari.
-- Sebelum dihapus, ronde yang sudah selesai dan lebih tua dari 90 hari diringkas ke arena_state.rolled
-- (jumlah ronde, rekor, ronde sempurna), jadi rekor, lencana, dan jumlah ronde tidak mundur.
-- Ronde yang tidak pernah selesai juga dihapus pada batas yang sama.

ALTER TABLE arena_state ADD COLUMN IF NOT EXISTS rolled jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION kira_retention() RETURNS TABLE(path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
  r record;
  old jsonb;
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

  -- Ringkas ronde arena yang akan dihapus ke arena_state.rolled.
  FOR r IN
    SELECT s.org_id, s.learner_id, s.arena,
           (count(*) FILTER (WHERE s.arena = 'hitung' OR s.mode IN ('quiz', 'speed')))::int AS n,
           max(s.ppm) FILTER (WHERE s.mode IN ('sprint60', 'sprint120') AND s.answered >= 10 AND s.correct::float / nullif(s.answered, 0) >= 0.8) AS best_ppm,
           coalesce(bool_or(s.mode IN ('sprint60', 'sprint120') AND s.answered >= 15 AND s.correct = s.answered), false) AS perfect_sprint,
           min(s.duration_ms) FILTER (WHERE s.mode = 'target20' AND s.answered = 20 AND s.correct = 20) AS best_target_ms,
           max(s.correct) FILTER (WHERE s.mode = 'speed') AS speed_best,
           coalesce(bool_or(s.mode = 'quiz' AND s.answered >= 10 AND s.correct = s.answered), false) AS perfect_quiz
      FROM arena_session s
     WHERE s.finished_at IS NOT NULL AND s.started_at < now() - interval '90 days'
     GROUP BY s.org_id, s.learner_id, s.arena
  LOOP
    SELECT coalesce(a.rolled, '{}'::jsonb) INTO old FROM arena_state a WHERE a.learner_id = r.learner_id AND a.arena = r.arena;
    old := coalesce(old, '{}'::jsonb);
    INSERT INTO arena_state (org_id, learner_id, arena, data, rolled, updated_at)
    VALUES (r.org_id, r.learner_id, r.arena, '{}'::jsonb, jsonb_strip_nulls(jsonb_build_object(
      'rounds', coalesce((old->>'rounds')::int, 0) + r.n,
      'bestSprintPpm', CASE WHEN r.best_ppm IS NULL AND old->'bestSprintPpm' IS NULL THEN NULL ELSE to_jsonb(greatest(coalesce(r.best_ppm, 0), coalesce((old->>'bestSprintPpm')::real, 0))) END,
      'perfectSprint', r.perfect_sprint OR coalesce((old->>'perfectSprint')::boolean, false),
      'bestTargetMs', CASE WHEN r.best_target_ms IS NULL AND old->'bestTargetMs' IS NULL THEN NULL ELSE to_jsonb(least(coalesce(r.best_target_ms, 2147483647), coalesce((old->>'bestTargetMs')::int, 2147483647))) END,
      'speedBest', greatest(coalesce(r.speed_best, 0), coalesce((old->>'speedBest')::int, 0)),
      'perfectQuiz', r.perfect_quiz OR coalesce((old->>'perfectQuiz')::boolean, false)
    )), now())
    ON CONFLICT (learner_id, arena) DO UPDATE SET rolled = EXCLUDED.rolled;
  END LOOP;
  DELETE FROM arena_session s WHERE s.started_at < now() - interval '90 days';

  RETURN QUERY
    WITH d AS (
      DELETE FROM media m
        WHERE m.expires_at < now()
           OR (m.kind IN ('audio', 'image', 'drawing') AND m.learner_id IS NOT NULL AND m.created_at < now() - interval '90 days')
        RETURNING m.path AS p
    )
    SELECT d.p FROM d;
END $$;
