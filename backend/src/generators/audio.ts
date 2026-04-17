/**
 * Per-lesson audio narration — OpenAI TTS
 *
 * For each lesson:
 *   1. Lesson content is formatted into a natural narration text
 *   2. OpenAI tts-1 renders it as MP3 with the "shimmer" voice
 *   3. MP3 is uploaded to Supabase Storage
 *
 * Lessons are generated sequentially to avoid rate limits.
 */

import { supabase } from '../config/supabase';
import { getOpenAIClient } from '../config/openai';
import { AppModule, ModuleLesson } from '../types';

const TTS_MODEL  = 'tts-1';
const NARR_VOICE = 'shimmer'; // calm, warm narrator

// ─── Narration text builder ───────────────────────────────────────────────────

function buildNarrationText(lesson: ModuleLesson): string {
  // Each section is its own paragraph — TTS pauses naturally at paragraph breaks
  const sections: string[] = [];

  // Title + objective
  const titleLine = `${lesson.title}.`;
  const objLine = lesson.objective
    ? (() => { const o = lesson.objective.replace(/^To\s+/i, ''); return `Your goal is to ${o.charAt(0).toLowerCase()}${o.slice(1)}.`; })()
    : null;
  sections.push([titleLine, objLine].filter(Boolean).join(' '));

  if (lesson.whyItMatters) {
    sections.push(lesson.whyItMatters);
  }
  if (lesson.islamicGuidance) {
    sections.push(`From an Islamic perspective — ${lesson.islamicGuidance}`);
  }
  if (lesson.researchInsight) {
    sections.push(`What the research tells us — ${lesson.researchInsight}`);
  }
  if (lesson.actionSteps?.length) {
    const steps = lesson.actionSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
    sections.push(`Here are some practical steps.\n${steps}`);
  }
  if (lesson.whatToSay?.length) {
    const phrases = lesson.whatToSay.map((p: string, i: number) => `${i + 1}. "${p}"`).join('\n');
    sections.push(`Here are some things you might say to your child.\n${phrases}`);
  }
  if (lesson.mistakesToAvoid?.length) {
    const mistakes = lesson.mistakesToAvoid.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n');
    sections.push(`Common mistakes to avoid.\n${mistakes}`);
  }
  if (lesson.reflectionQuestion) {
    sections.push(`A question to sit with — ${lesson.reflectionQuestion}`);
  }
  if (lesson.miniTakeaway) {
    sections.push(`Remember — ${lesson.miniTakeaway}`);
  }

  // Double newline between sections = paragraph break = natural pause in TTS
  return sections.filter(Boolean).join('\n\n');
}

// ─── TTS text sanitiser ───────────────────────────────────────────────────────
// Expands Islamic abbreviations so the narrator reads them naturally

function sanitizeForTts(text: string): string {
  return text
    // Prophet ﷺ abbreviations
    .replace(/\(p\.?b\.?u\.?h\.?\)/gi, 'peace and blessings be upon him')
    .replace(/\bp\.?b\.?u\.?h\.?\b/gi,  'peace and blessings be upon him')
    .replace(/\(s\.?a\.?w\.?\)/gi,       'peace and blessings be upon him')
    .replace(/\bs\.?a\.?w\.?\b/gi,       'peace and blessings be upon him')
    // Allah ﷻ
    .replace(/\(s\.?w\.?t\.?\)/gi,       'glorified and exalted be He')
    .replace(/\bs\.?w\.?t\.?\b/gi,       'glorified and exalted be He')
    // Companions
    .replace(/\(r\.?a\.?\)/gi,           'may Allah be pleased with them')
    .replace(/\(a\.?s\.?\)/gi,           'peace be upon him');
}

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────

async function textToMp3(text: string): Promise<Buffer> {
  const client = getOpenAIClient();
  if (!client) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await client.audio.speech.create({
    model: TTS_MODEL,
    voice: NARR_VOICE,
    input: text,
    response_format: 'mp3',
  });

  return Buffer.from(await response.arrayBuffer());
}

// ─── Supabase Storage upload ──────────────────────────────────────────────────

const BUCKET = 'module-audio';

async function uploadAudio(fileId: string, mp3Buffer: Buffer): Promise<string> {
  const fileName = `${fileId}.mp3`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, mp3Buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ─── Single lesson export (used by per-lesson parallel frontend requests) ─────

export async function generateSingleLessonNarration(
  moduleId: string,
  lesson: ModuleLesson
): Promise<string> {
  const text = sanitizeForTts(buildNarrationText(lesson));
  const mp3  = await textToMp3(text);
  const url  = await uploadAudio(`${moduleId}_lesson_${lesson.id}`, mp3);
  console.log(`[audio] Lesson ${lesson.id} done: ${(mp3.length / 1024).toFixed(0)}KB`);
  return url;
}

// ─── Batch export (kept for reference) ───────────────────────────────────────

export async function generateAllLessonNarrations(
  mod: AppModule
): Promise<Record<number, string>> {
  console.log(`[audio] Generating narrations for ${mod.lessons.length} lessons`);

  const audioMap: Record<number, string> = {};

  for (const lesson of mod.lessons) {
    try {
      const text = sanitizeForTts(buildNarrationText(lesson));
      const mp3  = await textToMp3(text);
      const url  = await uploadAudio(`${mod.id}_lesson_${lesson.id}`, mp3);
      console.log(`[audio] Lesson ${lesson.id} done: ${(mp3.length / 1024).toFixed(0)}KB`);
      audioMap[lesson.id] = url;
    } catch (err) {
      console.error(`[audio] Lesson ${lesson.id} narration failed:`, err);
    }
  }

  return audioMap;
}
