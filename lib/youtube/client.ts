import type { TranscriptCue } from './types';
import { parseJson3 } from './parsers';

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function extractJsonFromHtml(html: string, varName: string): Record<string, unknown> | null {
  const patterns = [
    new RegExp(`(?:window\\[["']${varName}["']\\]|var\\s+${varName}|${varName})\\s*=\\s*({.+?});`),
    new RegExp(`(?:window\\[["']${varName}["']\\]|var\\s+${varName}|${varName})\\s*=\\s*({.+?})\\s*(?:var\\s+|<\\/script>|;)`),
    new RegExp(`["']${varName}["']\\s*:\\s*({.+?})\\s*(?:,|\\n|\\r)`),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        let jsonStr = match[1].trim();
        if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
        return JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        // Continue to next match
      }
    }
  }
  return null;
}

export function findTranscriptParams(obj: unknown): string | null {
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

export function extractApiKey(html: string): string | null {
  const match = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/i) ||
                html.match(/"innertubeApiKey"\s*:\s*"([^"]+)"/i);
  return match ? match[1] : null;
}

export async function fetchViaCaptionTracks(
  playerResponse: Record<string, unknown>,
  languageCode?: string,
): Promise<TranscriptCue[] | null> {
  try {
    const captions = playerResponse?.captions as Record<string, unknown> | undefined;
    const renderer = captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined;
    const captionTracks = renderer?.captionTracks as Array<{
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
      name?: { simpleText?: string };
    }> | undefined;

    if (!captionTracks || captionTracks.length === 0) return null;

    const lang = (languageCode ?? 'en').toLowerCase();
    const primary = lang.split('-')[0];

    const track =
      captionTracks.find((t) => t.languageCode?.toLowerCase() === lang && t.kind !== 'asr') ??
      captionTracks.find((t) => t.languageCode?.toLowerCase().startsWith(primary) && t.kind !== 'asr') ??
      captionTracks.find((t) => t.languageCode?.toLowerCase() === lang) ??
      captionTracks.find((t) => t.languageCode?.toLowerCase().startsWith(primary)) ??
      captionTracks.find((t) => t.languageCode?.toLowerCase().startsWith('en') && t.kind !== 'asr') ??
      captionTracks.find((t) => t.languageCode?.toLowerCase().startsWith('en')) ??
      captionTracks[0];

    if (!track?.baseUrl) return null;

    const cleanUrl = track.baseUrl.replace(/&amp;/g, '&');
    const url = new URL(cleanUrl);
    url.searchParams.set('fmt', 'json3');

    const ttResponse = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'SOCS=CAESEwgDEgk2ODE3MTQwMjQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+987',
      },
    });

    if (!ttResponse.ok) return null;

    const payload = await ttResponse.text();
    if (!payload.trim()) return null;

    return parseJson3(payload);
  } catch {
    return null;
  }
}

export async function fetchViaInnerTube(videoId: string, params: string, apiKey?: string): Promise<TranscriptCue[] | null> {
  try {
    const url = apiKey
      ? `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}&prettyPrint=false`
      : 'https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false';

    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240313.05.00',
              hl: 'en',
              gl: 'US',
            },
          },
          params,
          videoId,
        }),
      },
    );

    if (!response.ok) {
      console.error('[Transcript Proxy] InnerTube returned HTTP', response.status);
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const actions = data?.actions as Array<Record<string, unknown>> | undefined;
    if (!actions || actions.length === 0) return null;

    const panel = getNestedPath(actions[0], [
      'updateEngagementPanelAction',
      'content',
      'transcriptRenderer',
      'content',
      'transcriptSearchPanelRenderer',
      'body',
      'transcriptSegmentListRenderer',
      'initialSegments',
    ]) as Array<Record<string, unknown>> | undefined;

    if (!panel || panel.length === 0) return null;

    const cues: TranscriptCue[] = [];

    for (const item of panel) {
      const renderer = item?.transcriptSegmentRenderer as {
        startMs?: string;
        endMs?: string;
        snippet?: { runs?: Array<{ text?: string }> };
      } | undefined;

      if (!renderer) continue;

      const startMs = parseInt(renderer.startMs ?? '0', 10);
      const endMs = parseInt(renderer.endMs ?? '0', 10);
      const text = (renderer.snippet?.runs ?? [])
        .map((r) => r.text ?? '')
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
    console.error('[Transcript Proxy] InnerTube error:', error);
    return null;
  }
}

export function getNestedPath(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
