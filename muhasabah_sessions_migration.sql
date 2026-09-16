-- Muhasabah sessions and config — RLS and policies
-- Safe to re-run: drops and recreates policies so the correct version always applies.

ALTER TABLE muhasabah_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE muhasabah_config   ENABLE ROW LEVEL SECURITY;

-- ── muhasabah_sessions ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "muhasabah_sessions_family_read" ON muhasabah_sessions;
DROP POLICY IF EXISTS "muhasabah_sessions_select"      ON muhasabah_sessions;

-- Own sessions always readable; partner sessions readable when in the same family.
CREATE POLICY "muhasabah_sessions_select" ON muhasabah_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT fm2.user_id
      FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "muhasabah_sessions_insert" ON muhasabah_sessions;
CREATE POLICY "muhasabah_sessions_insert" ON muhasabah_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "muhasabah_sessions_update" ON muhasabah_sessions;
CREATE POLICY "muhasabah_sessions_update" ON muhasabah_sessions FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT fm2.user_id
      FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
    )
  );

-- ── muhasabah_config ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "muhasabah_config_family_read"   ON muhasabah_config;
DROP POLICY IF EXISTS "muhasabah_config_select"        ON muhasabah_config;

CREATE POLICY "muhasabah_config_select" ON muhasabah_config FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT fm2.user_id
      FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "muhasabah_config_insert" ON muhasabah_config;
CREATE POLICY "muhasabah_config_insert" ON muhasabah_config FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "muhasabah_config_update" ON muhasabah_config;
CREATE POLICY "muhasabah_config_update" ON muhasabah_config FOR UPDATE
  USING (user_id = auth.uid());
