-- Heads Up — user-browsable content packs
-- Each pack appears as a new category once a user adds it.

CREATE TABLE IF NOT EXISTS headsup_packs (
  id          text        PRIMARY KEY,
  title       text        NOT NULL,
  description text        NOT NULL,
  emoji       text        NOT NULL,
  color       text        NOT NULL,
  card_count  int         NOT NULL DEFAULT 0,
  is_free     boolean     NOT NULL DEFAULT true,
  sort_order  int         NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS headsup_pack_cards (
  id      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id text    NOT NULL REFERENCES headsup_packs(id) ON DELETE CASCADE,
  word    text    NOT NULL
);

CREATE TABLE IF NOT EXISTS user_headsup_packs (
  user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id  text        NOT NULL REFERENCES headsup_packs(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pack_id)
);

-- Public read for packs and their cards
ALTER TABLE headsup_packs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE headsup_pack_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_headsup_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packs_read"      ON headsup_packs      FOR SELECT USING (active = true);
CREATE POLICY "pack_cards_read" ON headsup_pack_cards  FOR SELECT USING (true);
CREATE POLICY "user_packs_read"   ON user_headsup_packs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_packs_insert" ON user_headsup_packs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_packs_delete" ON user_headsup_packs FOR DELETE USING (user_id = auth.uid());

-- ── Seed packs ────────────────────────────────────────────────────────────────

INSERT INTO headsup_packs (id, title, description, emoji, color, card_count, sort_order) VALUES
  ('women_of_islam',    'Women of Islam',    'The remarkable women who shaped Islamic history — from the earliest believers to modern trailblazers.',  '🌸', '#8B3A62', 20, 1),
  ('names_of_allah',    'Names of Allah',    'The beautiful names of Allah (Asma ul Husna) — can your family describe each one without saying it?',     '✨', '#1A3A6B', 25, 2),
  ('islamic_scholars',  'Islamic Scholars',  'Great Muslim scholars, jurists, and thinkers who preserved and spread Islamic knowledge across centuries.', '📚', '#2D4A1B', 18, 3),
  ('holy_places',       'Holy Places',       'Sacred sites, mosques, and landmarks from Islamic history around the world.',                              '🕌', '#5C3317', 16, 4)
ON CONFLICT (id) DO NOTHING;

-- ── Women of Islam ────────────────────────────────────────────────────────────

INSERT INTO headsup_pack_cards (pack_id, word) VALUES
  ('women_of_islam', 'Khadijah bint Khuwaylid'),
  ('women_of_islam', 'Aisha bint Abi Bakr'),
  ('women_of_islam', 'Fatimah bint Muhammad'),
  ('women_of_islam', 'Maryam (Mary)'),
  ('women_of_islam', 'Asiya (Pharaoh''s wife)'),
  ('women_of_islam', 'Hafsa bint Umar'),
  ('women_of_islam', 'Umm Salamah'),
  ('women_of_islam', 'Sumayyah bint Khayyat'),
  ('women_of_islam', 'Nusayba bint Kab'),
  ('women_of_islam', 'Asma bint Abi Bakr'),
  ('women_of_islam', 'Zaynab bint Muhammad'),
  ('women_of_islam', 'Hajar (Hagar)'),
  ('women_of_islam', 'Ruqayyah bint Muhammad'),
  ('women_of_islam', 'Umm Habiba'),
  ('women_of_islam', 'Umm Ayman'),
  ('women_of_islam', 'Fatima al-Fihri'),
  ('women_of_islam', 'Bilqis (Queen of Sheba)'),
  ('women_of_islam', 'Maryam Mirzakhani'),
  ('women_of_islam', 'Zainab bint Ali'),
  ('women_of_islam', 'Safiyyah bint Huyayy');

-- ── Names of Allah ────────────────────────────────────────────────────────────

INSERT INTO headsup_pack_cards (pack_id, word) VALUES
  ('names_of_allah', 'Ar-Rahman (The Most Gracious)'),
  ('names_of_allah', 'Ar-Raheem (The Most Merciful)'),
  ('names_of_allah', 'Al-Malik (The King)'),
  ('names_of_allah', 'Al-Quddus (The Most Holy)'),
  ('names_of_allah', 'As-Salam (The Source of Peace)'),
  ('names_of_allah', 'Al-Mu''min (The Guardian of Faith)'),
  ('names_of_allah', 'Al-Aziz (The Almighty)'),
  ('names_of_allah', 'Al-Jabbar (The Compeller)'),
  ('names_of_allah', 'Al-Khaliq (The Creator)'),
  ('names_of_allah', 'Al-Ghaffar (The Repeatedly Forgiving)'),
  ('names_of_allah', 'Ar-Razzaq (The Provider)'),
  ('names_of_allah', 'Al-Fattah (The Opener)'),
  ('names_of_allah', 'Al-Alim (The All-Knowing)'),
  ('names_of_allah', 'As-Sami (The All-Hearing)'),
  ('names_of_allah', 'Al-Basir (The All-Seeing)'),
  ('names_of_allah', 'Al-Latif (The Subtle One)'),
  ('names_of_allah', 'Al-Khabir (The All-Aware)'),
  ('names_of_allah', 'Al-Halim (The Forbearing)'),
  ('names_of_allah', 'Al-Azeem (The Magnificent)'),
  ('names_of_allah', 'Al-Ghafur (The Forgiving)'),
  ('names_of_allah', 'Al-Shakur (The Appreciative)'),
  ('names_of_allah', 'Al-Aliyy (The Most High)'),
  ('names_of_allah', 'Al-Hafiz (The Preserver)'),
  ('names_of_allah', 'Al-Wadud (The Loving)'),
  ('names_of_allah', 'Al-Haqq (The Truth)');

-- ── Islamic Scholars ──────────────────────────────────────────────────────────

INSERT INTO headsup_pack_cards (pack_id, word) VALUES
  ('islamic_scholars', 'Imam Malik'),
  ('islamic_scholars', 'Imam Shafi''i'),
  ('islamic_scholars', 'Imam Ahmad ibn Hanbal'),
  ('islamic_scholars', 'Imam Abu Hanifa'),
  ('islamic_scholars', 'Ibn Taymiyyah'),
  ('islamic_scholars', 'Ibn al-Qayyim'),
  ('islamic_scholars', 'Imam al-Nawawi'),
  ('islamic_scholars', 'Ibn Hajar al-Asqalani'),
  ('islamic_scholars', 'Imam al-Bukhari'),
  ('islamic_scholars', 'Imam Muslim'),
  ('islamic_scholars', 'Al-Ghazali'),
  ('islamic_scholars', 'Ibn Kathir'),
  ('islamic_scholars', 'Ibn Rushd (Averroes)'),
  ('islamic_scholars', 'Ibn Sina (Avicenna)'),
  ('islamic_scholars', 'Al-Khawarizmi'),
  ('islamic_scholars', 'Al-Biruni'),
  ('islamic_scholars', 'Fatima al-Fihri'),
  ('islamic_scholars', 'Ibn Battuta');

-- ── Holy Places ───────────────────────────────────────────────────────────────

INSERT INTO headsup_pack_cards (pack_id, word) VALUES
  ('holy_places', 'Masjid al-Haram'),
  ('holy_places', 'Masjid al-Nabawi'),
  ('holy_places', 'Al-Aqsa Mosque'),
  ('holy_places', 'Dome of the Rock'),
  ('holy_places', 'Cave of Hira'),
  ('holy_places', 'Cave of Thawr'),
  ('holy_places', 'Mount Arafat'),
  ('holy_places', 'Mina'),
  ('holy_places', 'Muzdalifah'),
  ('holy_places', 'Masjid Quba'),
  ('holy_places', 'Safa and Marwa'),
  ('holy_places', 'Zamzam Well'),
  ('holy_places', 'Jannat al-Baqi'),
  ('holy_places', 'Masjid al-Qiblatayn'),
  ('holy_places', 'Cordoba Mosque'),
  ('holy_places', 'Blue Mosque (Istanbul)');
