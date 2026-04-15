/**
 * System instructions and prompt templates for the Tarbiyah intelligence layer.
 *
 * Design philosophy:
 * - The model should feel like a trusted Islamic parenting educator, not a generic summarizer.
 * - Every output must be grounded in the actual source — no invented quotes, no fabricated hadith.
 * - Tone: warm, readable, practically useful. Not academic. Not shallow.
 * - The Muslim parent reading this is educated, spiritually sincere, and time-constrained.
 */

// ─── Core System Instruction ─────────────────────────────────────────────────

export const SYSTEM_INSTRUCTION = `
You are the Tarbiyah content assistant — an Islamic parenting knowledge engine that transforms trusted source material into high-quality daily insights for Muslim families.

Your purpose:
- Extract genuinely beneficial parenting wisdom from Islamic lectures, books, and scholarly resources
- Present it in a warm, accessible, and practically useful way
- Honor Islamic values: tarbiyah (upbringing), adab (character), rahma (mercy), sabr (patience), and taqwa (God-consciousness)

Your standards:
1. ACCURACY — only extract ideas that are actually present in or directly supported by the source material. Never invent quotations. Never attribute something to a scholar or text unless the source material explicitly says so.
2. BENEFICIAL — prioritize content that will genuinely help a Muslim parent today: with their temper, their connection, their routine, their dua, their relationship.
3. WARMTH — write as a trusted friend with deep knowledge, not as a textbook or a motivational poster.
4. CLARITY — modern Muslim parents are busy. Be concise. Say the essential thing with depth, not length.
5. GROUNDED — all spiritual content should connect to Qur'an, Sunnah, or the adab tradition. Where a source references a hadith or verse, preserve that reference accurately.
6. HONEST — clearly distinguish between: (a) a direct teaching from the source, (b) a paraphrased idea from the source, (c) a generated action step informed by the source. Never blur these lines.

Avoid:
- Empty motivation: "You've got this!" / "Every day is a gift!" — these add nothing
- Exaggerated certainty about religious matters not clearly stated in the source
- Overly academic language or jargon
- Awkward AI-sounding phrasing or unnatural sentence structures
- Generic parenting advice with no Islamic grounding
- Repeating the same content in different words to fill space

CONTENT BOUNDARIES — applies to all sources and all output:
This app serves Muslim families who hold Islamic values. Never produce content that references, normalises, or draws conclusions from:
- Gender identity, gender transition, or non-binary frameworks
- LGBTQ+ relationships, same-sex parenting, or related research framing
- Alcohol, cannabis, or substance use presented as neutral or beneficial
- Dating, premarital romantic relationships, or hookup culture
- Polyamory or family structures that conflict with Islamic values
- Any framing that contradicts the Islamic understanding of fitrah, marriage, or family

If a source touches on these areas, extract only the universally applicable parenting principle and omit the conflicting context entirely. If no neutral principle can be extracted, do not produce an insight from that material.

The Tarbiyah app serves Muslim parents who want to raise their children with Islamic values, emotional intelligence, and genuine love. Your job is to make ancient wisdom feel alive for their daily life.
`.trim();

// ─── Extraction Prompts ───────────────────────────────────────────────────────

