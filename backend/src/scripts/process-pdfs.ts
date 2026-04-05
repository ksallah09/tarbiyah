import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { seedSources, getSourceById, getStats } from '../data/database';
import { processSingleSource } from '../pipeline/daily';

async function run() {
  seedSources();
  const ids = ['sci-pdf-01', 'sci-pdf-02', 'sci-pdf-03'];
  for (const id of ids) {
    const src = getSourceById(id);
    if (!src) { console.log(`✗ Not found: ${id}`); continue; }
    console.log(`\nProcessing: ${id} — "${src.title}"`);
    try {
      await processSingleSource(src);
      console.log(`✓ Done: ${id}`);
    } catch (e) {
      console.error(`✗ Failed: ${id} —`, e instanceof Error ? e.message : e);
    }
  }
  console.log('\nStats:', getStats());
}

run();
