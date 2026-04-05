import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { seedSources, getSourceById, getStats } from '../data/database';
import { processSingleSource } from '../pipeline/daily';

async function run() {
  await seedSources();
  const ids = ['sci-pdf-01', 'sci-pdf-03'];
  for (const id of ids) {
    const src = await getSourceById(id);
    if (!src) { console.log(`✗ Not found: ${id}`); continue; }
    console.log(`\nProcessing: ${id} — "${src.title}"`);
    try {
      await processSingleSource(src);
      console.log(`✓ Done: ${id}`);
    } catch (e) {
      console.error(`✗ Failed: ${id} —`, e instanceof Error ? e.message : e);
    }
  }
  const stats = await getStats();
  console.log('\nStats:', stats);
}

run().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
