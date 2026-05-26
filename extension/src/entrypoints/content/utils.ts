import type { TranscriptMessage } from './types';

export function isTranscriptMessage(message: unknown): message is TranscriptMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message.type === 'SOCRATES_EXTRACT_TRANSCRIPT' ||
      message.type === 'SOCRATES_GET_TRANSCRIPT_STATE')
  );
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown transcript extraction error.';
}

export function cacheKey(videoId: string): string {
  return `socrates:transcript:${videoId}`;
}

export function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
