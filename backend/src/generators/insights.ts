import { v4 as uuidv4 } from 'uuid';
import { getJsonModel, generateWithRetry, MODEL_HEAVY } from '../config/gemini';
import { SYSTEM_INSTRUCTION, buildInsightGenerationPrompt, buildBatchInsightGenerationPrompt } from '../prompts/system';
import { parseJsonRobustly } from '../utils/json';
import {
  Source,
  ExtractedContent,
  InsightOutput,
  GeminiInsightResponse,
  AppInsightCard,
  AppDailyPayload,
  AppActionGoal,
  InsightTag,
  AgeGroup,
  ContentType,
} from '../types';

/**
 * Transforms extracted source content into a polished InsightOutput.
 *
 * This is where raw extracted knowledge becomes app-ready parenting content.
 * The model uses the detailed extraction as grounding to write warm, readable,
 * spiritually sound insights — not a generic summarizer output.
 */
export async function generateInsight(
  source: Source,
  extracted: ExtractedContent,
  jobId: string,
): Promise<InsightOutput> {
  const model = getJsonModel(MODEL_HEAVY, SYSTEM_INSTRUCTION);

  const prompt = buildInsightGenerationPrompt(
    extracted,
    source.title,
    source.category,
    source.author ?? source.speakerName
  );

  console.log(`  → Generating insights for: ${source.title}`);

  const raw = await generateWithRetry(model, prompt, MODEL_HEAVY, SYSTEM_INSTRUCTION);

  let parsed: GeminiInsightResponse;
  try {
    parsed = parseJsonRobustly(raw) as GeminiInsightResponse;
  } catch {
    throw new Error(
      `Insight generator: Could not parse Gemini response for "${source.title}".\n` +
      `Raw (first 500 chars): ${raw.slice(0, 500)}`
    );
  }

  return buildInsightOutput(parsed, source, jobId);
}

/**
 * Generates multiple distinct insights from a single source in one API call.
 * Each insight covers a different angle (spiritual, emotional, practical, nuanced).
 * Far more efficient and produces genuinely distinct content vs. calling the model N times.
 */
export async function generateMultipleInsights(
  source: Source,
  extracted: ExtractedContent,
  jobId: string,
  count = 4
): Promise<InsightOutput[]> {
  const model = getJsonModel(MODEL_HEAVY, SYSTEM_INSTRUCTION);

  const prompt = buildBatchInsightGenerationPrompt(
    extracted,
    source.title,
    source.category,
    source.author ?? source.speakerName,
    count,
  );

  console.log(`  → Generating ${count} insights (batch) for: ${source.title}`);

  const raw = await generateWithRetry(model, prompt, MODEL_HEAVY, SYSTEM_INSTRUCTION);

  let parsed: GeminiInsightResponse[];
  try {
    const value = parseJsonRobustly(raw);
    parsed = Array.isArray(value) ? value : [value as GeminiInsightResponse];
  } catch {
    throw new Error(
      `Batch insight generator: Could not parse Gemini response for "${source.title}".\n` +
      `Raw (first 500 chars): ${raw.slice(0, 500)}`
    );
  }

  return parsed.map(p => buildInsightOutput(p, source, jobId));
}

// Shortens long org/institution names for display in the app UI.
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  'National Institute of Child Health and Human Development': 'NICHD',
  'American Academy of Pediatrics': 'AAP',
  'UC Davis Health': 'UC Davis Health',
  'Child Mind Institute': 'Child Mind Institute',
};

