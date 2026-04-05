import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  Source,
  ProcessingJob,
  InsightOutput,
  ExtractedContent,
  ProcessingStatus,
  InsightStatus,
} from '../types';
import { CURATED_SOURCES } from './sources';

// ─── Setup ───────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'tarbiyah.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
    initializeSchema(_db);
  }
  return _db;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      url              TEXT UNIQUE NOT NULL,
      type             TEXT NOT NULL,
      category         TEXT NOT NULL DEFAULT 'spiritual',
      author           TEXT,
      speaker_name     TEXT,
      tags             TEXT NOT NULL DEFAULT '[]',
      language         TEXT NOT NULL DEFAULT 'en',
      description      TEXT,
      duration_minutes INTEGER,
      is_active        INTEGER NOT NULL DEFAULT 1,
      added_at         DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS processing_jobs (
      id                TEXT PRIMARY KEY,
      source_id         TEXT NOT NULL REFERENCES sources(id),
      status            TEXT NOT NULL DEFAULT 'pending',
      started_at        DATETIME,
      completed_at      DATETIME,
      error_message     TEXT,
      extracted_content TEXT,
      created_at        DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insights (
      id                  TEXT PRIMARY KEY,
      source_id           TEXT NOT NULL REFERENCES sources(id),
      job_id              TEXT NOT NULL REFERENCES processing_jobs(id),
      category            TEXT NOT NULL DEFAULT 'spiritual',
      insight_title       TEXT NOT NULL DEFAULT '',
      daily_insight       TEXT NOT NULL,
      spiritual_insight   TEXT,
      educational_insight TEXT,
      action_step         TEXT,
      attribution         TEXT NOT NULL,
      source_grounding    TEXT NOT NULL DEFAULT '{}',
      tags                TEXT NOT NULL DEFAULT '[]',
      content_type        TEXT NOT NULL DEFAULT 'mixed',
      status              TEXT NOT NULL DEFAULT 'draft',
      date_generated      DATETIME NOT NULL DEFAULT (datetime('now')),
      date_published      DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_insights_status    ON insights(status);
    CREATE INDEX IF NOT EXISTS idx_insights_date      ON insights(date_generated);
    CREATE INDEX IF NOT EXISTS idx_jobs_source_status ON processing_jobs(source_id, status);
  `);
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export function upsertSource(source: Omit<Source, 'addedAt'>): void {
  getDb().prepare(`
    INSERT INTO sources (id, title, url, type, category, author, speaker_name, tags, language, description, duration_minutes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title        = excluded.title,
      url          = excluded.url,
      category     = excluded.category,
      author       = excluded.author,
      speaker_name = excluded.speaker_name,
      tags         = excluded.tags,
      description  = excluded.description,
      is_active    = excluded.is_active
  `).run(
    source.id,
    source.title,
    source.url,
    source.type,
    source.category,
    source.author ?? null,
    source.speakerName ?? null,
    JSON.stringify(source.tags),
    source.language,
    source.description ?? null,
    source.durationMinutes ?? null,
    source.isActive ? 1 : 0,
  );
}

export function getSourceById(id: string): Source | undefined {
  const row = getDb().prepare('SELECT * FROM sources WHERE id = ?').get(id) as
    Record<string, unknown> | undefined;
  return row ? rowToSource(row) : undefined;
}

export function getAllSources(): Source[] {
  const rows = getDb()
    .prepare('SELECT * FROM sources WHERE is_active = 1 ORDER BY added_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(rowToSource);
}

export function getUnprocessedSources(): Source[] {
  const rows = getDb().prepare(`
    SELECT s.* FROM sources s
    WHERE s.is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM processing_jobs j
        WHERE j.source_id = s.id AND j.status = 'completed'
      )
    ORDER BY s.added_at ASC
  `).all() as Record<string, unknown>[];
  return rows.map(rowToSource);
}

function rowToSource(row: Record<string, unknown>): Source {
  return {
    id: row.id as string,
    title: row.title as string,
    url: row.url as string,
    type: row.type as Source['type'],
    category: (row.category ?? 'spiritual') as Source['category'],
    author: row.author as string | undefined,
    speakerName: row.speaker_name as string | undefined,
    tags: JSON.parse(row.tags as string),
    language: row.language as Source['language'],
    description: row.description as string | undefined,
    durationMinutes: row.duration_minutes as number | undefined,
    isActive: (row.is_active as number) === 1,
    addedAt: new Date(row.added_at as string),
  };
}

export function getSourcesByCategory(category: Source['category']): Source[] {
  const rows = getDb()
    .prepare('SELECT * FROM sources WHERE is_active = 1 AND category = ? ORDER BY added_at ASC')
    .all(category) as Record<string, unknown>[];
  return rows.map(rowToSource);
}

// ─── Processing Jobs ──────────────────────────────────────────────────────────

export function createJob(sourceId: string): ProcessingJob {
  const job: ProcessingJob = { id: uuidv4(), sourceId, status: 'pending' };
  getDb().prepare(`
    INSERT INTO processing_jobs (id, source_id, status) VALUES (?, ?, ?)
  `).run(job.id, job.sourceId, job.status);
  return job;
}

export function startJob(jobId: string): void {
  getDb().prepare(`
    UPDATE processing_jobs SET status = 'processing', started_at = datetime('now') WHERE id = ?
  `).run(jobId);
}

export function completeJob(jobId: string, extractedContent: ExtractedContent): void {
  getDb().prepare(`
    UPDATE processing_jobs
    SET status = 'completed', completed_at = datetime('now'), extracted_content = ?
    WHERE id = ?
  `).run(JSON.stringify(extractedContent), jobId);
}

export function failJob(jobId: string, errorMessage: string): void {
  getDb().prepare(`
    UPDATE processing_jobs
    SET status = 'failed', completed_at = datetime('now'), error_message = ?
    WHERE id = ?
  `).run(errorMessage, jobId);
}

export function getJobById(jobId: string): ProcessingJob | undefined {
  const row = getDb()
    .prepare('SELECT * FROM processing_jobs WHERE id = ?')
    .get(jobId) as Record<string, unknown> | undefined;
  return row ? rowToJob(row) : undefined;
}

function rowToJob(row: Record<string, unknown>): ProcessingJob {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    status: row.status as ProcessingStatus,
    startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    errorMessage: row.error_message as string | undefined,
    extractedContent: row.extracted_content
      ? (JSON.parse(row.extracted_content as string) as ExtractedContent)
      : undefined,
  };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export function saveInsight(insight: InsightOutput): void {
  getDb().prepare(`
    INSERT INTO insights (
      id, source_id, job_id, category, insight_title, daily_insight, spiritual_insight,
      educational_insight, action_step, attribution, source_grounding,
      tags, content_type, status, date_generated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    insight.id,
    insight.sourceId,
    insight.jobId,
    insight.category,
    insight.insightTitle ?? '',
    insight.dailyInsight,
    insight.spiritualInsight ?? null,
    insight.educationalInsight ?? null,
    insight.actionStep ?? null,
    insight.attribution,
    JSON.stringify(insight.sourceGrounding),
    JSON.stringify(insight.tags),
    insight.contentType,
    insight.status,
    insight.dateGenerated.toISOString(),
  );
}

export function getPublishedInsightsByCategory(
  category: InsightOutput['category'],
  limit = 10
): InsightOutput[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM insights WHERE status = 'published' AND category = ? ORDER BY date_published DESC LIMIT ?"
    )
    .all(category, limit) as Record<string, unknown>[];
  return rows.map(rowToInsight);
}

