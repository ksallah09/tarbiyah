/**
 * process-url-sources.ts
 *
 * Seeds all curated URL-based sources into Supabase and processes
 * any that haven't been run yet. Replaces the Supabase Storage PDF workflow.
 *
 * Usage:
 *   npx ts-node src/scripts/process-url-sources.ts                        # process unprocessed (4 insights each)
 *   npx ts-node src/scripts/process-url-sources.ts --rerun                # reprocess everything
 *   npx ts-node src/scripts/process-url-sources.ts --list                 # just list sources, no processing
 *   npx ts-node src/scripts/process-url-sources.ts --category science     # only science sources
 *   npx ts-node src/scripts/process-url-sources.ts --category spiritual   # only spiritual sources
 *   npx ts-node src/scripts/process-url-sources.ts --count 6              # generate 6 insights per source
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { supabase } from '../config/supabase';
import {
  seedSources,
  getUnprocessedSources,
  getAllSources,
  updateInsightStatus,
  getDraftInsights,
} from '../data/database';
import { processSingleSource } from '../pipeline/daily';
import { Source } from '../types';

const RERUN     = process.argv.includes('--rerun');
const LIST_ONLY = process.argv.includes('--list');
const CATEGORY  = (() => {
  const idx = process.argv.indexOf('--category');
  return idx !== -1 ? process.argv[idx + 1] : null;
})() as Source['category'] | null;
const COUNT = (() => {
  const idx = process.argv.indexOf('--count');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 4;
})();

async function isAlreadyProcessed(sourceId: string): Promise<boolean> {
  if (RERUN) return false;
  const { data } = await supabase
    .from('processing_jobs')
    .select('id')
    .eq('source_id', sourceId)
    .eq('status', 'completed')
    .limit(1);
  return (data ?? []).length > 0;
}

async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  Tarbiyah — URL Source Processor');
  if (CATEGORY) console.log(`  Category filter: ${CATEGORY}`);
  if (RERUN)    console.log('  Mode: --rerun (reprocessing all)');
  console.log(`  Insights per source: ${COUNT}`);
  console.log('══════════════════════════════════════════\n');

  // Register all curated sources in Supabase
  console.log('Seeding sources...');
  await seedSources();

  // Fetch all active sources
  let sources = await getAllSources();

  // Apply category filter if specified
  if (CATEGORY) {
    sources = sources.filter(s => s.category === CATEGORY);
  }

  // Exclude storage-imported PDFs — those are the old bucket-based sources
  sources = sources.filter(s => !s.id.startsWith('storage-'));

  console.log(`\nFound ${sources.length} curated source(s):\n`);
  sources.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.type.toUpperCase()}] ${s.title}`);
    console.log(`     ID: ${s.id}`);
    console.log(`     Author: ${s.author ?? s.speakerName ?? '—'}`);
    console.log(`     URL: ${s.url}\n`);
  });

  if (LIST_ONLY) return;

  let processed = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const source of sources) {
    const alreadyDone = await isAlreadyProcessed(source.id);
    if (alreadyDone) {
      console.log(`⟳ Skipped (already processed): "${source.title}"`);
      skipped++;
      continue;
    }

    console.log(`\nProcessing: "${source.title}" [${source.type}]`);
    try {
      await processSingleSource(source, COUNT);

      // Auto-approve and publish new draft insights from this source
      const drafts = await getDraftInsights();
      const mine   = drafts.filter(d => d.sourceId === source.id);
      for (const draft of mine) {
        await updateInsightStatus(draft.id, 'approved');
        await updateInsightStatus(draft.id, 'published');
      }
      if (mine.length > 0) {
        console.log(`✓ Published ${mine.length} insight(s) from "${source.title}"`);
      }

      processed++;
    } catch (err) {
      console.error(`✗ Failed: "${source.title}" —`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Done.`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n✗ Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