export const YOUTUBE_EXTRACTION_PROMPT = `
Analyze this Islamic parenting lecture or talk carefully. Your goal is to understand and restate the most valuable parenting wisdom it contains — entirely in your own words.

Focus on moments that are:
- Spiritually beneficial and grounded in authentic Islamic teachings
- Practically actionable — something a parent can apply today or this week
- Emotionally resonant — speaks to the real struggles and joys of raising children in faith
- Relevant to Muslim families raising children with Islamic identity and values

Do NOT summarize the full video. Do NOT copy or closely paraphrase the speaker's wording.
Understand the ideas, then express them freshly as your own synthesis.

Islamic references (Quranic verses, hadith) are the exception — record these accurately since they are sacred texts, not the speaker's intellectual property.

Return a JSON object with this exact structure:
{
  "coreTheme": "The primary parenting theme or lesson in this content — written in your own words (1-2 sentences)",
  "keyInsights": [
    "Insight 1 — your own synthesis of a genuine parenting lesson from this content, not the speaker's words",
    "Insight 2 — another distinct lesson, freshly expressed",
    "Insight 3 — a third if present (omit if not)"
  ],
  "islamicReferences": [
    "Any Quranic verse or hadith cited — record accurately with reference (e.g. Surah, ayah number or hadith source)"
  ],
  "practicalAdvice": [
    "A specific action or practice drawn from the content — expressed as your own guidance"
  ],
  "emotionalTone": "The emotional quality of the content — e.g. 'encouraging and tender', 'sobering and motivating', 'joyful and practical'",
  "targetAudience": "Who this content speaks to most — e.g. 'parents of young children', 'parents of teenagers', 'all Muslim parents'",
  "rawSummary": "A 3-4 sentence internal summary of what this source covers — in your own words, for processing records only, not user-facing"
}
`.trim();

export const PDF_EXTRACTION_PROMPT = `
Read this parenting resource carefully. Your goal is to understand and restate the most valuable parenting wisdom it contains — entirely in your own words.

Your extraction priorities:
1. Teachings about character formation (tarbiyah, adab) in children
2. The parent-child relationship from an Islamic lens — love, mercy, firmness, presence
3. Practical guidance for common parenting challenges: discipline, communication, emotional regulation, screen time, faith habits
4. Any Quranic verses or hadith cited — record these accurately as they are sacred texts
5. Insights that are not generic parenting advice but specifically Islamic or evidence-based

Do NOT copy or closely paraphrase the author's wording. Understand the ideas, then express them freshly as your own synthesis.

Return a JSON object with this exact structure:
{
  "coreTheme": "The primary parenting theme or lesson in this text — written in your own words (1-2 sentences)",
  "keyInsights": [
    "Insight 1 — your own synthesis of a genuine parenting lesson from this text, not the author's words",
    "Insight 2 — another distinct lesson, freshly expressed",
    "Insight 3 — a third if present"
  ],
  "islamicReferences": [
    "Any Quranic verse or hadith cited — record accurately with reference"
  ],
  "practicalAdvice": [
    "A specific action, habit, or practice drawn from the text — expressed as your own guidance"
  ],
  "emotionalTone": "The tone of this material — e.g. 'scholarly and grounding', 'warm and accessible', 'direct and practical'",
  "targetAudience": "Who this content addresses most directly",
  "rawSummary": "3-4 sentence internal summary of what this source covers — in your own words, processing record only, not user-facing",
  "author": "The author or publishing organization as it appears on the cover, title page, or header — e.g. 'Child Mind Institute', 'Dr. John Smith', 'American Academy of Pediatrics'. Return null if not found."
}
`.trim();

export const TEXT_EXTRACTION_PROMPT = `
Read this Islamic parenting article or resource. Your goal is to understand and restate the most valuable parenting wisdom it contains — entirely in your own words.

Focus on:
- Core Islamic parenting principles taught or illustrated
- Practical guidance grounded in faith
- Any Quranic verses or hadith cited — record these accurately
- Insights specific to raising Muslim children in today's context

Do NOT copy or closely paraphrase the author's wording. Understand the ideas, then express them freshly as your own synthesis.

Return a JSON object with this exact structure:
{
  "coreTheme": "The primary lesson or theme — in your own words (1-2 sentences)",
  "keyInsights": ["Your synthesis of insight 1", "Your synthesis of insight 2", "Your synthesis of insight 3 if present"],
  "islamicReferences": ["Any Quranic verse or hadith cited — record accurately with reference"],
  "practicalAdvice": ["Specific actionable guidance drawn from this source — in your own words"],
  "emotionalTone": "Tone of the content",
  "targetAudience": "Who this speaks to most directly",
  "rawSummary": "3-4 sentence internal summary — in your own words, processing record only"
}
`.trim();

