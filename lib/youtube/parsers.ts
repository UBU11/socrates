import type { TranscriptCue } from './types';

export function parseJson3(payload: string): TranscriptCue[] {
  try {
    const data = JSON.parse(payload) as {
      events?: Array<{
        tStartMs?: number;
        dDurationMs?: number;
        segs?: Array<{ utf8?: string }>;
      }>;
    };

    return (data.events ?? [])
      .filter((ev) => ev.segs && ev.segs.length > 0)
      .map((ev) => {
        const text = (ev.segs ?? [])
          .map((s) => s.utf8 ?? '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        const start = (ev.tStartMs ?? 0) / 1000;
        const duration = (ev.dDurationMs ?? 0) / 1000;
        return { start, duration, end: start + duration, text };
      })
      .filter((cue) => cue.text.length > 0);
  } catch (error) {
    console.error('[Transcript Proxy] Failed to parse json3:', error);
    return [];
  }
}
