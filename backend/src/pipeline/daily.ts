import {
  seedSources,
  getAllSources,
  getUnprocessedSources,
  upsertSource,
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

export async function processSingleSource(
  sourceArg: Source,
  generateCount = 1
): Promise<InsightOutput[]> {
  let source = sourceArg;
  const job = await createJob(source.id);
  await startJob(job.id);

  try {
    const extracted = await processSource(source);

    // If the PDF extraction found an author and the source didn't have one, persist it now
    // so the insight card shows the right name + image immediately.
    if (extracted.extractedAuthor && !source.author) {
      source = { ...source, author: extracted.extractedAuthor };
      await upsertSource(source);
      console.log(`  → Source author updated to: "${extracted.extractedAuthor}"`);
    }

    await completeJob(job.id, extracted);

    const insights =
      generateCount > 1
        ? await generateMultipleInsights(source, extracted, job.id, generateCount)
        : [await generateInsight(source, extracted, job.id)];

    for (const insight of insights) {
      await saveInsight(insight);
      console.log(`  ✓ Saved insight [${insight.id.slice(0, 8)}] as draft`);
    }

    console.log(`✓ Source processed: "${source.title}" → ${insights.length} insight(s) saved\n`);
    return insights;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(job.id, message);
    console.error(`✗ Failed to process "${source.title}": ${message}\n`);
    throw error;
  }
}

export async function processAllUnprocessedSources(): Promise<void> {
  const sources = await getUnprocessedSources();

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
    }
  }

  console.log(`\n── Pipeline complete ────────────────────`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Failed:    ${failed}`);
  console.log(`   Total:     ${sources.length}`);
}

export async function approveAllDrafts(): Promise<number> {
  const drafts = await getDraftInsights();
  for (const insight of drafts) {
    await updateInsightStatus(insight.id, 'approved');
  }
  console.log(`✓ Approved ${drafts.length} draft insight(s)`);
  return drafts.length;
}

export async function publishAllApproved(): Promise<number> {
  const approved = await getInsightsByStatus('approved');
  for (const insight of approved) {
    await updateInsightStatus(insight.id, 'published');
  }
  console.log(`✓ Published ${approved.length} insight(s)`);
  return approved.length;
}

export async function buildTodaysDailyPayload(): Promise<AppDailyPayload | null> {
  const [spiritualPool, sciencePool] = await Promise.all([
    getPublishedInsightsByCategory('spiritual', 5),
    getPublishedInsightsByCategory('science', 5),
  ]);

  if (spiritualPool.length === 0 || sciencePool.length === 0) {
    console.warn(
      `Not enough published insights. spiritual: ${spiritualPool.length}, science: ${sciencePool.length}`
    );
    return null;
  }

  const [spiritualSource, scienceSource] = await Promise.all([
    getSourceById(spiritualPool[0].sourceId),
    getSourceById(sciencePool[0].sourceId),
  ]);

  return buildDailyPayload(spiritualPool[0], sciencePool[0], spiritualSource, scienceSource);
}

export async function getSourceForTag(tag: string): Promise<Source | undefined> {
  const sources = await getAllSources();
  return sources.find(s => s.tags.includes(tag as Source['tags'][number]));
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

export async function runFullPipeline(): Promise<AppDailyPayload | null> {
  console.log('══════════════════════════════════════════');
  console.log('  Tarbiyah Intelligence Pipeline');
  console.log('══════════════════════════════════════════\n');

  await seedSources();
  await processAllUnprocessedSources();

  const approved = await approveAllDrafts();
  if (approved > 0) await publishAllApproved();

  const payload = await buildTodaysDailyPayload();

  const stats = await getStats();
  console.log('\n── Database Stats ───────────────────────');
  console.log(`   Sources:           ${stats.totalSources}`);
  console.log(`   Processed sources: ${stats.processedSources}`);
  console.log(`   Total insights:    ${stats.totalInsights}`);
  console.log(`   Published:         ${stats.publishedInsights}`);
  console.log(`   Drafts:            ${stats.draftInsights}`);
  console.log('═════════════════════════════════════════\n');

  return payload;
}

if (require.main === module) {
  runFullPipeline()
    .then(payload => {
      if (payload) {
        console.log('\n── Today\'s Daily Payload ────────────────');
        console.log(JSON.stringify(payload, null, 2));
      }
    })
    .catch(err => {
      console.error('Pipeline error:', err);
      process.exit(1);
    });
}