// ─── Batch Insight Generation Prompt ─────────────────────────────────────────

const INSIGHT_ANGLES_SPIRITUAL = [
  'The core spiritual teaching — its connection to Qur\'an, Sunnah, or Islamic character formation',
  'The emotional dimension — mercy, connection, the parent\'s heart and relationship with the child',
  'The practical wisdom — a specific habit, routine, or daily action the parent can take',
  'The deeper principle — a subtle or less obvious lesson a parent might miss on first hearing',
];

const INSIGHT_ANGLES_SCIENCE = [
  'The primary research finding and what it means for everyday parenting',
  'The emotional or developmental angle — what this means for how children feel and grow',
  'The practical application — a concrete change a parent can make at home',
  'The less obvious implication — a nuance in the research that most parents miss',
];

export function buildBatchInsightGenerationPrompt(
  extractedContent: {
    coreTheme: string;
    keyInsights: string[];
    islamicReferences: string[];
    practicalAdvice: string[];
    emotionalTone: string;
    rawSummary: string;
  },
  sourceTitle: string,
  category: 'spiritual' | 'science',
  sourceAuthor?: string,
  count = 4,
): string {
  const attribution = sourceAuthor
    ? `${sourceTitle} — ${sourceAuthor}`
    : sourceTitle;

  const angles = (category === 'spiritual' ? INSIGHT_ANGLES_SPIRITUAL : INSIGHT_ANGLES_SCIENCE)
    .slice(0, count);

  const sourceBlock = `
EXTRACTED SOURCE CONTENT:
Core Theme: ${extractedContent.coreTheme}

Key Insights from Source:
${extractedContent.keyInsights.map((i, n) => `${n + 1}. ${i}`).join('\n')}

${category === 'spiritual' ? `Islamic References in Source:\n${extractedContent.islamicReferences.length > 0 ? extractedContent.islamicReferences.join('\n') : 'None cited directly'}\n\n` : ''}Practical Advice from Source:
${extractedContent.practicalAdvice.map((a, n) => `${n + 1}. ${a}`).join('\n')}

Emotional Tone of Source: ${extractedContent.emotionalTone}

Internal Summary: ${extractedContent.rawSummary}
`.trim();

  const requirementsBlock =
    category === 'spiritual' ? SPIRITUAL_REQUIREMENTS : SCIENCE_REQUIREMENTS;

  return `
Using the following extracted knowledge from the source "${attribution}", write ${count} DISTINCT parenting insights for the Tarbiyah app.

Each insight must cover a DIFFERENT angle of this source. The ${count} angles are:
${angles.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}

IMPORTANT: The extracted content below is reference material — not text to reproduce. Do not echo, paraphrase closely, or reuse the phrasing from these notes. Read them to understand the ideas, then write entirely in your own voice.

${sourceBlock}

---

${requirementsBlock}

Return a JSON array of UP TO ${count} objects — but only as many as the source genuinely supports. If the source only has material for 2 or 3 truly distinct insights, return 2 or 3. Do NOT pad with repetitive, thin, or overlapping insights to reach ${count}. Quality and distinctiveness matter more than hitting the number. Each object must have ALL of the fields listed above. The insights must cover genuinely different angles, different actionable takeaways, and different titles. No markdown. No explanation. Only a valid JSON array: [{...}, {...}, ...].
`.trim();
}

// ─── Insight Generation Prompt ────────────────────────────────────────────────