export function updateInsightStatus(insightId: string, status: InsightStatus): void {
  if (status === 'published') {
    getDb().prepare(`
      UPDATE insights SET status = ?, date_published = datetime('now') WHERE id = ?
    `).run(status, insightId);
  } else {
    getDb().prepare(`UPDATE insights SET status = ? WHERE id = ?`).run(status, insightId);
  }
}

export function getInsightsByStatus(status: InsightStatus): InsightOutput[] {
  const rows = getDb()
    .prepare('SELECT * FROM insights WHERE status = ? ORDER BY date_generated DESC')
    .all(status) as Record<string, unknown>[];
  return rows.map(rowToInsight);
}

export function getLatestPublishedInsights(limit = 10): InsightOutput[] {
  const rows = getDb()
    .prepare('SELECT * FROM insights WHERE status = ? ORDER BY date_published DESC LIMIT ?')
    .all('published', limit) as Record<string, unknown>[];
  return rows.map(rowToInsight);
}

export function getInsightsByTag(tag: string): InsightOutput[] {
  const rows = getDb()
    .prepare("SELECT * FROM insights WHERE tags LIKE ? AND status != 'draft' ORDER BY date_generated DESC")
    .all(`%"${tag}"%`) as Record<string, unknown>[];
  return rows.map(rowToInsight);
}

export function getDraftInsights(): InsightOutput[] {
  return getInsightsByStatus('draft');
}

function rowToInsight(row: Record<string, unknown>): InsightOutput {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    jobId: row.job_id as string,
    category: (row.category ?? 'spiritual') as InsightOutput['category'],
    insightTitle: (row.insight_title ?? '') as string,
    dailyInsight: row.daily_insight as string,
    spiritualInsight: row.spiritual_insight as string | undefined,
    educationalInsight: row.educational_insight as string | undefined,
    actionStep: row.action_step as string | undefined,
    attribution: row.attribution as string,
    sourceGrounding: JSON.parse(row.source_grounding as string),
    tags: JSON.parse(row.tags as string),
    contentType: row.content_type as InsightOutput['contentType'],
    status: row.status as InsightStatus,
    dateGenerated: new Date(row.date_generated as string),
    datePublished: row.date_published ? new Date(row.date_published as string) : undefined,
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export function seedSources(): void {
  const db = getDb();
  db.exec('BEGIN');
  try {
    for (const source of CURATED_SOURCES) {
      upsertSource(source);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log(`✓ Seeded ${CURATED_SOURCES.length} sources into the database.`);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStats() {
  const db = getDb();
  return {
    totalSources: (db.prepare('SELECT COUNT(*) as c FROM sources').get() as { c: number }).c,
    processedSources: (db.prepare(
      "SELECT COUNT(DISTINCT source_id) as c FROM processing_jobs WHERE status = 'completed'"
    ).get() as { c: number }).c,
    totalInsights: (db.prepare('SELECT COUNT(*) as c FROM insights').get() as { c: number }).c,
    publishedInsights: (db.prepare(
      "SELECT COUNT(*) as c FROM insights WHERE status = 'published'"
    ).get() as { c: number }).c,
    draftInsights: (db.prepare(
      "SELECT COUNT(*) as c FROM insights WHERE status = 'draft'"
    ).get() as { c: number }).c,
  };
}

// Allow direct execution: `ts-node src/data/database.ts`
if (require.main === module) {
  seedSources();
  console.log('Database stats:', getStats());
}
