import { Source } from '../types';

/**
 * Curated backend source repository.
 *
 * Sources are split into two categories that map directly to the home screen cards:
 *   - 'spiritual'  → Spiritual Insight card (Islamic lectures)
 *   - 'science'    → Scientific Insight card (child development / parenting research)
 *
 * The daily pipeline pulls one source from each pool to populate the two cards.
 */
export const CURATED_SOURCES: Omit<Source, 'addedAt'>[] = [

  // ── Spiritual: YouTube Islamic Parenting Lectures ─────────────────────────

  {
    id: 'yt-spiritual-01',
    title: 'The Quranic Essence of Parenting',
    url: 'https://www.youtube.com/watch?v=alSMirHDUDE',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Nouman Ali Khan',
    author: 'Nouman Ali Khan - Official - Bayyinah',
    tags: ['tarbiyah', 'character', 'adab', 'love', 'faith', 'khutbah', 'responsibility'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-02',
    title: 'Raising My Child with Islam',
    url: 'https://www.youtube.com/watch?v=SqrTq7R-I9g',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Nouman Ali Khan',
    author: 'Nouman Ali Khan - Official - Bayyinah',
    tags: ['tarbiyah', 'mercy', 'connection', 'faith', 'influence', 'home-environment'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-03',
    title: 'Raising Daughters and Sons in Islam: Rights & Rewards',
    url: 'https://www.youtube.com/watch?v=lxv7Drm9Kws',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Belal Assaad',
    author: 'Tafseer of life',
    tags: ['adab', 'character', 'patience', 'tarbiyah', 'daughters', 'equality', 'gift'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-04',
    title: "I Raised ALL Of My Sons to Memorize the Quran - Here's What Worked!",
    url: 'https://www.youtube.com/watch?v=MeCzHRYuMLU',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Fatima Barkatulla',
    author: 'Tarteel AI',
    tags: ['discipline', 'love', 'mercy', 'communication', 'hifdh', 'quran', 'motivation'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-05',
    title: 'The Advice of Luqman The Wise',
    url: 'https://www.youtube.com/watch?v=_QlV2KUaFgA',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Omar Suleiman',
    author: 'Institute of Knowledge',
    tags: ['prayer', 'dua', 'routines', 'faith', 'luqman', 'wisdom', 'excellence', 'ihsan'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-06',
    title: 'Secrets to A Righteous Family',
    url: 'https://www.youtube.com/watch?v=EshTHKqKLqI',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Yasir Qadhi',
    author: 'Yasir Qadhi',
    tags: ['gratitude', 'adab', 'character', 'knowledge', 'surah-yusuf', 'family-dynamics', 'forgiveness'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-07',
    title: 'Muslim Family: Where Did We Go Wrong?',
    url: 'https://www.youtube.com/watch?v=sUSLtkPMnYI',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Yasmin Mogahed',
    author: 'Yasmin Mogahed',
    tags: ['presence', 'connection', 'mercy', 'tarbiyah', 'marriage', 'responsibility'],
    language: 'en',
    isActive: true,
  },

  {
    id: 'yt-spiritual-08',
    title: 'Are We Making This Huge Parenting Mistake?',
    url: 'https://www.youtube.com/watch?v=AyeQM0HFEfY',
    type: 'youtube',
    category: 'spiritual',
    speakerName: 'Yasmin Mogahed',
    author: 'Yasmin Mogahed',
    tags: ['identity', 'faith', 'boundaries', 'adab', 'love-of-allah', 'mercy', 'foundation'],
    language: 'en',
    isActive: true,
  },

  // ── Science: Child Development & Parenting Research Articles ─────────────

  {
    id: 'sci-article-01',
    title: '10 Tips for Parenting Your Pre-Teen',
    url: 'https://childmind.org/article/10-tips-for-parenting-your-pre-teen/',
    type: 'article',
    category: 'science',
    author: 'Child Mind Institute',
    tags: ['communication', 'connection', 'boundaries', 'emotional-regulation'],
    language: 'en',
    description: 'Research-backed tips from the Child Mind Institute on parenting pre-teens — communication, independence, and staying connected.',
    isActive: true,
  },

  {
    id: 'sci-article-02',
    title: 'What Parents Should Know About Tweens',
    url: 'https://childmind.org/article/what-parents-should-know-about-tweens/',
    type: 'article',
    category: 'science',
    author: 'Child Mind Institute',
    tags: ['identity', 'attachment', 'communication', 'emotional-regulation'],
    language: 'en',
    description: 'Understanding tween development — what is happening emotionally, socially, and cognitively during this critical window.',
    isActive: true,
  },

  {
    id: 'sci-article-03',
    title: "Parents' Guide to Problem Behavior",
    url: 'https://childmind.org/guide/parents-guide-to-problem-behavior/',
    type: 'article',
    category: 'science',
    author: 'Child Mind Institute',
    tags: ['discipline', 'boundaries', 'emotional-regulation', 'anger', 'routines'],
    language: 'en',
    description: 'A comprehensive guide from the Child Mind Institute on understanding and responding to challenging behavior in children.',
    isActive: true,
  },

  {
    id: 'sci-article-04',
    title: 'Brothers and Sisters: Sibling Relationships',
    url: 'https://www.healthychildren.org/English/family-life/family-dynamics/Pages/brothers-and-sisters.aspx',
    type: 'article',
    category: 'science',
    author: 'American Academy of Pediatrics',
    tags: ['connection', 'play', 'kindness', 'emotional-regulation', 'communication'],
    language: 'en',
    description: 'AAP guidance on sibling relationships — how to foster healthy bonds, manage conflict, and support sibling connection.',
    isActive: true,
  },

  // ── Science: Parenting Research PDFs ─────────────────────────────────────

  {
    id: 'sci-pdf-01',
    title: 'Parenting — UC Davis Health Patient Education',
    url: 'https://health.ucdavis.edu/media-resources/children/documents/patient-education-A-to-Z/Parenting.pdf',
    type: 'pdf',
    category: 'science',
    author: 'UC Davis Health',
    tags: ['routines', 'attachment', 'communication', 'discipline', 'play'],
    language: 'en',
    description: 'Clinical parenting guidance from UC Davis Health covering child development stages, discipline strategies, and building healthy attachment.',
    isActive: true,
  },

  {
    id: 'sci-pdf-02',
    title: 'The Art of Parenting',
    url: 'https://www.unicef.org/lac/media/27656/file/The%20Art%20of%20Parenting.pdf',
    type: 'pdf',
    category: 'science',
    author: 'UNICEF',
    tags: ['attachment', 'love', 'connection', 'emotional-regulation', 'play'],
    language: 'en',
    description: "UNICEF's guide on nurturing parenting — covering responsive caregiving, emotional connection, play, and positive discipline.",
    isActive: false, // URL returns 403 — disabled until a working URL is found
  },

  {
    id: 'sci-pdf-03',
    title: 'Adventures in Parenting — NICHD',
    url: 'https://www.nichd.nih.gov/sites/default/files/publications/pubs/documents/adventures_in_parenting_rev.pdf',
    type: 'pdf',
    category: 'science',
    author: 'National Institute of Child Health and Human Development',
    tags: ['attachment', 'routines', 'communication', 'play', 'emotional-regulation'],
    language: 'en',
    description: "NIH research-based parenting guide covering responsiveness, prevention of problems, monitoring, mentoring, modeling, and love — across different stages of a child's development.",
    isActive: true,
  },
];

export function getActiveSources(): Omit<Source, 'addedAt'>[] {
  return CURATED_SOURCES.filter((s) => s.isActive);
}

export function getSourcesByCategory(
  category: Source['category']
): Omit<Source, 'addedAt'>[] {
  return CURATED_SOURCES.filter((s) => s.isActive && s.category === category);
}

export function getSourcesByType(
  type: Source['type']
): Omit<Source, 'addedAt'>[] {
  return CURATED_SOURCES.filter((s) => s.isActive && s.type === type);
}

export function getSourceById(
  id: string
): Omit<Source, 'addedAt'> | undefined {
  return CURATED_SOURCES.find((s) => s.id === id);
}
