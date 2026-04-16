/**
 * Per-lesson audio narration — Gemini single-speaker TTS
 *
 * For each lesson:
 *   1. Lesson content is formatted into a natural narration text (no separate script step)
 *   2. gemini-2.5-flash-preview-tts renders it in one request with a single warm voice
 *   3. Raw PCM is wrapped in a WAV header and uploaded to Supabase Storage
 *
 * All 5 lessons are generated in parallel so total time ≈ slowest single lesson.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../config/supabase';
import { AppModule, ModuleLesson } from '../types';

const TTS_MODEL  = 'gemini-2.5-flash-preview-tts';
const NARR_VOICE = 'Aoede'; // warm, clear female narrator

// ─── Narration text builder ───────────────────────────────────────────────────

function buildNarrationText(lesson: ModuleLesson): string {
  const parts: string[] = [
    `Lesson: ${lesson.title}.`,
    lesson.objective,
    lesson.whyItMatters,
  ];

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

const NARRATION_SYSTEM = `You are a warm, knowledgeable narrator for Tarbiyah, an Islamic parenting app.
Narrate the following lesson content directly to a Muslim parent in a calm, clear, encouraging tone —
as if you are a trusted guide speaking to them personally. Be natural and conversational, not robotic.`;

// ─── Gemini single-speaker TTS ────────────────────────────────────────────────

async function textToWav(text: string, apiKey: string): Promise<Buffer> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Pass system instruction on the model, not in the content — otherwise TTS reads it aloud
  const model = genAI.getGenerativeModel({ model: TTS_MODEL, systemInstruction: NARRATION_SYSTEM });

  const result = await (model as any).generateContent({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: NARR_VOICE } },
      },
    },
  });

  const part = result.response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) throw new Error('Gemini TTS returned no audio data.');

  const pcm = Buffer.from(part.inlineData.data, 'base64');
  const mimeType: string = part.inlineData.mimeType ?? 'audio/pcm;rate=24000';
  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

  return pcmToWav(pcm, sampleRate);
}

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const dataSize   = pcm.length;
  const header     = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);                                        // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

// ─── Supabase Storage upload ──────────────────────────────────────────────────

const BUCKET = 'module-audio';

async function uploadAudio(fileId: string, wavBuffer: Buffer): Promise<string> {
  const fileName = `${fileId}.wav`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, wavBuffer, {
      contentType: 'audio/wav',
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ─── Main export — generates all lesson narrations in parallel ────────────────

export async function generateAllLessonNarrations(
  mod: AppModule,
  apiKey: string
): Promise<Record<number, string>> {
  console.log(`[audio] Generating narrations for ${mod.lessons.length} lessons in parallel`);

  const results = await Promise.allSettled(
    mod.lessons.map(async (lesson) => {
      const text = buildNarrationText(lesson);
      const wav  = await textToWav(text, apiKey);
      const url  = await uploadAudio(`${mod.id}_lesson_${lesson.id}`, wav);
      console.log(`[audio] Lesson ${lesson.id} done: ${(wav.length / 1024).toFixed(0)}KB`);
      return { id: lesson.id, url };
    })
  );

  const audioMap: Record<number, string> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      audioMap[result.value.id] = result.value.url;
    } else {
      console.error('[audio] Lesson narration failed:', result.reason);
    }
  }

  return audioMap;
}
