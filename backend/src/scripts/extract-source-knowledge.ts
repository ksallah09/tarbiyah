/**
 * extract-source-knowledge.ts
 *
 * Builds the source_knowledge table by running a richer extraction over each
 * source's already-processed extracted_content. Produces key takeaways, theme
 * indexing, age group relevance, and a narrative summary per source.
 *
 * New sources processed via process-url-sources.ts are handled automatically.
 * Use this script to backfill existing sources or reprocess specific ones.
 *
 * Usage:
 *   npx ts-node src/scripts/extract-source-knowledge.ts             # process all unprocessed
 *   npx ts-node src/scripts/extract-source-knowledge.ts --all       # reprocess everything
 *   npx ts-node src/scripts/extract-source-knowledge.ts --dry-run   # preview without saving
 *   npx ts-node src/scripts/extract-source-knowledge.ts --source <source_id>  # one source
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { supabase } from '../config/supabase';
import { extractSourceKnowledge } from '../pipeline/knowledge';
import { ExtractedContent } from '../types';

const DRY_RUN   = process.argv.includes('--dry-run');
const REPROCESS = process.argv.includes('--all');
const DELAY_MS  = 2000;

const SINGLE_SOURCE_IDX = process.argv.indexOf('--source');
const SINGLE_SOURCE_ID  = SINGLE_SOURCE_IDX !== -1 ? process.argv[SINGLE_SOURCE_IDX + 1] : null;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`\nSource Knowledge Extractor${DRY_RUN ? ' [DRY RUN]' : ''}${REPROCESS ? ' [REPROCESS ALL]' : ''}\n`);

  // 1. Fetch all completed processing jobs
  let jobQuery = supabase
    .from('processing_jobs')
    .select('source_id, extracted_content')
    .eq('status', 'completed');

  if (SINGLE_SOURCE_ID) {
    jobQuery = jobQuery.eq('source_id', SINGLE_SOURCE_ID);
  }

  const { data: jobs, error: jobError } = await jobQuery;
  if (jobError) { console.error('Failed to fetch jobs:', jobError.message); process.exit(1); }
  if (!jobs?.length) { console.log('No completed processing jobs found.'); return; }

  // 2. Find which sources already have knowledge entries (skip unless --all)
  let existingIds = new Set<string>();
  if (!REPROCESS && !SINGLE_SOURCE_ID) {
    const { data: existing } = await supabase
      .from('source_knowledge')
      .select('source_id');
    existingIds = new Set((existing ?? []).map((r: any) => r.source_id as string));
  }

  // 3. Fetch source titles for logging
  const sourceIds = (jobs as any[]).map(j => j.source_id as string);
  const { data: sources } = await supabase
    .from('sources')
    .select('id, title')
    .in('id', sourceIds);
  const titleMap = new Map((sources ?? []).map((s: any) => [s.id as string, s.title as string]));

  // 4. Filter to unprocessed
  const toProcess = (jobs as any[]).filter(j => {
    if (!j.extracted_content) return false;
    if (REPROCESS || SINGLE_SOURCE_ID) return true;
    return !existingIds.has(j.source_id);
  });

  console.log(`Sources to process: ${toProcess.length} (${existingIds.size} already done)\n`);

  if (toProcess.length === 0) {
    console.log('All sources already have knowledge entries. Use --all to reprocess.');
    return;
  }

  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const job   = toProcess[i];
    const title = titleMap.get(job.source_id) ?? job.source_id;

    console.log(`[${i + 1}/${toProcess.length}] ${title}`);

    try {
      if (!DRY_RUN) {
        await extractSourceKnowledge(job.source_id, job.extracted_content as ExtractedContent);
        console.log(`  ✓ Done`);
      } else {
        console.log(`  ✓ [dry-run] Would extract`);
      }
      succeeded++;
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Done. Succeeded: ${succeeded}, Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
