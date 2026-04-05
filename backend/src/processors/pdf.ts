import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileState } from '@google/generative-ai/server';
import { fileManager, getJsonModel, MODEL_HEAVY } from '../config/gemini';
import {
  SYSTEM_INSTRUCTION,
  PDF_EXTRACTION_PROMPT,
} from '../prompts/system';
import { Source, ExtractedContent, GeminiExtractionResponse } from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

/**
 * Processes a PDF source using Gemini's File API.
 *
 * Flow:
 *   1. Download the PDF to a temp file
 *   2. Upload via Gemini File API
 *   3. Poll until the file is ACTIVE
 *   4. Generate content from the uploaded file
 *   5. Clean up temp file and uploaded file
 */
export async function processPdfSource(
  source: Pick<Source, 'id' | 'title' | 'url' | 'author' | 'tags' | 'description'>
): Promise<ExtractedContent> {
  const tempPath = await downloadPdf(source.url, source.title);

  let uploadedFileUri: string | undefined;

  try {
    const uploadedFile = await uploadPdfToGemini(tempPath, source.title);
    uploadedFileUri = uploadedFile.uri;

    await waitForFileActive(uploadedFile.name);

    const extracted = await extractFromUploadedPdf(
      uploadedFile.uri,
      uploadedFile.mimeType ?? 'application/pdf',
      source
    );

    return extracted;
  } finally {
    // Always clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // Attempt to delete from Gemini File API (best effort)
    if (uploadedFileUri) {
      try {
        const fileName = uploadedFileUri.split('/').pop()!;
        await fileManager.deleteFile(fileName);
      } catch {
        // Non-critical — files expire automatically
      }
    }
  }
}

async function downloadPdf(url: string, title: string): Promise<string> {
  console.log(`  → Downloading PDF: ${title}`);

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'TarbiyahApp/1.0 (PDF Processor)' },
  });

  const tempPath = path.join(
    os.tmpdir(),
    `tarbiyah-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  );

  fs.writeFileSync(tempPath, Buffer.from(response.data));
  console.log(`  → PDF downloaded to temp: ${path.basename(tempPath)}`);

  return tempPath;
}

async function uploadPdfToGemini(
  filePath: string,
  title: string
): Promise<{ uri: string; name: string; mimeType: string }> {
  console.log(`  → Uploading to Gemini File API: ${title}`);

  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType: 'application/pdf',
    displayName: title,
  });

  console.log(`  → Uploaded. File name: ${uploadResult.file.name}`);

  return {
    uri: uploadResult.file.uri,
    name: uploadResult.file.name,
    mimeType: uploadResult.file.mimeType,
  };
}

async function waitForFileActive(fileName: string): Promise<void> {
  console.log(`  → Waiting for file to be ready...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const file = await fileManager.getFile(fileName);

    if (file.state === FileState.ACTIVE) {
      console.log(`  → File is ready.`);
      return;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini File API processing failed for file: ${fileName}`);
    }

    // PROCESSING state — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `File ${fileName} did not become ACTIVE within ${
      (MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000
    }s`
  );
}

async function extractFromUploadedPdf(
  fileUri: string,
  mimeType: string,
  source: Pick<Source, 'title' | 'author' | 'tags' | 'description'>
): Promise<ExtractedContent> {
  const model = getJsonModel(MODEL_HEAVY, SYSTEM_INSTRUCTION);

  const contextPreamble = [
    `You are about to analyze a PDF document for the Tarbiyah Islamic parenting app.`,
    ``,
    `DOCUMENT DETAILS:`,
    `Title: ${source.title}`,
    source.author ? `Author: ${source.author}` : '',
    `Topics: ${source.tags.join(', ')}`,
    source.description ? `Description: ${source.description}` : '',
    ``,
    `Extract the most valuable parenting wisdom from this document.`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await model.generateContent([
    { text: contextPreamble },
    {
      fileData: { fileUri, mimeType },
    },
    { text: PDF_EXTRACTION_PROMPT },
  ]);

  const raw = result.response.text();

  let parsed: GeminiExtractionResponse;
  try {
    parsed = JSON.parse(raw) as GeminiExtractionResponse;
  } catch {
    throw new Error(
      `PDF processor: Gemini returned unparseable JSON for source "${source.title}".\n` +
      `Raw response (first 500 chars): ${raw.slice(0, 500)}`
    );
  }

  const extractedAuthor = typeof parsed.author === 'string' && parsed.author.trim()
    ? parsed.author.trim()
    : undefined;

  if (extractedAuthor) {
    console.log(`  → Extracted author from PDF: "${extractedAuthor}"`);
  }

  return {
    coreTheme: parsed.coreTheme ?? '',
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
    islamicReferences: Array.isArray(parsed.islamicReferences)
      ? parsed.islamicReferences
      : [],
    practicalAdvice: Array.isArray(parsed.practicalAdvice)
      ? parsed.practicalAdvice
      : [],
    emotionalTone: parsed.emotionalTone ?? 'reflective and grounding',
    targetAudience: parsed.targetAudience ?? 'Muslim parents',
    rawSummary: parsed.rawSummary ?? `Content extracted from: ${source.title}`,
    extractedAuthor,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
