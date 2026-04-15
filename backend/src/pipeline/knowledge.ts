/**
 * knowledge.ts
 *
 * Extracts and saves a source_knowledge entry for a single source.
 * Called automatically by processSingleSource after insights are saved.
 * Can also be imported by the standalone extract-source-knowledge script.
 */

import { supabase } from '../config/supabase';
import { getJsonModel, generateWithRetry, MODEL_HEAVY } from '../config/gemini';
import { ExtractedContent } from '../types';

function buildExtractionPrompt(
  sourceTitle: string,
  sourceAuthor: string,
  category: string,
  extracted: ExtractedContent
): string {
  return `
You are building a structured knowledge base entry for a Muslim parenting app called Tarbiyah.

You have been given processed content from a parenting source. Your job is to extract a rich,
structured knowledge document that can be used to power personalised learning modules and
contextual answers.

SOURCE: "${sourceTitle}"
AUTHOR / SPEAKER: ${sourceAuthor}
CATEGORY: ${category}

PROCESSED CONTENT:
Core Theme: ${extracted.coreTheme}
Key Insights: ${extracted.keyInsights?.join(' | ')}
Islamic References: ${extracted.islamicReferences?.join(' | ')}
Practical Advice: ${extracted.practicalAdvice?.join(' | ')}
Summary: ${extracted.rawSummary}

─────────────────────────────────────────────────────────────────

Extract a structured knowledge document using this exact JSON shape:

{
  "narrativeSummary": "string — 3–5 paragraph prose summary of the full source. Capture the author's main argument, key spiritual or scientific insights, and the overall parenting guidance they give. Write in a warm, clear tone as if briefing a thoughtful Muslim parent. Do not use bullet points here.",

  "keyTakeaways": [
    "string — one clear, self-contained takeaway point"
  ],

  "themes": ["string"],

  "ageGroups": ["string"],

  "moduleUsageNotes": "string — 2-3 sentences on how this source could best be used in a learning module. What type of parenting struggle does it address? What is its particular strength as source material?"
}

RULES:
- keyTakeaways: Extract as many distinct points as the source genuinely supports — no minimum, no maximum. Do not pad or repeat. A short article may yield 3–4 points. A 3-hour lecture may yield 20+. Each takeaway should be a complete, actionable or insightful sentence a parent could actually use.
- themes: Choose from this list only — include all that apply: patience, discipline, emotional-regulation, mercy, connection, routines, dua, communication, presence, adab, screen-time, anger, gratitude, tarbiyah, character, knowledge, love, boundaries, faith, prayer, identity, attachment, play, kindness, forgiveness, family-dynamics, marriage, motivation, responsibility, home-environment
- ageGroups: Choose all that apply from: "under-5", "5-10", "11-15", "16-plus", "all"
- Return valid JSON only — no markdown fences, no extra text.
`.trim();
}

export async function extractSourceKnowledge(
  sourceId: string,
  extracted: ExtractedContent
): Promise<void> {
  // Fetch source metadata
  const { data: src } = await supabase
    .from('sources')
    .select('title, author, speaker_name, category')
    .eq('id', sourceId)
    .single();

  const title    = src?.title    ?? sourceId;
  const author   = src?.speaker_name ?? src?.author ?? 'Unknown';
  const category = src?.category ?? 'spiritual';

  const systemInstruction = 'You extract structured knowledge from parenting source material. Return valid JSON only.';
  const model  = getJsonModel(MODEL_HEAVY, systemInstruction);
  const prompt = buildExtractionPrompt(title, author, category, extracted);
  const raw    = await generateWithRetry(model, prompt, MODEL_HEAVY, systemInstruction);

  let parsed: any;
  const jsonStr = raw.trim().replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
  parsed = JSON.parse(jsonStr);

  const takeaways: string[] = Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [];
  const themes: string[]    = Array.isArray(parsed.themes)       ? parsed.themes       : [];
  const ageGroups: string[] = Array.isArray(parsed.ageGroups)    ? parsed.ageGroups    : ['all'];

  const { error } = await supabase
    .from('source_knowledge')
    .upsert({
      source_id:          sourceId,
      narrative_summary:  parsed.narrativeSummary  ?? '',
      key_takeaways:      takeaways,
      themes,
      age_groups:         ageGroups,
      module_usage_notes: parsed.moduleUsageNotes  ?? '',
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'source_id' });

  if (error) throw new Error(`source_knowledge upsert failed: ${error.message}`);
}
