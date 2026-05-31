declare const chrome: any;
import type { CaptionTrack, TranscriptCue } from './types';
import { withTranscriptFormat } from './captionSelection';
import { parseTranscriptPayload } from './localParsers';
import { readApiKey } from './youtube';

export async function fetchTranscriptCues(
  track: CaptionTrack,
  videoId?: string,
  playerResponse?: any,
): Promise<TranscriptCue[]> {
  const vid = videoId ?? extractVideoIdFromUrl(track.baseUrl);

  if (playerResponse && vid) {
    try {
      let dynamicToken = findTranscriptParams(playerResponse);
      if (!dynamicToken && playerResponse._socratesInitialData) {
        dynamicToken = findTranscriptParams(playerResponse._socratesInitialData);
      }
      const apiKey = readApiKey() ?? '';
      if (dynamicToken) {
        console.log('[Socrates] Attempting browser background InnerTube fetch with dynamic token...');
        const response = await new Promise<{ ok: boolean; data?: any; error?: string }>((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'SOCRATES_BG_TRANSCRIPT_FETCH',
            params: dynamicToken,
            videoId: vid,
            apiKey,
          }, (res) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(res);
          });
        });

        if (response && response.ok && response.data) {
          const cues = parseInnerTubeJson(response.data);
          if (cues.length > 0) {
            console.log('[Socrates] Successfully parsed', cues.length, 'cues from background InnerTube fetch.');
            return cues;
          }
        }
      }
    } catch (error) {
      console.error('[Socrates] Background InnerTube fetch failed, trying timedtext background fetch:', error);
    }
  }

  try {
    const targetUrl = withTranscriptFormat(track.baseUrl);
    console.log('[Socrates] Attempting browser background fetch for URL:', targetUrl.slice(0, 100) + '...');

    const response = await new Promise<{ ok: boolean; text?: string; error?: string }>((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'SOCRATES_BG_FETCH',
        url: targetUrl,
      }, (res) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(res);
      });
    });

    if (response && response.ok && response.text) {
      console.log('[Socrates] Background timedtext fetch succeeded, payload length:', response.text.length);
      const cues = parseTranscriptPayload(response.text);
      if (cues.length > 0) {
        return cues;
      }
    }
  } catch (error) {
    console.error('[Socrates] Background timedtext fetch failed, trying Next.js server proxy:', error);
  }

  if (!vid) {
    throw new Error('Could not determine videoId for transcript fetch.');
  }

  console.log('[Socrates] Fetching transcript via Next.js server proxy for videoId:', vid);

  const response = await fetch('http://127.0.0.1:3000/api/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId: vid,
      languageCode: track.languageCode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Transcript proxy returned HTTP ${response.status}.`);
  }

  const result = (await response.json()) as {
    ok: boolean;
    cues?: TranscriptCue[];
    payload?: string;
    error?: string;
  };

  if (!result.ok) {
    throw new Error(result.error || 'Failed to fetch transcript via proxy.');
  }

  if (result.cues && result.cues.length > 0) {
    console.log('[Socrates] Received', result.cues.length, 'pre-parsed cues from proxy');
    return result.cues;
  }

  const payload = result.payload ?? '';
  if (payload.length > 0) {
    console.log('[Socrates] Received raw payload from proxy, length:', payload.length);
    const cues = parseTranscriptPayload(payload);
    if (cues.length > 0) return cues;
  }

  throw new Error(
    'The transcript proxy was unable to extract captions for this video. ' +
    'This may happen if the video has no captions or if YouTube is blocking automated requests.',
  );
}

function extractVideoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://www.youtube.com');
    return parsed.searchParams.get('v') ?? null;
  } catch {
    return null;
  }
}

function findTranscriptParams(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;

  if (
    'getTranscriptEndpoint' in obj &&
    obj.getTranscriptEndpoint &&
    typeof obj.getTranscriptEndpoint === 'object' &&
    'params' in obj.getTranscriptEndpoint &&
    typeof obj.getTranscriptEndpoint.params === 'string'
  ) {
    return obj.getTranscriptEndpoint.params;
  }

  for (const value of Object.values(obj)) {
    const found = findTranscriptParams(value);
    if (found) return found;
  }

  return null;
}

function parseInnerTubeJson(data: any): TranscriptCue[] {
  try {
    const actions = data?.actions as Array<any> | undefined;
    if (!actions || actions.length === 0) return [];

    const panel = getNestedPath(actions[0], [
      'updateEngagementPanelAction',
      'content',
      'transcriptRenderer',
      'content',
      'transcriptSearchPanelRenderer',
      'body',
      'transcriptSegmentListRenderer',
      'initialSegments',
    ]) as Array<any> | undefined;

    if (!panel || panel.length === 0) return [];

    const cues: TranscriptCue[] = [];

    for (const item of panel) {
      const renderer = item?.transcriptSegmentRenderer;
      if (!renderer) continue;

      const startMs = parseInt(renderer.startMs ?? '0', 10);
      const endMs = parseInt(renderer.endMs ?? '0', 10);
      const text = (renderer.snippet?.runs ?? [])
        .map((r: any) => r.text ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) continue;

      cues.push({
        start: startMs / 1000,
        duration: (endMs - startMs) / 1000,
        end: endMs / 1000,
        text,
      });
    }

    return cues;
  } catch (error) {
    console.error('[Socrates] InnerTube parse error:', error);
    return [];
  }
}

function getNestedPath(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
