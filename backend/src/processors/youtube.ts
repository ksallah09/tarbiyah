import { Part } from '@google/generative-ai';
import { getJsonModel, generateWithRetry, MODEL_HEAVY, MODEL_FAST } from '../config/gemini';
import { SYSTEM_INSTRUCTION, YOUTUBE_EXTRACTION_PROMPT } from '../prompts/system';
import { Source, ExtractedContent, GeminiExtractionResponse } from '../types';
import { parseJsonRobustly } from '../utils/json';

// gemini-1.5-flash supports up to 2M tokens — used as fallback for very long videos
const MODEL_LONG_VIDEO = 'gemini-1.5-flash';

export async function processYouTubeSource(
  source: Pick<Source, 'id' | 'title' | 'url' | 'author' | 'speakerName' | 'tags' | 'description' | 'language'>
): Promise<ExtractedContent> {
  const parts: Part[] = [
    { text: buildContextPreamble(source) },
    { fileData: { mimeType: 'video/*', fileUri: source.url } },
    { text: source.language !== 'en' ? `The video is in a non-English language. Listen to the audio, understand the content, then respond entirely in English — translating and summarising the key parenting insights.\n\n${YOUTUBE_EXTRACTION_PROMPT}` : YOUTUBE_EXTRACTION_PROMPT },
  ];

  console.log(`  → Analyzing YouTube video: ${source.title}`);

  let raw: string;
  try {
    const model = getJsonModel(MODEL_HEAVY, SYSTEM_INSTRUCTION);
    raw = await generateWithRetry(model, parts, MODEL_HEAVY, SYSTEM_INSTRUCTION);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Token limit exceeded — fall back to gemini-1.5-flash which supports 2M tokens
    if (msg.includes('token count exceeds') || msg.includes('400')) {
      console.warn(`  ⚠ Video too long for ${MODEL_HEAVY} — retrying with ${MODEL_LONG_VIDEO} (2M token context)`);
      const fallback = getJsonModel(MODEL_LONG_VIDEO, SYSTEM_INSTRUCTION);
      raw = await generateWithRetry(fallback, parts, MODEL_LONG_VIDEO, SYSTEM_INSTRUCTION);
    } else {
      throw err;
    }
  }

  let parsed: GeminiExtractionResponse;
  try {
    parsed = parseJsonRobustly(raw) as GeminiExtractionResponse;
  } catch {
    throw new Error(
      `YouTube processor: Gemini returned unparseable JSON for "${source.title}".\n` +
      `Raw response (first 500 chars): ${raw.slice(0, 500)}`
    );
  }

  return validateExtractedContent(parsed, source.title);
}

function buildContextPreamble(
  source: Pick<Source, 'title' | 'author' | 'speakerName' | 'tags' | 'description' | 'language'>
): string {
  const speaker = source.speakerName ?? source.author ?? 'Unknown Speaker';
  return [
    `You are about to analyze a video for the Tarbiyah app.`,
    ``,
    `VIDEO DETAILS:`,
    `Title: ${source.title}`,
    `Speaker: ${speaker}`,
    `Language: ${source.language === 'ar' ? 'Arabic' : source.language === 'bilingual' ? 'Arabic/English' : 'English'}`,
    `Topics: ${source.tags.join(', ')}`,
    source.description ? `Description: ${source.description}` : '',
    ``,
    `Focus your analysis on parenting insights relevant to Muslim families.`,
    `Extract what is genuinely useful, spiritually grounded, and practically applicable.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function validateExtractedContent(
  parsed: Partial<GeminiExtractionResponse>,
  sourceTitle: string
): ExtractedContent {
  if (!parsed.coreTheme) {
    throw new Error(
      `YouTube processor: Missing "coreTheme" in response for "${sourceTitle}"`
    );
  }
  return {
    coreTheme: parsed.coreTheme,
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
    islamicReferences: Array.isArray(parsed.islamicReferences) ? parsed.islamicReferences : [],
    practicalAdvice: Array.isArray(parsed.practicalAdvice) ? parsed.practicalAdvice : [],
    emotionalTone: parsed.emotionalTone ?? 'reflective and beneficial',
    targetAudience: parsed.targetAudience ?? 'Muslim parents',
    rawSummary: parsed.rawSummary ?? `Parenting insights extracted from: ${sourceTitle}`,
  };
}
