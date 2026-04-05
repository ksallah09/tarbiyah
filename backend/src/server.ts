/**
 * Tarbiyah Chat Server
 *
 * AI parenting advisor grounded exclusively in the curated PDF source library.
 * Uses extracted knowledge from processed PDFs to answer parent questions.
 *
 * Usage:
 *   npm run server
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { getTextModel, MODEL_FAST } from './config/gemini';
import { seedSources, getDb } from './data/database';
import { ExtractedContent } from './types';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.CHAT_PORT ?? 3001;

// ─── PDF source IDs that power the chat ──────────────────────────────────────

const CHAT_SOURCE_IDS = ['sci-pdf-01', 'sci-pdf-03'];

// ─── Build system prompt from extracted PDF knowledge ────────────────────────

function buildSystemPrompt(): string {
  const rows = (getDb().prepare(`
    SELECT s.id, s.title, s.author, s.description, s.tags, j.extracted_content
    FROM processing_jobs j
    JOIN sources s ON s.id = j.source_id
    WHERE j.status = 'completed'
      AND j.extracted_content IS NOT NULL
      AND s.id IN (${CHAT_SOURCE_IDS.map(() => '?').join(',')})
    ORDER BY j.completed_at DESC
  `).all(...CHAT_SOURCE_IDS)) as Array<{
    id: string;
    title: string;
    author: string | null;
    description: string | null;
    tags: string;
    extracted_content: string;
  }>;

  let prompt = `You are a knowledgeable and warm parenting advisor inside the Tarbiyah app, speaking directly to Muslim parents. You help parents raise healthy, emotionally secure, well-guided children.

Your knowledge comes exclusively from the following research-based parenting documents. Every answer you give should be grounded in this material. You may use your intelligence to present the information clearly, make connections between concepts, and speak in a warm, practical tone — but do not introduce advice or claims that go beyond what these sources support.

You are also free to engage in natural conversation (greetings, follow-up questions, clarifications), but when giving parenting guidance, stay grounded in the sources below.

When citing a source, refer to it naturally by title or author (e.g. "According to the UC Davis Health guide..." or "NIH research highlights..."). Do not invent studies or statistics.

`;

  if (rows.length === 0) {
    prompt += `NOTE: No source content has been loaded yet. Let the user know the knowledge base is still being set up.\n`;
    return prompt;
  }

  prompt += `=== KNOWLEDGE BASE ===\n\n`;

  for (const row of rows) {
    const content: ExtractedContent = JSON.parse(row.extracted_content);
    const author = row.author ?? 'Unknown';

    prompt += `────────────────────────────────────────\n`;
    prompt += `SOURCE: "${row.title}"\n`;
    prompt += `AUTHOR: ${author}\n`;
    if (row.description) prompt += `OVERVIEW: ${row.description}\n`;
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

  return prompt;
}

// ─── Chat endpoint ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

app.post('/chat', async (req, res) => {
  try {
    const { question, history = [] }: { question: string; history: ChatMessage[] } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const systemPrompt = buildSystemPrompt();
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

app.get('/health', (_req, res) => res.json({ status: 'ok', sources: CHAT_SOURCE_IDS }));

// ─── Start ────────────────────────────────────────────────────────────────────

seedSources();
app.listen(PORT, () => {
  console.log(`\n✓ Tarbiyah chat server running on http://localhost:${PORT}`);
  console.log(`  Knowledge base: ${CHAT_SOURCE_IDS.join(', ')}`);
  console.log(`  POST /chat  — AI parenting advisor`);
  console.log(`  GET  /health — health check\n`);
});
