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

    const [spiritualInsight, scienceInsight] = await Promise.all([
      pickInsight('spiritual', userId, focusAreas, childrenAgeGroups),
      pickInsight('science', userId, focusAreas, childrenAgeGroups),
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
    const { topic, childrenAges, focusAreas } = req.body as {
      topic: string;
      childrenAges?: string;
      focusAreas?: string[];
    };

    if (!topic?.trim()) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    const sourceContext = await buildModuleSourceContext(topic);
    const systemPrompt  = buildModuleSystemPrompt(sourceContext);

    const userPrompt = [
      `Parent's topic: ${topic.trim()}`,
      childrenAges  ? `Children's ages: ${childrenAges}` : null,
      focusAreas?.length ? `Parent's focus areas: ${focusAreas.join(', ')}` : null,
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
