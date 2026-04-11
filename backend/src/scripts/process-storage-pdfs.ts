/**
 * process-storage-pdfs.ts
 *
 * Discovers all PDFs in the Supabase Storage bucket `scientific_pdfs`,
 * registers each as a source, and runs the full processing pipeline on
 * any that haven't been processed yet.
 *
 * Usage:
 *   npx ts-node src/scripts/process-storage-pdfs.ts
 *
 * Options:
 *   --list          Just list files in the bucket, don't process
 *   --rerun         Re-process sources even if already completed
 *   --authors-only  Re-extract authors from PDFs only — no new insights generated
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import axios from 'axios';
import fs from 'fs';
import os from 'os';
import { FileState } from '@google/generative-ai/server';
import { fileManager, getJsonModel, MODEL_HEAVY } from '../config/gemini';
import { SYSTEM_INSTRUCTION } from '../prompts/system';
import { supabase } from '../config/supabase';
import {
  upsertSource, getSourceById, seedSources,
  updateInsightStatus, getDraftInsights,
} from '../data/database';
import { processSingleSource } from '../pipeline/daily';
import { Source } from '../types';

const BUCKET        = 'scientific_pdfs';
const SUPABASE_URL  = process.env.SUPABASE_URL!;
const RERUN         = process.argv.includes('--rerun');
const LIST_ONLY     = process.argv.includes('--list');
const AUTHORS_ONLY  = process.argv.includes('--authors-only');

/**
 * Map PDF filenames (without extension, lowercase) to their known author/org.
 * If a PDF isn't listed here it will fall back to 'Child Mind Institute'.
 * Add entries whenever you upload new PDFs so the app shows the right name + image.
 *
 * Valid org values that already have images:
 *   'Child Mind Institute'
 *   'National Institute of Child Health and Human Development'
 *   'American Academy of Pediatrics'
 *   'UC Davis Health'
 *   'UNICEF'
 */
const PDF_AUTHOR_MAP: Record<string, string> = {
  // examples — update to match your actual filenames:
  // 'early-puberty-and-mental-health':   'Child Mind Institute',
  // 'how-to-communicate-with-teenagers': 'Child Mind Institute',
  // 'tips-for-using-rewards':            'Child Mind Institute',
};

function authorFromFilename(filename: string): string {
  const key = filename.replace(/\.pdf$/i, '').toLowerCase().replace(/\s+/g, '-');
  return PDF_AUTHOR_MAP[key] ?? 'Child Mind Institute';
}

// Build the public URL for a file in the bucket
function publicUrl(filePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filePath)}`;
}

// Turn a filename into a clean title: "my-pdf-file.pdf" → "My Pdf File"
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// Stable source ID derived from filename
function sourceIdFromFilename(filename: string): string {
  return 'storage-' + filename
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, 40);
}

async function listBucketFiles(): Promise<Array<{ name: string; size: number | null }>> {
  const { data, error } = await supabase.storage.from(BUCKET).list('', {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) throw new Error(`Failed to list bucket: ${error.message}`);
  return (data ?? [])
    .filter(f => f.name.toLowerCase().endsWith('.pdf'))
    .map(f => ({ name: f.name, size: f.metadata?.size ?? null }));
}

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

async function extractAuthorFromPdf(url: string, title: string): Promise<string | null> {
  // Download
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer', timeout: 30_000,
    headers: { 'User-Agent': 'TarbiyahApp/1.0' },
  });
  const tempPath = path.join(os.tmpdir(), `tarbiyah-author-${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, Buffer.from(response.data));

  let uploadedName: string | undefined;
  try {
    // Upload to Gemini
    const upload = await fileManager.uploadFile(tempPath, {
      mimeType: 'application/pdf', displayName: title,
    });
    uploadedName = upload.file.name;

    // Wait for ACTIVE
    for (let i = 0; i < 20; i++) {
      const f = await fileManager.getFile(uploadedName);
      if (f.state === FileState.ACTIVE) break;
      if (f.state === FileState.FAILED) throw new Error('Gemini file processing failed');
      await new Promise(r => setTimeout(r, 3000));
    }

    // Ask only for the author
    const model = getJsonModel(MODEL_HEAVY, SYSTEM_INSTRUCTION);
    const result = await model.generateContent([
      { fileData: { fileUri: upload.file.uri, mimeType: 'application/pdf' } },
      { text: `Look at the cover page, title page, header, or footer of this document. Who is the author or publishing organization?\n\nReturn ONLY this JSON: { "author": "Name or Organization" }\n\nIf you cannot find an author, return: { "author": null }` },
    ]);

    const raw = result.response.text().trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return typeof parsed.author === 'string' ? parsed.author.trim() : null;
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (uploadedName) {
      try { await fileManager.deleteFile(uploadedName); } catch {}
    }
  }
}

