-- General accomplishments: feed-only, not tied to a tree
CREATE TABLE IF NOT EXISTS family_accomplishments (
  id          TEXT        PRIMARY KEY DEFAULT 'fa_' || gen_random_uuid()::text,
  family_id   TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id),
  child_id    TEXT,
  child_name  TEXT,
  manner      TEXT,
  note        TEXT,
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  loved_by    TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE family_accomplishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fam_acc_select" ON family_accomplishments FOR SELECT
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE POLICY "fam_acc_insert" ON family_accomplishments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "fam_acc_update" ON family_accomplishments FOR UPDATE
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
