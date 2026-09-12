/**
 * auto-media-library.ts
 * Monthly cron: discovers trending titles via Google Search grounding,
 * deduplicates against existing library + curated list, then runs
 * media checks on net-new titles only.
 *
 * Run: npx ts-node src/scripts/auto-media-library.ts
 * Options:
 *   --dry     Print discovered titles without running checks
 *   --force   Re-check titles already in the library
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_URL   = process.env.API_URL ?? 'https://tarbiyah-production.up.railway.app';
const DELAY_MS  = 1500;
const MODEL     = process.env.GEMINI_MODEL_FAST ?? 'gemini-2.0-flash';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Curated baseline (never re-check these unless --force) ────────────────────
// Import the curated list so we can exclude already-known titles
import { TITLES as CURATED } from './bulk-media-check';

const CURATED_KEYS = new Set(CURATED.map(t => `${t.title.toLowerCase()}||${t.type}`));

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaType = 'movie' | 'show' | 'book' | 'game' | 'channel';

interface DiscoveredTitle {
  title: string;
  type: MediaType;
  year?: number;
}

// ── Step 1: Discover trending titles via grounding ────────────────────────────

async function discoverTitles(): Promise<DiscoveredTitle[]> {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const prompt = `Today is ${today}.

Use Google Search to find what children and teenagers (ages 4–16) are watching, reading, playing and following RIGHT NOW this month.

Search across these categories and return results in STRICT JSON format only — no markdown, no explanation:

{
  "movies": [
    { "title": "string", "year": number }
  ],
  "shows": [
    { "title": "string", "year": number }
  ],
  "books": [
    { "title": "string", "year": number }
  ],
  "games": [
    { "title": "string", "year": number }
  ],
  "channels": [
    { "title": "string" }
  ]
}

Rules:
- Search for: "most popular kids movies ${new Date().getFullYear()}", "trending shows for kids teens this month", "top children's books right now", "most played kids games this month", "top YouTube channels for kids teens"
- Return 10–15 titles per category
- Only include titles that appear in search results published in the last 60 days
- Do NOT include titles from your training knowledge alone unless confirmed by recent search results
- Year should be the release year, not the current year
- Channels: include the YouTube channel name exactly as it appears
- Return ONLY the JSON object, nothing else`;

  console.log('\n[discover] Calling Gemini with Google Search grounding...');

  const model = genAI.getGenerativeModel({
    model: MODEL,
    tools: [{ googleSearch: {} } as any],
    generationConfig: { temperature: 0.1 },
  });

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Discovery grounding timeout')), 180_000)
    ),
  ]);

  const raw = (result as any).response.text().trim();
  const cleaned = raw.startsWith('```')
    ? raw.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '')
    : raw;

  const parsed = JSON.parse(cleaned);

  const discovered: DiscoveredTitle[] = [
    ...(parsed.movies  ?? []).map((t: any) => ({ title: t.title, type: 'movie'   as MediaType, year: t.year })),
    ...(parsed.shows   ?? []).map((t: any) => ({ title: t.title, type: 'show'    as MediaType, year: t.year })),
    ...(parsed.books   ?? []).map((t: any) => ({ title: t.title, type: 'book'    as MediaType, year: t.year })),
    ...(parsed.games   ?? []).map((t: any) => ({ title: t.title, type: 'game'    as MediaType, year: t.year })),
    ...(parsed.channels ?? []).map((t: any) => ({ title: t.title, type: 'channel' as MediaType })),
  ].filter(t => t.title && typeof t.title === 'string' && t.title.trim().length > 1);

  console.log(`[discover] Found ${discovered.length} titles from grounding.`);
  return discovered;
}

// ── Step 2: Deduplicate ───────────────────────────────────────────────────────

async function dedup(
  discovered: DiscoveredTitle[],
  force: boolean,
): Promise<DiscoveredTitle[]> {
  const { data: existing } = await supabase
    .from('media_library')
    .select('title, type');
  const libraryKeys = new Set((existing ?? []).map((e: any) => `${e.title.toLowerCase()}||${e.type}`));

  return discovered.filter(t => {
    const k = `${t.title.toLowerCase()}||${t.type}`;
    if (CURATED_KEYS.has(k)) return false;    // already in curated list
    if (!force && libraryKeys.has(k)) return false; // already checked
    return true;
  });
}

// ── Step 3: Run checks ────────────────────────────────────────────────────────

const CONTENT_AREA_KEYS = ['sex_nudity', 'violence', 'profanity', 'substances', 'frightening', 'faith_values'];

function hasRealContent(data: any): boolean {
  if (!data.content_areas || data.limited_data) return false;
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

async function runChecks(titles: DiscoveredTitle[]): Promise<void> {
  let done = 0, skipped = 0, failed = 0;

  for (const item of titles) {
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const force = process.argv.includes('--force');
  const dry   = process.argv.includes('--dry');

  const discovered = await discoverTitles();
  const toCheck    = await dedup(discovered, force);

  console.log(`\n${toCheck.length} net-new titles to check (${discovered.length - toCheck.length} already known):\n`);
  toCheck.forEach((t, i) =>
    console.log(`  ${i + 1}. [${t.type}] ${t.title}${t.year ? ` (${t.year})` : ''}`)
  );

  if (dry || toCheck.length === 0) {
    if (toCheck.length === 0) console.log('Nothing new to check.');
    return;
  }

  console.log('\nRunning checks...\n');
  await runChecks(toCheck);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
