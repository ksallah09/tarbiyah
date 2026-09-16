-- User-specific generated conversation cards
-- Each user can generate their own cards via AI; they never appear in the shared deck.

CREATE TABLE IF NOT EXISTS user_conversation_cards (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck       text        NOT NULL,
  question   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_conversation_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ucc_select" ON user_conversation_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ucc_insert" ON user_conversation_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ucc_delete" ON user_conversation_cards FOR DELETE USING (user_id = auth.uid());
