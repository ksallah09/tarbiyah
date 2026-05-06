/**
 * Tarbiyah Server
 *
 * - POST /chat    — AI parenting advisor (grounded in PDF knowledge base)
 * - GET  /daily   — Personalized daily insight payload (requires auth)
 * - GET  /health  — Health check
 *
 * Usage:
 *   npm run server
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getTextModel, getJsonModel, generateWithRetry, MODEL_FAST, MODEL_HEAVY } from './config/gemini';
import { supabase, verifyUserToken } from './config/supabase';
import { seedSources, pickInsight, recordDelivery, getSourceById } from './data/database';
import { buildDailyPayload } from './generators/insights';
import { buildModuleSystemPrompt } from './prompts/module';
import { generateAllLessonNarrations, generateSingleLessonNarration } from './generators/audio';
import { generateJsonWithOpenAI } from './config/openai';
import { ExtractedContent, AppDailyPayload, AppModule, ModuleLesson } from './types';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? process.env.CHAT_PORT ?? 3001;

// ─── Chat source IDs ──────────────────────────────────────────────────────────

const CHAT_SOURCE_IDS = ['sci-pdf-01', 'sci-pdf-03'];

// ─── System prompt cache ──────────────────────────────────────────────────────

let cachedSystemPrompt: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  const { data: jobs } = await supabase
    .from('processing_jobs')
    .select('source_id, extracted_content, completed_at')
    .eq('status', 'completed')
    .in('source_id', CHAT_SOURCE_IDS)
    .order('completed_at', { ascending: false });

  const sourceIds = (jobs ?? []).map((j: Record<string, string>) => j.source_id);

  const { data: sources } = sourceIds.length > 0
    ? await supabase.from('sources').select('id, title, author, description').in('id', sourceIds)
    : { data: [] };

  const sourceMap = new Map(
    (sources ?? []).map((s: Record<string, string>) => [s.id, s])
  );

  let prompt = `You are a knowledgeable and warm parenting advisor inside the Tarbiyah app, speaking directly to Muslim parents. You help parents raise healthy, emotionally secure, well-guided children.

Your knowledge comes exclusively from the following research-based parenting documents. Every answer you give should be grounded in this material. You may use your intelligence to present the information clearly, make connections between concepts, and speak in a warm, practical tone — but do not introduce advice or claims that go beyond what these sources support.

You are also free to engage in natural conversation (greetings, follow-up questions, clarifications), but when giving parenting guidance, stay grounded in the sources below.

When citing a source, refer to it naturally by title or author (e.g. "According to the UC Davis Health guide..." or "NIH research highlights..."). Do not invent studies or statistics.

`;

  if (!jobs || jobs.length === 0) {
    prompt += `NOTE: No source content has been loaded yet. Let the user know the knowledge base is still being set up.\n`;
    cachedSystemPrompt = prompt;
    return prompt;
  }

  prompt += `=== KNOWLEDGE BASE ===\n\n`;

  for (const job of jobs as Array<{ source_id: string; extracted_content: ExtractedContent }>) {
    const source = sourceMap.get(job.source_id) as Record<string, string> | undefined;
    const content: ExtractedContent = job.extracted_content;

    prompt += `────────────────────────────────────────\n`;
    prompt += `SOURCE: "${source?.title ?? job.source_id}"\n`;
    prompt += `AUTHOR: ${source?.author ?? 'Unknown'}\n`;
    if (source?.description) prompt += `OVERVIEW: ${source.description}\n`;
    prompt += `\n`;
    prompt += `CORE THEME:\n${content.coreTheme}\n\n`;

    if (content.keyInsights?.length) {
      prompt += `KEY INSIGHTS:\n`;
      content.keyInsights.forEach(k => { prompt += `• ${k}\n`; });
      prompt += '\n';
    }

    if (content.practicalAdvice?.length) {
      prompt += `PRACTICAL ADVICE:\n`;
      content.practicalAdvice.forEach(a => { prompt += `• ${a}\n`; });
      prompt += '\n';
    }

    if (content.emotionalTone) {
      prompt += `TONE/APPROACH: ${content.emotionalTone}\n\n`;
    }

    if (content.rawSummary) {
      prompt += `FULL SUMMARY:\n${content.rawSummary}\n\n`;
    }
  }

  prompt += `────────────────────────────────────────\n\n`;
  prompt += `Always be warm, direct, and parent-focused. Structure longer answers with short paragraphs or bullet points. If a question falls outside the scope of these sources, say so honestly and suggest the parent consult a professional.\n`;

  cachedSystemPrompt = prompt;
  return prompt;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  const token = authHeader.slice(7);
  const user = await verifyUserToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.userId = user.id;
  next();
}

// ─── POST /chat ───────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

app.post('/chat', async (req: Request, res: Response) => {
  try {
    const { question, history = [] }: { question: string; history: ChatMessage[] } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const systemPrompt = await getSystemPrompt();
    const model = getTextModel(MODEL_FAST, systemPrompt);

    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(question);
    const answer = result.response.text();

    return res.json({ answer });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Failed to generate response. Please try again.' });
  }
});

// ─── GET /daily ───────────────────────────────────────────────────────────────

app.get('/daily', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const focusAreas = req.query.focusAreas
      ? String(req.query.focusAreas).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const childrenAgeGroups = req.query.childrenAges
      ? String(req.query.childrenAges).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const familyStructure = req.query.familyStructure
      ? String(req.query.familyStructure)
      : 'prefer_not_to_say';

    const [spiritualInsight, scienceInsight] = await Promise.all([
      pickInsight('spiritual', userId, focusAreas, childrenAgeGroups, familyStructure),
      pickInsight('science', userId, focusAreas, childrenAgeGroups, familyStructure),
    ]);

    if (!spiritualInsight || !scienceInsight) {
      return res.status(404).json({
        error: 'Not enough published insights available.',
        spiritual: !!spiritualInsight,
        science: !!scienceInsight,
      });
    }

    const [spiritualSource, scienceSource] = await Promise.all([
      getSourceById(spiritualInsight.sourceId),
      getSourceById(scienceInsight.sourceId),
    ]);

    const payload: AppDailyPayload = buildDailyPayload(
      spiritualInsight,
      scienceInsight,
      spiritualSource,
      scienceSource,
    );

    // Record deliveries after building payload (fire-and-forget, don't block response)
    Promise.all([
      recordDelivery(userId, spiritualInsight.id),
      recordDelivery(userId, scienceInsight.id),
    ]).catch(err => console.error('Delivery tracking error:', err));

    return res.json(payload);
  } catch (err) {
    console.error('Daily endpoint error:', err);
    return res.status(500).json({ error: 'Failed to build daily payload.' });
  }
});

// ─── GET /daily/preview (no auth — random insight pair for unauthenticated users) ─

app.get('/daily/preview', async (_req: Request, res: Response) => {
  try {
    const [spiritualInsight, scienceInsight] = await Promise.all([
      pickInsight('spiritual', null, []),
      pickInsight('science', null, []),
    ]);

    if (!spiritualInsight || !scienceInsight) {
      return res.status(404).json({ error: 'Not enough published insights available.' });
    }

    const [spiritualSource, scienceSource] = await Promise.all([
      getSourceById(spiritualInsight.sourceId),
      getSourceById(scienceInsight.sourceId),
    ]);

    const payload = buildDailyPayload(spiritualInsight, scienceInsight, spiritualSource, scienceSource);
    return res.json(payload);
  } catch (err) {
    console.error('Preview endpoint error:', err);
    return res.status(500).json({ error: 'Failed to build daily payload.' });
  }
});

// ─── Source context builder for modules ──────────────────────────────────────
// Uses source_knowledge table (rich takeaways + theme index) when available,
// falls back to raw extracted_content from processing_jobs for sources not yet processed.

const KNOWLEDGE_THEME_MAP: Record<string, string[]> = {
  anger:              ['anger', 'emotional-regulation', 'discipline'],
  discipline:         ['discipline', 'boundaries', 'responsibility'],
  connection:         ['connection', 'attachment', 'presence', 'love'],
  screen:             ['screen-time'],
  teen:               ['identity', 'boundaries', 'communication', 'family-dynamics'],
  anxiety:            ['emotional-regulation', 'attachment', 'communication'],
  confidence:         ['identity', 'character', 'love', 'attachment'],
  faith:              ['faith', 'prayer', 'dua', 'tarbiyah', 'adab'],
  patience:           ['patience', 'mercy', 'gratitude'],
  communication:      ['communication', 'presence', 'connection'],
  routines:           ['routines', 'responsibility', 'discipline'],
  marriage:           ['marriage', 'family-dynamics', 'home-environment'],
};

function topicToThemes(topic: string): string[] {
  const lower = topic.toLowerCase();
  const matched = new Set<string>();
  for (const [keyword, themes] of Object.entries(KNOWLEDGE_THEME_MAP)) {
    if (lower.includes(keyword)) themes.forEach(t => matched.add(t));
  }
  return matched.size > 0 ? Array.from(matched) : [];
}

async function buildModuleSourceContext(topic: string): Promise<string> {
  const themes = topicToThemes(topic);

  // ── Try source_knowledge first (rich takeaways) ────────────────────────────
  let knowledgeQuery = supabase
    .from('source_knowledge')
    .select('source_id, narrative_summary, key_takeaways, themes, age_groups, module_usage_notes');

  // If we matched themes, prefer sources that overlap — but always include some
  const { data: allKnowledge } = await knowledgeQuery;

  if (allKnowledge && allKnowledge.length > 0) {
    const sourceIds = (allKnowledge as any[]).map(k => k.source_id as string);
    const { data: sources } = await supabase
      .from('sources')
      .select('id, title, author, speaker_name, category')
      .in('id', sourceIds);

    const sourceMap = new Map(
      (sources ?? []).map((s: any) => [s.id as string, s])
    );

    // Sort: theme-matching sources first, then the rest
    const scored = (allKnowledge as any[]).map(k => {
      const overlap = themes.length > 0
        ? (k.themes as string[]).filter(t => themes.includes(t)).length
        : 0;
      return { k, overlap };
    });
    scored.sort((a, b) => b.overlap - a.overlap);

    // Take top 12 to avoid token overflow — at least 4 high-relevance, rest as context
    const selected = scored.slice(0, 12).map(s => s.k);

    let context = '';
    for (const entry of selected) {
      const src = sourceMap.get(entry.source_id) as any;
      const title  = src?.title ?? entry.source_id;
      const author = src?.speaker_name ?? src?.author ?? 'Unknown';

      context += `════════════════════════════════════\n`;
      context += `SOURCE: "${title}" — ${author}\n`;
      if (entry.module_usage_notes) context += `USAGE: ${entry.module_usage_notes}\n`;
      context += '\n';
      if (entry.narrative_summary) context += `OVERVIEW:\n${entry.narrative_summary}\n\n`;
      if (entry.key_takeaways?.length) {
        context += `KEY TAKEAWAYS:\n`;
        (entry.key_takeaways as string[]).forEach(t => { context += `• ${t}\n`; });
        context += '\n';
      }
    }
    return context;
  }

  // ── Fallback: raw extracted_content from processing_jobs ──────────────────
  const { data: jobs } = await supabase
    .from('processing_jobs')
    .select('source_id, extracted_content')
    .eq('status', 'completed')
    .limit(40);

  if (!jobs || jobs.length === 0) return 'No source material available.';

  const sourceIds = jobs.map((j: Record<string, unknown>) => j.source_id as string);
  const { data: sources } = await supabase
    .from('sources')
    .select('id, title, author, category')
    .in('id', sourceIds);

  const sourceMap = new Map(
    (sources ?? []).map((s: Record<string, unknown>) => [s.id as string, s])
  );

  let context = '';
  for (const job of jobs as Array<{ source_id: string; extracted_content: ExtractedContent }>) {
    const src = sourceMap.get(job.source_id) as Record<string, unknown> | undefined;
    const c = job.extracted_content;
    if (!c) continue;

    context += `────────────────────────────\n`;
    context += `SOURCE: "${src?.title ?? job.source_id}" — ${src?.author ?? 'Unknown'}\n\n`;
    if (c.coreTheme) context += `CORE THEME: ${c.coreTheme}\n\n`;
    if (c.keyInsights?.length) {
      context += `KEY INSIGHTS:\n`;
      c.keyInsights.forEach(k => { context += `• ${k}\n`; });
      context += '\n';
    }
    if (c.practicalAdvice?.length) {
      context += `PRACTICAL ADVICE:\n`;
      c.practicalAdvice.forEach(a => { context += `• ${a}\n`; });
      context += '\n';
    }
  }
  return context;
}

// ─── POST /learn/generate ─────────────────────────────────────────────────────

app.post('/learn/generate', async (req: Request, res: Response) => {
  try {
    const { topic, childrenAges, focusAreas, familyStructure } = req.body as {
      topic: string;
      childrenAges?: string;
      focusAreas?: string[];
      familyStructure?: string;
    };

    if (!topic?.trim()) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    const sourceContext = await buildModuleSourceContext(topic);
    const systemPrompt  = buildModuleSystemPrompt(sourceContext);

    const familyNote = familyStructure === 'single_parent'
      ? 'This parent is a single parent — do not assume a co-parent or spouse is present. Avoid advice like "discuss with your partner" or "take turns".'
      : null;

    const userPrompt = [
      `Parent's topic: ${topic.trim()}`,
      childrenAges  ? `Children's ages: ${childrenAges}` : null,
      focusAreas?.length ? `Parent's focus areas: ${focusAreas.join(', ')}` : null,
      familyNote,
    ].filter(Boolean).join('\n');

    // Try Gemini first (pro → flash fallback handled inside generateWithRetry)
    // If Gemini is unavailable, fall back to OpenAI GPT-4o
    let raw: string;
    try {
      const model = getJsonModel(MODEL_HEAVY, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_HEAVY, systemPrompt);
    } catch (geminiErr) {
      console.warn('[learn/generate] Gemini unavailable, falling back to OpenAI:', (geminiErr as Error).message);
      try {
        raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
      } catch (openAiErr) {
        console.error('[learn/generate] OpenAI fallback also failed:', (openAiErr as Error).message);
        return res.status(503).json({ error: 'AI is experiencing high demand right now. Please try again in a moment.' });
      }
    }

    let parsed: Omit<AppModule, 'id' | 'totalLessons' | 'completedLessons' | 'createdAt'>;
    try {
      // Strip markdown code fences if the model wraps the response
      let jsonStr = raw.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Module JSON parse error. Raw response:', raw.slice(0, 500));
      return res.status(500).json({ error: 'Failed to generate module. Please try again.' });
    }

    // Ensure lessons have required fields
    const lessons: ModuleLesson[] = (parsed.lessons ?? []).map((l, i) => ({
      id: i + 1,
      title: l.title ?? `Lesson ${i + 1}`,
      type: l.type ?? (i % 2 === 0 ? 'spiritual' : 'science'),
      duration: l.duration ?? '5 min',
      objective: l.objective ?? '',
      whyItMatters: l.whyItMatters ?? '',
      islamicGuidance: l.islamicGuidance ?? '',
      researchInsight: l.researchInsight ?? '',
      actionSteps: l.actionSteps ?? [],
      whatToSay: l.whatToSay ?? [],
      mistakesToAvoid: l.mistakesToAvoid ?? [],
      reflectionQuestion: l.reflectionQuestion ?? '',
      miniTakeaway: l.miniTakeaway ?? '',
      completed: false,
    }));

    const module: AppModule = {
      id: `mod_${Date.now()}`,
      topic: topic.trim(),
      title: parsed.title ?? 'Your Parenting Module',
      issueSummary: parsed.issueSummary ?? '',
      parentReframe: parsed.parentReframe ?? '',
      rootCauses: parsed.rootCauses ?? [],
      moduleGoal: parsed.moduleGoal ?? '',
      lessons,
      weeklyPriorities: parsed.weeklyPriorities ?? [],
      weeklyHabits: parsed.weeklyHabits ?? [],
      behaviorToReduce: parsed.behaviorToReduce ?? '',
      relationshipAction: parsed.relationshipAction ?? '',
      spiritualPractices: parsed.spiritualPractices ?? '',
      progressSigns: parsed.progressSigns ?? [],
      whenToSeekHelp: parsed.whenToSeekHelp ?? '',
      finalEncouragement: parsed.finalEncouragement ?? '',
      totalLessons: lessons.length,
      completedLessons: 0,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    return res.json(module);
  } catch (err) {
    console.error('Learn generate error:', err);
    return res.status(500).json({ error: 'Failed to generate module. Please try again.' });
  }
});

// ─── POST /learn/generate/async ──────────────────────────────────────────────
// Returns a jobId immediately; processes the module in the background and writes
// the result to the learn_module_jobs Supabase table.

async function runLearnModuleJob(jobId: string, body: {
  topic: string;
  childrenAges?: string;
  focusAreas?: string[];
  familyStructure?: string;
}) {
  try {
    const { topic, childrenAges, focusAreas, familyStructure } = body;

    const sourceContext = await buildModuleSourceContext(topic);
    const systemPrompt  = buildModuleSystemPrompt(sourceContext);

    const familyNote = familyStructure === 'single_parent'
      ? 'This parent is a single parent — do not assume a co-parent or spouse is present. Avoid advice like "discuss with your partner" or "take turns".'
      : null;

    const userPrompt = [
      `Parent's topic: ${topic.trim()}`,
      childrenAges  ? `Children's ages: ${childrenAges}` : null,
      focusAreas?.length ? `Parent's focus areas: ${focusAreas.join(', ')}` : null,
      familyNote,
    ].filter(Boolean).join('\n');

    function cleanJson(raw: string): string {
      let s = raw.trim();
      // Strip markdown fences
      if (s.startsWith('```')) s = s.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '').trim();
      // Strip any text before the first { (thinking preamble)
      const start = s.indexOf('{');
      if (start > 0) s = s.slice(start);
      // Remove stray single-letter tokens Gemini thinking bleeds between array objects
      s = s.replace(/,(\s*\n\s*)[a-zA-Z][ \t]+(?=\{)/g, ',\n');
      return s;
    }

    let raw: string;
    try {
      const model = getJsonModel(MODEL_HEAVY, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_HEAVY, systemPrompt);
    } catch {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let parsed: Omit<AppModule, 'id' | 'totalLessons' | 'completedLessons' | 'createdAt'>;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch {
      console.warn(`Job ${jobId}: JSON parse failed on Gemini output, retrying with OpenAI`);
      const oaiRaw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
      parsed = JSON.parse(cleanJson(oaiRaw));
    }

    const lessons: ModuleLesson[] = (parsed.lessons ?? []).map((l, i) => ({
      id: i + 1,
      title: l.title ?? `Lesson ${i + 1}`,
      type: l.type ?? (i % 2 === 0 ? 'spiritual' : 'science'),
      duration: l.duration ?? '5 min',
      objective: l.objective ?? '',
      whyItMatters: l.whyItMatters ?? '',
      islamicGuidance: l.islamicGuidance ?? '',
      researchInsight: l.researchInsight ?? '',
      actionSteps: l.actionSteps ?? [],
      whatToSay: l.whatToSay ?? [],
      mistakesToAvoid: l.mistakesToAvoid ?? [],
      reflectionQuestion: l.reflectionQuestion ?? '',
      miniTakeaway: l.miniTakeaway ?? '',
      completed: false,
    }));

    const module: AppModule = {
      id: `mod_${Date.now()}`,
      topic: topic.trim(),
      title: parsed.title ?? 'Your Parenting Module',
      issueSummary: parsed.issueSummary ?? '',
      parentReframe: parsed.parentReframe ?? '',
      rootCauses: parsed.rootCauses ?? [],
      moduleGoal: parsed.moduleGoal ?? '',
      lessons,
      weeklyPriorities: parsed.weeklyPriorities ?? [],
      weeklyHabits: parsed.weeklyHabits ?? [],
      behaviorToReduce: parsed.behaviorToReduce ?? '',
      relationshipAction: parsed.relationshipAction ?? '',
      spiritualPractices: parsed.spiritualPractices ?? '',
      progressSigns: parsed.progressSigns ?? [],
      whenToSeekHelp: parsed.whenToSeekHelp ?? '',
      finalEncouragement: parsed.finalEncouragement ?? '',
      totalLessons: lessons.length,
      completedLessons: 0,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    await supabase.from('learn_module_jobs').update({ status: 'complete', module }).eq('id', jobId);
  } catch (err) {
    console.error(`Job ${jobId} failed:`, err);
    await supabase.from('learn_module_jobs').update({ status: 'failed', error: String(err) }).eq('id', jobId);
  }
}

app.post('/learn/generate/async', async (req: Request, res: Response) => {
  try {
    const { topic, childrenAges, focusAreas, familyStructure } = req.body as {
      topic: string;
      childrenAges?: string;
      focusAreas?: string[];
      familyStructure?: string;
    };

    if (!topic?.trim()) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    const { data, error } = await supabase
      .from('learn_module_jobs')
      .insert({ status: 'pending' })
      .select('id')
      .single();

    if (error || !data) return res.status(500).json({ error: 'Could not create job.' });

    const jobId = data.id;

    runLearnModuleJob(jobId, { topic, childrenAges, focusAreas, familyStructure }).catch(() => {});

    return res.json({ jobId });
  } catch (err) {
    console.error('POST /learn/generate/async error:', err);
    return res.status(500).json({ error: 'Failed to start module generation.' });
  }
});

// ─── POST /learn/audio/lesson ────────────────────────────────────────────────
// Generates narration audio for a single lesson. Returns { url }.
// Frontend calls this per-lesson in parallel so each player unlocks as it resolves.

app.post('/learn/audio/lesson', async (req: Request, res: Response) => {
  try {
    const { moduleId, lesson, voice } = req.body;
    if (!moduleId || !lesson?.id) {
      return res.status(400).json({ error: 'moduleId and lesson are required.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'Audio generation is not configured on this server.' });
    }

    const url = await generateSingleLessonNarration(moduleId, lesson, voice);
    return res.json({ url });
  } catch (err) {
    console.error('Single lesson audio error:', err);
    return res.status(500).json({ error: 'Failed to generate lesson audio.' });
  }
});

// ─── POST /guide/now ─────────────────────────────────────────────────────────

app.post('/guide/now', async (req: Request, res: Response) => {
  try {
    const { situation, childAge, childGender } = req.body as { situation: string; childAge?: string; childGender?: string };
    if (!situation?.trim()) return res.status(400).json({ error: 'situation is required.' });

    const sourceContext = await buildModuleSourceContext(situation.trim());

    const systemPrompt = `You are Tarbiyah AI, a trusted Muslim parenting coach helping parents respond wisely during real parenting moments.

Your guidance must combine:
1. Islamic wisdom and tarbiyah principles
2. Research-based parenting and child development insights
3. ONLY the approved internal knowledge base provided below

CORE IDENTITY:
You help Muslim parents handle problems in a way that is spiritually grounded, emotionally intelligent, and practically effective.

SOURCE RULES:
- Use the knowledge base below as the main authority.
- Draw from both Islamic materials and research summaries contained in it.
- If a topic is not directly covered, give reasonable best-practice guidance aligned with Islamic values and established parenting principles.
- Never invent studies, statistics, scholars, or citations.
- Never quote research unless supported by the knowledge base.

TONE: Calm, wise, compassionate, practical, respectful, clear, non-judgmental, encouraging.

QUALITY STANDARDS — THIS IS CRITICAL:
- NEVER give generic, surface-level advice. Every response must feel written specifically for this parent, this child, this moment.
- NEVER use hollow phrases like "stay calm", "validate their feelings", "set clear boundaries", or "use I-statements" without explaining exactly HOW and WHY in this specific situation.
- ALWAYS name what is developmentally happening in the child — what is going on in their brain, their emotional world, their stage of development that explains this behaviour. This reframes the parent's frustration into understanding.
- The "what to say" scripts must sound like a real, warm parent speaking — not a textbook or therapy worksheet. Natural, direct, confident, loving.
- The Islamic grounding must be SPECIFIC — a precise hadith, ayah, or principle with its context and why it directly applies here. Not vague platitudes about patience or mercy.
- Each action step must include a brief "why this works" — parents follow advice they understand, not just instructions.
- Speak to the parent's likely emotional state. Acknowledge the difficulty before prescribing solutions.
- If the child is young: root everything in co-regulation, modeling, connection before correction.
- If the child is older: emphasise communication, natural consequences, respect, collaboration.
- If a teen: lead with dignity — their identity and autonomy are sacred at this stage.
- If a safety issue: safety first, everything else second.

=== KNOWLEDGE BASE ===
${sourceContext}`;

    const userPrompt = `Parent situation: "${situation.trim()}"
${childAge ? `Child's age: ${childAge}` : ''}${childGender ? `\nChild's gender: ${childGender}` : ''}

STRUCTURE EXAMPLE — follow this shape exactly, replace all content with your own tailored output:
{
  "immediateReframe": "Example first sentence naming what is happening developmentally. Example second sentence reframing the moment spiritually.",
  "whatToSay": ["Example natural phrase a parent can say verbatim.", "Example follow-up phrase.", "Example third phrase if needed."],
  "whatToDo": ["Example step 1 — specific action and why it works.", "Example step 2.", "Example step 3."],
  "islamicGuidance": { "text": "Example: state the Islamic principle here. Example: explain what it means in practice. Example: connect it directly to this parent's specific situation — no citations." },
  "researchInsight": { "text": "Example: state the child development finding. Example: explain why it works developmentally. Example: connect it to this parent's specific situation — no source names." },
  "longTermFix": ["Example specific habit with a clear mechanism.", "Example second habit from a different angle."],
  "whenToSeekHelp": "Example 1-2 sentences on when professional support is warranted.",
  "parentReminder": "Example one powerful closing line.",
  "moduleNudge": "Example one sentence suggesting a deeper learning topic."
}

Respond with JSON only (no markdown). Keep total response 300–500 words:
{
  "immediateReframe": "2 sentences. First: name what is likely happening developmentally or emotionally in the child right now — give the parent genuine insight into the why behind the behaviour. Second: reframe the moment spiritually or emotionally so the parent feels equipped, not defeated.",
  "whatToSay": ["Specific, natural sentence the parent can say verbatim — warm, direct, not textbook. Tailored to the child's age and situation.", "Optional follow-up (max 3 total). Each line should feel distinct and build on the last."],
  "whatToDo": ["Step 1 — specific action + one sentence on why this works for this age/situation", "Step 2 — same format", "Step 3 — same format"],
  "islamicGuidance": {
    "text": "A specific hadith, ayah, or tarbiyah principle with its meaning and direct application to this exact situation. Not generic. Should feel like wisdom from a knowledgeable sheikh who understands this parent's struggle. Do NOT include any source references, hadith numbers, book names, or citations in this text — wisdom only."
  },
  "researchInsight": {
    "text": "A specific child development or psychology insight that explains what is happening and why the recommended approach works — grounded in the knowledge base. Should give the parent an 'aha' moment. Do NOT include source names, study citations, or references in this text — insight only."
  },
  "longTermFix": ["Specific habit or system with a clear mechanism — not generic advice", "Second habit — different angle, equally specific"],
  "whenToSeekHelp": "1-2 sentences describing specific signs or circumstances when this situation warrants professional support — a therapist, counsellor, paediatrician, or Islamic scholar. Be honest and specific, not generic.",
  "parentReminder": "One short, sincere, powerful line. Should feel like it comes from a wise friend who truly understands the weight of raising children as a Muslim parent.",
  "moduleNudge": "One sentence suggesting a related module topic for deeper learning"
}`;

    let raw: string;
    try {
      const model = getJsonModel(MODEL_FAST, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_FAST);
    } catch (geminiErr) {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return res.json(parsed);
  } catch (err) {
    console.error('POST /guide/now error:', err);
    return res.status(500).json({ error: 'Failed to generate guidance. Please try again.' });
  }
});

// ─── POST /incident/coach ─────────────────────────────────────────────────────

app.post('/incident/coach', async (req: Request, res: Response) => {
  try {
    const {
      incidentText,
      childName,
      childAge,
      childGender,
      childStage,
      strengths,
      temperaments,
      specialNeeds,
      growthAreas,
      pastIncidents,
      recentWins,
      familyStructure,
    } = req.body as {
      incidentText:  string;
      childName?:    string;
      childAge?:     string | number;
      childGender?:  string;
      childStage?:   string;
      strengths?:    string[];
      temperaments?: string[];
      specialNeeds?: string[];
      growthAreas?:    { title: string; description: string }[];
      pastIncidents?:  string[];
      recentWins?:     string[];
      familyStructure?: string;
    };
    if (!incidentText?.trim()) return res.status(400).json({ error: 'incidentText is required.' });

    const sourceContext = await buildModuleSourceContext(incidentText.trim());

    const systemPrompt = `You are Tarbiyah AI, a wise and compassionate Muslim parenting coach. A parent has just logged a difficult parenting moment. Give them brief, grounded, practical coaching — rooted in Islamic wisdom and the knowledge base below.

SOURCE RULES: Use the knowledge base as your primary authority. If not directly covered, draw on sound Islamic tarbiyah principles and established child development knowledge. Never invent hadith, citations, or statistics.

TONE: Warm, non-judgmental, wise, brief, specific. Never generic. Speak to this parent, this child, this moment. When the child profile includes special needs, strengths, or temperament, let that visibly shape your advice — do not give generic responses that ignore who this child actually is.
${ISLAMIC_SENSITIVITIES}
=== KNOWLEDGE BASE ===
${sourceContext}`;

    const lines: string[] = [];
    if (childName)               lines.push(`Name: ${childName}`);
    if (childAge)                lines.push(`Age: ${childAge}`);
    if (childGender)             lines.push(`Gender: ${childGender}`);
    if (childStage)              lines.push(`School stage: ${childStage}`);
    if (strengths?.length)       lines.push(`Strengths: ${strengths.join(', ')}`);
    if (temperaments?.length)    lines.push(`Temperament: ${temperaments.join(', ')}`);
    if (specialNeeds?.length)    lines.push(`Special needs / additional context: ${specialNeeds.join(', ')}`);
    if (growthAreas?.length) {
      lines.push(`Current growth areas being worked on:`);
      growthAreas.forEach(a => lines.push(`  - ${a.title}${a.description ? `: ${a.description}` : ''}`));
    }
    if (recentWins?.length) {
      lines.push(`Recent wins logged by parent:`);
      recentWins.forEach(w => lines.push(`  - "${w}"`));
    }
    if (pastIncidents?.length) {
      lines.push(`Past incidents logged (most recent first):`);
      [...pastIncidents].reverse().forEach(i => lines.push(`  - "${i}"`));
    }
    if (familyStructure === 'single_parent') lines.push(`Family structure: Single parent household`);

    const profileSection = lines.length
      ? `\nCHILD PROFILE:\n${lines.join('\n')}\n`
      : '';

    const userPrompt = `A parent just logged this incident:

"${incidentText.trim()}"
${profileSection}
Use the child profile above to make your coaching specific to this child — not generic. If there are past incidents, look for patterns and name them. If there are wins, acknowledge what is working. If there are special needs, let that shape your advice.

Respond with JSON only — no markdown, no preamble:
{
  "acknowledgment": "1-2 sentences. Acknowledge what the parent experienced — name the difficulty without judgment. If there are recurring patterns in the past incidents, name them gently. Make the parent feel seen, not shamed.",
  "islamicAngle": "1-2 sentences. A specific Islamic principle, hadith wisdom, or Quranic angle that reframes or speaks directly to this moment and this child. Must feel precise, not generic. No citations.",
  "action": "1-2 sentences. One specific, concrete thing this parent can try with this child right now or today — informed by their temperament, strengths, or growth areas. Explain briefly why it works."
}`;

    function cleanJson(raw: string): string {
      let s = raw.trim();
      if (s.startsWith('```')) s = s.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '').trim();
      const start = s.indexOf('{');
      if (start > 0) s = s.slice(start);
      return s;
    }

    let raw: string;
    try {
      const model = getJsonModel(MODEL_FAST, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_FAST);
    } catch {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    const parsed = JSON.parse(cleanJson(raw));
    return res.json(parsed);
  } catch (err) {
    console.error('POST /incident/coach error:', err);
    return res.status(500).json({ error: 'Failed to generate coaching.' });
  }
});

// ─── GET /trending/challenges ─────────────────────────────────────────────────

const CHALLENGE_CATEGORIES = [
  { label: 'Screen Time',        keywords: ['screen', 'phone', 'ipad', 'device', 'youtube', 'gaming', 'game', 'tablet', 'tv'] },
  { label: 'Anger & Tantrums',   keywords: ['anger', 'angry', 'tantrum', 'meltdown', 'hitting', 'aggressive', 'rage', 'temper', 'emotions'] },
  { label: 'Building Connection',keywords: ['connect', 'relationship', 'bond', 'distant', 'quality time', 'closer', 'attention'] },
  { label: 'Islamic Identity',   keywords: ['islam', 'muslim', 'identity', 'faith', 'religion', 'prayer', 'quran', 'deen', 'salah'] },
  { label: 'Anxiety & Confidence',keywords:['anxiety', 'anxious', 'confidence', 'shy', 'fearful', 'worried', 'worry', 'fear', 'nervous'] },
  { label: 'Teens & Puberty',    keywords: ['teen', 'puberty', 'teenager', 'adolescent', 'tween'] },
  { label: 'Bedtime & Sleep',    keywords: ['sleep', 'bedtime', 'night routine', 'bed'] },
  { label: 'Listening & Respect',keywords: ['listen', 'obey', 'discipline', 'respect', 'defiant', 'rules', 'behaviour', 'behavior'] },
  { label: 'Sibling Rivalry',    keywords: ['sibling', 'brother', 'sister', 'fighting', 'jealous'] },
  { label: 'Focus & Learning',   keywords: ['focus', 'school', 'homework', 'learning', 'adhd', 'study', 'education'] },
];

const DEFAULT_CHALLENGES = [
  { label: 'Screen Time', count: 45 },
  { label: 'Anger & Tantrums', count: 38 },
  { label: 'Building Connection', count: 32 },
  { label: 'Listening & Respect', count: 27 },
  { label: 'Islamic Identity', count: 21 },
];

app.get('/trending/challenges', async (req: Request, res: Response) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data } = await supabase
      .from('user_modules')
      .select('topic')
      .gte('created_at', since.toISOString());

    const topics = (data ?? []).map((row: { topic: string }) => (row.topic ?? '').toLowerCase());

    const counts: Record<string, number> = {};
    for (const topic of topics) {
      for (const cat of CHALLENGE_CATEGORIES) {
        if (cat.keywords.some(kw => topic.includes(kw))) {
          counts[cat.label] = (counts[cat.label] ?? 0) + 1;
          break;
        }
      }
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({
        label,
        count: Math.max(5, Math.round((count + Math.floor(Math.random() * 4) + 1) / 5) * 5),
      }));

    return res.json(sorted.length >= 3 ? sorted : DEFAULT_CHALLENGES);
  } catch (err) {
    console.error('GET /trending/challenges error:', err);
    return res.json(DEFAULT_CHALLENGES);
  }
});

// ─── GET /community/metadata ──────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return /youtu\.be\/|youtube\.com\/(watch|shorts|embed)/.test(url);
}

async function fetchYouTubeMeta(url: string): Promise<{ title: string; description: string; thumbnail: string }> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const res = await fetch(oembedUrl, { signal: controller.signal });
  clearTimeout(timeout);
  const data = await res.json() as { title?: string; thumbnail_url?: string; author_name?: string };
  const rawTitle = data.title ?? '';
  // Strip trailing " - YouTube" suffix and emoji/special Unicode characters
  const title = rawTitle
    .replace(/\s*-\s*YouTube\s*$/i, '')
    .replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{27FF}|\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title,
    description: title ? `YouTube video by ${data.author_name ?? 'unknown channel'}` : '',
    thumbnail: data.thumbnail_url ?? '',
  };
}

app.get('/community/metadata', async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string };
  if (!url) return res.status(400).json({ error: 'url is required.' });

  try {
    if (isYouTubeUrl(url)) {
      return res.json(await fetchYouTubeMeta(url));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tarbiyah/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    const html = await response.text();

    const ogTitle    = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
                    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    const ogDesc     = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
                    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1];
    const pageTitle  = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();

    const decodeEntities = (str: string) =>
      str.replace(/&amp;/g, '&')
         .replace(/&lt;/g, '<')
         .replace(/&gt;/g, '>')
         .replace(/&quot;/g, '"')
         .replace(/&#39;/g, "'")
         .replace(/&apos;/g, "'")
         .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

    const title = decodeEntities(ogTitle ?? pageTitle ?? '');
    const description = decodeEntities(ogDesc ?? '');

    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
                 ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
                 ?? null;

    return res.json({ title, description, thumbnail: ogImage ?? '' });
  } catch {
    return res.json({ title: '', description: '' });
  }
});

// ─── COMMUNITY RESOURCES ──────────────────────────────────────────────────────

const DAILY_SUBMISSION_LIMIT = 5;
const CRON_SECRET = process.env.CRON_SECRET ?? '';

// ── 1. URL safety via Google Safe Browsing ────────────────────────────────────
async function checkUrlSafety(url: string): Promise<{ safe: boolean; threat?: string }> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!apiKey) return { safe: true };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          client: { clientId: 'tarbiyah', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    clearTimeout(timeout);
    const data = await res.json() as { matches?: { threatType: string }[] };
    if (data.matches && data.matches.length > 0) return { safe: false, threat: data.matches[0].threatType };
    return { safe: true };
  } catch {
    return { safe: true }; // fail open if Safe Browsing is unreachable
  }
}

// ── Scrape og:image thumbnail from a URL ─────────────────────────────────────
async function fetchThumbnail(url: string): Promise<string | null> {
  try {
    if (isYouTubeUrl(url)) {
      const meta = await fetchYouTubeMeta(url);
      return meta.thumbnail || null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Tarbiyahbot/1.0)' },
    });
    clearTimeout(timeout);
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ── 2. AI moderation via Gemini → OpenAI fallback ────────────────────────────
async function moderateResource(
  url: string, title: string, description: string, category: string
): Promise<{ approved: boolean; pending: boolean; reason: string }> {
  const systemPrompt = 'You are a content moderator for Tarbiyah, an Islamic parenting app for Muslim families following Islamic principles.';
  const prompt = `Review this community-submitted parenting resource:
URL: ${url}
Title: ${title}
Description: ${description || '(none)'}
Category: ${category}

APPROVE if:
- Relevant to parenting, child development, family life, or Islamic education
- Islamically appropriate and consistent with Islamic values
- A legitimate resource (not spam, phishing, or a commercial sales page)
- Author/channel may be non-Muslim as long as content is appropriate for Muslim families

REJECT only if clearly:
- Contains haram content (adult/sexual content, inappropriate music, un-Islamic relationships)
- Promotes beliefs that contradict core Islamic principles (e.g. shirk, kufr)
- Completely unrelated to parenting or family (e.g. random news, sports, politics)
- Spam, phishing, or purely commercial with no educational value

When in doubt, APPROVE. Give the submitter the benefit of the doubt.
If the URL is inaccessible or you cannot verify its content, APPROVE based on the title and description alone — do not reject solely because the URL could not be fetched.

Never use the word "Sunni" in your response. Always say "Islamic" instead.
Respond with JSON only — no markdown: { "approved": boolean, "reason": string }`;

  function parseResult(text: string): { approved: boolean; pending: boolean; reason: string } {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);
    if (typeof result.approved !== 'boolean') throw new Error('Invalid response shape');
    return { ...result, pending: false };
  }

  // Try Gemini first
  try {
    const model = getJsonModel(MODEL_FAST, systemPrompt);
    const text = await generateWithRetry(model, prompt, MODEL_FAST);
    return parseResult(text);
  } catch (geminiErr: any) {
    console.warn('[moderateResource] Gemini failed, trying OpenAI:', geminiErr?.message);
  }

  // Fallback to OpenAI
  try {
    const text = await generateJsonWithOpenAI(systemPrompt, prompt);
    return parseResult(text);
  } catch (openaiErr: any) {
    console.warn('[moderateResource] OpenAI also failed:', openaiErr?.message);
    return { approved: false, pending: true, reason: 'AI review temporarily unavailable.' };
  }
}

// GET /community/resources
app.get('/community/resources', async (req: Request, res: Response) => {
  try {
    const { category, age } = req.query as { category?: string; age?: string };

    let query = supabase
      .from('community_resources')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (category && category !== 'All') query = query.eq('category', category);
    if (age && age !== 'All Ages') query = query.eq('age_range', age);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    console.error('GET /community/resources error:', err);
    return res.status(500).json({ error: 'Failed to fetch resources.' });
  }
});

// POST /community/resources — submit + AI moderate
app.post('/community/resources', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { url, title, description, category, age_range, why_helped, exclude_thumbnail } = req.body;
    if (!url || !title || !category) {
      return res.status(400).json({ error: 'url, title and category are required.' });
    }

    // ── Mitigation 2: Rate limit — 5 submissions per user per day ─────────────
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabase
      .from('community_resources')
      .select('*', { count: 'exact', head: true })
      .eq('submitted_by', req.userId!)
      .gte('created_at', since);
    if ((count ?? 0) >= DAILY_SUBMISSION_LIMIT) {
      return res.status(429).json({ error: 'You can share up to 5 resources per day. Please try again tomorrow.' });
    }

    // ── Mitigation 1: URL safety check + thumbnail scrape (parallel) ─────────
    const [safety, thumbnailUrl] = await Promise.all([
      checkUrlSafety(url),
      exclude_thumbnail ? Promise.resolve(null) : fetchThumbnail(url),
    ]);
    if (!safety.safe) {
      return res.status(422).json({ error: 'This URL was flagged as unsafe and cannot be submitted.' });
    }

    // ── Mitigation 1+5: AI moderation with fallback queue ─────────────────────
    const moderation = await moderateResource(url, title, description ?? '', category);

    if (!moderation.approved && !moderation.pending) {
      // Hard rejection — clear content violation
      return res.status(422).json({
        error: moderation.reason ?? 'This resource could not be approved.',
        hint: 'Please review the content and try again, or submit a different resource.',
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', req.userId!)
      .single();
    const submitterName: string | null = profile?.name ?? null;

    const { data, error } = await supabase
      .from('community_resources')
      .insert({
        url,
        title,
        description: description ?? null,
        category,
        age_range: age_range ?? 'All Ages',
        why_helped: why_helped ?? null,
        submitted_by: req.userId!,
        submitter_name: submitterName,
        thumbnail_url: thumbnailUrl,
        approved: moderation.pending ? false : true,
        pending_review: moderation.pending ?? false,
        rejected: false,
        recommend_count: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(moderation.pending ? 202 : 200).json({
      ...data,
      _pending: moderation.pending ?? false,
    });
  } catch (err) {
    console.error('POST /community/resources error:', err);
    return res.status(500).json({ error: 'Failed to submit resource. Please try again.' });
  }
});

// POST /community/resources/:id/recommend — toggle
app.post('/community/resources/:id/recommend', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const resourceId = req.params.id;
    const userId = req.userId!;

    const { data: existing } = await supabase
      .from('resource_recommendations')
      .select('resource_id')
      .eq('user_id', userId)
      .eq('resource_id', resourceId)
      .single();

    if (existing) {
      await supabase.from('resource_recommendations').delete()
        .eq('user_id', userId).eq('resource_id', resourceId);
      await supabase.rpc('decrement_recommend', { resource_id: resourceId });
      return res.json({ recommended: false });
    } else {
      await supabase.from('resource_recommendations').insert({ user_id: userId, resource_id: resourceId });
      await supabase.rpc('increment_recommend', { resource_id: resourceId });
      return res.json({ recommended: true });
    }
  } catch (err) {
    console.error('POST /community/resources/:id/recommend error:', err);
    return res.status(500).json({ error: 'Failed to update recommendation.' });
  }
});

// GET /community/resources/my-recommendations — IDs the user has recommended
app.get('/community/resources/my-recommendations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('resource_recommendations')
      .select('resource_id')
      .eq('user_id', req.userId!);
    if (error) throw error;
    return res.json((data ?? []).map((r: { resource_id: string }) => r.resource_id));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
});

// GET /community/resources/my-posts — resources submitted by the current user
app.get('/community/resources/my-posts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('community_resources')
      .select('*')
      .eq('submitted_by', req.userId!)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch your posts.' });
  }
});

// POST /community/resources/retry-pending — cron job retries pending AI moderation
app.post('/community/resources/retry-pending', async (req: Request, res: Response) => {
  if (req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised.' });
  }
  try {
    const { data: pending, error } = await supabase
      .from('community_resources')
      .select('*')
      .eq('approved', false)
      .eq('pending_review', true)
      .eq('rejected', false)
      .limit(20);

    if (error) throw error;
    if (!pending?.length) return res.json({ retried: 0 });

    let approved = 0, stillPending = 0, rejected = 0;

    for (const resource of pending) {
      const moderation = await moderateResource(resource.url, resource.title, resource.description ?? '', resource.category);

      if (moderation.pending) {
        stillPending++;
        continue; // Gemini still down — leave it, try next cycle
      }

      if (moderation.approved) {
        await supabase.from('community_resources').update({ approved: true, pending_review: false }).eq('id', resource.id);
        approved++;
      } else {
        await supabase.from('community_resources').update({
          rejected: true,
          pending_review: false,
          rejection_reason: moderation.reason,
        }).eq('id', resource.id);
        rejected++;
      }
    }

    return res.json({ retried: pending.length, approved, rejected, stillPending });
  } catch (err) {
    console.error('retry-pending error:', err);
    return res.status(500).json({ error: 'Retry job failed.' });
  }
});

// PATCH /community/resources/:id — edit own resource
app.patch('/community/resources/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, category, age_range, why_helped } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('community_resources')
      .select('submitted_by')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Resource not found.' });
    if (existing.submitted_by !== req.userId!) return res.status(403).json({ error: 'Not authorised.' });

    const { data, error } = await supabase
      .from('community_resources')
      .update({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(age_range !== undefined && { age_range }),
        ...(why_helped !== undefined && { why_helped }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('PATCH /community/resources/:id error:', err);
    return res.status(500).json({ error: 'Failed to update resource.' });
  }
});

// DELETE /community/resources/:id — delete own resource
app.delete('/community/resources/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await supabase
      .from('community_resources')
      .select('submitted_by')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Resource not found.' });
    if (existing.submitted_by !== req.userId!) return res.status(403).json({ error: 'Not authorised.' });

    const { error } = await supabase.from('community_resources').delete().eq('id', id);
    if (error) throw error;
    return res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /community/resources/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete resource.' });
  }
});

// PATCH /community/duas/:id
app.patch('/community/duas/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required.' });
    if (text.trim().length > 280) return res.status(400).json({ error: 'Du\'a must be 280 characters or less.' });
    const { data: existing, error: fetchErr } = await supabase
      .from('duas').select('user_id').eq('id', req.params.id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Not found.' });
    if (existing.user_id !== req.userId!) return res.status(403).json({ error: 'Not authorised.' });
    const moderation = await moderateResource('', text.trim(), '', 'dua');
    const { data, error } = await supabase
      .from('duas').update({ title: req.body.title?.trim() || null, text: text.trim(), is_approved: moderation.approved && !moderation.pending })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update du\'a.' });
  }
});

// DELETE /community/duas/:id
app.delete('/community/duas/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('duas').select('user_id').eq('id', req.params.id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Not found.' });
    if (existing.user_id !== req.userId!) return res.status(403).json({ error: 'Not authorised.' });
    const { error } = await supabase.from('duas').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete du\'a.' });
  }
});

// PATCH /community/wins/:id
app.patch('/community/wins/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required.' });
    if (text.trim().length > 280) return res.status(400).json({ error: 'Win must be 280 characters or less.' });
    const { data: existing, error: fetchErr } = await supabase
      .from('parenting_wins').select('user_id').eq('id', req.params.id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Not found.' });
    if (existing.user_id !== req.userId!) return res.status(403).json({ error: 'Not authorised.' });
    const moderation = await moderateResource('', text.trim(), '', 'parenting_win');
    const { data, error } = await supabase
      .from('parenting_wins').update({ title: req.body.title?.trim() || null, text: text.trim(), is_approved: moderation.approved && !moderation.pending })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update win.' });
  }
});

// DELETE /community/wins/:id
app.delete('/community/wins/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('parenting_wins').select('user_id').eq('id', req.params.id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Not found.' });
    if (existing.user_id !== req.userId!) return res.status(403).json({ error: 'Not authorised.' });
    const { error } = await supabase.from('parenting_wins').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete win.' });
  }
});

// ─── Du'a Board ───────────────────────────────────────────────────────────────

// GET /community/duas
app.get('/community/duas', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('duas')
      .select('*, dua_reactions(type, user_id)')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const duas = (data ?? []).map((d: any) => ({
      ...d,
      made_dua_count: d.dua_reactions.filter((r: any) => r.type === 'made_dua').length,
      feel_you_count: d.dua_reactions.filter((r: any) => r.type === 'feel_you').length,
      dua_reactions: undefined,
    }));
    return res.json(duas);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch duas.' });
  }
});

// POST /community/duas
app.post('/community/duas', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, text, is_anonymous, display_name } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required.' });
    if (text.trim().length > 280) return res.status(400).json({ error: 'Du\'a must be 280 characters or less.' });

    const moderation = await moderateResource('', text.trim(), '', 'dua');
    const is_approved = moderation.approved && !moderation.pending;

    const { data, error } = await supabase
      .from('duas')
      .insert({ user_id: req.userId!, title: title?.trim() || null, text: text.trim(), is_anonymous: !!is_anonymous, display_name: display_name ?? null, is_approved })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ ...data, pending: moderation.pending });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit du\'a.' });
  }
});

// POST /community/duas/:id/react — toggle made_dua or feel_you
app.post('/community/duas/:id/react', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.body as { type: 'made_dua' | 'feel_you' };
    if (!['made_dua', 'feel_you'].includes(type)) return res.status(400).json({ error: 'Invalid reaction type.' });

    const userId = req.userId!;
    const { data: existing } = await supabase
      .from('dua_reactions')
      .select('id')
      .eq('dua_id', id).eq('user_id', userId).eq('type', type)
      .single();

    if (existing) {
      await supabase.from('dua_reactions').delete().eq('id', existing.id);
      return res.json({ reacted: false, type });
    } else {
      await supabase.from('dua_reactions').insert({ dua_id: id, user_id: userId, type });
      return res.json({ reacted: true, type });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to react.' });
  }
});

// GET /community/duas/my-reactions
app.get('/community/duas/my-reactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('dua_reactions')
      .select('dua_id, type')
      .eq('user_id', req.userId!);
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reactions.' });
  }
});

// ─── Parenting Wins ───────────────────────────────────────────────────────────

// GET /community/wins
app.get('/community/wins', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('parenting_wins')
      .select('*, win_reactions(user_id)')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const wins = (data ?? []).map((w: any) => ({
      ...w,
      heart_count: w.win_reactions.length,
      win_reactions: undefined,
    }));
    return res.json(wins);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch wins.' });
  }
});

// POST /community/wins — submit with AI moderation
app.post('/community/wins', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, text, is_anonymous, display_name } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required.' });
    if (text.trim().length > 280) return res.status(400).json({ error: 'Win must be 280 characters or less.' });

    const moderation = await moderateResource('', text.trim(), '', 'parenting_win');
    const is_approved = moderation.approved && !moderation.pending;

    const { data, error } = await supabase
      .from('parenting_wins')
      .insert({
        user_id: req.userId!,
        title: title?.trim() || null,
        text: text.trim(),
        is_anonymous: !!is_anonymous,
        display_name: display_name ?? null,
        is_approved,
      })
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({ ...data, pending: moderation.pending });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit win.' });
  }
});

// POST /community/wins/:id/react — toggle heart
app.post('/community/wins/:id/react', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const { data: existing } = await supabase
      .from('win_reactions')
      .select('id')
      .eq('win_id', id).eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('win_reactions').delete().eq('id', existing.id);
      return res.json({ reacted: false });
    } else {
      await supabase.from('win_reactions').insert({ win_id: id, user_id: userId });
      return res.json({ reacted: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to react.' });
  }
});

// GET /community/wins/my-reactions
app.get('/community/wins/my-reactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('win_reactions')
      .select('win_id')
      .eq('user_id', req.userId!);
    if (error) throw error;
    return res.json((data ?? []).map((r: any) => r.win_id));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reactions.' });
  }
});

// ─── Saved Resources (My Library) ─────────────────────────────────────────────

// GET /community/saved
app.get('/community/saved', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('saved_resources')
      .select('resource_id, community_resources(*)')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json((data ?? []).map((r: any) => r.community_resources));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch saved resources.' });
  }
});

// POST /community/saved/:id — toggle save
app.post('/community/saved/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const { data: existing } = await supabase
      .from('saved_resources')
      .select('id')
      .eq('user_id', userId).eq('resource_id', id)
      .single();

    if (existing) {
      await supabase.from('saved_resources').delete().eq('id', existing.id);
      return res.json({ saved: false });
    } else {
      await supabase.from('saved_resources').insert({ user_id: userId, resource_id: id });
      return res.json({ saved: true });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle save.' });
  }
});

// GET /community/saved/ids — just the IDs the user has saved
app.get('/community/saved/ids', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('saved_resources')
      .select('resource_id')
      .eq('user_id', req.userId!);
    if (error) throw error;
    return res.json((data ?? []).map((r: any) => r.resource_id));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch saved IDs.' });
  }
});

// GET /community/my-posts — all of user's resources, duas, wins
app.get('/community/my-posts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [resources, duas, wins] = await Promise.all([
      supabase.from('community_resources').select('*').eq('submitted_by', req.userId!).order('created_at', { ascending: false }),
      supabase.from('duas').select('*').eq('user_id', req.userId!).order('created_at', { ascending: false }),
      supabase.from('parenting_wins').select('*').eq('user_id', req.userId!).order('created_at', { ascending: false }),
    ]);
    return res.json({
      resources: resources.data ?? [],
      duas: duas.data ?? [],
      wins: wins.data ?? [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch your posts.' });
  }
});

// ─── GET /modules ─────────────────────────────────────────────────────────────

app.get('/modules', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('user_modules')
      .select('data')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const modules = (data ?? []).map((row: { data: unknown }) => row.data);
    return res.json(modules);
  } catch (err) {
    console.error('GET /modules error:', err);
    return res.status(500).json({ error: 'Failed to fetch modules.' });
  }
});

// ─── POST /modules ────────────────────────────────────────────────────────────

app.post('/modules', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const mod = req.body as AppModule;
    if (!mod?.id) return res.status(400).json({ error: 'Module id is required.' });

    const { error } = await supabase
      .from('user_modules')
      .upsert({
        id: mod.id,
        user_id: req.userId!,
        topic: mod.topic,
        title: mod.title,
        data: mod,
        completed_lessons: mod.completedLessons ?? 0,
        total_lessons: mod.totalLessons ?? 5,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,id' });

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /modules error:', err);
    return res.status(500).json({ error: 'Failed to save module.' });
  }
});

// ─── DELETE /auth/account ─────────────────────────────────────────────────────

app.delete('/auth/account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.userId!);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ─── POST /pip/generate ───────────────────────────────────────────────────────

app.post('/pip/generate', async (req: Request, res: Response) => {
  try {
    const { planType, userGoal, journeyType, childAges, familyContext, stressLevel, familyStructure } = req.body as {
      planType: string; userGoal: string; journeyType: string;
      childAges?: string; familyContext?: string; stressLevel?: string; familyStructure?: string;
    };
    if (!userGoal?.trim()) return res.status(400).json({ error: 'userGoal is required.' });

    const sourceContext = await buildModuleSourceContext(userGoal.trim());

    const systemPrompt = `You are Tarbiyah AI, a trusted Muslim parenting and personal development coach.

Your purpose is to generate transformational improvement plans for Muslim parents using:
1. Islamic guidance and tarbiyah principles
2. Research-based parenting, psychology, habit-building, and behavior change insights
3. ONLY the approved internal knowledge base: source_knowledge

CORE MISSION:
Help parents grow personally and improve their family life through structured, realistic plans that create lasting change.

IMPORTANT SOURCE RULES:
- Use source_knowledge as the main authority.
- Use both Islamic and research-backed insights found within source_knowledge.
- If a topic is not directly covered, provide practical best-practice guidance aligned with Islamic values.
- Never invent studies, scholars, statistics, or citations.
- Never contradict Islamic ethics.
${ISLAMIC_SENSITIVITIES}
TONE: Wise, Supportive, Practical, Motivating, Calm, Respectful, Non-judgmental, Hopeful.

JOURNEY DEFINITIONS:
1. Reset (14 Days) — Fast wins, lighter tasks, immediate support, quick progress.
2. Growth (30 Days) — Balanced challenge, sustainable systems, habit repetition, measurable progress.
3. Transformation (90 Days) — Deeper identity work, layered systems, monthly milestones, durable lifestyle change.

IMPORTANT RULES:
- Keep practical for busy parents.
- Focus on systems over motivation alone.
- Avoid guilt-heavy language.
- Encourage mercy, repentance, patience, consistency.
- Keep concise but premium-feeling.
- Adapt to child age when relevant.
- Prioritize emotional regulation if anger/stress issue.
- Prioritize connection if relationship issue.
- Prioritize routine if chaos issue.
- Prioritize worship culture if deen issue.
- Do NOT include hadith numbers, book names, or study citations in any text fields.
- Each roadmap phase MUST have its own "dailyHabits" array of exactly 5 habits as objects with "text" and "priority" fields. Mark 2–3 as "core" (highest impact, parent must try) and the rest as "bonus" (reinforcing, optional but valuable). Habits should evolve across phases — early phases build awareness and simple actions, later phases deepen practice and increase challenge. The durationDays for all phases must add up exactly to the total plan duration.
- CRITICAL: Every habit must be written as a daily repeatable action — something the parent can meaningfully do every single day. Never write one-time tasks, setup activities, or time-bound observations (e.g. never "track for 3 days", "have an initial conversation", "set up a system this week"). If an action involves reflection or observation, write it as a daily micro-habit: instead of "track your anger triggers for a week", write "take 2 minutes before bed to note one moment today where you felt triggered".

=== KNOWLEDGE BASE ===
${sourceContext}`;

    const durationDays = journeyType === 'Reset' ? 14 : journeyType === 'Transformation' ? 90 : 30;

    const pipFamilyNote = familyStructure === 'single_parent'
      ? 'This parent is a single parent — do not assume a co-parent or spouse is present. Avoid advice like "discuss with your partner" or "take turns".'
      : '';

    const userPrompt = `Plan Type: ${planType || 'General'}
Main Struggle or Goal: ${userGoal.trim()}
Selected Journey: ${journeyType || 'Growth'} (${durationDays} Days)
${childAges ? `Child Ages: ${childAges}` : ''}
${familyContext ? `Family Context: ${familyContext}` : ''}
${stressLevel ? `Stress Level: ${stressLevel}` : ''}
${pipFamilyNote}

STRUCTURE EXAMPLE — follow this shape exactly for every field, replace all content with your own tailored output:
{
  "roadmap": [
    {
      "phase": "Phase 1: Example Phase Name (Days 1-10)",
      "title": "Example short title",
      "description": "Example 2-3 sentence description of what this phase focuses on.",
      "durationDays": 10,
      "dailyHabits": [
        { "text": "Example core habit — highest impact, specific and trackable", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "One sentence explaining why this habit works for this parent's specific struggle." },
        { "text": "Example core habit — highest impact, specific and trackable", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "One sentence on the psychological or behavioural mechanism." },
        { "text": "Example core habit — highest impact, specific and trackable", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "One sentence connecting this directly to the parent's goal." },
        { "text": "Example bonus habit — reinforcing, good if time allows", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "One sentence on why this reinforces the core habits." },
        { "text": "Example bonus habit — reinforcing, good if time allows", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "One sentence on why this adds value." }
      ]
    },
    {
      "phase": "Phase 2: Example Phase Name (Days 11-20)",
      "title": "Example short title",
      "description": "Example description.",
      "durationDays": 10,
      "dailyHabits": [
        { "text": "Example core habit", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "Why this works." },
        { "text": "Example core habit", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "Why this works." },
        { "text": "Example bonus habit", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "Why this helps." },
        { "text": "Example bonus habit", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "Why this helps." },
        { "text": "Example bonus habit", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "Why this helps." }
      ]
    }
  ]
}
RULES: durationDays across all phases must sum to the total plan duration. Every phase must have exactly 5 dailyHabits as objects with "text", "notifTitle", "priority", and "why". "notifTitle" must be a punchy 2-5 word action-oriented title that makes a parent want to open the app (e.g. "Pause before reacting", "One minute of connection", "Name what you feel"). Mark 2–3 as "core" and the rest as "bonus". The "why" must be one specific sentence explaining the mechanism — not generic. Phase label must include the day range e.g. "(Days 1-10)".

Respond with valid JSON only (no markdown). Full structure:
{
  "title": "Warm motivating plan title",
  "bigPictureGoal": "2-3 sentences on what success looks like",
  "whyHappening": ["Likely cause 1", "Likely cause 2", "Likely cause 3"],
  "islamicFoundation": "2-3 sentences. First: state the Islamic principle — an ayah, hadith, or tarbiyah lesson. Second: explain what it means in practice. Third: connect it directly to this parent's specific struggle. No citations or hadith numbers.",
  "researchInsight": "2-3 sentences. First: state the evidence-based finding. Second: explain why it works developmentally or psychologically. Third: connect it directly to this parent's situation. No source names or citations.",
  "roadmap": [{"phase": "Phase 1: Name (Days 1-10)", "title": "Short title", "description": "2-3 sentences", "durationDays": 10, "dailyHabits": [{"text": "Habit 1", "notifTitle": "Punchy title", "priority": "core", "why": "Why this works."}, {"text": "Habit 2", "notifTitle": "Punchy title", "priority": "core", "why": "Why this works."}, {"text": "Habit 3", "notifTitle": "Punchy title", "priority": "core", "why": "Why this works."}, {"text": "Habit 4", "notifTitle": "Punchy title", "priority": "bonus", "why": "Why this helps."}, {"text": "Habit 5", "notifTitle": "Punchy title", "priority": "bonus", "why": "Why this helps."}]}],
  "firstActionSteps": {"day1": "Specific task", "day2": "Specific task", "day3": "Specific task"},
  "whatToSayScripts": ["Script 1 — realistic parent voice", "Script 2", "Script 3"],
  "whenYouSlipUp": "Reset strategy for difficult days — 2-3 sentences",
  "progressMetrics": ["Sign 1", "Sign 2", "Sign 3", "Sign 4", "Sign 5"],
  "nextBestJourney": "One sentence recommending what comes after this plan",
  "parentReminder": "One uplifting closing line"
}`;

    let raw: string;
    try {
      const model = getJsonModel(MODEL_FAST, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_FAST);
    } catch (geminiErr) {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return res.json({ ...parsed, durationDays });
  } catch (err) {
    console.error('POST /pip/generate error:', err);
    return res.status(500).json({ error: 'Failed to generate plan. Please try again.' });
  }
});

// ─── POST /pip/checkin ────────────────────────────────────────────────────────

app.post('/pip/checkin', async (req: Request, res: Response) => {
  try {
    const { feedback, currentHabits, journeyType, dayNumber } = req.body as {
      feedback: string; currentHabits: string[]; journeyType: string; dayNumber: number;
    };
    if (!feedback?.trim()) return res.status(400).json({ error: 'feedback is required.' });

    const systemPrompt = `You are Tarbiyah AI, a warm Muslim parenting coach reviewing a parent's progress check-in.

Your role: listen to their feedback, acknowledge their effort, provide short coaching insight, and if needed adjust their 5 daily habits to better fit their current reality. Return habits as objects with "text" and "priority" fields — mark 2–3 as "core" and the rest as "bonus".

TONE: Warm, honest, encouraging, non-judgmental. Speak like a trusted coach who knows them.
RULES:
- Keep coaching response to 3-5 sentences max.
- Only adjust habits if the parent's feedback clearly indicates they need to be modified (too hard, not relevant, need to change focus).
- If habits are working, return them unchanged.
- Never invent citations or studies.`;

    const userPrompt = `Journey: ${journeyType}, Day ${dayNumber} check-in.

Current daily habits:
${currentHabits.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Parent feedback: "${feedback.trim()}"

Respond with valid JSON only:
{
  "coachingResponse": "3-5 sentence warm coaching response acknowledging their feedback and giving one key insight or encouragement",
  "adjustedHabits": [{"text": "Habit 1", "priority": "core", "why": "Why this works."}, {"text": "Habit 2", "priority": "core", "why": "Why this works."}, {"text": "Habit 3", "priority": "core", "why": "Why this works."}, {"text": "Habit 4", "priority": "bonus", "why": "Why this helps."}, {"text": "Habit 5", "priority": "bonus", "why": "Why this helps."}]
}`;

    let raw: string;
    try {
      const model = getJsonModel(MODEL_FAST, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_FAST);
    } catch (geminiErr) {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return res.json(parsed);
  } catch (err) {
    console.error('POST /pip/checkin error:', err);
    return res.status(500).json({ error: 'Failed to process check-in. Please try again.' });
  }
});

// ─── POST /child-plan/checkin ────────────────────────────────────────────────

app.post('/child-plan/checkin', async (req: Request, res: Response) => {
  try {
    const { feedback, currentActions, journeyType, dayNumber, growthGoal } = req.body as {
      feedback: string; currentActions: string[]; journeyType: string; dayNumber: number; growthGoal?: string;
    };
    if (!feedback?.trim()) return res.status(400).json({ error: 'feedback is required.' });

    const systemPrompt = `You are Tarbiyah AI, a warm Muslim parenting coach reviewing a parent's progress check-in for their child's growth plan.

Your role: listen to their feedback about how their child is progressing and how the parent actions are going, acknowledge their effort, provide short coaching insight specific to the child's growth issue, and if needed adjust their 5 daily parent actions to better fit the current reality.

TONE: Warm, honest, encouraging, non-judgmental. Speak like a trusted coach who knows them.
RULES:
- Keep coaching response to 3-5 sentences max.
- The coaching must be specific to the child's growth issue and what the parent shared — not generic.
- Only adjust actions if the parent's feedback clearly indicates they need to be modified (too hard, not relevant, child is responding differently than expected).
- If actions are working, return them unchanged.
- Never invent citations or studies.`;

    const userPrompt = `Growth Issue: ${growthGoal || 'Not specified'}
Journey: ${journeyType}, Day ${dayNumber} check-in.

Current daily parent actions:
${(currentActions || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}

Parent feedback: "${feedback.trim()}"

Respond with valid JSON only:
{
  "coachingResponse": "3-5 sentence warm coaching response acknowledging their feedback and giving one key insight or encouragement specific to the child's growth issue",
  "adjustedActions": [{"text": "Action 1", "priority": "core", "why": "Why this works."}, {"text": "Action 2", "priority": "core", "why": "Why this works."}, {"text": "Action 3", "priority": "core", "why": "Why this works."}, {"text": "Action 4", "priority": "bonus", "why": "Why this helps."}, {"text": "Action 5", "priority": "bonus", "why": "Why this helps."}]
}`;

    let raw: string;
    try {
      const model = getJsonModel(MODEL_FAST, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_FAST);
    } catch (geminiErr) {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return res.json(parsed);
  } catch (err) {
    console.error('POST /child-plan/checkin error:', err);
    return res.status(500).json({ error: 'Failed to process check-in. Please try again.' });
  }
});

// ─── POST /child-plan/generate ───────────────────────────────────────────────

app.post('/child-plan/generate', async (req: Request, res: Response) => {
  try {
    const { growthGoal, childAge, temperament, parentChallenge, journeyType, familyStructure } = req.body as {
      growthGoal: string; childAge: string; journeyType: string;
      temperament?: string; parentChallenge?: string; familyStructure?: string;
    };
    if (!growthGoal?.trim()) return res.status(400).json({ error: 'growthGoal is required.' });

    const sourceContext = await buildModuleSourceContext(growthGoal.trim());

    const systemPrompt = `You are Tarbiyah AI, a trusted Muslim parenting and child development coach.

Your role is to help Muslim parents wisely support their child's growth using:
1. Islamic tarbiyah principles
2. Research-based child development and parenting insights
3. ONLY the approved internal knowledge base: source_knowledge

CORE MISSION:
Help parents nurture their child's growth through wise parenting, healthy environments, consistent routines, emotional support, and age-appropriate guidance.

IMPORTANT PHILOSOPHY:
The child is not a problem to fix.
The goal is not control, punishment, or forcing habits.
The goal is to help the parent create conditions where the child can grow with dignity, confidence, responsibility, and faith.

SOURCE RULES:
- Use source_knowledge as the main authority.
- Use both Islamic and research-based insights found within source_knowledge.
- If a topic is not directly covered, give practical best-practice guidance aligned with Islamic values.
- Never invent studies, scholars, statistics, or citations.
- Never contradict Islamic ethics.
${ISLAMIC_SENSITIVITIES}
TONE: Warm, Wise, Encouraging, Practical, Respectful, Hopeful, Non-judgmental.

JOURNEY DEFINITIONS:
1. Reset (14 Days) — Immediate support around one growth area. Fast wins, lighter tasks.
2. Growth (30 Days) — Steady development and habit-building. Balanced challenge, sustainable systems.
3. Transformation (90 Days) — Deep long-term developmental progress and family culture change.

IMPORTANT RULES:
- Parent accountability should be emphasized more than child compliance.
- Use encouragement over pressure.
- Use routines over lectures.
- Use repetition over intensity.
- Adapt to developmental age.
- For young children: play, modeling, structure.
- For older children: ownership, dialogue, responsibility.
- For teens: dignity, trust, collaboration, autonomy.
- Keep practical for busy parents.
- Do NOT frame the child as broken or defective.
- Do NOT focus on punishment or compliance.
- Do NOT include hadith numbers, book names, or study citations.
- Each roadmap phase MUST have its own "parentDailyActions" array of exactly 5 actions as objects with "text" and "priority" fields. Mark 2–3 as "core" (highest impact, parent must try) and the rest as "bonus" (reinforcing, optional but valuable). Actions should progress across phases — early phases focus on observation and gentle intervention, later phases build consistency and deeper connection. The durationDays for all phases must add up exactly to the total plan duration.

=== KNOWLEDGE BASE ===
${sourceContext}`;

    const durationDays = journeyType === 'Reset' ? 14 : journeyType === 'Transformation' ? 90 : 30;

    const childPlanFamilyNote = familyStructure === 'single_parent'
      ? 'This parent is a single parent — do not assume a co-parent or spouse is present. All parent actions must be achievable by one parent alone.'
      : '';

    const userPrompt = `Growth Goal: ${growthGoal.trim()}
Child Age: ${childAge || 'Not specified'}
Selected Journey: ${journeyType || 'Growth'} (${durationDays} Days)
${temperament ? `Child Temperament: ${temperament}` : ''}
${parentChallenge ? `Parent Challenge: ${parentChallenge}` : ''}
${childPlanFamilyNote}

SPECIFICITY RULES — APPLY TO THE ENTIRE PLAN:
- Every section must directly address the exact growth issue described. Do not give generic parenting advice.
- The title, roadmap, actions, scripts, and opportunities must all be visibly connected to the specific issue (e.g. if the issue is "says hurtful things", every action should target that — not general kindness or emotional regulation in the abstract).
- "growthGoal" should describe what specific improvement looks like for THIS child and THIS issue, not a general positive outcome.
- "whatAffecting" should list causes specific to the described behaviour, not generic child development factors.
- "roadmap" phases should describe a clear progression tied to the issue (e.g. awareness → practice → habit).
- "whatToSayScripts" must be scripts a parent would actually say in a moment related to THIS issue.

PARENT DAILY ACTIONS RULES:
- Each action must be specific, practical, and directly tied to the growth issue.
- Include a quantity or time goal where possible (e.g. "Spend 10 minutes...", "Give 2 specific praise statements...", "Practice one role-play scenario...").
- Actions should describe what the parent DOES, not vague intentions.
- CRITICAL: Every action must be written as a daily repeatable habit — something the parent can meaningfully do every single day throughout the plan. Never write one-time tasks, time-bound observations, or setup activities (e.g. never "observe for 3 days", "have an initial conversation", "set up a chart this week"). If an action involves observation, write it as a daily micro-habit: instead of "observe screen patterns for 3 days", write "take 2 minutes tonight to note one screen pattern you observed today".
- Good: "Spend 10 minutes doing a calm one-on-one activity", "Point out 2 kind words your child uses and praise them specifically", "Take 2 minutes to note one thing you observed about your child today".
- Bad: "Be supportive", "Encourage good behavior", "Observe for 3 days", "Have an initial conversation about screens", "Set up a family routine this week".

CHILD GROWTH OPPORTUNITIES RULES:
- These are activities or experiences the parent sets up for the child to practise the skill naturally.
- Keep the spotlight on what the child does and experiences — the parent's role is to facilitate, not be the main actor.
- Each opportunity must be directly tied to the specific growth issue and feel clearly distinct from the parent daily actions.
- Make them age-appropriate and practical — things that fit naturally into family life.
- Good: "Create a simple family job chart and let your child choose their task for the day", "Set up a role-play game where your child practises asking for help politely".
- Bad: "Model good behaviour", "Praise your child's efforts", "Have a calm conversation about the issue".

STRUCTURE EXAMPLE — follow this shape exactly for every field, replace all content with your own tailored output:
{
  "roadmap": [
    {
      "phase": "Phase 1: Example Phase Name (Days 1-10)",
      "title": "Example short title",
      "description": "Example 2-3 sentence description of what this phase focuses on.",
      "durationDays": 10,
      "parentDailyActions": [
        { "text": "Example core action — highest impact, specific and measurable", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "One sentence explaining why this specific action works for this child's growth issue." },
        { "text": "Example core action — highest impact, specific and measurable", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "One sentence on the mechanism — why this works developmentally or psychologically." },
        { "text": "Example core action — highest impact, specific and measurable", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "One sentence connecting this action directly to the child's specific struggle." },
        { "text": "Example bonus action — reinforcing, good if time allows", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "One sentence on why this reinforces the core work." },
        { "text": "Example bonus action — reinforcing, good if time allows", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "One sentence on why this adds value." }
      ]
    },
    {
      "phase": "Phase 2: Example Phase Name (Days 11-20)",
      "title": "Example short title",
      "description": "Example description.",
      "durationDays": 10,
      "parentDailyActions": [
        { "text": "Example core action", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "Why this works." },
        { "text": "Example core action", "notifTitle": "2-5 word catchy title", "priority": "core", "why": "Why this works." },
        { "text": "Example bonus action", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "Why this helps." },
        { "text": "Example bonus action", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "Why this helps." },
        { "text": "Example bonus action", "notifTitle": "2-5 word catchy title", "priority": "bonus", "why": "Why this helps." }
      ]
    }
  ]
}
RULES: durationDays across all phases must sum to the total plan duration. Every phase must have exactly 5 parentDailyActions as objects with "text", "notifTitle", "priority", and "why". "notifTitle" must be a punchy 2-5 word action-oriented title that makes a parent want to open the app (e.g. "10 minutes just for them", "Catch them being good", "Reflect on today"). Mark 2–3 as "core" and the rest as "bonus". The "why" must be one specific sentence explaining the mechanism — not generic. Phase label must include the day range e.g. "(Days 1-10)".

Respond with valid JSON only (no markdown). Full structure:
{
  "title": "Warm motivating plan title",
  "growthGoal": "2-3 sentences on what healthy progress looks like for this child",
  "whatAffecting": ["Likely contributing factor 1", "Likely contributing factor 2", "Likely contributing factor 3"],
  "islamicFoundation": "2-3 sentences. First: state the Islamic principle — an ayah, hadith, or tarbiyah lesson relevant to nurturing this child. Second: explain what it means in practice. Third: connect it directly to this child's specific growth issue. No citations or hadith numbers.",
  "researchInsight": "2-3 sentences. First: state the child development finding relevant to this issue. Second: explain why it matters developmentally for this age. Third: connect it to what the parent can do. No source names or citations.",
  "roadmap": [{"phase": "Phase 1: Name (Days 1-10)", "title": "Short title", "description": "2-3 sentences", "durationDays": 10, "parentDailyActions": [{"text": "Action 1", "notifTitle": "Punchy title", "priority": "core", "why": "Why this works for this child."}, {"text": "Action 2", "notifTitle": "Punchy title", "priority": "core", "why": "Why this works."}, {"text": "Action 3", "notifTitle": "Punchy title", "priority": "core", "why": "Why this works."}, {"text": "Action 4", "notifTitle": "Punchy title", "priority": "bonus", "why": "Why this helps."}, {"text": "Action 5", "notifTitle": "Punchy title", "priority": "bonus", "why": "Why this helps."}]}],
  "childGrowthOpportunities": ["Age-appropriate opportunity 1", "Opportunity 2", "Opportunity 3", "Opportunity 4", "Opportunity 5"],
  "firstActionSteps": {"day1": "Specific task", "day2": "Specific task", "day3": "Specific task"},
  "whatToSayScripts": ["Warm realistic script 1", "Script 2", "Script 3"],
  "ifResistance": "2-3 sentences on how to respond wisely without power struggles",
  "signsOfProgress": ["Encouraging indicator 1 (not perfection-based)", "Sign 2", "Sign 3", "Sign 4", "Sign 5"],
  "nextBestJourney": "One sentence recommending what comes after this plan",
  "parentReminder": "One uplifting closing sentence"
}`;

    let raw: string;
    try {
      const model = getJsonModel(MODEL_FAST, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_FAST);
    } catch (geminiErr) {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return res.json({ ...parsed, durationDays });
  } catch (err) {
    console.error('POST /child-plan/generate error:', err);
    return res.status(500).json({ error: 'Failed to generate plan. Please try again.' });
  }
});

// ─── Shared Islamic sensitivities block ──────────────────────────────────────

const ISLAMIC_SENSITIVITIES = `
ISLAMIC SENSITIVITIES — THESE ARE NON-NEGOTIABLE RULES:

QURAN:
- NEVER suggest playing the Quran as background music, ambient sound, white noise, or in any passive/distracted setting.
- The Quran must always be framed as something to be listened to attentively, with presence and respect (as Allah commands in Surah Al-A'raf 7:204: "listen to it and be silent").
- NEVER group Quran in the same category as music, nasheeds, or entertainment media.
- If suggesting Quran listening, always frame it as an intentional, focused activity — not something playing in the background while doing something else.

MUSIC:
- Do NOT assume music is permissible in a Muslim household. Many Muslim families avoid music entirely based on Islamic scholarly opinion.
- NEVER recommend music as a parenting tool, calming strategy, or background activity without acknowledging that families differ on this.
- If audio is relevant (e.g. for calming, focus, or atmosphere), suggest: nature sounds, silence, or attentive Quran listening — not music.
- If you must reference audio entertainment, use "audio content the family is comfortable with" — never "music" as a default.

NASHEEDS:
- Nasheeds (without musical instruments) are generally more accepted but families still vary. If suggesting nasheeds, frame them as an option, not an assumption.
- Never equate or group nasheeds with music or secular songs.

GENDER AND MODESTY:
- Be mindful of Islamic gender norms, especially for pre-teen and teenage children. Avoid suggesting mixed-gender activities that would be inappropriate in a Muslim context.
- For older girls especially, be respectful of modesty and hijab considerations in activity suggestions.

HOLIDAYS AND CELEBRATIONS:
- Never suggest celebrating or participating in non-Islamic holidays (Christmas, Halloween, Valentine's Day, etc.) as a parenting strategy.
- Islamic celebrations (Eid, Ramadan practices) may be referenced positively where relevant.

SINGLE PARENTS:
- If the parent's family structure is single parent, NEVER include advice about the marital relationship, improving the spousal dynamic, co-parenting communication with a partner, or anything that assumes a partner is present in the home.
- All habits, activities, and coaching must be achievable by one parent alone.
- Do not frame single-parent situations as incomplete or in need of a two-parent fix.

AGE-APPROPRIATE ISLAMIC FRAMING — CRITICAL:
Children under 6 cannot understand abstract theology. Misapplied Islamic framing at this age can create confusing or harmful associations. Apply the following age tiers strictly:

UNDER 6 (toddlers and preschoolers):
- Islamic guidance must be CONCRETE and SENSORY only: a short simple dua, saying "Bismillah", making wudu together, a simplified prophet story, listening to Quran together attentively.
- NEVER introduce abstract theological concepts about Allah's attributes, qadar, creation, or causation.
- FORBIDDEN EXAMPLE — do not generate anything like this for a child under 6: "Say to your child: 'Allah made all our feelings'" — a toddler cannot distinguish between "Allah created our fitrah" and "Allah is the cause of my anger right now." This plants a theologically confusing and developmentally inappropriate association.
- At this age, the Islamic contribution is the PARENT's intention (niyyah), the home environment, and simple embodied practices — not theological explanation to the child.

AGES 6–9:
- Simple Islamic concepts are appropriate but must be grounded in concrete stories, actions, and examples — not abstract theology.
- Dua, prophet stories, Islamic character concepts (honesty, kindness, sharing) are appropriate.
- Avoid explaining complex concepts like qadar, Allah's will causing events, or theological nuance.

AGES 10+:
- Nuanced Islamic framing, discussion of character and akhlaq, Islamic identity, and more substantive theological concepts are appropriate and valuable.
- Teens especially benefit from understanding the "why" behind Islamic principles at a deeper level.

GENERAL:
- Never suggest anything that contradicts clear Islamic ethics, halal/haram principles, or the adab (etiquette) of Islam.
- When in doubt about whether something is Islamically appropriate, err on the side of caution or offer alternatives.
- Always maintain the dignity of Islamic practice — never present Islamic acts as optional lifestyle choices.
`;

// ─── POST /child-growth-plan ─────────────────────────────────────────────────

app.post('/child-growth-plan', async (req: Request, res: Response) => {
  try {
    const { child, issue, parentAnalysis, familyStructure } = req.body as {
      child: {
        name: string; age?: number; gender?: string; grade?: string; schooling?: string;
        strengths?: string[]; temperaments?: string[]; interests?: string[]; specialNeeds?: string[];
      };
      issue: string;
      parentAnalysis?: string;
      familyStructure?: string;
    };

    if (!child?.name || !issue?.trim()) {
      return res.status(400).json({ error: 'child.name and issue are required.' });
    }

    const sourceContext = await buildModuleSourceContext(issue.trim());

    const systemPrompt = `You are Tarbiyah AI — a warm, deeply knowledgeable Muslim parenting coach grounded in the Islamic spiritual tradition and research-based child development.

Your role is to create highly personalised, actionable 4-week growth plans for individual children that are genuinely Islamic in spirit — not just culturally Muslim, but rooted in the wisdom, values, and character of the Prophetic tradition — while being fully informed by modern child development science.

CORE IDENTITY OF THIS APP:
Tarbiyah is an Islamic concept meaning the holistic nurturing of a child's body, mind, character, and soul. This is the lens through which every plan is written. The Prophet ﷺ was the most complete model of how to raise and relate to children — with gentleness (rifq), mercy (rahmah), dignity, play, honesty, and patience (sabr). This is the standard.

CORE PHILOSOPHY:
- The child is an amanah — a sacred trust from Allah — not a project to fix or a problem to solve.
- Parenting with intention is an act of worship (ibadah). Every act of patience, gentleness, and consistent love is rewarded by Allah.
- The parent's character and inner state are the most powerful force in the child's development — before any technique or strategy.
- The fitrah (innate natural disposition toward goodness and faith) is already in the child. The parent's job is to protect and nurture it, not manufacture it.
- Focus on parent behaviour change first — what the parent does consistently is what shapes the child.
- Use connection, routine, modelling, and encouragement over control, compliance, or punishment.

ISLAMIC PARENTING FOUNDATION — APPLY THROUGHOUT EVERY PLAN:
Draw from the following Islamic concepts and weave them authentically into habits, activities, wisdom, and tips. Use them as living principles, not decorative additions:

- Tarbiyah — holistic nurturing of the whole child (body, mind, character, faith)
- Fitrah — the child's innate inclination toward goodness and tawhid; never suppress it, always affirm it
- Rifq — gentleness; the Prophet ﷺ said Allah loves gentleness in all affairs
- Rahmah — mercy; lead with mercy before correction, always
- Sabr — patient persistence; growth is slow, sabr is the engine of change
- Ihsan — excellence and beauty in how you parent, even when it's hard
- Akhlaq — character; the goal of tarbiyah is beautiful character, not compliance
- Amanah — the child as a sacred trust; this reframes correction as care, not control
- Tawakkul — trust in Allah after doing your best; release the anxiety of perfection
- Du'a — making sincere supplication for your child is itself a parenting act
- Modelling (uswah) — children learn who we ARE, not what we say; the Prophet ﷺ is the example
- Shura — consulting, listening to, and involving children in their growth (especially for older children and teens)
- Haya — nurturing a healthy sense of dignity, modesty, and self-respect
- Qudwah hasanah — being the living example you want your child to become

ISLAMIC GROUNDING RULES — NON-NEGOTIABLE:
1. Every week must have an "islamicPrinciple" — one Islamic concept (from the list above or similar) that frames that week's approach. It should feel like a genuine spiritual lens, not a superficial label.
2. In every week, at least ONE habit's wisdom must draw from Islamic tradition — name the principle, explain its spiritual depth, then connect it directly to this child's specific challenge.
3. In every week, at least ONE activity's wisdom must have an Islamic dimension — how this activity connects to building character, fitrah, or the Prophetic model.
4. The plan must open with an "islamicFoundation" — 2–3 sentences connecting this specific challenge to an Islamic principle or Prophetic approach. This sets the spiritual frame for the entire plan.
5. Islamic insights must be SUBSTANTIVE — not "make du'a together" as a throwaway line, but a real tarbiyah insight that gives the parent a new way of seeing their child and this challenge through an Islamic lens.

WEEKLY PROGRESSION (with Islamic arc):
- Week 1: Awareness and rahmah — observe with mercy, establish safety and connection, lead with the heart
- Week 2: Rifq in action — gentle consistent intervention, practise with low stakes, model the akhlaq you want to see
- Week 3: Sabr and consistency — stay the course with patience, reflect on what's working, trust the fitrah
- Week 4: Ihsan and ownership — celebrate progress with gratitude (shukr), build intrinsic motivation, hand ownership to the child

PERSONALISATION RULES:
- Use the child's name, age, temperament, strengths, and interests to make every habit and activity feel written for THIS specific child.
- If the child is young (under 6): prioritise co-regulation, play-based learning, structure, and modelling.
- If the child is school-age (6–12): balance routine, responsibility, and natural consequences.
- If the child is a teen (13+): lead with dignity, autonomy, dialogue, and trust — shura is especially important here.
- Reference the child's interests when suggesting activities to make them feel personal and engaging.
- Use the parent's analysis of root causes to inform the depth and tone of each week's focus.

HABITS vs ACTIVITIES:
- Habits: Things the PARENT does daily — micro-behaviours, responses, language choices, Islamic practices that shape the home environment. Written as specific repeatable parent actions.
- Activities: Things the parent sets up for the CHILD to experience — structured play, conversations, creative exercises, real-world practice, or experiences that build character. Written as distinct child-facing experiences.

WISDOM RULES (for every habit and activity):
- For habits: alternate between Islamic wisdom and developmental/psychological insight across the three habits each week. The primary habit's wisdom should lean Islamic when possible, grounding the most important action in spiritual understanding.
- For activities: similarly alternate, ensuring Islamic wisdom appears substantively at least once per week.
- Connect the wisdom directly to this child's specific issue — not generic advice.
- Islamic wisdom in the wisdom field should feel like genuine tarbiyah insight — explain the spiritual principle, why it matters for this child's development specifically, and how it manifests practically.
- Use plain language. No hadith numbers, scholar names, or study citations. The insight is what matters.

DAILY TIPS — ISLAMIC WEIGHT:
- Of 28 daily tips, at least 12 must draw from Islamic wisdom (not 7).
- Islamic tips must carry real tarbiyah depth — a principle explained, connected to the specific challenge, applied practically. Not generic reminders.
- Rotate across: Islamic tarbiyah wisdom (12–14), child development insight (6–8), practical encouragement (4–5), parent self-reminder grounded in faith (3–4).
- Islamic tips might draw from: the Prophetic example with children, the concept of fitrah and how it applies to this challenge, what sabr or rahmah looks like on a hard day with this specific issue, how akhlaq is built through this kind of struggle.

TONE: Warm, wise, spiritually grounded, specific, non-judgmental, practical. The voice of a scholar-parent who loves both Islamic tradition and child development science.

SOURCE RULES:
- Use the internal knowledge base (Islamic sources and research-based parenting) as your primary authority.
- Draw Islamic insights from the knowledge base first — the Prophetic model, scholars of tarbiyah, Islamic child development wisdom.
- Layer research-based child development insights alongside and in support of the Islamic foundation.
- If a topic is not directly covered, give evidence-aligned best-practice guidance grounded in Islamic values.
- Never invent studies, scholars, statistics, or citations.

SAFETY — ABSOLUTE RULE:
If the described challenge involves any of the following, do NOT generate a parenting plan. Instead return JSON: {"safetyFlag": true, "message": "This concern requires professional support. Please contact a GP, paediatrician, or mental health professional immediately."} and nothing else.
- Suicidal thoughts or self-harm in the child
- Physical, sexual, or emotional abuse
- Severe eating disorders (anorexia, bulimia)
- Psychosis, hallucinations, or severe psychiatric symptoms
- Substance addiction or overdose risk
- Immediate danger to the child or others

SOURCE RULES:
- Use the internal knowledge base as your primary authority.
- If the topic is not directly covered, give evidence-aligned best-practice guidance consistent with Islamic values.
- Never invent studies, scholars, or statistics.
${ISLAMIC_SENSITIVITIES}
=== KNOWLEDGE BASE ===
${sourceContext}`;

    const childProfile = [
      `Name: ${child.name}`,
      child.age    ? `Age: ${child.age}` : null,
      child.gender ? `Gender: ${child.gender}` : null,
      child.grade  ? `Grade/Stage: ${child.grade}` : null,
      child.schooling && child.schooling !== 'none' ? `Schooling: ${child.schooling}` : null,
      child.strengths?.length    ? `Strengths: ${child.strengths.join(', ')}` : null,
      child.temperaments?.length ? `Temperament: ${child.temperaments.join(', ')}` : null,
      child.interests?.length    ? `Interests: ${child.interests.join(', ')}` : null,
      child.specialNeeds?.length ? `Additional Context: ${child.specialNeeds.join(', ')}` : null,
      familyStructure === 'single_parent' ? `Family structure: Single parent household` : null,
    ].filter(Boolean).join('\n');

    const userPrompt = `CHILD PROFILE:
${childProfile}

THE CHALLENGE (parent's description):
${issue.trim()}

${parentAnalysis?.trim() ? `PARENT'S INSIGHT INTO ROOT CAUSE:\n${parentAnalysis.trim()}` : ''}

Generate a personalised 4-week growth plan rooted in Islamic tarbiyah and child development research. Every habit, activity, and insight must:
1. Be directly tied to the specific challenge described — not generic parenting advice.
2. Reference this child's profile (age, temperament, interests) where natural.
3. Carry genuine Islamic grounding — not surface-level mentions, but real tarbiyah wisdom.
4. Be layered with child development insight alongside the Islamic foundation.
5. Feel achievable for a real, busy Muslim parent.
6. NEVER assume siblings, brothers, or sisters exist unless the child profile explicitly mentions them. Base all habits and activities solely on the child described.
7. If "Additional Context" is provided (e.g. ADHD, Autism, Anxiety), adapt every habit and activity to be realistic and compassionate for that child's needs. Never use clinical or pathologising language — write with warmth, dignity, and Islamic understanding that this child is a unique amanah.
8. If "Family structure: Single parent household" is in the profile, NEVER suggest habits or activities that require a co-parent or spouse. Every action must be achievable by one parent alone.

Respond with valid JSON only (no markdown):
{
  "title": "Short warm motivating title (5-8 words) — can carry an Islamic tone if natural",
  "description": "2-3 sentences. What healthy, character-grounded progress looks like for THIS child with THIS specific challenge. Warm, specific, and hopeful.",
  "islamicFoundation": "2-3 sentences. Connect this specific challenge to an Islamic principle, Prophetic example, or tarbiyah concept. How does Islam frame this struggle? What spiritual lens should the parent hold? Make it feel like a wise scholar-parent is reframing the challenge through the Islamic tradition. Specific and substantive — not generic.",
  "weeks": [
    {
      "week": 1,
      "theme": "Short theme title (3-5 words)",
      "islamicPrinciple": "One Islamic concept that frames this week (e.g. Rahmah — leading with mercy). 1-2 sentences on what this principle means for THIS week's approach with THIS child.",
      "habits": [
        {
          "priority": "primary",
          "text": "The single most impactful daily habit for this week. A busy parent must do this above all others.",
          "wisdom": "2-3 sentences. Ground this in Islamic wisdom — name the tarbiyah principle at work, explain its spiritual depth, connect it directly to this child's specific challenge. This should feel like genuine Islamic parenting insight, not a developmental explanation alone."
        },
        {
          "priority": "secondary",
          "text": "An important supporting habit. Do this if you have 10 extra minutes.",
          "wisdom": "2-3 sentences. This wisdom can draw from child development — explain the developmental mechanism and connect it directly to this child's specific issue."
        },
        {
          "priority": "bonus",
          "text": "A bonus habit for parents who want to go deeper this week.",
          "wisdom": "2-3 sentences. This wisdom can blend both Islamic and developmental insight — what does going deeper here look like spiritually and practically for this child?"
        }
      ],
      "activities": [
        {
          "text": "A specific experience the parent sets up for the child to practise the skill. Age-appropriate, tied to the challenge, and where possible connected to Islamic values (character, kindness, responsibility, connection).",
          "wisdom": "2-3 sentences. Draw from Islamic wisdom — how does this activity build the child's fitrah, akhlaq, or character? Connect the Islamic dimension to the specific challenge."
        },
        {
          "text": "A second activity — this one can be more play-based or creative, still tied to the challenge.",
          "wisdom": "2-3 sentences. Draw from child development research — why does this kind of play or experience build the specific skill this child needs?"
        },
        {
          "text": "A third activity — progressively more child-led than the first two.",
          "wisdom": "2-3 sentences. Blend Islamic and developmental insight — what does this activity do for the child's inner life and outer behaviour?"
        }
      ]
    },
    {
      "week": 2,
      "theme": "...",
      "islamicPrinciple": "...",
      "habits": [{ "priority": "primary", "text": "...", "wisdom": "..." }, { "priority": "secondary", "text": "...", "wisdom": "..." }, { "priority": "bonus", "text": "...", "wisdom": "..." }],
      "activities": [{ "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }]
    },
    {
      "week": 3,
      "theme": "...",
      "islamicPrinciple": "...",
      "habits": [{ "priority": "primary", "text": "...", "wisdom": "..." }, { "priority": "secondary", "text": "...", "wisdom": "..." }, { "priority": "bonus", "text": "...", "wisdom": "..." }],
      "activities": [{ "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }]
    },
    {
      "week": 4,
      "theme": "...",
      "islamicPrinciple": "...",
      "habits": [{ "priority": "primary", "text": "...", "wisdom": "..." }, { "priority": "secondary", "text": "...", "wisdom": "..." }, { "priority": "bonus", "text": "...", "wisdom": "..." }],
      "activities": [{ "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }]
    }
  ],
  "dailyTips": [
    { "title": "3-5 word punchy title", "body": "1-2 sentences. Islamic wisdom OR child development insight OR practical encouragement OR faith-grounded parent reminder. Warm, specific to the challenge, directly useful today." },
    "... 28 items total"
  ]
}

Rules:
- Exactly 4 weeks. Each week: exactly 3 habits and exactly 3 activities.
- Every week MUST have an "islamicPrinciple" — this is non-negotiable.
- The "islamicFoundation" at the top is required — it sets the spiritual frame for the entire plan.
- Primary habit wisdom: Islamic grounding required.
- First activity wisdom: Islamic grounding required.
- All other wisdoms: alternate between Islamic and developmental — both must appear substantively across the plan.
- Habits progress across weeks (Week 1: rahmah/awareness → Week 4: ihsan/ownership).
- Activities become progressively more child-led across weeks.
- dailyTips: exactly 28 items. At least 12 must be genuinely Islamic (tarbiyah insight, Prophetic example, spiritual reframe of the challenge). Remaining tips: child development insight, practical encouragement, faith-grounded parent self-reminder. Spread evenly — do not group by type.
- Islamic tips must be SUBSTANTIVE: a real tarbiyah principle named, explained briefly, and connected to this specific challenge. Never a throwaway line.
- All content — habits, activities, tips — must be visibly connected to the specific challenge described.
- No hadith numbers, scholar names, or study citations anywhere.
- No markdown. Valid JSON only.`;

    let raw: string;
    try {
      const model = getJsonModel(MODEL_HEAVY, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_HEAVY);
    } catch (geminiErr) {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return res.json(parsed);
  } catch (err) {
    console.error('POST /child-growth-plan error:', err);
    return res.status(500).json({ error: 'Failed to generate growth plan. Please try again.' });
  }
});

// ─── POST /child-growth-plan/async ───────────────────────────────────────────
// Returns a jobId immediately; processes the plan in the background and writes
// the result to the growth_plan_jobs Supabase table.

async function runGrowthPlanJob(jobId: string, body: {
  child: { name: string; age?: number; gender?: string; grade?: string; schooling?: string; strengths?: string[]; temperaments?: string[]; interests?: string[]; specialNeeds?: string[] };
  issue: string; parentAnalysis?: string; familyStructure?: string;
}) {
  try {
    const { child, issue, parentAnalysis, familyStructure } = body;
    const sourceContext = await buildModuleSourceContext(issue.trim());

    // Re-use the same system prompt from the sync endpoint
    const systemPrompt = `You are Tarbiyah AI — a warm, deeply knowledgeable Muslim parenting coach grounded in the Islamic spiritual tradition and research-based child development.

Your role is to create highly personalised, actionable 4-week growth plans for individual children that are genuinely Islamic in spirit — not just culturally Muslim, but rooted in the wisdom, values, and character of the Prophetic tradition — while being fully informed by modern child development science.

CORE IDENTITY OF THIS APP:
Tarbiyah is an Islamic concept meaning the holistic nurturing of a child's body, mind, character, and soul. This is the lens through which every plan is written. The Prophet ﷺ was the most complete model of how to raise and relate to children — with gentleness (rifq), mercy (rahmah), dignity, play, honesty, and patience (sabr). This is the standard.

CORE PHILOSOPHY:
- The child is an amanah — a sacred trust from Allah — not a project to fix or a problem to solve.
- Parenting with intention is an act of worship (ibadah). Every act of patience, gentleness, and consistent love is rewarded by Allah.
- The parent's character and inner state are the most powerful force in the child's development — before any technique or strategy.
- The fitrah (innate natural disposition toward goodness and faith) is already in the child. The parent's job is to protect and nurture it, not manufacture it.
- Focus on parent behaviour change first — what the parent does consistently is what shapes the child.
- Use connection, routine, modelling, and encouragement over control, compliance, or punishment.

ISLAMIC PARENTING FOUNDATION — APPLY THROUGHOUT EVERY PLAN:
Draw from the following Islamic concepts and weave them authentically into habits, activities, wisdom, and tips:
Tarbiyah, Fitrah, Rifq, Rahmah, Sabr, Ihsan, Akhlaq, Amanah, Tawakkul, Du'a, Uswah, Shura, Haya, Qudwah hasanah.

ISLAMIC GROUNDING RULES — NON-NEGOTIABLE:
1. Every week must have an "islamicPrinciple".
2. In every week, at least ONE habit's wisdom must draw from Islamic tradition.
3. In every week, at least ONE activity's wisdom must have an Islamic dimension.
4. The plan must open with an "islamicFoundation".
5. Islamic insights must be SUBSTANTIVE.

WEEKLY PROGRESSION (with Islamic arc):
- Week 1: Awareness and rahmah
- Week 2: Rifq in action
- Week 3: Sabr and consistency
- Week 4: Ihsan and ownership

PERSONALISATION RULES:
- Use the child's profile to make every habit and activity feel written for THIS specific child.
- Reference the child's interests when suggesting activities.

HABITS vs ACTIVITIES:
- Habits: Things the PARENT does daily.
- Activities: Things the parent sets up for the CHILD to experience.

WISDOM RULES: Alternate Islamic and developmental wisdom. Primary habit = Islamic. First activity = Islamic.

DAILY TIPS: At least 12 of 28 must be Islamic tarbiyah wisdom. Rotate evenly across types.

TONE: Warm, wise, spiritually grounded, specific, non-judgmental, practical.

SAFETY — ABSOLUTE RULE:
If the described challenge involves suicidal thoughts, self-harm, abuse, severe eating disorders, psychosis, or substance addiction, return: {"safetyFlag": true, "message": "Professional support required."} and nothing else.

SOURCE RULES:
- Use the internal knowledge base as primary authority.
- Never invent studies, scholars, statistics, or citations.
${ISLAMIC_SENSITIVITIES}
=== KNOWLEDGE BASE ===
${sourceContext}`;

    const childProfile = [
      `Name: ${child.name}`,
      child.age    ? `Age: ${child.age}` : null,
      child.gender ? `Gender: ${child.gender}` : null,
      child.grade  ? `Grade/Stage: ${child.grade}` : null,
      child.schooling && child.schooling !== 'none' ? `Schooling: ${child.schooling}` : null,
      child.strengths?.length    ? `Strengths: ${child.strengths.join(', ')}` : null,
      child.temperaments?.length ? `Temperament: ${child.temperaments.join(', ')}` : null,
      child.interests?.length    ? `Interests: ${child.interests.join(', ')}` : null,
      child.specialNeeds?.length ? `Additional Context: ${child.specialNeeds.join(', ')}` : null,
      familyStructure === 'single_parent' ? `Family structure: Single parent household` : null,
    ].filter(Boolean).join('\n');

    const userPrompt = `CHILD PROFILE:
${childProfile}

THE CHALLENGE (parent's description):
${issue.trim()}

${parentAnalysis?.trim() ? `PARENT'S INSIGHT INTO ROOT CAUSE:\n${parentAnalysis.trim()}` : ''}

Generate a personalised 4-week growth plan rooted in Islamic tarbiyah and child development research. Every habit, activity, and insight must:
1. Be directly tied to the specific challenge described — not generic parenting advice.
2. Reference this child's profile (age, temperament, interests) where natural.
3. Carry genuine Islamic grounding — not surface-level mentions, but real tarbiyah wisdom.
4. Be layered with child development insight alongside the Islamic foundation.
5. Feel achievable for a real, busy Muslim parent.
6. NEVER assume siblings, brothers, or sisters exist unless the child profile explicitly mentions them. Base all habits and activities solely on the child described.
7. If "Additional Context" is provided (e.g. ADHD, Autism, Anxiety), adapt every habit and activity to be realistic and compassionate for that child's needs. Never use clinical or pathologising language — write with warmth, dignity, and Islamic understanding that this child is a unique amanah.
8. If "Family structure: Single parent household" is in the profile, NEVER suggest habits or activities that require a co-parent or spouse. Every action must be achievable by one parent alone.

Respond with valid JSON only (no markdown):
{
  "title": "Short warm motivating title (5-8 words) — can carry an Islamic tone if natural",
  "description": "2-3 sentences. What healthy, character-grounded progress looks like for THIS child with THIS specific challenge. Warm, specific, and hopeful.",
  "islamicFoundation": "2-3 sentences. Connect this specific challenge to an Islamic principle, Prophetic example, or tarbiyah concept. Specific and substantive — not generic.",
  "weeks": [
    {
      "week": 1,
      "theme": "Short theme title (3-5 words)",
      "islamicPrinciple": "One Islamic concept that frames this week. 1-2 sentences on what this principle means for THIS week's approach with THIS child.",
      "habits": [
        { "priority": "primary", "text": "The single most impactful daily habit for this week.", "wisdom": "2-3 sentences. Islamic grounding required — name the tarbiyah principle, explain its depth, connect to this child's challenge." },
        { "priority": "secondary", "text": "An important supporting habit.", "wisdom": "2-3 sentences. Draw from child development — explain the mechanism and connect to this child's specific issue." },
        { "priority": "bonus", "text": "A bonus habit for parents who want to go deeper.", "wisdom": "2-3 sentences. Blend Islamic and developmental insight." }
      ],
      "activities": [
        { "text": "A specific experience the parent sets up for the child. Age-appropriate, tied to the challenge.", "wisdom": "2-3 sentences. Islamic grounding required — how does this build the child's fitrah or akhlaq?" },
        { "text": "A second activity — more play-based or creative, still tied to the challenge.", "wisdom": "2-3 sentences. Child development research — why does this experience build the specific skill?" },
        { "text": "A third activity — more child-led than the first two.", "wisdom": "2-3 sentences. Blend Islamic and developmental insight." }
      ]
    },
    { "week": 2, "theme": "...", "islamicPrinciple": "...", "habits": [{ "priority": "primary", "text": "...", "wisdom": "..." }, { "priority": "secondary", "text": "...", "wisdom": "..." }, { "priority": "bonus", "text": "...", "wisdom": "..." }], "activities": [{ "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }] },
    { "week": 3, "theme": "...", "islamicPrinciple": "...", "habits": [{ "priority": "primary", "text": "...", "wisdom": "..." }, { "priority": "secondary", "text": "...", "wisdom": "..." }, { "priority": "bonus", "text": "...", "wisdom": "..." }], "activities": [{ "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }] },
    { "week": 4, "theme": "...", "islamicPrinciple": "...", "habits": [{ "priority": "primary", "text": "...", "wisdom": "..." }, { "priority": "secondary", "text": "...", "wisdom": "..." }, { "priority": "bonus", "text": "...", "wisdom": "..." }], "activities": [{ "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }, { "text": "...", "wisdom": "..." }] }
  ],
  "dailyTips": [
    { "title": "3-5 word punchy title", "body": "1-2 sentences. Islamic wisdom OR child development insight OR practical encouragement. Warm, specific to the challenge." }
  ]
}

Rules:
- Exactly 4 weeks. Each week: exactly 3 habits and exactly 3 activities.
- Every week MUST have an "islamicPrinciple".
- Primary habit wisdom: Islamic grounding required. First activity wisdom: Islamic grounding required.
- dailyTips: exactly 28 items. At least 12 must be genuinely Islamic tarbiyah wisdom.
- No hadith numbers, scholar names, or study citations. No markdown. Valid JSON only.`;

    function cleanJson(raw: string): string {
      let s = raw.trim();
      // Strip markdown fences
      if (s.startsWith('```')) s = s.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '').trim();
      // Strip any text before the first { (thinking preamble)
      const start = s.indexOf('{');
      if (start > 0) s = s.slice(start);
      // Remove stray single-letter tokens Gemini thinking bleeds between array objects
      // e.g.  "},\ne        {" → "},\n{"
      s = s.replace(/,(\s*\n\s*)[a-zA-Z][ \t]+(?=\{)/g, ',\n');
      return s;
    }

    let raw: string;
    try {
      const model = getJsonModel(MODEL_HEAVY, systemPrompt);
      raw = await generateWithRetry(model, userPrompt, MODEL_HEAVY);
    } catch {
      raw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch {
      // Gemini returned malformed JSON — fall through to OpenAI
      console.warn(`Job ${jobId}: JSON parse failed on Gemini output, retrying with OpenAI`);
      const oaiRaw = await generateJsonWithOpenAI(systemPrompt, userPrompt);
      parsed = JSON.parse(cleanJson(oaiRaw));
    }

    await supabase.from('growth_plan_jobs').update({ status: 'complete', plan: parsed }).eq('id', jobId);
  } catch (err) {
    console.error(`Job ${jobId} failed:`, err);
    await supabase.from('growth_plan_jobs').update({ status: 'failed', error: String(err) }).eq('id', jobId);
  }
}

app.post('/child-growth-plan/async', async (req: Request, res: Response) => {
  try {
    const { child, issue, parentAnalysis, familyStructure } = req.body;
    if (!child?.name || !issue?.trim()) return res.status(400).json({ error: 'child.name and issue are required.' });

    // Create the job record and return the ID immediately
    const { data, error } = await supabase
      .from('growth_plan_jobs')
      .insert({ status: 'pending' })
      .select('id')
      .single();

    if (error || !data) return res.status(500).json({ error: 'Could not create job.' });

    const jobId = data.id;

    // Fire off generation without awaiting
    runGrowthPlanJob(jobId, { child, issue, parentAnalysis, familyStructure }).catch(() => {});

    return res.json({ jobId });
  } catch (err) {
    console.error('POST /child-growth-plan/async error:', err);
    return res.status(500).json({ error: 'Failed to start plan generation.' });
  }
});

// ─── GET /mosque/social-links ─────────────────────────────────────────────────

const PLACES_API_KEY = 'AIzaSyAAzZUrCRvsauWBVNUnIf9HgH-CR8ub4Ig';

const FB_EXCLUDE = /\/(sharer|share\.php|login|dialog|photo|video|tr[/?]|help|legal|policies|watch|notes|marketplace|gaming|live|ads|business|developers)(\/?$|\/?[?#])/i;
const IG_EXCLUDE = /\/(p|reel|reels|tv|stories|explore|accounts|directory)\//i;

function cleanFb(raw: string): string | null {
  const url = raw.split('?')[0].split('#')[0].replace(/\/$/, '');
  const handle = url.split('/').pop() ?? '';
  if (FB_EXCLUDE.test(url) || handle.length < 3) return null;
  return url;
}
function cleanIg(raw: string): string | null {
  const url = raw.split('?')[0].split('#')[0].replace(/\/$/, '');
  const handle = url.split('/').pop() ?? '';
  if (IG_EXCLUDE.test(url) || handle.length < 3) return null;
  return url;
}

function extractSocials(html: string): { facebook: string | null; instagram: string | null } {
  let facebook: string | null = null;
  let instagram: string | null = null;

  // ── 1. JSON-LD sameAs (highest confidence — emitted by WordPress/Squarespace/Wix automatically) ──
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]) as any;
      const nodes = [parsed, ...(Array.isArray(parsed['@graph']) ? parsed['@graph'] : [])];
      for (const node of nodes) {
        const sameAs: string[] = Array.isArray(node.sameAs) ? node.sameAs
          : typeof node.sameAs === 'string' ? [node.sameAs] : [];
        for (const url of sameAs) {
          if (!facebook && /(?:facebook|fb)\.com/i.test(url)) facebook = cleanFb(url);
          if (!instagram && /instagram\.com/i.test(url)) instagram = cleanIg(url);
        }
      }
    } catch {}
    if (facebook && instagram) return { facebook, instagram };
  }

  // ── 2. <meta> tags ──
  for (const m of html.matchAll(/<meta[^>]+(?:content|value)=["']([^"']*(?:facebook|instagram)[^"']*)["'][^>]*>/gi)) {
    const content = m[1];
    if (!facebook && /(?:facebook|fb)\.com/i.test(content)) {
      const match = content.match(/https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/[^\s"'<>]+/i);
      if (match) facebook = cleanFb(match[0]);
    }
    if (!instagram && /instagram\.com/i.test(content)) {
      const match = content.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i);
      if (match) instagram = cleanIg(match[0]);
    }
    if (facebook && instagram) return { facebook, instagram };
  }

  // ── 3. <script> tag content (JSON config blobs, JS variables) ──
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const src = m[1];
    if (!facebook) {
      for (const fm of src.matchAll(/https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/([a-zA-Z0-9._%-]+)/g)) {
        const c = cleanFb(fm[0]); if (c) { facebook = c; break; }
      }
    }
    if (!instagram) {
      for (const im of src.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/g)) {
        const c = cleanIg(im[0]); if (c) { instagram = c; break; }
      }
    }
    if (facebook && instagram) return { facebook, instagram };
  }

  // ── 4. Full HTML scan (href, data-*, plain text) ──
  if (!facebook) {
    for (const m of html.matchAll(/https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/([a-zA-Z0-9._%-]+(?:\/[a-zA-Z0-9._%-]+)*)/g)) {
      const c = cleanFb(m[0]); if (c) { facebook = c; break; }
    }
  }
  if (!instagram) {
    for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/g)) {
      const c = cleanIg(m[0]); if (c) { instagram = c; break; }
    }
  }

  return { facebook, instagram };
}

const EVENTS_KEYWORDS = /\b(events?|programme|program|calendar|whats-on|what-s-on|activities|upcoming)\b/i;

const EVENTS_PATHS = [
  '/events', '/events-calendar', '/event', '/upcoming-events',
  '/community-events', '/community/events', '/whats-on', '/what-s-on',
  '/programmes', '/programs', '/calendar', '/activities',
];

function extractEventsUrl(html: string, baseUrl: string): string | null {
  try {
    const base = new URL(baseUrl);
    for (const m of html.matchAll(/href=["']([^"'#?][^"']*)["']/g)) {
      const href = m[1].trim();
      if (!EVENTS_KEYWORDS.test(href)) continue;
      try {
        const url = new URL(href, base);
        if (url.hostname === base.hostname) return url.href.replace(/\/$/, '');
      } catch {}
    }
  } catch {}
  return null;
}

async function probeEventsUrl(base: string): Promise<string | null> {
  const origin = base.replace(/\/$/, '');
  for (const path of EVENTS_PATHS) {
    try {
      const res = await fetch(origin + path, {
        method: 'HEAD',
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(3000),
        redirect: 'follow',
      });
      if (res.ok) return origin + path;
    } catch {}
  }
  return null;
}

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

app.get('/mosque/social-links', async (req: Request, res: Response) => {
  const placeId = req.query.placeId as string | undefined;
  if (!placeId) return res.status(400).json({ error: 'placeId is required' });

  const force = req.query.force === 'true';

  // Cache check — 7 day TTL if links exist, 24h if not (retry sooner on misses)
  let existingFb: string | null = null;
  let existingIg: string | null = null;
  try {
    const { data: cached } = await supabase
      .from('mosque_profiles')
      .select('facebook_url, instagram_url, website, events_url, last_scraped_at')
      .eq('place_id', placeId)
      .maybeSingle();

    if (cached?.last_scraped_at) {
      existingFb = cached.facebook_url ?? null;
      existingIg = cached.instagram_url ?? null;
      const ageMs = Date.now() - new Date(cached.last_scraped_at).getTime();
      const ttl = (existingFb || existingIg) ? 7 * 86400000 : 86400000;
      // Also re-scrape if events_url was never populated (added after initial scrape)
      const eventsUrlMissing = cached.events_url === null || cached.events_url === undefined;
      if (!force && ageMs < ttl && !eventsUrlMissing) return res.json({ facebook: existingFb, instagram: existingIg, website: cached.website ?? null, eventsUrl: cached.events_url ?? null });
    }
  } catch {}

  // Resolve website from Google Places
  let website: string | null = null;
  try {
    const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,name&key=${PLACES_API_KEY}`;
    const placesJson = await fetch(placesUrl).then(r => r.json()) as any;
    if (placesJson.status === 'OK') {
      const raw = placesJson.result?.website ?? null;
      // Upgrade http → https so iOS ATS doesn't block the WebView
      website = raw ? raw.replace(/^http:\/\//i, 'https://') : null;
    }
  } catch {}

  let facebook: string | null = null;
  let instagram: string | null = null;
  let eventsUrl: string | null = null;

  if (website) {
    const base = website.replace(/\/$/, '');

    // Try homepage first
    const homeHtml = await fetchPage(base);
    if (homeHtml) {
      ({ facebook, instagram } = extractSocials(homeHtml));
      eventsUrl = extractEventsUrl(homeHtml, base);
    }

    // If no events URL found via links, probe common paths directly
    if (!eventsUrl) {
      eventsUrl = await probeEventsUrl(base);
    }

    // If still missing socials, try /contact and /about subpages
    if (!facebook || !instagram) {
      for (const path of ['/contact', '/about', '/contact-us', '/about-us']) {
        if (facebook && instagram) break;
        const html = await fetchPage(base + path);
        if (!html) continue;
        const { facebook: f, instagram: ig } = extractSocials(html);
        if (!facebook) facebook = f;
        if (!instagram) instagram = ig;
      }
    }
  }

  // Preserve existing user-submitted URLs if scraping found nothing new
  if (!facebook) facebook = existingFb;
  if (!instagram) instagram = existingIg;

  // Cache result
  try {
    await supabase.from('mosque_profiles').upsert({
      place_id: placeId, website,
      facebook_url: facebook, instagram_url: instagram,
      events_url: eventsUrl,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: 'place_id' });
  } catch {}

  return res.json({ facebook, instagram, website, eventsUrl });
});

// ─── Resource Requests ────────────────────────────────────────────────────────

async function moderateRequest(
  title: string, description: string
): Promise<{ approved: boolean; reason: string }> {
  const systemPrompt = 'You are a content moderator for Tarbiyah, an Islamic parenting app for Muslim families.';
  const prompt = `Review this community resource request from a Muslim parent:
Title: ${title}
Description: ${description}

APPROVE if:
- Asking for parenting, child development, family life, or Islamic education resources
- Islamically appropriate and relevant to Muslim family life
- A genuine question (not spam or advertising)

REJECT only if clearly:
- Contains haram, inappropriate, or offensive content
- Completely unrelated to parenting or family
- Spam or advertising

When in doubt, APPROVE.
Respond with JSON only — no markdown: { "approved": boolean, "reason": string }`;

  function parse(text: string): { approved: boolean; reason: string } {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const r = JSON.parse(cleaned);
    if (typeof r.approved !== 'boolean') throw new Error('bad shape');
    return r;
  }

  try {
    const model = getJsonModel(MODEL_FAST, systemPrompt);
    const text = await generateWithRetry(model, prompt, MODEL_FAST);
    return parse(text);
  } catch {}

  try {
    const text = await generateJsonWithOpenAI(systemPrompt, prompt);
    return parse(text);
  } catch {}

  return { approved: true, reason: 'AI review unavailable — auto-approved.' };
}

// GET /community/requests
app.get('/community/requests', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('resource_requests')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    console.error('GET /community/requests error:', err);
    return res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// POST /community/requests
app.post('/community/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, displayName } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    const moderation = await moderateRequest(title.trim(), description.trim());
    if (!moderation.approved) {
      return res.status(422).json({ error: moderation.reason ?? 'This request could not be approved.' });
    }

    const { data, error } = await supabase.from('resource_requests').insert({
      user_id: req.userId,
      display_name: displayName ?? 'Parent',
      title: title.trim(),
      description: description.trim(),
      status: 'approved',
    }).select().single();
    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('POST /community/requests error:', err);
    return res.status(500).json({ error: 'Failed to submit request.' });
  }
});

// GET /community/requests/:id/replies
app.get('/community/requests/:id/replies', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('resource_request_replies')
      .select('*')
      .eq('request_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    console.error('GET /community/requests/:id/replies error:', err);
    return res.status(500).json({ error: 'Failed to fetch replies.' });
  }
});

// POST /community/requests/:id/replies
app.post('/community/requests/:id/replies', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { url, title, category, comment, displayName } = req.body;
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required.' });

    const { data, error } = await supabase.from('resource_request_replies').insert({
      request_id: req.params.id,
      user_id: req.userId,
      display_name: displayName ?? 'Parent',
      url: url.trim(),
      title: title?.trim() ?? '',
      category: category ?? null,
      comment: comment?.trim() ?? null,
    }).select().single();
    if (error) throw error;

    // Increment reply_count on the request
    await supabase.rpc('increment_request_reply_count', { request_id: req.params.id });

    return res.status(201).json(data);
  } catch (err) {
    console.error('POST /community/requests/:id/replies error:', err);
    return res.status(500).json({ error: 'Failed to submit reply.' });
  }
});

// POST /community/requests/replies/:replyId/react
app.post('/community/requests/replies/:replyId/react', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { type, warnComment } = req.body; // type: 'agree' | 'warn'
    if (!['agree', 'warn'].includes(type)) return res.status(400).json({ error: 'Invalid reaction type.' });

    const { data: existing } = await supabase
      .from('resource_reply_reactions')
      .select('id, type')
      .eq('reply_id', req.params.replyId)
      .eq('user_id', req.userId!)
      .maybeSingle();

    if (existing) {
      if (existing.type === type) {
        // Toggle off
        await supabase.from('resource_reply_reactions').delete().eq('id', existing.id);
        await supabase.rpc('decrement_reply_reaction', { reply_id: req.params.replyId, reaction_type: type });
        return res.json({ toggled: false });
      } else {
        // Switch type
        await supabase.from('resource_reply_reactions').update({ type, warn_comment: warnComment ?? null }).eq('id', existing.id);
        await supabase.rpc('decrement_reply_reaction', { reply_id: req.params.replyId, reaction_type: existing.type });
        await supabase.rpc('increment_reply_reaction', { reply_id: req.params.replyId, reaction_type: type });
        return res.json({ toggled: true, type });
      }
    }

    await supabase.from('resource_reply_reactions').insert({
      reply_id: req.params.replyId,
      user_id: req.userId,
      type,
      warn_comment: warnComment ?? null,
    });
    await supabase.rpc('increment_reply_reaction', { reply_id: req.params.replyId, reaction_type: type });

    return res.json({ toggled: true, type });
  } catch (err) {
    console.error('POST /community/requests/replies/:replyId/react error:', err);
    return res.status(500).json({ error: 'Failed to react.' });
  }
});

// GET /community/requests/replies/my-reactions — reactions by current user across all replies
app.get('/community/requests/replies/my-reactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('resource_reply_reactions')
      .select('reply_id, type')
      .eq('user_id', req.userId!);
    if (error) throw error;
    return res.json(data ?? []);
  } catch {
    return res.json([]);
  }
});

// ─── GET /health ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', sources: CHAT_SOURCE_IDS }));

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  // Listen immediately so Railway health checks pass right away
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n✓ Tarbiyah server running on http://0.0.0.0:${PORT}`);
    console.log(`  POST /chat           — AI parenting advisor`);
    console.log(`  GET  /daily          — Personalized daily payload (auth required)`);
    console.log(`  GET  /daily/preview  — Daily payload preview (no auth)`);
    console.log(`  POST /learn/generate — Generate personalized parenting module`);
    console.log(`  POST /learn/audio/lessons — Generate per-lesson narration audio (parallel)`);
    console.log(`  GET  /modules        — Fetch user's saved modules (auth required)`);
    console.log(`  POST /modules        — Save/update a module (auth required)`);
    console.log(`  GET  /health         — Health check\n`);
  });

  // Seed and warm cache in the background after startup
  (async () => {
    try {
      await seedSources();
      await getSystemPrompt();
      console.log('✓ Sources seeded and prompt cache warmed.');
    } catch (err) {
      console.error('Startup initialization error:', err);
    }
  })();
}

start().catch(err => {
  console.error('Server startup error:', err);
  process.exit(1);
});
