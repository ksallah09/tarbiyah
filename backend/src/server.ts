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

    const [spiritualInsight, scienceInsight] = await Promise.all([
      pickInsight('spiritual', userId, focusAreas),
      pickInsight('science', userId, focusAreas),
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

async function buildModuleSourceContext(): Promise<string> {
  // Pull all completed processing jobs with their extracted content
  const { data: jobs } = await supabase
    .from('processing_jobs')
    .select('source_id, extracted_content')
    .eq('status', 'completed')
    .limit(80); // cap to avoid token overflow

  if (!jobs || jobs.length === 0) return 'No source material available.';

  const sourceIds = jobs.map((j: Record<string, unknown>) => j.source_id as string);
  const { data: sources } = await supabase
    .from('sources')
    .select('id, title, author, category, tags, description')
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
    context += `SOURCE: "${src?.title ?? job.source_id}"\n`;
    context += `AUTHOR: ${src?.author ?? 'Unknown'}\n`;
    context += `CATEGORY: ${src?.category ?? 'unknown'}\n`;
    if (src?.description) context += `OVERVIEW: ${src.description}\n`;
    context += '\n';
    if (c.coreTheme)         context += `CORE THEME: ${c.coreTheme}\n\n`;
    if (c.keyInsights?.length) {
      context += `KEY INSIGHTS:\n`;
      c.keyInsights.forEach(k => { context += `• ${k}\n`; });
      context += '\n';
    }
    if (c.islamicReferences?.length) {
      context += `ISLAMIC REFERENCES:\n`;
      c.islamicReferences.forEach(r => { context += `• ${r}\n`; });
      context += '\n';
    }
    if (c.practicalAdvice?.length) {
      context += `PRACTICAL ADVICE:\n`;
      c.practicalAdvice.forEach(a => { context += `• ${a}\n`; });
      context += '\n';
    }
    if (c.rawSummary) context += `SUMMARY: ${c.rawSummary}\n\n`;
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

    const sourceContext = await buildModuleSourceContext();
    const systemPrompt  = buildModuleSystemPrompt(sourceContext);
    const model         = getJsonModel(MODEL_HEAVY, systemPrompt);

    const userPrompt = [
      `Parent's topic: ${topic.trim()}`,
      childrenAges  ? `Children's ages: ${childrenAges}` : null,
      focusAreas?.length ? `Parent's focus areas: ${focusAreas.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const raw = await generateWithRetry(model, userPrompt, MODEL_HEAVY, systemPrompt);

    let parsed: Omit<AppModule, 'id' | 'totalLessons' | 'completedLessons' | 'createdAt'>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('Module JSON parse error. Raw response:', raw.slice(0, 500));
      return res.status(500).json({ error: 'Failed to parse module response.' });
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
      }, { onConflict: 'id' });

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /modules error:', err);
    return res.status(500).json({ error: 'Failed to save module.' });
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
