-- Allow any family member to insert and update family_children rows within their
-- shared family. Both are needed so the joining partner can upsert the canonical
-- child row during the child merge step — without INSERT, a missing canonical row
-- can't be created; without UPDATE, linked_child_id silently stays NULL.

-- Unique constraint on child_id so upsert ON CONFLICT works during child merge
ALTER TABLE family_children ADD CONSTRAINT family_children_child_id_key UNIQUE (child_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_children' AND policyname = 'family_children_family_update'
  ) THEN
    CREATE POLICY "family_children_family_update" ON family_children FOR UPDATE
      USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'family_children' AND policyname = 'family_children_family_insert'
  ) THEN
    CREATE POLICY "family_children_family_insert" ON family_children FOR INSERT
      WITH CHECK (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
  END IF;
END $$;
