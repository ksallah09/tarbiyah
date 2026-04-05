import { Source, ExtractedContent } from '../types';
import { processYouTubeSource } from './youtube';
import { processPdfSource } from './pdf';
import { processTextSource } from './text';

/**
 * Processor factory — dispatches to the correct handler based on source type.
 *
 * All processors return the same ExtractedContent shape, making the rest of
 * the pipeline source-type agnostic.
 */
export async function processSource(
  source: Source
): Promise<ExtractedContent> {
  console.log(`\nProcessing [${source.type.toUpperCase()}] "${source.title}"`);

  switch (source.type) {
    case 'youtube':
      return processYouTubeSource(source);

    case 'pdf':
      return processPdfSource(source);

    case 'book':
      // Books may be PDFs or web-hosted — check URL extension
      if (source.url.toLowerCase().endsWith('.pdf')) {
        return processPdfSource(source);
      }
      return processTextSource(source);

    case 'article':
    case 'website':
      return processTextSource(source);

    default: {
      const exhaustiveCheck: never = source.type;
      throw new Error(`Unknown source type: ${String(exhaustiveCheck)}`);
    }
  }
}
