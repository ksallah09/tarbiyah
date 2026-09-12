/**
 * backfill-posters.ts
 * Fetches poster/cover URLs for media_library + media_cache rows
 * where poster IS NULL, across all media types.
 *
 * Sources:
 *   movie / show  → TMDB
 *   book          → Google Books (no key needed)
 *   game          → RAWG
 *   channel       → YouTube Data API
 *
 * Run: npx ts-node src/scripts/backfill-posters.ts
 * Options:
 *   --dry     Show what would be updated without writing
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const TMDB_TOKEN  = process.env.TMDB_READ_TOKEN!;
const RAWG_KEY    = process.env.RAWG_API_KEY!;
const YT_KEY      = process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
const DELAY_MS    = 300;

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Per-type poster fetchers ──────────────────────────────────────────────────

async function posterForMovie(title: string, year: number | null, type: 'movie' | 'show'): Promise<string | null> {
  const tmdbType = type === 'show' ? 'tv' : 'movie';
  const yearParam = year ? (type === 'show' ? `&first_air_date_year=${year}` : `&year=${year}`) : '';
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${tmdbType}?query=${encodeURIComponent(title)}${yearParam}`,
      { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ poster_path?: string }> };
    const p = data.results?.[0]?.poster_path;
    return p ? `https://image.tmdb.org/t/p/w500${p}` : null;
  } catch { return null; }
}

async function posterForBook(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5&fields=cover_i,title`
    );
    if (!res.ok) return null;
    const data = await res.json() as { docs?: Array<{ cover_i?: number }> };
    for (const doc of data.docs ?? []) {
      if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    return null;
  } catch { return null; }
}

async function posterForGame(title: string): Promise<string | null> {
  if (!RAWG_KEY) return null;
  try {
    const res = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(title)}&page_size=1&key=${RAWG_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ background_image?: string }> };
    return data.results?.[0]?.background_image ?? null;
  } catch { return null; }
}

async function posterForChannel(title: string): Promise<string | null> {
  if (!YT_KEY) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(title)}&maxResults=1&key=${YT_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json() as { items?: Array<{ snippet?: { thumbnails?: { high?: { url?: string }; medium?: { url?: string } } } }> };
    const thumbs = data.items?.[0]?.snippet?.thumbnails;
    return thumbs?.high?.url ?? thumbs?.medium?.url ?? null;
  } catch { return null; }
}

async function fetchPoster(title: string, year: number | null, type: string): Promise<string | null> {
  switch (type) {
    case 'movie':
    case 'show':    return posterForMovie(title, year, type as 'movie' | 'show');
    case 'book':    return posterForBook(title);
    case 'game':    return posterForGame(title);
    case 'channel': return posterForChannel(title);
    default:        return null;
  }
}

// ── Backfill one table ────────────────────────────────────────────────────────

async function backfillTable(table: 'media_library' | 'media_cache', dry: boolean) {
  const { data, error } = await supabase
    .from(table)
    .select('id, title, year, type')
    .is('poster', null);

  if (error) { console.error(`[${table}] fetch error:`, error.message); return; }
  if (!data || data.length === 0) { console.log(`[${table}] nothing to backfill`); return; }

  console.log(`[${table}] ${data.length} rows to backfill\n`);

  let updated = 0, missing = 0;

  for (const row of data as any[]) {
    const poster = await fetchPoster(row.title, row.year ?? null, row.type);
    if (!poster) {
      console.log(`  – [${row.type}] ${row.title} — no poster found`);
      missing++;
      await delay(DELAY_MS);
      continue;
    }

    console.log(`  ${dry ? '(dry)' : '✓'} [${row.type}] ${row.title}`);
    if (!dry) {
      const { error: upErr } = await supabase
        .from(table)
        .update({ poster })
        .eq('id', row.id);
      if (upErr) console.warn(`    error: ${upErr.message}`);
      else updated++;
    } else {
      updated++;
    }

    await delay(DELAY_MS);
  }

  console.log(`\n[${table}] ✓ ${updated} updated  – ${missing} no poster found\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!TMDB_TOKEN) { console.error('TMDB_READ_TOKEN missing in .env'); process.exit(1); }
  if (!RAWG_KEY)   console.warn('RAWG_API_KEY missing — games will be skipped');

  const dry = process.argv.includes('--dry');
  if (dry) console.log('--- DRY RUN ---\n');

  await backfillTable('media_library', dry);
  await backfillTable('media_cache', dry);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
