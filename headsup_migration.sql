-- Islamic Heads Up — categories and cards
-- Seeded with all bundled content so the app immediately falls back to server data.
-- Add new categories/cards here anytime — no app update needed.

CREATE TABLE IF NOT EXISTS headsup_categories (
  id         text        PRIMARY KEY,
  label      text        NOT NULL,
  emoji      text        NOT NULL,
  color      text        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS headsup_cards (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text    NOT NULL REFERENCES headsup_categories(id) ON DELETE CASCADE,
  word        text    NOT NULL
);

-- Add active column if it wasn't there on first creation
ALTER TABLE headsup_categories ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE headsup_cards      ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Public read — curated content, same for all users
ALTER TABLE headsup_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE headsup_cards      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "headsup_categories_read" ON headsup_categories;
DROP POLICY IF EXISTS "headsup_cards_read"      ON headsup_cards;
CREATE POLICY "headsup_categories_read" ON headsup_categories FOR SELECT USING (active = true);
CREATE POLICY "headsup_cards_read"      ON headsup_cards      FOR SELECT USING (active = true);

-- ── Seed categories ───────────────────────────────────────────────────────────

INSERT INTO headsup_categories (id, label, emoji, color, sort_order) VALUES
  ('prophets',   'Prophets',        '🌙', '#1B3D2F', 1),
  ('companions', 'Companions',      '⭐', '#2E5B8E', 2),
  ('seerah',     'Seerah',          '📜', '#7C3D1B', 3),
  ('quran',      'Qur''an',         '📖', '#1B5E20', 4),
  ('vocab',      'Islamic Vocab',   '🔤', '#5B3D8E', 5),
  ('who_am_i',   'Who Am I?',       '🤔', '#8E3D1B', 6),
  ('character',  'Good Character',  '💛', '#7A6000', 7),
  ('ramadan',    'Ramadan',         '🌙', '#003366', 8),
  ('kids',       'Easy Kids',       '🌟', '#2E7D62', 9)
ON CONFLICT (id) DO NOTHING;

-- ── Seed cards ────────────────────────────────────────────────────────────────

INSERT INTO headsup_cards (category_id, word) VALUES
  -- Prophets
  ('prophets', 'Adam'), ('prophets', 'Nuh'), ('prophets', 'Ibrahim'),
  ('prophets', 'Ismail'), ('prophets', 'Ishaq'), ('prophets', 'Yaqub'),
  ('prophets', 'Yusuf'), ('prophets', 'Musa'), ('prophets', 'Harun'),
  ('prophets', 'Dawud'), ('prophets', 'Sulayman'), ('prophets', 'Ayyub'),
  ('prophets', 'Yunus'), ('prophets', 'Isa'), ('prophets', 'Muhammad'),
  ('prophets', 'Idris'), ('prophets', 'Hud'), ('prophets', 'Salih'),
  ('prophets', 'Lut'), ('prophets', 'Shuayb'), ('prophets', 'Ilyas'),
  ('prophets', 'Al-Yasa'), ('prophets', 'Dhul-Kifl'),
  ('prophets', 'Zakariyya'), ('prophets', 'Yahya'),

  -- Companions
  ('companions', 'Abu Bakr'), ('companions', 'Umar ibn al-Khattab'),
  ('companions', 'Uthman ibn Affan'), ('companions', 'Ali ibn Abi Talib'),
  ('companions', 'Bilal ibn Rabah'), ('companions', 'Khadijah'),
  ('companions', 'Aisha'), ('companions', 'Fatimah'), ('companions', 'Hamzah'),
  ('companions', 'Khalid ibn al-Walid'), ('companions', 'Abu Hurayrah'),
  ('companions', 'Anas ibn Malik'), ('companions', 'Abdullah ibn Masud'),
  ('companions', 'Salman al-Farisi'), ('companions', 'Sumayyah'),
  ('companions', 'Ammar ibn Yasir'), ('companions', 'Zayd ibn Harithah'),
  ('companions', 'Muadh ibn Jabal'), ('companions', 'Abdur-Rahman ibn Awf'),
  ('companions', 'Sad ibn Abi Waqqas'), ('companions', 'Talha'),
  ('companions', 'Zubayr ibn al-Awwam'), ('companions', 'Umm Salamah'),
  ('companions', 'Hafsa'), ('companions', 'Ruqayyah'),

  -- Seerah
  ('seerah', 'Hijrah'), ('seerah', 'Battle of Badr'), ('seerah', 'Battle of Uhud'),
  ('seerah', 'Battle of Khandaq'), ('seerah', 'Conquest of Makkah'),
  ('seerah', 'Treaty of Hudaybiyah'), ('seerah', 'Year of Grief'),
  ('seerah', 'Cave of Hira'), ('seerah', 'Cave of Thawr'),
  ('seerah', 'Night Journey (Isra & Miraj)'), ('seerah', 'First Revelation'),
  ('seerah', 'Masjid al-Nabawi'), ('seerah', 'Constitution of Madinah'),
  ('seerah', 'Farewell Sermon'), ('seerah', 'Battle of Tabuk'),
  ('seerah', 'Pledge of Aqabah'), ('seerah', 'Masjid al-Qiblatayn'),
  ('seerah', 'Zamzam Well'), ('seerah', 'Abyssinia (Habasha)'),
  ('seerah', 'Year of the Elephant'),

  -- Quran
  ('quran', 'Al-Fatiha'), ('quran', 'Al-Baqarah'), ('quran', 'Al-Imran'),
  ('quran', 'An-Nisa'), ('quran', 'Al-Maidah'), ('quran', 'Al-Kahf'),
  ('quran', 'Yasin'), ('quran', 'Ar-Rahman'), ('quran', 'Al-Mulk'),
  ('quran', 'Al-Ikhlas'), ('quran', 'Al-Falaq'), ('quran', 'An-Nas'),
  ('quran', 'Al-Asr'), ('quran', 'Al-Kawthar'), ('quran', 'Al-Fil'),
  ('quran', 'Al-Fajr'), ('quran', 'Al-Waqiah'), ('quran', 'Ayat al-Kursi'),
  ('quran', 'Juz Amma'), ('quran', 'Surah Yusuf'), ('quran', 'Surah Maryam'),
  ('quran', 'Al-Jinn'), ('quran', 'Al-Insan'), ('quran', 'Al-Qiyamah'),
  ('quran', 'Al-Naba'),

  -- Islamic Vocab
  ('vocab', 'Salah'), ('vocab', 'Zakat'), ('vocab', 'Sawm'),
  ('vocab', 'Hajj'), ('vocab', 'Shahada'), ('vocab', 'Tawakkul'),
  ('vocab', 'Sabr'), ('vocab', 'Shukr'), ('vocab', 'Tawbah'),
  ('vocab', 'Ikhlas'), ('vocab', 'Taqwa'), ('vocab', 'Iman'),
  ('vocab', 'Islam'), ('vocab', 'Ihsan'), ('vocab', 'Ummah'),
  ('vocab', 'Baraka'), ('vocab', 'Rizq'), ('vocab', 'Dua'),
  ('vocab', 'Dhikr'), ('vocab', 'Khushu'), ('vocab', 'Fitrah'),
  ('vocab', 'Akhlaq'), ('vocab', 'Amanah'), ('vocab', 'Adl'),
  ('vocab', 'Rahmah'), ('vocab', 'Jannah'), ('vocab', 'Jahannam'),
  ('vocab', 'Barzakh'), ('vocab', 'Qiblah'), ('vocab', 'Wudu'),

  -- Who Am I?
  ('who_am_i', 'Saladin'), ('who_am_i', 'Ibn Battuta'),
  ('who_am_i', 'Al-Khawarizmi'), ('who_am_i', 'Rumi'),
  ('who_am_i', 'Ibn Rushd'), ('who_am_i', 'Ibn Sina'),
  ('who_am_i', 'Al-Ghazali'), ('who_am_i', 'Tariq ibn Ziyad'),
  ('who_am_i', 'Umar ibn Abd al-Aziz'), ('who_am_i', 'Malcolm X'),
  ('who_am_i', 'Muhammad Ali'), ('who_am_i', 'Maryam Mirzakhani'),
  ('who_am_i', 'Al-Biruni'), ('who_am_i', 'Ibn Khaldun'),
  ('who_am_i', 'Fatima al-Fihri'), ('who_am_i', 'Nusayba bint Kab'),
  ('who_am_i', 'Harun al-Rashid'), ('who_am_i', 'Suleiman the Magnificent'),

  -- Good Character
  ('character', 'Honesty'), ('character', 'Kindness'), ('character', 'Patience'),
  ('character', 'Gratitude'), ('character', 'Generosity'), ('character', 'Humility'),
  ('character', 'Courage'), ('character', 'Justice'), ('character', 'Forgiveness'),
  ('character', 'Respect'), ('character', 'Loyalty'), ('character', 'Trustworthiness'),
  ('character', 'Modesty'), ('character', 'Compassion'), ('character', 'Perseverance'),
  ('character', 'Mercy'), ('character', 'Sincerity'), ('character', 'Wisdom'),
  ('character', 'Self-control'), ('character', 'Fairness'),

  -- Ramadan
  ('ramadan', 'Iftar'), ('ramadan', 'Suhoor'), ('ramadan', 'Tarawih'),
  ('ramadan', 'Laylat al-Qadr'), ('ramadan', 'Itikaf'), ('ramadan', 'Sadaqah'),
  ('ramadan', 'Eid al-Fitr'), ('ramadan', 'Zakat al-Fitr'), ('ramadan', 'Fasting'),
  ('ramadan', 'Niyyah'), ('ramadan', 'Crescent Moon'), ('ramadan', 'Dates'),
  ('ramadan', 'Zamzam'), ('ramadan', 'Quran Recitation'), ('ramadan', 'Dhikr'),
  ('ramadan', 'Tahajjud'), ('ramadan', 'Dua at Iftar'),
  ('ramadan', 'Haram to eat during the day'), ('ramadan', 'Charity'),
  ('ramadan', 'Reflection'),

  -- Easy Kids
  ('kids', 'Masjid'), ('kids', 'Prayer mat'), ('kids', 'Hijab'),
  ('kids', 'Quran'), ('kids', 'Bismillah'), ('kids', 'Alhamdulillah'),
  ('kids', 'Inshallah'), ('kids', 'Kaaba'), ('kids', 'Makkah'),
  ('kids', 'Madinah'), ('kids', 'Angel'), ('kids', 'Prophet Muhammad'),
  ('kids', 'Five pillars'), ('kids', 'Wudu'), ('kids', 'Eid'),
  ('kids', 'Ramadan'), ('kids', 'Moon'), ('kids', 'Minaret'),
  ('kids', 'Jannah'), ('kids', 'Halal'), ('kids', 'Friday prayer'),
  ('kids', 'Adhan'), ('kids', 'Sadaqah'), ('kids', 'Smile (it is sunnah)'),
  ('kids', 'Stars');
