import type { TranscriptResult } from '@/utils/transcript';
import { cacheKey } from './utils';

export async function readCachedTranscript(videoId: string): Promise<TranscriptResult | null> {
  const key = cacheKey(videoId);
  const stored = await browser.storage.local.get(key);
  const value = stored[key] as TranscriptResult | undefined;
  return value?.videoId === videoId ? value : null;
}

export async function writeCachedTranscript(result: TranscriptResult): Promise<void> {
  await browser.storage.local.set({
    [cacheKey(result.videoId)]: result,
  });
}
