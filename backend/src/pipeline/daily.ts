import {
  seedSources,
  getAllSources,
  getUnprocessedSources,
  createJob,
  startJob,
  completeJob,
  failJob,
  saveInsight,
  updateInsightStatus,
  getInsightsByStatus,
  getPublishedInsightsByCategory,
  getDraftInsights,
  getStats,
  getSourceById,
} from '../data/database';
import { processSource } from '../processors';
import { generateInsight, generateMultipleInsights, buildDailyPayload } from '../generators/insights';
import { Source, InsightOutput, AppDailyPayload } from '../types';

// ─── Pipeline Orchestration ───────────────────────────────────────────────────

/**
 * Processes a single source end-to-end:
 *   1. Creates a processing job
 *   2. Runs the appropriate processor (YouTube / PDF / text)
 *   3. Generates insight(s) from extracted content
 *   4. Saves everything to the database as drafts
 *
 * Returns the generated InsightOutput(s).
 */
export async function processSingleSource(
  source: Source,
  generateCount = 1
): Promise<InsightOutput[]> {
  const job = createJob(source.id);
  startJob(job.id);

  try {
    // Step 1: Extract content from the source
    const extracted = await processSource(source);
    completeJob(job.id, extracted);

    // Step 2: Generate insight(s)
    const insights =
      generateCount > 1
        ? await generateMultipleInsights(source, extracted, job.id, generateCount)
        : [await generateInsight(source, extracted, job.id)];

    // Step 3: Save as drafts
    for (const insight of insights) {
      saveInsight(insight);
      console.log(`  ✓ Saved insight [${insight.id.slice(0, 8)}] as draft`);
    }

    console.log(
      `✓ Source processed: "${source.title}" → ${insights.length} insight(s) saved\n`
    );
    return insights;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failJob(job.id, message);
    console.error(`✗ Failed to process "${source.title}": ${message}\n`);
    throw error;
  }
}

/**
 * Processes all unprocessed sources in the curated repository.
 * Creates draft insights for each one.
 *
 * Safe to call repeatedly — skips sources that have already been completed.
 */
export async function processAllUnprocessedSources(): Promise<void> {
  const sources = getUnprocessedSources();

  if (sources.length === 0) {
    console.log('✓ All sources have already been processed.');
    return;
  }

  console.log(`\nProcessing ${sources.length} unprocessed source(s)...\n`);

  let processed = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      await processSingleSource(source);
      processed++;
    } catch {
      failed++;
      // Continue with next source even if one fails
    }
  }

  console.log(`\n── Pipeline complete ────────────────────`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Failed:    ${failed}`);
  console.log(`   Total:     ${sources.length}`);
}

/**
 * Approves all current draft insights.
 * In production, this would be a manual review step via a CMS.
 */
export function approveAllDrafts(): number {
  const drafts = getDraftInsights();
  for (const insight of drafts) {
    updateInsightStatus(insight.id, 'approved');
  }
  console.log(`✓ Approved ${drafts.length} draft insight(s)`);
  return drafts.length;
}

/**
 * Publishes all approved insights.
 */
export function publishAllApproved(): number {
  const approved = getInsightsByStatus('approved');
  for (const insight of approved) {
    updateInsightStatus(insight.id, 'published');
  }
  console.log(`✓ Published ${approved.length} insight(s)`);
  return approved.length;
}

/**
 * Builds the daily app payload by pulling one insight from each category pool.
 *
 * - Spiritual Insight card  ← most recent published insight with category = 'spiritual'
 * - Scientific Insight card ← most recent published insight with category = 'science'
 *
 * This maps directly to the two cards on the home screen.
 */
export function buildTodaysDailyPayload(): AppDailyPayload | null {
  const spiritualPool = getPublishedInsightsByCategory('spiritual', 5);
  const sciencePool   = getPublishedInsightsByCategory('science', 5);

  if (spiritualPool.length === 0 || sciencePool.length === 0) {
    console.warn(
      `Not enough published insights to build a daily payload. ` +
      `spiritual: ${spiritualPool.length}, science: ${sciencePool.length}`
    );
    return null;
  }

  const spiritualSource  = getSourceById(spiritualPool[0].sourceId);
  const scienceSource    = getSourceById(sciencePool[0].sourceId);

  return buildDailyPayload(spiritualPool[0], sciencePool[0], spiritualSource, scienceSource);
}

/**
 * Selects a source with a specific tag for targeted content generation.
 */
export function getSourceForTag(tag: string): Source | undefined {
  const sources = getAllSources();
  return sources.find((s) => s.tags.includes(tag as Source['tags'][number]));
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

/**
 * Runs the complete pipeline:
 *   1. Seed the database with curated sources
 *   2. Process all unprocessed sources
 *   3. Approve and publish the generated insights
 *   4. Build and return the daily payload
 */
export async function runFullPipeline(): Promise<AppDailyPayload | null> {
  console.log('══════════════════════════════════════════');
  console.log('  Tarbiyah Intelligence Pipeline');
  console.log('══════════════════════════════════════════\n');

  // 1. Seed
  seedSources();

  // 2. Process
  await processAllUnprocessedSources();

  // 3. Approve + Publish
  const approved = approveAllDrafts();
  if (approved > 0) {
    publishAllApproved();
  }

  // 4. Build daily payload
  const payload = buildTodaysDailyPayload();

  // 5. Stats
  const stats = getStats();
  console.log('\n── Database Stats ───────────────────────');
  console.log(`   Sources:           ${stats.totalSources}`);
  console.log(`   Processed sources: ${stats.processedSources}`);
  console.log(`   Total insights:    ${stats.totalInsights}`);
  console.log(`   Published:         ${stats.publishedInsights}`);
  console.log(`   Drafts:            ${stats.draftInsights}`);
  console.log('═════════════════════════════════════════\n');

  return payload;
}

// Allow direct execution: `ts-node src/pipeline/daily.ts`
if (require.main === module) {
  runFullPipeline()
    .then((payload) => {
      if (payload) {
        console.log('\n── Today\'s Daily Payload ────────────────');
        console.log(JSON.stringify(payload, null, 2));
      }
    })
    .catch((err) => {
      console.error('Pipeline error:', err);
      process.exit(1);
    });
}
