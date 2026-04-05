/**
 * Test runner — processes two specific sources and writes the daily payload
 * to src/data/insights.json in the React Native project for live app testing.
 *
 * Usage:
 *   npx ts-node src/scripts/test-run.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { seedSources, getSourceById, getStats } from '../data/database';
import { processSingleSource, approveAllDrafts, publishAllApproved } from '../pipeline/daily';
import { getPublishedInsightsByCategory } from '../data/database';
import { buildDailyPayload } from '../generators/insights';
import { Source } from '../types';

// Output path: React Native src/data/insights.json
const OUTPUT_PATH = path.resolve(__dirname, '../../../src/data/insights.json');

const TEST_SOURCES = ['yt-spiritual-03', 'sci-pdf-03'];

async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  Tarbiyah — Test Run');
  console.log(`  Sources: ${TEST_SOURCES.join(', ')}`);
  console.log('══════════════════════════════════════════\n');

  seedSources();

  for (const sourceId of TEST_SOURCES) {
    const source = getSourceById(sourceId);
    if (!source) {
      console.error(`✗ Source not found: ${sourceId}`);
      process.exit(1);
    }
    await processSingleSource(source);
  }

  approveAllDrafts();
  publishAllApproved();

  const spiritual = getPublishedInsightsByCategory('spiritual', 1);
  const science   = getPublishedInsightsByCategory('science', 1);

  if (!spiritual[0] || !science[0]) {
    console.error('✗ Missing published insights — check processing logs above.');
    process.exit(1);
  }

  const spiritualSource = getSourceById(spiritual[0].sourceId) as Source;
  const scienceSource   = getSourceById(science[0].sourceId) as Source;
  const payload = buildDailyPayload(spiritual[0], science[0], spiritualSource, scienceSource);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`\n✓ Payload written to:\n  ${OUTPUT_PATH}\n`);
  console.log('── Preview ──────────────────────────────────────────');
  console.log(`Spiritual card:  "${payload.insights[0].insightTitle}"`);
  console.log(`                 "${payload.insights[0].body.slice(0, 100)}..."`);
  console.log(`Science card:    "${payload.insights[1].insightTitle}"`);
  console.log(`                 "${payload.insights[1].body.slice(0, 100)}..."`);
  console.log(`Action goals:    ${payload.actionGoals.length}`);
  console.log('─────────────────────────────────────────────────────\n');

  console.log('Stats:', getStats());
}

main().catch((err) => {
  console.error('\n✗ Test run failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
