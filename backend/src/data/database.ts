import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import { CURATED_SOURCES } from './sources';
import {
  Source,
  ProcessingJob,
  InsightOutput,
  ExtractedContent,
  ProcessingStatus,
  InsightStatus,
} from '../types';

// ─── Sources ──────────────────────────────────────────────────────────────────

export async function upsertSource(source: Omit<Source, 'addedAt'>): Promise<void> {
  const { error } = await supabase.from('sources').upsert({
    id:               source.id,
    title:            source.title,
    url:              source.url,
    type:             source.type,
    category:         source.category,
    author:           source.author           ?? null,
    speaker_name:     source.speakerName       ?? null,
    tags:             source.tags,
    language:         source.language,
    description:      source.description       ?? null,
    duration_minutes: source.durationMinutes   ?? null,
    is_active:        source.isActive,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function getSourceById(id: string): Promise<Source | undefined> {
  const { data, error } = await supabase
    .from('sources').select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return rowToSource(data);
}

export async function getAllSources(): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources').select('*').eq('is_active', true)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSource);
}

export async function getUnprocessedSources(): Promise<Source[]> {
  const { data: jobs } = await supabase
    .from('processing_jobs').select('source_id').eq('status', 'completed');
  const processedIds = (jobs ?? []).map((j: Record<string, string>) => j.source_id);

  const { data, error } = await supabase
    .from('sources').select('*').eq('is_active', true)
    .order('added_at', { ascending: true });
  if (error) throw error;

  const all = (data ?? []).map(rowToSource);
  return processedIds.length > 0
    ? all.filter(s => !processedIds.includes(s.id))
    : all;
}

export async function getSourcesByCategory(category: Source['category']): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources').select('*').eq('is_active', true).eq('category', category);
  if (error) throw error;
  return (data ?? []).map(rowToSource);
}

function rowToSource(row: Record<string, unknown>): Source {
  return {
    id:              row.id              as string,
    title:           row.title           as string,
    url:             row.url             as string,
    type:            row.type            as Source['type'],
    category:        (row.category ?? 'spiritual') as Source['category'],
    author:          row.author          as string | undefined,
    speakerName:     row.speaker_name    as string | undefined,
    tags:            (row.tags           as Source['tags']) ?? [],
    language:        row.language        as Source['language'],
    description:     row.description     as string | undefined,
    durationMinutes: row.duration_minutes as number | undefined,
    isActive:        row.is_active       as boolean,
    addedAt:         new Date(row.added_at as string),
  };
}

// ─── Processing Jobs ──────────────────────────────────────────────────────────

export async function createJob(sourceId: string): Promise<ProcessingJob> {
  const job: ProcessingJob = { id: uuidv4(), sourceId, status: 'pending' };
  const { error } = await supabase.from('processing_jobs').insert({
    id: job.id, source_id: job.sourceId, status: job.status,
  });
  if (error) throw error;
  return job;
}

export async function startJob(jobId: string): Promise<void> {
  const { error } = await supabase.from('processing_jobs').update({
    status: 'processing',
    started_at: new Date().toISOString(),
  }).eq('id', jobId);
  if (error) throw error;
}

export async function completeJob(jobId: string, extractedContent: ExtractedContent): Promise<void> {
  const { error } = await supabase.from('processing_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    extracted_content: extractedContent,
  }).eq('id', jobId);
  if (error) throw error;
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase.from('processing_jobs').update({
    status: 'failed',
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  }).eq('id', jobId);
  if (error) throw error;
}

export async function getJobById(jobId: string): Promise<ProcessingJob | undefined> {
  const { data, error } = await supabase
    .from('processing_jobs').select('*').eq('id', jobId).single();
  if (error || !data) return undefined;
  return rowToJob(data);
}

