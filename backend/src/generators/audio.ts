/**
 * Audio overview generator — Gemini multi-speaker TTS
 *
 * Generates a NotebookLM-style podcast conversation from a learning module:
 *   1. Gemini writes a two-host dialogue script grounded in the module content
 *   2. gemini-2.5-flash-preview-tts renders the full conversation in one request
 *      with two distinct voices (Aoede + Charon) — natural prosody, no stitching
 *   3. Raw PCM is wrapped in a WAV header and uploaded to Supabase Storage
 *   4. Returns the public audio URL
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../config/supabase';
import { getTextModel, generateWithRetry, MODEL_FAST } from '../config/gemini';
import { AppModule } from '../types';

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

// Gemini built-in voice names — Aoede (bright, warm) + Charon (clear, grounded)
const SPEAKER_A = 'Amira';
const SPEAKER_B = 'Yusuf';
const VOICE_A   = 'Aoede';
const VOICE_B   = 'Charon';

// ─── Script generation ────────────────────────────────────────────────────────

const SCRIPT_SYSTEM_PROMPT = `You are writing a short, warm podcast-style audio overview for the Tarbiyah app — an Islamic parenting app. Two hosts, ${SPEAKER_A} and ${SPEAKER_B}, are having a natural, friendly conversation about a parenting topic for Muslim parents.

RULES:
- Write exactly 12–16 exchanges (one line per host turn).
- Keep each line under 40 words — short, spoken, conversational.
- Hosts refer to each other by name at most twice total.
- Grounded in the module content provided — do not invent facts or hadith.
- Warm, practical, empathetic tone. No jargon.
- End with a brief encouraging close — one line each.
- Do NOT include stage directions, sound effects, or any text outside the speaker lines.

FORMAT — respond with only lines like this, nothing else:
${SPEAKER_A}: "..."
${SPEAKER_B}: "..."
${SPEAKER_A}: "..."
...`;

function buildScriptPrompt(mod: AppModule): string {
  const lessonSummaries = mod.lessons.map(
    (l, i) => `Lesson ${i + 1} — ${l.title}: ${l.miniTakeaway}`
  ).join('\n');

  return `MODULE TITLE: ${mod.title}
TOPIC: ${mod.topic}
SUMMARY: ${mod.issueSummary}
REFRAME: ${mod.parentReframe}
GOAL: ${mod.moduleGoal}

LESSONS:
${lessonSummaries}

KEY HABITS: ${mod.weeklyHabits?.join(', ')}
ENCOURAGEMENT: ${mod.finalEncouragement}`;
}

async function generateScript(mod: AppModule): Promise<string> {
  const model = getTextModel(MODEL_FAST, SCRIPT_SYSTEM_PROMPT);
  const raw   = await generateWithRetry(model, buildScriptPrompt(mod), MODEL_FAST, SCRIPT_SYSTEM_PROMPT);

  // Validate we got real dialogue lines
  const lines = raw.split('\n').filter(l => l.trim().startsWith(`${SPEAKER_A}:`) || l.trim().startsWith(`${SPEAKER_B}:`));
  if (lines.length < 4) {
    throw new Error(`Script generation produced too few lines (${lines.length}). Raw: ${raw.slice(0, 300)}`);
  }

  return raw.trim();
}

// ─── Gemini multi-speaker TTS ─────────────────────────────────────────────────

async function scriptToWav(script: string, apiKey: string): Promise<Buffer> {
  const genAI = new GoogleGenerativeAI(apiKey);

  // The TTS model uses generateContent with responseModalities: ['AUDIO']
  const model = genAI.getGenerativeModel({ model: TTS_MODEL });

  const result = await (model as any).generateContent({
    contents: [{ role: 'user', parts: [{ text: script }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: SPEAKER_A, voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_A } } },
            { speaker: SPEAKER_B, voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_B } } },
          ],
        },
      },
    },
  });

  const part = result.response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error('Gemini TTS returned no audio data.');
  }

  const pcm = Buffer.from(part.inlineData.data, 'base64');

  // Parse sample rate from mimeType e.g. "audio/pcm;rate=24000"
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

async function uploadAudio(moduleId: string, wavBuffer: Buffer): Promise<string> {
  const fileName = `${moduleId}.wav`;

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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateModuleAudio(mod: AppModule, apiKey: string): Promise<string> {
  console.log(`[audio] Generating script for module: ${mod.id}`);
  const script = await generateScript(mod);
  console.log(`[audio] Script ready (${script.split('\n').length} lines)`);

  console.log(`[audio] Running Gemini TTS...`);
  const wav = await scriptToWav(script, apiKey);
  console.log(`[audio] Audio ready: ${(wav.length / 1024).toFixed(0)}KB`);

  const url = await uploadAudio(mod.id, wav);
  console.log(`[audio] Uploaded: ${url}`);

  return url;
}