// Maps known speaker/org names to asset image filenames in the React Native project.
// Key should match source.speakerName or the first segment of source.author (before " - ").
const SPEAKER_IMAGE_MAP: Record<string, string> = {
  // ── Spiritual speakers ──
  'Belal Assaad':          'belal-assaad.jpg',
  'Yasmin Mogahed':        'YAsmin-MOgahed.png',
  'Omar Suleiman':         'Omar-Suleiman.jpg',
  'Dr. Omar Suleiman':     'Omar-Suleiman.jpg',
  'Yasir Qadhi':           'yasir-qadhi.jpeg',
  'Dr. Yasir Qadhi':       'yasir-qadhi.jpeg',
  'Mufti Menk':            'mufti-menk.jpeg',
  'Haifaa Younis':         'haifaa-younis.jpeg',
  'Dr. Haifaa Younis':     'haifaa-younis.jpeg',
  'Ibrahim Hindy':         'ibrahim-hindy.jpeg',
  'Sh. Ibrahim Hindy':     'ibrahim-hindy.jpeg',
  'Hamza Yusuf':           'hamza-yusuf.png',
  'Shaykh Hamza Yusuf':    'hamza-yusuf.png',

  // ── Scientific / institutional ──
  'Child Mind Institute':                              'childmind.png',
  'childmind.org':                                     'childmind.png',
  'American Academy of Pediatrics':                   'american-academy-of-ped.jpg',
  'AAP':                                              'american-academy-of-ped.jpg',
  'UC Davis Health':                                  'ucdavishealth.jpg',
  'National Institute of Child Health and Human Development': 'national-inst-child-health.jpeg',
  'NICHD':                                            'national-inst-child-health.jpeg',
  'National Institutes of Health':                    'NIH_2013_logo_vertical.svg.png',
  'NIH':                                              'NIH_2013_logo_vertical.svg.png',
  'UNICEF':                                           'UNICEF-logo.png',
  'CDC':                                              'CDC_logo_2024.png',
  'Centers for Disease Control and Prevention':       'CDC_logo_2024.png',
  'Centers for Disease Control and Prevention (CDC)': 'CDC_logo_2024.png',
  'National Center for Injury Prevention and Control':'CDC_logo_2024.png',
  'American Academy of Family Physicians':            'AAFP_LogoMark_Color.jpg',
  'AAFP':                                             'AAFP_LogoMark_Color.jpg',
};

function resolveSpeakerMeta(source: Source): { speakerName: string; speakerImage: string } {
  // Spiritual sources: never attribute to individual scholars — use Tarbiyah branding
  if (source.category === 'spiritual') {
    return { speakerName: 'Tarbiyah', speakerImage: 'spiritual-insights.png' };
  }

  // Scientific/institutional sources: use org name and logo
  const rawName = source.speakerName ?? (source.author ?? '').split(' - ')[0].trim();
  const displayName = DISPLAY_NAME_OVERRIDES[rawName] ?? rawName;
  const speakerImage = SPEAKER_IMAGE_MAP[rawName] ?? 'science-insights.png';
  return { speakerName: displayName || 'Tarbiyah', speakerImage };
}

/**
 * Converts a processed InsightOutput into the app-ready card format
 * that the React Native front-end consumes.
 */
export function toAppInsightCard(
  insight: InsightOutput,
  type: AppInsightCard['type'] = 'spiritual',
  source?: Source
): AppInsightCard {
  const body = type === 'spiritual'
    ? (insight.spiritualInsight ?? insight.dailyInsight)
    : type === 'scientific'
    ? (insight.educationalInsight ?? insight.dailyInsight)
    : insight.dailyInsight;

  const { speakerName, speakerImage } = source
    ? resolveSpeakerMeta(source)
    : { speakerName: insight.attribution, speakerImage: type === 'spiritual' ? 'spiritual-insights.png' : 'science-insights.png' };

  const sourceDetail = source
    ? {
        sourceType: source.type,
        sourceTitle: source.title,
        speakerOrAuthor: source.speakerName ?? (source.author ?? '').split(' - ')[0].trim(),
        sourceUrl: source.url,
      }
    : { sourceType: 'unknown', sourceTitle: insight.attribution, speakerOrAuthor: '', sourceUrl: '' };

  return {
    id: insight.id,
    type,
    insightTitle: insight.insightTitle || deriveTitleFromBody(body),
    body,
    dailyInsight: insight.dailyInsight,
    speakerName,
    speakerImage,
    source: insight.attribution,
    sourceDetail,
    actionStep: insight.actionStep,
    tags: insight.tags,
    date: insight.dateGenerated.toISOString().split('T')[0],
  };
}

/**
 * Builds the full daily app payload from a pair of insights —
 * one spiritual and one educational.
 */