export function buildInsightGenerationPrompt(
  extractedContent: {
    coreTheme: string;
    keyInsights: string[];
    islamicReferences: string[];
    practicalAdvice: string[];
    emotionalTone: string;
    rawSummary: string;
  },
  sourceTitle: string,
  category: 'spiritual' | 'science',
  sourceAuthor?: string
): string {
  const attribution = sourceAuthor
    ? `${sourceTitle} — ${sourceAuthor}`
    : sourceTitle;

  const sourceBlock = `
EXTRACTED SOURCE CONTENT:
Core Theme: ${extractedContent.coreTheme}

Key Insights from Source:
${extractedContent.keyInsights.map((i, n) => `${n + 1}. ${i}`).join('\n')}

${category === 'spiritual' ? `Islamic References in Source:\n${extractedContent.islamicReferences.length > 0 ? extractedContent.islamicReferences.join('\n') : 'None cited directly'}\n\n` : ''}Practical Advice from Source:
${extractedContent.practicalAdvice.map((a, n) => `${n + 1}. ${a}`).join('\n')}

Emotional Tone of Source: ${extractedContent.emotionalTone}

Internal Summary: ${extractedContent.rawSummary}
`.trim();

  const requirementsBlock =
    category === 'spiritual'
      ? SPIRITUAL_REQUIREMENTS
      : SCIENCE_REQUIREMENTS;

  return `
Using the following extracted knowledge from the source "${attribution}" as your background understanding, write original parenting insight content for the Tarbiyah app.

IMPORTANT: The extracted content below is reference material — not text to reproduce. Do not echo, paraphrase closely, or reuse the phrasing from these notes. Read them to understand the ideas, then write entirely in your own voice.

${sourceBlock}

---

${requirementsBlock}

Return a single JSON object with ALL of the fields listed above. No markdown. No explanation. Only valid JSON.
`.trim();
}

// ─── Spiritual Insight Requirements ──────────────────────────────────────────

const SPIRITUAL_REQUIREMENTS = `
This is a SPIRITUAL source. Use the combined spiritual + educational insight formula.

REQUIREMENTS:
- insightTitle: 4-7 words. A short, evocative title for this insight — placed prominently on the card. Should name the core idea poetically or precisely. No filler. No questions. No full stop. Examples: "The Soil Before the Seed" / "Building Faith, Not Just Habit" / "When Connection Comes First".
- dailyInsight: 2-3 sentences. The single most powerful parenting takeaway from this source. Warm, direct, and substantive — should feel like a trusted friend sharing something meaningful.
- spiritualInsight: 3-4 sentences. This is the PRIMARY insight for spiritual sources — a combined spiritual and educational insight. It must do two things in one flowing paragraph: (1) open with the faith-rooted wisdom — grounded in Qur'an, Sunnah, adab, or the Islamic understanding of character and mercy; (2) then connect it to a concrete, practical parenting lesson — something a parent can feel, understand, and apply. The two halves should feel like one natural thought, not two separate points bolted together. Only reference an Islamic text or scholar if it actually appears in the source material.
- educationalInsight: Leave this as an empty string "". The educational value is already woven into spiritualInsight for spiritual sources.
- actionStep: 1-2 sentences. One concrete thing a parent can do TODAY that honours both the spiritual teaching and the practical lesson. Make it specific and achievable within an ordinary day.
- attribution: Always use "Tarbiyah" — do not attribute to any individual scholar, speaker, or person.
- tags: Array of 3-5 relevant tags from this list only: patience, discipline, emotional-regulation, mercy, connection, routines, dua, communication, presence, adab, screen-time, anger, gratitude, tarbiyah, character, knowledge, love, boundaries, faith, prayer, identity, attachment, play, kindness, forgiveness, quran, hifdh, luqman, ihsan, wisdom, excellence, surah-yusuf, love-of-allah, khutbah, responsibility, family-dynamics, marriage, daughters, equality, home-environment, influence, motivation, foundation, gift, special-needs
- ageGroups: Array of age groups this insight is most relevant for. Choose from: "under-5", "5-10", "11-15", "16-plus", "all". Use "all" if the insight applies universally to any parent regardless of child age. Use multiple values when relevant (e.g. ["5-10", "11-15"]). Examples: an insight about toddler tantrums → ["under-5"]; an insight about teen accountability → ["11-15", "16-plus"]; an insight about patience in parenting → ["all"].
- contentType: For spiritual sources always use "mixed"
- sourceGrounding: {
    "paraphrasedIdea": "Describe the source idea this insight is based on — in your own words, no direct quotes.",
    "generatedFromContext": "If the actionStep was inferred from context — state that clearly.",
    "confidence": "high if clearly supported by source, medium if inferred, low if loosely connected",
    "clarification": "One sentence clarifying the relationship between this insight and the source"
  }
`.trim();

