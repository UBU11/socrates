import type { CaptionTrack, TranscriptCue } from './types';
import { withTranscriptFormat } from './captionSelection';

export async function fetchTranscriptCues(track: CaptionTrack): Promise<TranscriptCue[]> {
  const targetUrl = withTranscriptFormat(track.baseUrl);
  console.log('[Socrates] Direct Caption URL:', targetUrl);
  
  // Route through Next.js proxy to bypass adblockers & isolated world restrictions
  const response = await fetch('http://localhost:3000/api/transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ baseUrl: targetUrl }),
  });

  console.log('[Socrates] Proxy HTTP Response Status:', response.status);

  if (!response.ok) {
    throw new Error(`Caption request failed via Proxy with HTTP ${response.status}.`);
  }

  const result = await response.json() as { ok: boolean; payload?: string; error?: string };
  if (!result.ok) {
    throw new Error(result.error || 'Failed to fetch transcript via Proxy.');
  }

  const payload = result.payload ?? '';
  console.log('[Socrates] Proxied Payload Body Length:', payload.length);
  console.log('[Socrates] Proxied Payload Snippet:', payload.slice(0, 200));

  const cues = parseTranscriptPayload(payload);

  if (cues.length === 0) {
    console.error('[Socrates] Empty cues parsed from payload. Original response:', payload);
    throw new Error(`This caption track did not contain readable transcript text. Payload preview: "${payload.slice(0, 150).replace(/\s+/g, ' ')}"`);
  }

  return cues;
}

export function parseTranscriptPayload(payload: string): TranscriptCue[] {
  const trimmed = payload.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{')) {
    return parseJson3Transcript(trimmed);
  }

  if (trimmed.startsWith('WEBVTT')) {
    return parseVttTranscript(trimmed);
  }

  return parseXmlTranscript(trimmed);
}

function parseJson3Transcript(payload: string): TranscriptCue[] {
  const data = JSON.parse(payload) as {
    events?: Array<{
      tStartMs?: number;
      dDurationMs?: number;
      segs?: Array<{ utf8?: string }>;
    }>;
  };

  return (data.events ?? [])
    .map((event) => {
      const text = normalizeTranscriptText(
        (event.segs ?? []).map((segment) => segment.utf8 ?? '').join(''),
      );
      const start = (event.tStartMs ?? 0) / 1000;
      const duration = (event.dDurationMs ?? 0) / 1000;

      return {
        start,
        duration,
        end: start + duration,
        text,
      };
    })
    .filter((cue) => cue.text.length > 0);
}

function parseXmlTranscript(payload: string): TranscriptCue[] {
  const document = new DOMParser().parseFromString(payload, 'text/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Unable to parse the caption XML returned by YouTube.');
  }

  const legacyTextNodes = Array.from(document.querySelectorAll('text'));
  if (legacyTextNodes.length > 0) {
    return legacyTextNodes
      .map((node) => {
        const start = Number(node.getAttribute('start') ?? 0);
        const duration = Number(node.getAttribute('dur') ?? 0);
        const text = normalizeTranscriptText(node.textContent ?? '');

        return {
          start,
          duration,
          end: start + duration,
          text,
        };
      })
      .filter((cue) => cue.text.length > 0);
  }

  return Array.from(document.querySelectorAll('p'))
    .map((node) => {
      const start = Number(node.getAttribute('t') ?? 0) / 1000;
      const duration = Number(node.getAttribute('d') ?? 0) / 1000;
      const text = normalizeTranscriptText(node.textContent ?? '');

      return {
        start,
        duration,
        end: start + duration,
        text,
      };
    })
    .filter((cue) => cue.text.length > 0);
}

function parseVttTranscript(payload: string): TranscriptCue[] {
  return payload
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.includes('-->'))
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim());
      const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
      const [startText, endText] = lines[timeLineIndex].split('-->').map((value) => value.trim());
      const start = parseVttTimestamp(startText);
      const end = parseVttTimestamp(endText.split(/\s+/)[0]);
      const text = normalizeTranscriptText(lines.slice(timeLineIndex + 1).join(' '));

      return {
        start,
        duration: Math.max(0, end - start),
        end,
        text,
      };
    })
    .filter((cue) => cue.text.length > 0);
}

function parseVttTimestamp(value: string): number {
  const parts = value.split(':');
  const seconds = Number(parts.pop()?.replace(',', '.') ?? 0);
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeTranscriptText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}
