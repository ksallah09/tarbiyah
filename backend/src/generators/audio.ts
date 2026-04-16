/**
 * Per-lesson audio narration — OpenAI TTS
 *
 * For each lesson:
 *   1. Lesson content is formatted into a natural narration text
 *   2. OpenAI tts-1 renders it as MP3 with the "nova" voice
 *   3. MP3 is uploaded to Supabase Storage
 *
 * Lessons are generated sequentially to avoid rate limits.
 */

import { supabase } from '../config/supabase';
import { getOpenAIClient } from '../config/openai';
import { AppModule, ModuleLesson } from '../types';

const TTS_MODEL  = 'tts-1';
const NARR_VOICE = 'nova'; // warm, clear female narrator

// ─── Narration text builder ───────────────────────────────────────────────────

function buildNarrationText(lesson: ModuleLesson): string {
  const parts: string[] = [
    `Lesson: ${lesson.title}.`,
    lesson.objective ? `Your goal is to ${lesson.objective.replace(/^To\s+/i, '')}` : null,
    lesson.whyItMatters,
  ].filter(Boolean) as string[];

  if (lesson.islamicGuidance) {
    parts.push(`From an Islamic perspective: ${lesson.islamicGuidance}`);
  }
  if (lesson.researchInsight) {
    parts.push(`What the research tells us: ${lesson.researchInsight}`);
  }
  if (lesson.actionSteps?.length) {
    parts.push(`Here are some practical steps. ${lesson.actionSteps.join('. ')}.`);
  }
  if (lesson.whatToSay?.length) {
    parts.push(`You might say to your child: ${lesson.whatToSay[0]}`);
  }
  if (lesson.reflectionQuestion) {
    parts.push(`A question to sit with: ${lesson.reflectionQuestion}`);
  }
  if (lesson.miniTakeaway) {
    parts.push(`Remember: ${lesson.miniTakeaway}`);
  }

  return parts.filter(Boolean).join(' ');
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateAllLessonNarrations(
  mod: AppModule
): Promise<Record<number, string>> {
  console.log(`[audio] Generating narrations for ${mod.lessons.length} lessons`);

  const audioMap: Record<number, string> = {};

  for (const lesson of mod.lessons) {
    try {
      const text = buildNarrationText(lesson);
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
