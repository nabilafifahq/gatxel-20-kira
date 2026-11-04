-- Kode keluarga: anak bisa masuk langsung di browser (iPhone, iPad) dengan kode ini, namanya, dan PIN gambar.
-- Hanya menambah tabel, fungsi, dan pemicu. Setiap org yang ada mendapat satu kode, jadi aman untuk data produksi.
-- Kode sendiri tidak memberi akses ke anak; PIN dan kuncinya tetap berlaku.
CREATE TABLE family_code (
  org_id uuid PRIMARY KEY REFERENCES org(id) ON DELETE CASCADE,
  code text NOT NULL CONSTRAINT family_code_format_ck CHECK (code ~ '^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX family_code_code_uq ON family_code (code);
--> statement-breakpoint
ALTER TABLE family_code ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE family_code FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Orang dewasa di org itu boleh membaca kodenya. Sesi anak tidak. Tulisan hanya lewat fungsi definer di bawah.
CREATE POLICY family_code_adult_read ON family_code FOR SELECT TO kira_app
  USING (org_id = app_org_id() AND app_role() IN ('tutor', 'guardian'));
--> statement-breakpoint
GRANT SELECT ON family_code TO kira_app;
--> statement-breakpoint

-- Delapan karakter acak dari 28: tanpa 0, O, 1, I, L, dan tanpa huruf vokal supaya tidak membentuk kata yang tidak pantas.
-- gen_random_uuid memakai sumber acak kuat. Byte versi dan varian dilewati. Byte di atas 251 dibuang supaya sebaran rata.
CREATE FUNCTION kira_new_family_code() RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE
  alphabet constant text := '23456789BCDFGHJKMNPQRSTVWXYZ';
  out_code text := '';
  raw bytea;
  b integer;
  i integer;
BEGIN
  WHILE length(out_code) < 8 LOOP
    raw := uuid_send(gen_random_uuid());
    FOREACH i IN ARRAY ARRAY[0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15] LOOP
      b := get_byte(raw, i);
      IF b < 252 AND length(out_code) < 8 THEN
        out_code := out_code || substr(alphabet, (b % 28) + 1, 1);
      END IF;
    END LOOP;
  END LOOP;
  RETURN out_code;
END $$;
--> statement-breakpoint

-- Pasang kode baru untuk satu org. Kode lama langsung berhenti berlaku; perangkat yang sudah terdaftar tidak tersentuh.
CREATE FUNCTION kira_rotate_family_code(p_org uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org WHERE id = p_org) THEN
    RETURN NULL;
  END IF;
  FOR attempt IN 1..20 LOOP
    v_code := kira_new_family_code();
    BEGIN
      INSERT INTO family_code (org_id, code) VALUES (p_org, v_code)
      ON CONFLICT (org_id) DO UPDATE SET code = EXCLUDED.code, rotated_at = now();
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- Kode sudah dipakai keluarga lain: coba kode baru.
    END;
  END LOOP;
  RAISE EXCEPTION 'kode keluarga tidak bisa dibuat';
END $$;
--> statement-breakpoint

-- Satu-satunya jalan dari kode ke keluarga untuk permintaan tanpa sesi. Hanya mengembalikan id org yang cocok persis.
CREATE FUNCTION kira_org_by_family_code(p_code text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT f.org_id FROM family_code f WHERE f.code = p_code
$$;
--> statement-breakpoint

-- Keluarga baru dari jalur mana pun (daftar, setup, seed) langsung punya kode.
CREATE FUNCTION kira_org_family_code_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM kira_rotate_family_code(NEW.id);
  UPDATE family_code SET rotated_at = NULL WHERE org_id = NEW.id;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER org_family_code AFTER INSERT ON org FOR EACH ROW EXECUTE FUNCTION kira_org_family_code_trg();
--> statement-breakpoint

REVOKE ALL ON FUNCTION kira_new_family_code(), kira_rotate_family_code(uuid), kira_org_by_family_code(text), kira_org_family_code_trg() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kira_org_by_family_code(text), kira_rotate_family_code(uuid) TO kira_auth;
--> statement-breakpoint

-- Keluarga yang sudah ada.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM org LOOP
    PERFORM kira_rotate_family_code(r.id);
  END LOOP;
  UPDATE family_code SET rotated_at = NULL;
END $$;