export function buildDailyPayload(
  spiritualInsight: InsightOutput,
  educationalInsight: InsightOutput,
  spiritualSource?: Source,
  educationalSource?: Source,
  date?: Date
): AppDailyPayload {
  const targetDate = date ?? new Date();
  const dateStr = targetDate.toISOString().split('T')[0];

  const actionGoals: AppActionGoal[] = [];

  if (spiritualInsight.actionStep) {
    actionGoals.push({
      id: `goal-spiritual-${spiritualInsight.id}`,
      type: 'spiritual',
      label: 'Spiritual Tip',
      text: spiritualInsight.actionStep,
    });
  }

  if (educationalInsight.actionStep) {
    actionGoals.push({
      id: `goal-practical-${educationalInsight.id}`,
      type: 'practical',
      label: 'Practical Tip',
      text: educationalInsight.actionStep,
    });
  }

  return {
    date: dateStr,
    insights: [
      toAppInsightCard(spiritualInsight, 'spiritual', spiritualSource),
      toAppInsightCard(educationalInsight, 'scientific', educationalSource),
    ],
    actionGoals,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function buildInsightOutput(
  parsed: GeminiInsightResponse,
  source: Source,
  jobId: string
): InsightOutput {
  if (!parsed.dailyInsight) {
    throw new Error(
      `Insight generator: Missing required "dailyInsight" in response for source "${source.title}"`
    );
  }

  const tags = validateTags(parsed.tags ?? [], source.tags);

  return {
    id: uuidv4(),
    sourceId: source.id,
    jobId,
    category: source.category,
    insightTitle: parsed.insightTitle ?? '',
    dailyInsight: parsed.dailyInsight,
    spiritualInsight: parsed.spiritualInsight || undefined,
    educationalInsight: parsed.educationalInsight || undefined,
    actionStep: parsed.actionStep || undefined,
    attribution: parsed.attribution ?? buildFallbackAttribution(source),
    sourceGrounding: {
      sourceId: source.id,
      sourceTitle: source.title,
      paraphrasedIdea: parsed.sourceGrounding?.paraphrasedIdea,
      generatedFromContext: parsed.sourceGrounding?.generatedFromContext,
      confidence: parsed.sourceGrounding?.confidence ?? 'medium',
      clarification:
        parsed.sourceGrounding?.clarification ??
        'Insight generated from source content via Tarbiyah AI processing.',
    },
    tags,
    ageGroups: validateAgeGroups(parsed.ageGroups ?? []),
    contentType: validateContentType(parsed.contentType),
    status: 'draft',
    dateGenerated: new Date(),
  };
}


function deriveTitleFromBody(body: string): string {
  // Use first sentence if it's short enough
  const firstSentence = body.split(/[.!?]/)[0].trim();
  if (firstSentence.length <= 60) {
    return firstSentence;
  }

  // Otherwise take first 55 chars and add ellipsis
  return firstSentence.slice(0, 55).trim() + '…';
}

function buildFallbackAttribution(source: Source): string {
  const name = source.speakerName ?? source.author;
  if (name) {
    return `Based on ${name}`;
  }
  if (source.type === 'youtube') {
    return 'Based on an Islamic parenting lecture';
  }
  return 'Based on Islamic parenting guidance';
}

const VALID_TAGS: Set<InsightTag> = new Set([
  'patience', 'discipline', 'emotional-regulation', 'mercy', 'connection',
  'routines', 'dua', 'communication', 'presence', 'adab', 'screen-time',
  'anger', 'gratitude', 'tarbiyah', 'character', 'knowledge', 'love',
  'boundaries', 'faith', 'prayer', 'identity', 'attachment', 'play',
  'kindness', 'forgiveness', 'special-needs',
]);

function validateTags(
  modelTags: string[],
  sourceTags: InsightTag[]
): InsightTag[] {
  const validModel = (modelTags as InsightTag[]).filter((t) =>
    VALID_TAGS.has(t)
  );
  // Merge with source tags, deduplicate
  const merged = [...new Set([...validModel, ...sourceTags])];
  return merged.slice(0, 6) as InsightTag[];
}

const VALID_AGE_GROUPS: Set<AgeGroup> = new Set(['under-5', '5-10', '11-15', '16-plus', 'all']);

function validateAgeGroups(groups: string[]): AgeGroup[] {
  const valid = groups.filter(g => VALID_AGE_GROUPS.has(g as AgeGroup)) as AgeGroup[];
  return valid.length > 0 ? valid : ['all'];
}

const VALID_CONTENT_TYPES: Set<ContentType> = new Set([
  'spiritual', 'educational', 'practical', 'emotional', 'mixed',
]);

function validateContentType(type: unknown): ContentType {
  if (typeof type === 'string' && VALID_CONTENT_TYPES.has(type as ContentType)) {
    return type as ContentType;
  }
  return 'mixed';
}
