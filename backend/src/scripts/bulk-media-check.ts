/**
 * bulk-media-check.ts
 * Pre-populates media_library by running checks on a curated title list.
 * Run: npx ts-node src/scripts/bulk-media-check.ts
 * Options:
 *   --force        Re-check titles already in the library
 *   --dry          Print the list without calling the API
 *   --type=channel Filter to a single media type (movie|show|book|game|channel)
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// fallback to repo-root .env if backend one not found
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL ?? 'https://tarbiyah-production.up.railway.app';
const DELAY_MS = 1500; // gap between API calls

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// ── Curated title list ────────────────────────────────────────────────────────

export const TITLES: { title: string; type: 'movie' | 'show' | 'book' | 'game' | 'channel'; year?: number }[] = [
  // ==========================================
  // MOVIES
  // ==========================================
  { title: 'The Super Mario Bros. Movie',   type: 'movie', year: 2023 },
  { title: 'The Super Mario Galaxy Movie',  type: 'movie', year: 2026 },
  { title: 'A Minecraft Movie',            type: 'movie', year: 2025 },
  { title: 'Spider-Man: Across the Spider-Verse', type: 'movie', year: 2023 },
  { title: 'Spider-Man: Into the Spider-Verse',   type: 'movie', year: 2018 },
  { title: 'Inside Out 2',                 type: 'movie', year: 2024 },
  { title: 'Inside Out',                   type: 'movie', year: 2015 },
  { title: 'The Wild Robot',               type: 'movie', year: 2024 },
  { title: 'Moana 2',                      type: 'movie', year: 2024 },
  { title: 'Moana',                        type: 'movie', year: 2016 },
  { title: 'Zootopia 2',                   type: 'movie', year: 2025 },
  { title: 'Zootopia',                     type: 'movie', year: 2016 },
  { title: 'Elio',                         type: 'movie', year: 2025 },
  { title: 'Hoppers',                      type: 'movie', year: 2026 },
  { title: 'Toy Story 5',                  type: 'movie', year: 2026 },
  { title: 'Despicable Me 4',              type: 'movie', year: 2024 },
  { title: 'Minions: The Rise of Gru',     type: 'movie', year: 2022 },
  { title: 'Kung Fu Panda 4',              type: 'movie', year: 2024 },
  { title: 'The Bad Guys 2',               type: 'movie', year: 2025 },
  { title: 'The Bad Guys',                 type: 'movie', year: 2022 },
  { title: 'Puss in Boots: The Last Wish', type: 'movie', year: 2022 },
  { title: 'Teenage Mutant Ninja Turtles: Mutant Mayhem', type: 'movie', year: 2023 },
  { title: 'Flow',                         type: 'movie', year: 2024 },
  { title: 'Wonka',                        type: 'movie', year: 2023 },
  { title: 'Barbie',                       type: 'movie', year: 2023 },
  { title: 'Encanto',                      type: 'movie', year: 2021 },
  { title: 'Turning Red',                  type: 'movie', year: 2022 },
  { title: 'Elemental',                    type: 'movie', year: 2023 },
  { title: 'Wish',                         type: 'movie', year: 2023 },
  { title: 'Migration',                    type: 'movie', year: 2023 },
  { title: 'Coco',                         type: 'movie', year: 2017 },
  { title: 'Soul',                         type: 'movie', year: 2020 },
  { title: 'Luca',                         type: 'movie', year: 2021 },
  { title: 'Onward',                       type: 'movie', year: 2020 },
  { title: 'The Lion King',                type: 'movie', year: 1994 },
  { title: 'Finding Nemo',                 type: 'movie', year: 2003 },
  { title: 'Finding Dory',                 type: 'movie', year: 2016 },
  { title: 'Up',                           type: 'movie', year: 2009 },
  { title: 'WALL-E',                       type: 'movie', year: 2008 },
  { title: 'Ratatouille',                  type: 'movie', year: 2007 },
  { title: 'The Incredibles',              type: 'movie', year: 2004 },
  { title: 'Incredibles 2',                type: 'movie', year: 2018 },
  { title: 'Brave',                        type: 'movie', year: 2012 },
  { title: 'How to Train Your Dragon',     type: 'movie', year: 2010 },

  // ==========================================
  // SHOWS
  // ==========================================
  { title: 'Bluey',                        type: 'show', year: 2018 },
  { title: 'Bebefinn',                     type: 'show', year: 2022 },
  { title: 'Cocomelon Lane',               type: 'show', year: 2023 },
  { title: 'Cocomelon',                    type: 'show', year: 2018 },
  { title: 'Little Angel',                 type: 'show', year: 2021 },
  { title: 'The Creature Cases',           type: 'show', year: 2022 },
  { title: 'Paw Patrol',                   type: 'show', year: 2013 },
  { title: 'Peppa Pig',                    type: 'show', year: 2004 },
  { title: 'Hey Duggee',                   type: 'show', year: 2014 },
  { title: 'Gabby\'s Dollhouse',           type: 'show', year: 2021 },
  { title: 'Spidey and His Amazing Friends', type: 'show', year: 2021 },
  { title: 'Wednesday',                    type: 'show', year: 2022 },
  { title: 'Stranger Things',              type: 'show', year: 2016 },
  { title: 'Avatar: The Last Airbender',   type: 'show', year: 2005 },
  { title: 'Percy Jackson and the Olympians', type: 'show', year: 2023 },
  { title: 'One Piece (Live Action)',      type: 'show', year: 2023 },
  { title: 'Demon Slayer',                 type: 'show', year: 2019 },
  { title: 'My Hero Academia',             type: 'show', year: 2016 },
  { title: 'Jujutsu Kaisen',               type: 'show', year: 2020 },
  { title: 'Miraculous: Tales of Ladybug & Cat Noir', type: 'show', year: 2015 },
  { title: 'Gravity Falls',                type: 'show', year: 2012 },
  { title: 'The Owl House',                type: 'show', year: 2020 },
  { title: 'Amphibia',                     type: 'show', year: 2019 },
  { title: 'Hilda',                        type: 'show', year: 2018 },
  { title: 'Big City Greens',              type: 'show', year: 2018 },
  { title: 'The Dragon Prince',            type: 'show', year: 2018 },
  { title: 'Heartstopper',                 type: 'show', year: 2022 },
  { title: 'Teen Titans Go!',              type: 'show', year: 2013 },
  { title: 'Over the Garden Wall',         type: 'show', year: 2014 },
  { title: 'She-Ra and the Princesses of Power', type: 'show', year: 2018 },

  // ==========================================
  // BOOKS & GRAPHIC NOVELS
  // ==========================================
  { title: 'Dog Man',                      type: 'book', year: 2016 },
  { title: 'Cat Kid Comic Club',           type: 'book', year: 2020 },
  { title: 'InvestiGators',                type: 'book', year: 2020 },
  { title: 'Diary of a Wimpy Kid',         type: 'book', year: 2007 },
  { title: 'Captain Underpants',           type: 'book', year: 1997 },
  { title: 'The Bad Guys (Book Series)',   type: 'book', year: 2015 },
  { title: 'Wings of Fire: The Graphic Novel', type: 'book', year: 2018 },
  { title: 'Keeper of the Lost Cities',    type: 'book', year: 2012 },
  { title: 'A Good Girl\'s Guide to Murder', type: 'book', year: 2019 },
  { title: 'Heartstopper (Graphic Novel)', type: 'book', year: 2019 },
  { title: 'The Summer I Turned Pretty',   type: 'book', year: 2009 },
  { title: 'Wonder',                       type: 'book', year: 2012 },
  { title: 'Refugee',                      type: 'book', year: 2017 },
  { title: 'Amari and the Night Brothers', type: 'book', year: 2021 },
  { title: 'Percy Jackson and the Lightning Thief', type: 'book', year: 2005 },
  { title: 'Harry Potter and the Philosopher\'s Stone', type: 'book', year: 1997 },
  { title: 'The Hunger Games',             type: 'book', year: 2008 },
  { title: 'The Maze Runner',              type: 'book', year: 2009 },
  { title: 'The One and Only Ivan',        type: 'book', year: 2012 },
  { title: 'The Giver',                    type: 'book', year: 1993 },
  { title: 'Hatchet',                      type: 'book', year: 1987 },
  { title: 'Matilda',                      type: 'book', year: 1988 },
  { title: 'Charlotte\'s Web',             type: 'book', year: 1952 },
  { title: 'Roald Dahl: Charlie and the Chocolate Factory', type: 'book', year: 1964 },

  // ==========================================
  // GAMES & PLATFORMS
  // ==========================================
  { title: 'Roblox',                       type: 'game', year: 2006 },
  { title: 'Roblox: Brookhaven RP',        type: 'game', year: 2020 },
  { title: 'Roblox: Blox Fruits',          type: 'game', year: 2019 },
  { title: 'Roblox: Dress To Impress',     type: 'game', year: 2023 },
  { title: 'Roblox: Adopt Me!',            type: 'game', year: 2017 },
  { title: 'Roblox: Pet Simulator 99',     type: 'game', year: 2023 },
  { title: 'Roblox: Murder Mystery 2',     type: 'game', year: 2014 },
  { title: 'Minecraft',                    type: 'game', year: 2011 },
  { title: 'Fortnite',                     type: 'game', year: 2017 },
  { title: 'Brawl Stars',                  type: 'game', year: 2018 },
  { title: 'Genshin Impact',               type: 'game', year: 2020 },
  { title: 'Valorant',                     type: 'game', year: 2020 },
  { title: 'Apex Legends',                 type: 'game', year: 2019 },
  { title: 'EA Sports FC 25',              type: 'game', year: 2024 },
  { title: 'EA Sports FC 26',              type: 'game', year: 2025 },
  { title: 'Call of Duty: Modern Warfare III', type: 'game', year: 2023 },
  { title: 'Grand Theft Auto V',           type: 'game', year: 2013 },
  { title: 'Five Nights at Freddy\'s',     type: 'game', year: 2014 },
  { title: 'Poppy Playtime',               type: 'game', year: 2021 },
  { title: 'Rocket League',                type: 'game', year: 2015 },
  { title: 'Among Us',                     type: 'game', year: 2018 },
  { title: 'Mario Kart 8 Deluxe',          type: 'game', year: 2017 },
  { title: 'Animal Crossing: New Horizons',type: 'game', year: 2020 },
  { title: 'The Legend of Zelda: Tears of the Kingdom', type: 'game', year: 2023 },
  { title: 'Pokémon Scarlet and Violet',   type: 'game', year: 2022 },

  // ==========================================
  // YOUTUBE CHANNELS
  // ==========================================
  { title: 'MrBeast',                      type: 'channel' },
  { title: 'MrBeast Gaming',               type: 'channel' },
  { title: 'LankyBox',                     type: 'channel' },
  { title: 'Aphmau',                       type: 'channel' },
  { title: 'DanTDM',                       type: 'channel' },
  { title: 'SSundee',                      type: 'channel' },
  { title: 'FGTeeV',                       type: 'channel' },
  { title: 'PrestonPlayz',                 type: 'channel' },
  { title: 'IShowSpeed',                   type: 'channel' },
  { title: 'Kai Cenat',                    type: 'channel' },
  { title: 'Dude Perfect',                 type: 'channel' },
  { title: 'Mark Rober',                   type: 'channel' },
  { title: 'Kurzgesagt – In a Nutshell',   type: 'channel' },
  { title: 'SciShow Kids',                 type: 'channel' },
  { title: 'Blippi',                       type: 'channel' },
  { title: 'Ms Rachel - Songs for Littles',type: 'channel' },
  { title: 'Ryan\'s World',                type: 'channel' },
  { title: 'Like Nastya',                  type: 'channel' },
  { title: 'Bebefinn - Nursery Rhymes',    type: 'channel' },
  { title: 'Cocomelon - Nursery Rhymes',   type: 'channel' },
  { title: 'Numberblocks',                 type: 'channel' },
  { title: 'Alphablocks',                  type: 'channel' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONTENT_AREA_KEYS = ['sex_nudity', 'violence', 'profanity', 'substances', 'frightening', 'faith_values'];

function hasRealContent(data: any): boolean {
  if (!data.content_areas) return false;
  if (data.limited_data) return false;
  const isNoData = (data.flags ?? []).some((f: any) =>
    (typeof f === 'string' ? '' : f.title ?? '') === 'No content information found'
  );
  const hasConcerns = CONTENT_AREA_KEYS.some(k => {
    const v = data.content_areas[k];
    return v && v !== 'none';
  });
  return hasConcerns || !isNoData;
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const force = process.argv.includes('--force');
  const dry   = process.argv.includes('--dry');
  const typeArg = (process.argv.find(a => a.startsWith('--type=')) ?? '').replace('--type=', '') || null;

  const pool = typeArg ? TITLES.filter(t => t.type === typeArg) : TITLES;

  if (dry) {
    console.log(`\nDry run — ${pool.length} titles queued${typeArg ? ` (type: ${typeArg})` : ''}:\n`);
    pool.forEach((t, i) => console.log(`  ${i + 1}. [${t.type}] ${t.title}${t.year ? ` (${t.year})` : ''}`));
    return;
  }

  // Load existing library entries to skip
  const { data: existing } = await supabase
    .from('media_library')
    .select('title, type');
  const existingSet = new Set((existing ?? []).map((e: any) => `${e.title}||${e.type}`));
  console.log(`\nLibrary already has ${existingSet.size} entries.`);

  const toCheck = force
    ? pool
    : pool.filter(t => !existingSet.has(`${t.title}||${t.type}`));

  console.log(`Running checks on ${toCheck.length} titles (${TITLES.length - toCheck.length} skipped — already in library).\n`);

  let done = 0, skipped = 0, failed = 0;

  for (const item of toCheck) {
    const label = `[${item.type}] ${item.title}`;
    try {
      const res = await fetch(`${API_URL}/media/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, year: item.year, type: item.type }),
      });

      if (!res.ok) {
        console.log(`  ✗ ${label} — API ${res.status}`);
        failed++;
        await delay(DELAY_MS);
        continue;
      }

      const data = await res.json() as any;

      if (!hasRealContent(data)) {
        console.log(`  – ${label} — no content data, skipping`);
        skipped++;
        await delay(DELAY_MS);
        continue;
      }

      const { error } = await supabase.from('media_library').upsert({
        title:         item.title,
        year:          item.year ?? null,
        type:          item.type,
        poster:        data.poster ?? null,
        verdict:       data.verdict ?? null,
        content_areas: data.content_areas,
        flags:         data.flags ?? [],
        summary:       data.summary ?? null,
        age_range:     data.age_range ?? null,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'title,type', ignoreDuplicates: false });

      if (error) {
        console.log(`  ✗ ${label} — upsert error: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ ${label}`);
        done++;
      }
    } catch (e: any) {
      console.log(`  ✗ ${label} — ${e?.message}`);
      failed++;
    }

    await delay(DELAY_MS);
  }

  console.log(`\nDone. ✓ ${done} added  – ${skipped} skipped  ✗ ${failed} failed\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
