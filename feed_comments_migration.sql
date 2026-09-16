CREATE TABLE IF NOT EXISTS feed_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   TEXT        NOT NULL,
  post_id     UUID        NOT NULL,
  post_type   TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id),
  author_name TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_comments_select" ON feed_comments FOR SELECT
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE POLICY "feed_comments_insert" ON feed_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_comments_delete" ON feed_comments FOR DELETE
  USING (user_id = auth.uid());
