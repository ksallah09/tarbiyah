/**
 * generate-alerts.ts
 * Railway cron: Mon/Thu at 06:00 UTC (main run), Sat at 06:00 UTC (alerts-only run)
 * Command: npx ts-node src/scripts/generate-alerts.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Clients ───────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = 'gemini-3.5-flash';
const TODAY = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

// ── Severity mapping ──────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = { High: 3, Important: 2, Watch: 1 };

function normaliseSeverity(risk_level: string): 'High' | 'Important' | 'Watch' {
  const l = (risk_level ?? '').toLowerCase();
  if (l === 'high')      return 'High';
  if (l === 'important') return 'Important';
  return 'Watch';
}

// ── System instruction ────────────────────────────────────────────────────────

const ALERTS_VOICE = `
You are a safety intelligence engine for Tarbiyah — an app for Muslim parents.

WRITING RULES:
- Calm, informative, never alarmist
- Plain English, specific and practical
- Conditional language: "if your child uses X..." never "your child is..."
- High severity = immediate action needed. Watch = awareness only.

CRITICAL QUALITY RULES:
1. SPECIFICITY: Every alert must name something SPECIFIC happening RIGHT NOW.
   WRONG: "AI chatbots may pose risks to teens"
   RIGHT: "The [specific chatbot/challenge/trend] has been linked to [specific harm] this week"
2. SOURCE REQUIRED: Every alert must be grounded in the data provided.
3. QUALITY OVER QUANTITY: 5-6 strong, specific alerts rather than vague ones.
4. Every item MUST have a risk_level of "high", "important", or "watch".
   - high = immediate parental action needed
   - important = worth a conversation this week
   - watch = awareness only, monitor
5. ONE ALERT PER SOURCE: If a single article or report covers multiple angles,
   generate ONE alert for the most significant angle only. Do not generate two
   alerts that trace back to the same source or the same underlying incident.
`.trim();

// ── Call 1: Google Search grounding ──────────────────────────────────────────

async function fetchGroundingContext(): Promise<string> {
  console.log('[alerts] Fetching Google Search grounding context...');
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      tools: [{ googleSearch: {} } as any],
      generationConfig: { temperature: 0.2 } as any,
    });
    const prompt = `Today is ${TODAY}. Search for the top 3-4 youth safety concerns trending RIGHT NOW this week — things happening this week involving children, teens, social media, online harms, or dangerous challenges. Return a concise plain-text summary of each concern with its source. Focus on what is NEW and SPECIFIC.`;
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Grounding timeout')), 180_000)
      ),
    ]);
    const text = (result as any).response.text();
    console.log(`[alerts] Grounding: ${text.length} chars — ${text.slice(0, 120).replace(/\n/g, ' ')}`);
    return text;
  } catch (e) {
    console.warn('[alerts] Grounding failed:', (e as Error).message);
    return '';
  }
}

// ── Reddit safety signals ─────────────────────────────────────────────────────

async function fetchRedditSignals(): Promise<string> {
  const subs = ['Parenting', 'internetparents', 'teenagers', 'OutOfTheLoop', 'GenZ'];
  const titles: string[] = [];
  await Promise.allSettled(subs.map(async sub => {
    try {
      const clientId     = process.env.REDDIT_CLIENT_ID;
      const clientSecret = process.env.REDDIT_CLIENT_SECRET;
      let baseUrl = 'https://www.reddit.com';
      const headers: Record<string, string> = { 'User-Agent': 'TarbiyahApp/1.0 by tarbiyahdev' };

      if (clientId && clientSecret) {
        const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
          method:  'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':   'TarbiyahApp/1.0 by tarbiyahdev',
          },
          body: 'grant_type=client_credentials',
        });
        if (tokenRes.ok) {
          const td: any = await tokenRes.json();
          if (td.access_token) {
            headers['Authorization'] = `Bearer ${td.access_token}`;
            baseUrl = 'https://oauth.reddit.com';
          }
        }
      }

      const res = await fetch(`${baseUrl}/r/${sub}/top.json?t=week&limit=10`, { headers });
      if (!res.ok) return;
      const json: any = await res.json();
      for (const p of json?.data?.children ?? []) {
        const title = p?.data?.title;
        if (title && title.length < 200) titles.push(`[r/${sub}] ${title}`);
      }
    } catch {}
  }));
  return titles.slice(0, 25).join('\n');
}

// ── Call 2: Structured generation ─────────────────────────────────────────────

async function generateAlerts(
  groundingContext: string,
  redditSignals:   string,
  excludeTopics:   string[],
): Promise<any[]> {
  const exclusionBlock = excludeTopics.length > 0
    ? `\nTOPICS ALREADY COVERED THIS WEEK — do NOT generate alerts on these or close variations:\n${excludeTopics.map(t => `• ${t}`).join('\n')}\n`
    : '';

  const prompt = `Today is ${TODAY}.

REAL-TIME SEARCH CONTEXT (from Google Search — use as primary sources):
${groundingContext || 'No grounding context available — use your training knowledge for notable recent concerns.'}

REDDIT SAFETY SIGNALS:
${redditSignals || 'No Reddit signals available.'}
${exclusionBlock}
Generate 5-6 specific safety alerts for Muslim parents of children aged 5-18.
Ground every alert in the data above. Be concise — the ENTIRE response must be under 1000 words total.

Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "title": "≤10 words, specific not generic",
      "risk_level": "high | important | watch",
      "age_ranges": ["5–7", "8–10", "11–12", "13–15", "16–18"],
      "short_summary": "1-2 sentences. What is happening and why it matters.",
      "what_it_is": "2 sentences max. Plain language explanation.",
      "how_to_connect": "1 sentence. How to open the conversation without alarm.",
      "action_steps": "1-3 sentences. Combine practical steps to take with communication and educational guidance — how to talk about it, what to teach, and what to do. Keep Islamic values and the parent-child relationship in mind.",
      "source_citations": ["Source name (Month Year)"]
    }
  ]
}`;

  const model = genAI.getGenerativeModel({
    model:             MODEL,
    systemInstruction: ALERTS_VOICE,
    generationConfig:  {
      responseMimeType: 'application/json',
      temperature:      0.3,
      maxOutputTokens:  8192,
    } as any,
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text   = result.response.text();
      const parsed = JSON.parse(text);
      const items  = parsed.items ?? [];
      console.log(`[alerts] Generated ${items.length} alerts (attempt ${attempt + 1}).`);
      return items;
    } catch (e) {
      lastErr = e;
      console.warn(`[alerts] Generation attempt ${attempt + 1} failed:`, (e as Error).message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

// ── Within-batch source deduplication ─────────────────────────────────────────

function deduplicateBySource(rows: any[]): any[] {
  const seen = new Map<string, any>();
  for (const row of rows) {
    const key = (row.source_citations ?? [])
      .map((s: string) => s.toLowerCase().trim())
      .sort()
      .join('|');
    if (!key) {
      // No citation — keep under unique title key
      seen.set(`__no_src__${row.title}`, row);
      continue;
    }
    const existing = seen.get(key);
    if (!existing || (SEVERITY_RANK[row.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) {
      seen.set(key, row);
    }
  }
  return [...seen.values()];
}

// ── Push notifications ────────────────────────────────────────────────────────

function buildAlertDigestBody(titles: string[]): string {
  const MAX = 130;
  const bullets = titles.map(t => `• ${t}`);
  const full = bullets.join(' · ');
  if (full.length <= MAX) return full;
  let body = '';
  let included = 0;
  for (const b of bullets) {
    const candidate = body ? `${body} · ${b}` : b;
    if (candidate.length > MAX - 10) break;
    body = candidate;
    included++;
  }
  const remaining = titles.length - included;
  return remaining > 0 ? `${body} +${remaining} more` : body;
}

async function sendPushNotifications(inserted: { title: string; severity: string }[]): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('notify_push', true)
    .eq('notify_safety', true)
    .not('push_token', 'is', null);

  const tokens = (data ?? []).map((r: any) => r.push_token).filter(Boolean);
  if (!tokens.length) {
    console.log('[alerts] No push tokens with notify_safety enabled — skipping push.');
    return;
  }

  const highCount      = inserted.filter(r => r.severity === 'High').length;
  const importantCount = inserted.filter(r => r.severity === 'Important').length;
  const total          = inserted.length;

  const title = highCount > 0
    ? `⚠️ ${highCount} High Priority Alert${highCount !== 1 ? 's' : ''}`
    : importantCount > 0
    ? `📋 ${importantCount} New Alert${importantCount !== 1 ? 's' : ''} This Week`
    : `🔔 ${total} New Safety Update${total !== 1 ? 's' : ''}`;

  const body = buildAlertDigestBody(inserted.map(r => r.title));

  const messages = tokens.map((token: string) => ({
    to:        token,
    title,
    body,
    data:      { screen: 'Alerts' },
    sound:     'default',
    channelId: 'default',
  }));

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(chunk),
    });
    if (!res.ok) console.warn(`[alerts] Expo Push error: ${res.status}`);
    else {
      const result = await res.json() as any;
      const errors = (result.data ?? []).filter((r: any) => r.status === 'error');
      if (errors.length) console.warn(`[alerts] ${errors.length} delivery errors`);
    }
    console.log(`[alerts] Push chunk sent: ${chunk.length} tokens.`);
  }
  console.log(`[alerts] Push notifications sent to ${tokens.length} users — "${title}"`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[alerts] ── Starting generation run — ${TODAY} ──`);

  // 1. Fetch recent alert titles for exclusion (cross-week dedup)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentErr } = await supabase
    .from('alerts')
    .select('title')
    .gte('published_at', sevenDaysAgo);
  if (recentErr) console.warn('[alerts] Could not fetch recent titles:', recentErr.message);
  const excludeTopics = (recent ?? []).map((r: any) => r.title);
  console.log(`[alerts] Excluding ${excludeTopics.length} topics already covered this week.`);

  // 2. Fetch live context in parallel
  const [groundingContext, redditSignals] = await Promise.all([
    fetchGroundingContext(),
    fetchRedditSignals(),
  ]);

  // 3. Generate
  const items = await generateAlerts(groundingContext, redditSignals, excludeTopics);
  if (!items.length) {
    console.error('[alerts] No alerts generated — aborting.');
    process.exit(1);
  }

  // 4. Map Gemini output → DB rows
  const rows = items.map((item: any) => ({
    title:            (item.title ?? '').slice(0, 200),
    category:         'Safety Watch',
    severity:         normaliseSeverity(item.risk_level),
    description:      item.short_summary ?? null,
    what_to_do:       item.action_steps ?? null,
    age_ranges:       item.age_ranges ?? [],
    source_citations: item.source_citations ?? [],
    status:           'published',
    published_at:     new Date().toISOString(),
  }));

  // 5. Within-batch source dedup
  const deduped = deduplicateBySource(rows);
  console.log(`[alerts] After dedup: ${deduped.length} of ${rows.length} alerts will be inserted.`);

  // 6. Insert to DB
  const { data: inserted, error: insertErr } = await supabase
    .from('alerts')
    .insert(deduped)
    .select('id, title, severity');
  if (insertErr) {
    console.error('[alerts] Insert failed:', insertErr);
    process.exit(1);
  }
  console.log('[alerts] Inserted:');
  (inserted ?? []).forEach((r: any) => console.log(`  [${r.severity}] ${r.title}`));

  // 7. Send push notifications
  await sendPushNotifications(inserted ?? []);

  console.log('[alerts] ── Run complete ──');
}

main().catch(err => {
  console.error('[alerts] Fatal error:', err);
  process.exit(1);
});
