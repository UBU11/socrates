import type { TranscriptCue, TranscriptSegment } from './types';

const TRANSCRIPT_SEGMENT_CHAR_LIMIT = 3000;

export function segmentTranscript(
  videoId: string,
  cues: TranscriptCue[],
  maxChars = TRANSCRIPT_SEGMENT_CHAR_LIMIT,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentText: string[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentLength = 0;

  for (const cue of cues) {
    const text = cue.text.trim();
    if (!text) continue;

    if (currentText.length === 0) {
      currentStart = cue.start;
    }

    if (currentLength + text.length > maxChars && currentText.length > 0) {
      segments.push({
        id: `${videoId}_${Math.round(currentStart)}`,
        startTime: currentStart,
        endTime: currentEnd,
        text: currentText.join(' '),
      });

      currentText = [];
      currentLength = 0;
      currentStart = cue.start;
    }

    currentText.push(text);
    currentLength += text.length + 1;
    currentEnd = cue.end;
  }

  if (currentText.length > 0) {
    segments.push({
      id: `${videoId}_${Math.round(currentStart)}`,
      startTime: currentStart,
      endTime: currentEnd,
      text: currentText.join(' '),
    });
  }

  return segments;
}

export function formatTranscript(cues: TranscriptCue[]): string {
  return cues
    .map((cue) => `[${formatTimestamp(cue.start)}] ${cue.text}`)
    .join('\n');
}

export function formatTimestamp(totalSeconds: number): string {
  const rounded = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return [
      String(hours),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':');
  }

  return [String(minutes), String(seconds).padStart(2, '0')].join(':');
}
