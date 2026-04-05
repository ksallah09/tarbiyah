// ─── Source Repository Types ────────────────────────────────────────────────

export type SourceType = 'youtube' | 'pdf' | 'book' | 'article' | 'website';

export type SourceCategory = 'spiritual' | 'science';

export type SourceLanguage = 'en' | 'ar' | 'bilingual';

export type InsightTag = string;

export type InsightStatus = 'draft' | 'approved' | 'published';

export type ContentType =
  | 'spiritual'
  | 'educational'
  | 'practical'
  | 'emotional'
  | 'mixed';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ─── Source Entry ────────────────────────────────────────────────────────────

export interface Source {
  id: string;
  title: string;
  url: string;
  type: SourceType;
  category: SourceCategory; // 'spiritual' | 'science' — determines which home screen card pool
  author?: string;
  speakerName?: string;
  tags: InsightTag[];
  language: SourceLanguage;
  description?: string;
  durationMinutes?: number;
  isActive: boolean;
  addedAt: Date;
}

// ─── Processing ──────────────────────────────────────────────────────────────

export interface ProcessingJob {
  id: string;
  sourceId: string;
  status: ProcessingStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  extractedContent?: ExtractedContent;
}

export interface ExtractedContent {
  coreTheme: string;
  keyInsights: string[];
  islamicReferences: string[];
  practicalAdvice: string[];
  emotionalTone: string;
  targetAudience: string;
  rawSummary: string;
}

// ─── Generated Insight ───────────────────────────────────────────────────────

export interface InsightOutput {
  id: string;
  sourceId: string;
  jobId: string;
  category: SourceCategory; // inherited from source — drives home screen card selection

  // User-facing content
  insightTitle: string;    // short evocative title for card display (4-7 words)
  dailyInsight: string;
  spiritualInsight?: string;
  educationalInsight?: string;
  actionStep?: string;
  attribution: string;

  // Internal grounding (transparency layer)
  sourceGrounding: SourceGrounding;

  // Metadata
  tags: InsightTag[];
  contentType: ContentType;
  status: InsightStatus;
  dateGenerated: Date;
  datePublished?: Date;
}

export interface SourceGrounding {
  sourceId: string;
  sourceTitle: string;
  directQuote?: string;
  paraphrasedIdea?: string;
  generatedFromContext?: string;
  confidence: 'high' | 'medium' | 'low';
  clarification: string; // e.g. "Paraphrased idea from lecture" vs "Direct teaching from source"
}

// ─── Daily Feed ──────────────────────────────────────────────────────────────

export interface DailyFeed {
  date: string; // ISO date string
  spiritualInsight: InsightOutput;
  educationalInsight: InsightOutput;
  actionStep: string;
  source: Pick<Source, 'title' | 'author' | 'type'>;
}

// ─── Gemini Response Shapes ──────────────────────────────────────────────────

export interface GeminiExtractionResponse {
  coreTheme: string;
  keyInsights: string[];
  islamicReferences: string[];
  practicalAdvice: string[];
  emotionalTone: string;
  targetAudience: string;
  rawSummary: string;
}

export interface GeminiInsightResponse {
  insightTitle: string;   // short evocative title (4-7 words) for display on the card
  dailyInsight: string;
  spiritualInsight: string;
  educationalInsight: string;
  actionStep: string;
  attribution: string;
  tags: InsightTag[];
  contentType: ContentType;
  sourceGrounding: {
    directQuote?: string;
    paraphrasedIdea?: string;
    generatedFromContext?: string;
    confidence: 'high' | 'medium' | 'low';
    clarification: string;
  };
}

// ─── App-ready Output ────────────────────────────────────────────────────────
// This is what the mobile app receives — clean, front-end ready

export interface AppInsightCard {
  id: string;
  type: 'spiritual' | 'scientific' | 'practical';
  insightTitle: string;   // short evocative AI-generated title shown on card
  body: string;           // primary insight — spiritualInsight or educationalInsight
  dailyInsight: string;   // shorter daily reflection shown in detail header
  speakerName: string;    // display name only — used in card footer and detail header
  speakerImage: string;   // asset filename (e.g. "Nouman Ali Khan.png") — resolved in app
  source: string;         // speaker/org name for display
  sourceDetail: {
    sourceType: string;        // 'youtube' | 'article' | 'pdf' | 'book'
    sourceTitle: string;       // original title of the lecture, article, or book
    speakerOrAuthor: string;   // speaker name or author/org name
  };
  actionStep?: string;
  tags: string[];
  date: string;
}

export interface AppDailyPayload {
  date: string;
  insights: AppInsightCard[];
  actionGoals: AppActionGoal[];
}

export interface AppActionGoal {
  id: string;
  type: 'spiritual' | 'practical';
  label: string;
  text: string;
}