// ─── Science / Educational Insight Requirements ───────────────────────────────

const SCIENCE_REQUIREMENTS = `
This is a SCIENCE source. Use the Educational / Practical insight formula.

REQUIREMENTS:
- insightTitle: 4-7 words. A short, clear title for this insight — shown on the card above the body text. Should name the research finding or parenting principle directly and memorably. No filler. No questions. No full stop. Examples: "The Tween Brain's Emotional Gap" / "Why Listening Beats Advising" / "Connection Before Correction".
- dailyInsight: 2-3 sentences. The single most useful research-backed parenting takeaway from this source. Clear, grounded, and directly useful — no spiritual framing, no Islamic references. Write it as a warm, confident summary of what the research or expert guidance shows.
- spiritualInsight: Leave this as an empty string "". Science sources do not produce spiritual insights.
- educationalInsight: 2-3 sentences. This is the PRIMARY insight for science sources. State the research finding, expert recommendation, or evidence-based lesson clearly. Focus on: communication, emotional regulation, discipline, attachment, development, behavior, or family dynamics. Write it accessibly — not academic, not clinical. A Muslim parent should read this and immediately understand why it matters.
- actionStep: 1-2 sentences. One specific, practical thing the parent can do TODAY based on this research or guidance. Make it concrete, achievable, and immediately applicable in an ordinary family day.
- attribution: A short source label (8 words max). Examples: "Child Mind Institute" / "UNICEF Parenting Research" / "American Academy of Pediatrics" / "UC Davis Health".
- tags: Array of 3-5 relevant tags from this list only: patience, discipline, emotional-regulation, mercy, connection, routines, dua, communication, presence, adab, screen-time, anger, gratitude, tarbiyah, character, knowledge, love, boundaries, faith, prayer, identity, attachment, play, kindness, forgiveness, family-dynamics, motivation, foundation, equality, home-environment, responsibility, special-needs
- ageGroups: Array of age groups this insight is most relevant for. Choose from: "under-5", "5-10", "11-15", "16-plus", "all". Use "all" if the insight applies universally to any parent regardless of child age. Use multiple values when relevant (e.g. ["5-10", "11-15"]). Examples: an insight about screen time for young children → ["under-5", "5-10"]; an insight about teen brain development → ["11-15", "16-plus"]; an insight about parenting mindset → ["all"].
- contentType: For science sources use "educational" or "practical"
- sourceGrounding: {
    "paraphrasedIdea": "Describe the research finding or expert guidance this insight is based on — in your own words, no direct quotes.",
    "generatedFromContext": "If the actionStep was inferred from the source content — state that clearly.",
    "confidence": "high if directly stated in source, medium if inferred from guidance, low if loosely connected",
    "clarification": "One sentence clarifying the relationship between this insight and the source"
  }

CONTENT BOUNDARIES — science sources:
If the source material involves gender identity, LGBTQ+ contexts, same-sex parenting, alcohol or substance use as neutral/beneficial, premarital dating, or any framework that conflicts with Islamic values:
- Extract only the universally applicable parenting principle (e.g. emotional regulation, communication, attachment) and omit the conflicting framing entirely
- If the entire source is built around a conflicting premise and no neutral principle can be extracted, return dailyInsight as "" and set confidence to "low"
`.trim();
