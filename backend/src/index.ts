/**
 * Tarbiyah Intelligence Layer — Main Entry Point
 *
 * This is the demo/development runner. It shows how each part of
 * the pipeline works and produces app-ready output.
 *
 * Usage:
 *   npm run dev                   → Full pipeline demo
 *   npm run dev -- --source <id>  → Process a single source by ID
 *   npm run dev -- --stats        → Print database stats
 *   npm run dev -- --drafts       → List all draft insights
 *   npm run dev -- --payload      → Print today's daily payload
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { seedSources, getStats, getDraftInsights, getLatestPublishedInsights, getAllSources, getSourceById } from './data/database';
import { processSingleSource, runFullPipeline, buildTodaysDailyPayload, approveAllDrafts, publishAllApproved } from './pipeline/daily';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case '--stats':
      seedSources();
      printStats();
      break;

    case '--sources':
      seedSources();
      printSources();
      break;

    case '--drafts':
      seedSources();
      printDrafts();
      break;

    case '--payload':
      seedSources();
      approveAllDrafts();
      publishAllApproved();
      printDailyPayload();
      break;

    case '--source': {
      const sourceId = args[1];
      if (!sourceId) {
        console.error('Usage: npm run dev -- --source <source-id>');
        process.exit(1);
      }
      seedSources();
      const source = getSourceById(sourceId);
      if (!source) {
        console.error(`Source not found: ${sourceId}`);
        console.error('Available IDs:');
        getAllSources().forEach((s) => console.error(`  ${s.id}`));
        process.exit(1);
      }
      const insights = await processSingleSource(source);
      console.log('\n── Generated Insights ───────────────────');
      insights.forEach((insight) => printInsight(insight));
      break;
    }

    default:
      // Full pipeline demo
      await runFullPipeline();
      printDailyPayload();
      break;
  }
}

function printStats(): void {
  const stats = getStats();
  console.log('\n── Tarbiyah Database Stats ──────────────');
  console.log(`  Sources:            ${stats.totalSources}`);
  console.log(`  Processed sources:  ${stats.processedSources}`);
  console.log(`  Total insights:     ${stats.totalInsights}`);
  console.log(`  Published:          ${stats.publishedInsights}`);
  console.log(`  Drafts:             ${stats.draftInsights}`);
  console.log('─────────────────────────────────────────\n');
}

function printSources(): void {
  const sources = getAllSources();
  console.log('\n── Curated Source Repository ────────────');
  sources.forEach((s) => {
    console.log(`\n  [${s.type.toUpperCase()}] ${s.title}`);
    console.log(`  ID:     ${s.id}`);
    console.log(`  Author: ${s.author ?? s.speakerName ?? 'Unknown'}`);
    console.log(`  Tags:   ${s.tags.join(', ')}`);
    console.log(`  URL:    ${s.url}`);
  });
  console.log('\n─────────────────────────────────────────\n');
}

function printDrafts(): void {
  const drafts = getDraftInsights();

  if (drafts.length === 0) {
    console.log('\n  No draft insights. Run the pipeline first.\n');
    return;
  }

  console.log(`\n── Draft Insights (${drafts.length}) ────────────────`);
  drafts.forEach((insight) => printInsight(insight));
}

function printDailyPayload(): void {
  const payload = buildTodaysDailyPayload();

  if (!payload) {
    console.log('\n  No published insights yet. Run the full pipeline first.\n');
    return;
  }

  console.log('\n══ Today\'s App Payload ════════════════════\n');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n══════════════════════════════════════════\n');
}

function printInsight(insight: {
  id: string;
  dailyInsight: string;
  spiritualInsight?: string;
  educationalInsight?: string;
  actionStep?: string;
  attribution: string;
  tags: string[];
  status: string;
  sourceGrounding: { confidence: string; clarification: string };
}): void {
  console.log(`\n  ┌── Insight [${insight.id.slice(0, 8)}] ──────────────────`);
  console.log(`  │ Status: ${insight.status}`);
  console.log(`  │`);
  console.log(`  │ Daily Insight:`);
  console.log(`  │   "${insight.dailyInsight}"`);

  if (insight.spiritualInsight) {
    console.log(`  │`);
    console.log(`  │ Spiritual Insight:`);
    console.log(`  │   "${insight.spiritualInsight}"`);
  }

  if (insight.educationalInsight) {
    console.log(`  │`);
    console.log(`  │ Educational Insight:`);
    console.log(`  │   "${insight.educationalInsight}"`);
  }

  if (insight.actionStep) {
    console.log(`  │`);
    console.log(`  │ Action Step:`);
    console.log(`  │   "${insight.actionStep}"`);
  }

  console.log(`  │`);
  console.log(`  │ Attribution:  ${insight.attribution}`);
  console.log(`  │ Tags:         ${insight.tags.join(', ')}`);
  console.log(`  │ Confidence:   ${insight.sourceGrounding.confidence}`);
  console.log(`  │ Grounding:    ${insight.sourceGrounding.clarification}`);
  console.log(`  └───────────────────────────────────────────\n`);
}

main().catch((err) => {
  console.error('\n✗ Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
