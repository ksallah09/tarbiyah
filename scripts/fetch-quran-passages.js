/**
 * fetch-quran-passages.js
 *
 * Fetches Arabic text and English translations for all configured passages
 * from the free Al-Quran Cloud API and writes them to src/data/quranPassages.js.
 *
 * Usage:
 *   node scripts/fetch-quran-passages.js
 *
 * Requires: Node 18+ (built-in fetch) or Node 16 with node-fetch.
 * No extra npm dependencies needed.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── Passage reference list ───────────────────────────────────────────────────

const PASSAGE_REFS = [
  "2:1-5",   "2:21-25",  "2:45-46",   "2:152-157", "2:177",
  "2:183-187","2:201-202","2:255-257", "2:261-274", "2:277-286",
  "3:8-9",   "3:14-17",  "3:31-32",   "3:102-104", "3:133-136",
  "3:139-142","3:159-160","3:190-194", "4:1",       "4:19",
  "4:34-35", "4:36-38",  "5:8-9",     "5:27-31",   "6:151-153",
  "7:23",    "8:2-4",    "8:28",      "9:71-72",   "10:57-58",
  "11:114-115","12:23-24","12:83-87", "12:90-92",  "13:22-24",
  "14:7-8",  "14:35-41", "16:90-91",  "17:23-24",  "17:53",
  "18:46",   "19:12-15", "19:41-50",  "20:25-28",  "20:44",
  "20:132",  "23:1-11",  "24:30-31",  "24:35",     "24:58-59",
  "25:63-77","25:74",    "29:45",     "29:69",     "30:21",
  "31:12-19","33:21",    "33:35",     "33:70-71",  "39:9-10",
  "39:53-55","41:30-36", "49:10-13",  "59:18-24",  "64:14-15",
  "65:2-3",  "66:6",     "66:8",      "87:14-17",  "89:27-30",
  "90:12-17","91:7-10",  "93:1-11",   "94:1-8",    "103:1-3",
];

// ─── Surah names ──────────────────────────────────────────────────────────────

const SURAH_NAMES = {
  2:  'Al-Baqarah',    3:  "Ali 'Imran",    4:  'An-Nisa',
  5:  'Al-Ma\'idah',   6:  'Al-An\'am',     7:  'Al-A\'raf',
  8:  'Al-Anfal',      9:  'At-Tawbah',     10: 'Yunus',
  11: 'Hud',           12: 'Yusuf',         13: 'Ar-Ra\'d',
  14: 'Ibrahim',       16: 'An-Nahl',       17: 'Al-Isra',
  18: 'Al-Kahf',       19: 'Maryam',        20: 'Ta-Ha',
  23: 'Al-Mu\'minun',  24: 'An-Nur',        25: 'Al-Furqan',
  29: 'Al-\'Ankabut',  30: 'Ar-Rum',        31: 'Luqman',
  33: 'Al-Ahzab',      39: 'Az-Zumar',      41: 'Fussilat',
  49: 'Al-Hujurat',    59: 'Al-Hashr',      64: 'At-Taghabun',
  65: 'At-Talaq',      66: 'At-Tahrim',     87: 'Al-A\'la',
  89: 'Al-Fajr',       90: 'Al-Balad',      91: 'Ash-Shams',
  93: 'Ad-Duha',       94: 'Ash-Sharh',     103: 'Al-\'Asr',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseRef(ref) {
  const [surahStr, verseStr] = ref.split(':');
  const surah = Number(surahStr);
  const [from, to] = verseStr.includes('-')
    ? verseStr.split('-').map(Number)
    : [Number(verseStr), Number(verseStr)];
  return { surah, from, to };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  Tarbiyah — Quran Passage Fetcher');
  console.log('  Source: api.alquran.cloud (free, no key)');
  console.log('══════════════════════════════════════════\n');

  // Collect unique surahs
  const uniqueSurahs = [...new Set(PASSAGE_REFS.map(r => parseRef(r).surah))].sort((a, b) => a - b);
  console.log(`Fetching ${uniqueSurahs.length} unique surahs for ${PASSAGE_REFS.length} passages...\n`);

  // Fetch each surah (Arabic + English in one call)
  const surahCache = {};
  for (const surah of uniqueSurahs) {
    process.stdout.write(`  Fetching Surah ${surah} (${SURAH_NAMES[surah] || surah})... `);
    try {
      const data = await fetchJson(
        `https://api.alquran.cloud/v1/surah/${surah}/editions/quran-uthmani,en.sahih`
      );
      if (data.code !== 200) throw new Error(`API returned code ${data.code}`);
      surahCache[surah] = data.data; // [arabicEdition, englishEdition]
      console.log('✓');
    } catch (err) {
      console.log(`✗  ${err.message}`);
      process.exit(1);
    }
    await sleep(400); // be polite to the free API
  }

  // Build passage objects
  console.log('\nBuilding passages...');
  const passages = [];

  for (const ref of PASSAGE_REFS) {
    const { surah, from, to } = parseRef(ref);
    const [arabicEdition, englishEdition] = surahCache[surah];

    const arabicVerses  = arabicEdition.ayahs.filter(a => a.numberInSurah >= from && a.numberInSurah <= to);
    const englishVerses = englishEdition.ayahs.filter(a => a.numberInSurah >= from && a.numberInSurah <= to);

    if (arabicVerses.length === 0) {
      console.warn(`  ⚠ No verses found for ${ref} — skipping`);
      continue;
    }

    const surahName   = SURAH_NAMES[surah] || `Surah ${surah}`;
    const shortRef    = from === to ? `${surah}:${from}` : `${surah}:${from}-${to}`;

    const verses = arabicVerses.map((v, i) => ({
      number:      v.numberInSurah,
      arabic:      v.text,
      translation: englishVerses[i]?.text || '',
    }));

    // Keep joined strings for preview cards
    const arabic      = verses.map(v => v.arabic).join('  ');
    const translation = verses.map(v => v.translation).join(' ');

    passages.push({
      reference:  `${surahName} ${shortRef}`,
      shortRef,
      arabic,
      translation,
      verses,
      verseCount: arabicVerses.length,
    });

    console.log(`  ✓ ${shortRef.padEnd(12)} ${surahName} (${arabicVerses.length} verse${arabicVerses.length > 1 ? 's' : ''})`);
  }

  // Write output
  const outPath = path.join(__dirname, '../src/data/quranPassages.js');
  const output = [
    `// Auto-generated by scripts/fetch-quran-passages.js`,
    `// Arabic: Uthmani script (api.alquran.cloud)`,
    `// Translation: Saheeh International`,
    `// Do not edit manually — re-run the script to regenerate`,
    ``,
    `export const PASSAGES = ${JSON.stringify(passages, null, 2)};`,
    ``,
  ].join('\n');

  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Done! ${passages.length} passages written to:`);
  console.log(`  src/data/quranPassages.js`);
  console.log(`══════════════════════════════════════════\n`);
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message);
  process.exit(1);
});
