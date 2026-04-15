/**
 * tag-age-groups.ts
 *
 * Auto-tags all published insights that have no age_group set (or are set to '{all}')
 * by asking Gemini to classify each one based on its content.
 *
 * Run after adding the age_group column to the insights table:
 *   npx ts-node src/scripts/tag-age-groups.ts
 *   npx ts-node src/scripts/tag-age-groups.ts --dry-run   # preview without saving
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { supabase } from '../config/supabase';
import { getTextModel, generateWithRetry, MODEL_FAST } from '../config/gemini';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10; // process in batches to avoid rate limits
const DELAY_MS = 1500;

const CLASSIFICATION_PROMPT = `
You are classifying parenting insights by the age group of children they are most relevant for.

Age groups:
- "under-5"  — Toddler & Preschool (0–4 years)
- "5-10"     — Early Childhood (5–10 years)
- "11-15"    — Pre-Teen (11–15 years)
- "16-plus"  — Young Adult (16+)
- "all"      — Universal, applies to parents of children any age

Rules:
- Return an array of one or more values from the list above.
- Use "all" when the insight is about general parenting mindset, patience, love, dua, marriage, or character that applies regardless of child age.
- Use specific age groups when the content clearly references behaviours, development, or challenges tied to that stage.
- Multiple values are fine when the insight spans stages (e.g. ["5-10", "11-15"]).
- Return ONLY a JSON array — no explanation, no markdown. Example: ["11-15", "16-plus"]

Insight title: {TITLE}
Insight text: {TEXT}
`.trim();

async function classifyInsight(title: string, text: string): Promise<string[]> {
  const model = getTextModel(MODEL_FAST, 'You classify parenting content by age group. Return only a JSON array.');
  const prompt = CLASSIFICATION_PROMPT
    .replace('{TITLE}', title)
    .replace('{TEXT}', text);

  const raw = await generateWithRetry(model, prompt, MODEL_FAST);
  const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return ['all']; // safe fallback
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`\nAge Group Tagger${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  // Fetch insights where age_group is null or contains only 'all'
  const { data, error } = await supabase
    .from('insights')
    .select('id, insight_title, daily_insight, spiritual_insight, educational_insight, age_group')
    .eq('status', 'published')
    .order('date_generated', { ascending: true });

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  const rows = (data ?? []).filter((r: any) => {
    const ag = r.age_group;
    return !ag || ag.length === 0 || (ag.length === 1 && ag[0] === 'all');
  });

  console.log(`Found ${rows.length} insights to classify (out of ${data?.length ?? 0} published)\n`);

  if (rows.length === 0) {
    console.log('Nothing to do — all insights already have specific age groups.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (row: any) => {
      const text = row.spiritual_insight || row.educational_insight || row.daily_insight || '';
      const title = row.insight_title || '';

      try {
        const ageGroups = await classifyInsight(title, text);
        console.log(`  [${i + 1}/${rows.length}] "${title}" → ${JSON.stringify(ageGroups)}`);

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('insights')
            .update({ age_group: ageGroups })
            .eq('id', row.id);

          if (updateError) {
            console.error(`    ✗ Update failed: ${updateError.message}`);
            failed++;
          } else {
            updated++;
          }
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`  ✗ Classification failed for "${title}":`, err);
        failed++;
      }
    }));

    if (i + BATCH_SIZE < rows.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would have updated' : 'Updated'} ${updated} insights.`);
  if (failed > 0) console.log(`Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