async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  Tarbiyah — Supabase Storage PDF Importer');
  console.log(`  Bucket: ${BUCKET}`);
  console.log('══════════════════════════════════════════\n');

  await seedSources();

  console.log('Scanning bucket for PDFs...\n');
  const files = await listBucketFiles();

  if (files.length === 0) {
    console.log('No PDF files found in bucket.');
    return;
  }

  console.log(`Found ${files.length} PDF(s):\n`);
  files.forEach((f, i) => {
    const sizeKb = f.size ? Math.round(f.size / 1024) : '?';
    console.log(`  ${i + 1}. ${f.name} (${sizeKb} KB)`);
    console.log(`     ID:  ${sourceIdFromFilename(f.name)}`);
    console.log(`     URL: ${publicUrl(f.name)}\n`);
  });

  if (LIST_ONLY) return;

  // ── Authors-only mode: re-extract author from each PDF, update source, no new insights ──
  if (AUTHORS_ONLY) {
    console.log('Mode: --authors-only (no insights will be generated)\n');
    let updated = 0; let failed = 0;
    for (const file of files) {
      const sourceId = sourceIdFromFilename(file.name);
      const title    = titleFromFilename(file.name);
      const url      = publicUrl(file.name);
      console.log(`Extracting author: "${title}"`);
      try {
        const author = await extractAuthorFromPdf(url, title);
        if (author) {
          await supabase.from('sources').update({ author }).eq('id', sourceId);
          console.log(`  ✓ Author: "${author}"`);
          updated++;
        } else {
          console.log(`  ⚠ No author found in document`);
        }
      } catch (err) {
        console.error(`  ✗ Failed:`, err instanceof Error ? err.message : err);
        failed++;
      }
    }
    console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
    return;
  }

  let processed = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const file of files) {
    const sourceId = sourceIdFromFilename(file.name);
    const title    = titleFromFilename(file.name);
    const url      = publicUrl(file.name);

    const alreadyDone = await isAlreadyProcessed(sourceId);
    if (alreadyDone) {
      console.log(`⟳ Skipped (already processed): "${title}"`);
      skipped++;
      continue;
    }

    // Register the source in Supabase if not already there
    const source: Omit<Source, 'addedAt'> = {
      id:          sourceId,
      title,
      url,
      type:        'pdf',
      category:    'science',
      author:      authorFromFilename(file.name),
      tags:        ['parenting', 'child-development'],
      language:    'en',
      description: `Imported from Supabase Storage: ${file.name}`,
      isActive:    true,
    };

    await upsertSource(source);

    console.log(`\nProcessing: "${title}"`);
    try {
      await processSingleSource(source as Source);

      // Auto-approve and publish
      const drafts = await getDraftInsights();
      const mine   = drafts.filter(d => d.sourceId === sourceId);
      for (const draft of mine) {
        await updateInsightStatus(draft.id, 'approved');
        await updateInsightStatus(draft.id, 'published');
      }
      if (mine.length > 0) {
        console.log(`✓ Published ${mine.length} insight(s) from "${title}"`);
      }

      processed++;
    } catch (err) {
      console.error(`✗ Failed: "${title}" —`, err instanceof Error ? err.message : err);
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
