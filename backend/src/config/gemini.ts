import * as dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI, GenerativeModel, ModelParams, Part } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Ensure your backend/.env file contains ${key}=your_key_here`
    );
  }
  return value;
}

const apiKey = requireEnv('GEMINI_API_KEY');

export const genAI = new GoogleGenerativeAI(apiKey);
export const fileManager = new GoogleAIFileManager(apiKey);

export const MODEL_HEAVY = process.env.GEMINI_MODEL_HEAVY ?? 'gemini-2.5-pro';
export const MODEL_FAST  = process.env.GEMINI_MODEL_FAST  ?? 'gemini-2.5-flash';

export function getJsonModel(
  modelId: string,
  systemInstruction: string,
  extraParams?: Partial<ModelParams>
): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelId,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      topP: 0.9,
    },
    ...extraParams,
  });
}

export function getTextModel(
  modelId: string,
  systemInstruction: string
): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelId,
    systemInstruction,
    generationConfig: {
      temperature: 0.65,
      topP: 0.92,
    },
  });
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const RETRYABLE_CODES = [503, 429, 500];
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 3000;

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE_CODES.some((code) => msg.includes(String(code)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Calls model.generateContent with automatic retry on 503/429/500.
 * On each failure it waits BASE_DELAY * 2^attempt ms, then retries.
 * If MODEL_HEAVY keeps failing it falls back to MODEL_FAST on the last attempt.
 */
export async function generateWithRetry(
  model: GenerativeModel,
  prompt: string | (string | Part)[],
  modelId = MODEL_HEAVY,
  systemInstruction = ''
): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;

      if (!isRetryable(err)) throw err;

      const isLastAttempt = attempt === MAX_RETRIES;

      if (isLastAttempt) {
        // If we were on the heavy model, try once more with flash
        if (modelId === MODEL_HEAVY) {
          console.warn(`  ⚠ ${MODEL_HEAVY} unavailable after ${MAX_RETRIES} retries — falling back to ${MODEL_FAST}`);
          const fallback = getJsonModel(MODEL_FAST, systemInstruction);
          const result = await fallback.generateContent(prompt);
          return result.response.text();
        }
        throw err;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`  ⚠ API error (attempt ${attempt + 1}/${MAX_RETRIES}) — retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  throw lastErr;
}
