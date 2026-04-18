import axios from 'axios';
import { getJsonModel, generateWithRetry, MODEL_FAST } from '../config/gemini';
import {
  SYSTEM_INSTRUCTION,
  TEXT_EXTRACTION_PROMPT,
} from '../prompts/system';
import { Source, ExtractedContent, GeminiExtractionResponse } from '../types';
import { parseJsonRobustly } from '../utils/json';

const MAX_CONTENT_CHARS = 80_000; // Gemini 1.5 Flash handles up to 1M tokens, but we cap for efficiency

/**
 * Processes text-based sources: articles, web pages, and online book excerpts.
 *
 * Flow:
 *   1. Fetch the URL content
 *   2. Strip HTML to extract readable text
 *   3. Pass to Gemini for parenting insight extraction
 */
export async function processTextSource(
  source: Pick<Source, 'id' | 'title' | 'url' | 'author' | 'tags' | 'description'>
): Promise<ExtractedContent> {
  const textContent = await fetchAndExtractText(source.url, source.title);

  if (!textContent || textContent.length < 200) {
    throw new Error(
      `Text processor: Could not extract sufficient text content from "${source.url}". ` +
      `Got ${textContent?.length ?? 0} characters.`
    );
  }

  const truncated =
    textContent.length > MAX_CONTENT_CHARS
      ? textContent.slice(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated for processing]'
      : textContent;

  return extractInsightsFromText(truncated, source);
}

async function fetchAndExtractText(url: string, title: string): Promise<string> {
  console.log(`  → Fetching text content: ${title}`);

  let response;
  try {
    response = await axios.get<string>(url, {
      timeout: 20_000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TarbiyahApp/1.0)',
        Accept: 'text/html,text/plain,application/xhtml+xml',
      },
    });
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      throw new Error(
        `URL_NOT_FOUND: "${url}" returned 404. The article may have moved. ` +
        `Update the URL in sources.ts and re-run.`
      );
    }
    if (status === 403 || status === 429) {
      throw new Error(
        `URL_BLOCKED: "${url}" returned ${status}. The site is blocking the request.`
      );
    }
    throw err;
  }

  const content = response.data;

  // If plain text, return directly
  if (
    response.headers['content-type']?.includes('text/plain') ||
    !content.includes('<')
  ) {
    return content;
  }

  // Strip HTML tags — simple but effective for articles
  return stripHtml(content);
}

function stripHtml(html: string): string {
  return html
    // Remove scripts and styles entirely
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s{3,}/g, '\n\n')
    .trim();
}

async function extractInsightsFromText(
  textContent: string,
  source: Pick<Source, 'title' | 'author' | 'tags' | 'description'>
): Promise<ExtractedContent> {
  const model = getJsonModel(MODEL_FAST, SYSTEM_INSTRUCTION);

  const prompt = [
    `SOURCE DETAILS:`,
    `Title: ${source.title}`,
    source.author ? `Author / Publisher: ${source.author}` : '',
    `Topics: ${source.tags.join(', ')}`,
    source.description ? `Description: ${source.description}` : '',
    ``,
    `SOURCE CONTENT:`,
    textContent,
    ``,
    TEXT_EXTRACTION_PROMPT,
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await generateWithRetry(model, prompt, MODEL_FAST, SYSTEM_INSTRUCTION);

  let parsed: GeminiExtractionResponse;
  try {
    parsed = parseJsonRobustly(raw) as GeminiExtractionResponse;
  } catch {
    throw new Error(
      `Text processor: Gemini returned unparseable JSON for source "${source.title}".\n` +
      `Raw response (first 500 chars): ${raw.slice(0, 500)}`
    );
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
    emotionalTone: parsed.emotionalTone ?? 'informative and grounded',
    targetAudience: parsed.targetAudience ?? 'Muslim parents',
    rawSummary: parsed.rawSummary ?? `Content extracted from article: ${source.title}`,
  };
}
