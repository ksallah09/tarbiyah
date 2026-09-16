-- Ensure linked_tree_id column exists on family_trees
-- This links a duplicate tree (joiner's child) to its canonical tree (partner's child)
-- after the child-merge step. Rows with linked_tree_id set are hidden in the UI.
ALTER TABLE family_trees ADD COLUMN IF NOT EXISTS linked_tree_id TEXT REFERENCES family_trees(child_id);

-- RLS: allow family members to read, insert, and update trees in their shared family
-- (run these only if the policies don't already exist)

ALTER TABLE family_trees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_trees' AND policyname = 'trees_select'
  ) THEN
    CREATE POLICY "trees_select" ON family_trees FOR SELECT
      USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_trees' AND policyname = 'trees_insert'
  ) THEN
    CREATE POLICY "trees_insert" ON family_trees FOR INSERT
      WITH CHECK (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_trees' AND policyname = 'trees_update'
  ) THEN
    CREATE POLICY "trees_update" ON family_trees FOR UPDATE
      USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
  END IF;
END $$;
