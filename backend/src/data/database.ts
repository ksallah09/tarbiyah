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

export async function pickInsight(
  category: 'spiritual' | 'science',
  userId: string | null,
  focusAreas: string[] = []
): Promise<InsightOutput | null> {
  const [seen, pool] = await Promise.all([
    userId ? getDeliveredInsightIds(userId) : Promise.resolve([]),
    getPublishedInsightsByCategory(category, 100),
  ]);

  const unread = pool.filter(i => !seen.includes(i.id));
  if (unread.length === 0) return pool[0] ?? null; // reset if all seen

  // Score by tag overlap with user's focus areas, fall back to most recent
  const scored = unread.map(i => ({
    insight: i,
    score: i.tags.filter(t => focusAreas.includes(t)).length,
  }));
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