function rowToJob(row: Record<string, unknown>): ProcessingJob {
  return {
    id:               row.id         as string,
    sourceId:         row.source_id  as string,
    status:           row.status     as ProcessingStatus,
    startedAt:        row.started_at   ? new Date(row.started_at  as string) : undefined,
    completedAt:      row.completed_at ? new Date(row.completed_at as string) : undefined,
    errorMessage:     row.error_message as string | undefined,
    extractedContent: row.extracted_content as ExtractedContent | undefined,
  };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export async function saveInsight(insight: InsightOutput): Promise<void> {
  const { error } = await supabase.from('insights').insert({
    id:                  insight.id,
    source_id:           insight.sourceId,
    job_id:              insight.jobId,
    category:            insight.category,
    insight_title:       insight.insightTitle      ?? '',
    daily_insight:       insight.dailyInsight,
    spiritual_insight:   insight.spiritualInsight   ?? null,
    educational_insight: insight.educationalInsight ?? null,
    action_step:         insight.actionStep         ?? null,
    attribution:         insight.attribution,
    source_grounding:    insight.sourceGrounding,
    tags:                insight.tags,
    age_group:           insight.ageGroups,
    content_type:        insight.contentType,
    status:              insight.status,
    date_generated:      insight.dateGenerated.toISOString(),
  });
  if (error) throw error;
}

export async function getPublishedInsightsByCategory(
  category: InsightOutput['category'],
  limit = 10
): Promise<InsightOutput[]> {
  const { data, error } = await supabase
    .from('insights').select('*')
    .eq('status', 'published').eq('category', category)
    .order('date_published', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToInsight);
}

export async function updateInsightStatus(insightId: string, status: InsightStatus): Promise<void> {
  const update: Record<string, string> = { status };
  if (status === 'published') update.date_published = new Date().toISOString();
  const { error } = await supabase.from('insights').update(update).eq('id', insightId);
  if (error) throw error;
}

export async function getInsightsByStatus(status: InsightStatus): Promise<InsightOutput[]> {
  const { data, error } = await supabase
    .from('insights').select('*').eq('status', status)
    .order('date_generated', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToInsight);
}

export async function getLatestPublishedInsights(limit = 10): Promise<InsightOutput[]> {
  const { data, error } = await supabase
    .from('insights').select('*').eq('status', 'published')
    .order('date_published', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToInsight);
}

export async function getInsightsByTag(tag: string): Promise<InsightOutput[]> {
  const { data, error } = await supabase
    .from('insights').select('*').neq('status', 'draft')
    .contains('tags', [tag])
    .order('date_generated', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToInsight);
}

export async function getDraftInsights(): Promise<InsightOutput[]> {
  return getInsightsByStatus('draft');
}

function rowToInsight(row: Record<string, unknown>): InsightOutput {
  return {
    id:                  row.id                  as string,
    sourceId:            row.source_id           as string,
    jobId:               row.job_id              as string,
    category:            (row.category ?? 'spiritual') as InsightOutput['category'],
    insightTitle:        (row.insight_title      ?? '') as string,
    dailyInsight:        row.daily_insight        as string,
    spiritualInsight:    row.spiritual_insight    as string | undefined,
    educationalInsight:  row.educational_insight  as string | undefined,
    actionStep:          row.action_step          as string | undefined,
    attribution:         row.attribution          as string,
    sourceGrounding:     row.source_grounding     as InsightOutput['sourceGrounding'],
    tags:                (row.tags                as InsightOutput['tags']) ?? [],
    ageGroups:           (row.age_group           as InsightOutput['ageGroups']) ?? ['all'],
    contentType:         row.content_type         as InsightOutput['contentType'],
    status:              row.status               as InsightStatus,
    dateGenerated:       new Date(row.date_generated as string),
    datePublished:       row.date_published ? new Date(row.date_published as string) : undefined,
  };
}

// ─── Delivery Tracking ────────────────────────────────────────────────────────

export async function getDeliveredInsightIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('deliveries').select('insight_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((d: Record<string, string>) => d.insight_id);
}

export async function recordDelivery(userId: string, insightId: string): Promise<void> {
  const { error } = await supabase.from('deliveries')
    .upsert({ user_id: userId, insight_id: insightId }, { onConflict: 'user_id,insight_id' });
  if (error) throw error;
}

// Fisher-Yates shuffle (in-place)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function pickInsight(
  category: 'spiritual' | 'science',
  userId: string | null,
  focusAreas: string[] = [],
  childrenAgeGroups: string[] = []
): Promise<InsightOutput | null> {
  const [seen, pool] = await Promise.all([
    userId ? getDeliveredInsightIds(userId) : Promise.resolve([]),
    getPublishedInsightsByCategory(category, 100),
  ]);

  if (pool.length === 0) return null;

  // Preview mode (no auth): rotate by day so each day shows a different insight.
  // Spiritual and science use different offsets so they never repeat the same pair.
  if (!userId) {
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const offset = category === 'spiritual' ? 0 : Math.ceil(pool.length / 2);
    return pool[(dayIndex + offset) % pool.length];
  }

  // Tags that require the user to have explicitly opted in via focus areas.
  // Insights with these tags are excluded entirely for users who haven't selected them.
  const OPT_IN_TAGS = new Set(['special-needs']);

  const seenSet = new Set(seen);
  const unread = pool.filter(i => !seenSet.has(i.id));
  const allCandidates = unread.length > 0 ? unread : pool; // reset if all seen

  // Exclude opt-in-only insights for users who haven't selected the matching focus area
  const filtered = allCandidates.filter(
    i => !i.tags.some(t => OPT_IN_TAGS.has(t) && !focusAreas.includes(t))
  );
  const candidates = filtered.length > 0 ? filtered : allCandidates;

  // Count how many insights the user has already seen from each source.
  // Used as a penalty so over-represented sources naturally fall back.
  const seenCountBySource = new Map<string, number>();
  for (const id of seen) {
    const insight = pool.find(i => i.id === id);
    if (insight) {
      seenCountBySource.set(insight.sourceId, (seenCountBySource.get(insight.sourceId) ?? 0) + 1);
    }
  }

  // Score each candidate:
  //  +2 per focus area tag match
  //  +1 if age group matches the user's children (or insight is tagged 'all')
  //  - seenCountBySource penalty to avoid same speaker repeating
  // Shuffle first so equal-score ties are broken randomly, not by DB insertion order.
  const scored = shuffle(candidates).map(i => {
    const tagScore = i.tags.filter(t => focusAreas.includes(t)).length * 2;
    const ageScore = childrenAgeGroups.length === 0 ? 0
      : (i.ageGroups.includes('all') || i.ageGroups.some(ag => childrenAgeGroups.includes(ag)) ? 1 : 0);
    const sourcePenalty = seenCountBySource.get(i.sourceId) ?? 0;
    return { insight: i, score: tagScore + ageScore - sourcePenalty };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].insight;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export async function seedSources(): Promise<void> {
  for (const source of CURATED_SOURCES) {
    await upsertSource(source);
  }
  console.log(`✓ Seeded ${CURATED_SOURCES.length} sources into Supabase.`);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats() {
  const [
    { count: totalSources },
    { count: totalInsights },
    { count: publishedInsights },
    { count: draftInsights },
    { data: completedJobs },
  ] = await Promise.all([
    supabase.from('sources').select('*',   { count: 'exact', head: true }),
    supabase.from('insights').select('*',  { count: 'exact', head: true }),
    supabase.from('insights').select('*',  { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('insights').select('*',  { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('processing_jobs').select('source_id').eq('status', 'completed'),
  ]);

  const processedSources = new Set(
    (completedJobs ?? []).map((j: Record<string, string>) => j.source_id)
  ).size;

  return {
    totalSources:      totalSources      ?? 0,
    processedSources,
    totalInsights:     totalInsights     ?? 0,
    publishedInsights: publishedInsights ?? 0,
    draftInsights:     draftInsights     ?? 0,
  };
}
