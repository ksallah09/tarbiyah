-- Shukr Posts: family gratitude moments
CREATE TABLE IF NOT EXISTS shukr_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id),
  child_id    TEXT,
  child_name  TEXT,
  text        TEXT        NOT NULL DEFAULT '',
  theme       TEXT,
  ayah_ref    TEXT,
  ayah_text   TEXT,
  photo_url   TEXT,
  loved_by    TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shukr_posts ENABLE ROW LEVEL SECURITY;

-- Family members can read posts in their family
CREATE POLICY "shukr_posts_select" ON shukr_posts FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Users can only insert their own posts
CREATE POLICY "shukr_posts_insert" ON shukr_posts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Any family member can update (needed for loved_by reactions from partner)
CREATE POLICY "shukr_posts_update" ON shukr_posts FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Add video support
ALTER TABLE shukr_posts ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Allow users to delete their own posts
CREATE POLICY IF NOT EXISTS "shukr_posts_delete" ON shukr_posts FOR DELETE
  USING (user_id = auth.uid());
