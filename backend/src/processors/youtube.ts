import { Part } from '@google/generative-ai';
import { getJsonModel, generateWithRetry, MODEL_HEAVY } from '../config/gemini';
import { SYSTEM_INSTRUCTION, YOUTUBE_EXTRACTION_PROMPT } from '../prompts/system';
import { Source, ExtractedContent, GeminiExtractionResponse } from '../types';

export async function processYouTubeSource(
  source: Pick<Source, 'id' | 'title' | 'url' | 'author' | 'speakerName' | 'tags' | 'description' | 'language'>
): Promise<ExtractedContent> {
  const model = getJsonModel(MODEL_HEAVY, SYSTEM_INSTRUCTION);

  const parts: Part[] = [
    { text: buildContextPreamble(source) },
    { fileData: { mimeType: 'video/*', fileUri: source.url } },
    { text: source.language !== 'en' ? `The video is in a non-English language. Listen to the audio, understand the content, then respond entirely in English — translating and summarising the key parenting insights.\n\n${YOUTUBE_EXTRACTION_PROMPT}` : YOUTUBE_EXTRACTION_PROMPT },
  ];

  console.log(`  → Analyzing YouTube video: ${source.title}`);

  const raw = await generateWithRetry(model, parts, MODEL_HEAVY, SYSTEM_INSTRUCTION);

  let parsed: GeminiExtractionResponse;
  try {
    parsed = JSON.parse(raw) as GeminiExtractionResponse;
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
