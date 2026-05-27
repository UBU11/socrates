import type { TranscriptProxyRequestBody } from '@/lib/youtube/types';
import {
  USER_AGENT,
  extractJsonFromHtml,
  findTranscriptParams,
  extractApiKey,
  fetchViaCaptionTracks,
  fetchViaInnerTube,
} from '@/lib/youtube/client';
import { buildTranscriptParams } from '@/lib/youtube/protobuf';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TranscriptProxyRequestBody;
    const videoId = body.videoId;

    if (!videoId || typeof videoId !== 'string') {
      return Response.json(
        { error: 'Missing or invalid videoId parameter.' },
        { status: 400, headers: corsHeaders },
      );
    }

    console.log('[Transcript Proxy] Fetching transcript for video:', videoId);

    // 1. Fetch the watch page HTML
    let watchPageHtml = '';
    try {
      const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: 'SOCS=CAESEwgDEgk2ODE3MTQwMjQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+987',
        },
      });
      if (watchResponse.ok) {
        watchPageHtml = await watchResponse.text();
      } else {
        console.error('[Transcript Proxy] Watch page fetch returned HTTP', watchResponse.status);
      }
    } catch (e) {
      console.error('[Transcript Proxy] Failed to fetch watch page HTML:', e);
    }

    let playerResponse: Record<string, unknown> | null = null;
    let initialData: Record<string, unknown> | null = null;
    let apiKey = '';

    if (watchPageHtml) {
      playerResponse = extractJsonFromHtml(watchPageHtml, 'ytInitialPlayerResponse');
      initialData = extractJsonFromHtml(watchPageHtml, 'ytInitialData');
      apiKey = extractApiKey(watchPageHtml) ?? '';
    }

    // Strategy 1: Fetch timedtext from caption tracks inside playerResponse
    if (playerResponse) {
      const cues = await fetchViaCaptionTracks(playerResponse, body.languageCode);
      if (cues && cues.length > 0) {
        console.log('[Transcript Proxy] Strategy 1 (caption tracks) succeeded:', cues.length, 'cues');
        return Response.json({ ok: true, cues }, { headers: corsHeaders });
      }
    }

    // Strategy 2: Use YouTube InnerTube with extracted dynamic params token
    let dynamicParams = '';
    if (playerResponse) {
      dynamicParams = findTranscriptParams(playerResponse) ?? '';
    }
    if (!dynamicParams && initialData) {
      dynamicParams = findTranscriptParams(initialData) ?? '';
    }

    if (dynamicParams) {
      console.log('[Transcript Proxy] Extracted dynamic transcript token, length:', dynamicParams.length);
      const innerTubeCues = await fetchViaInnerTube(videoId, dynamicParams, apiKey);
      if (innerTubeCues && innerTubeCues.length > 0) {
        console.log('[Transcript Proxy] Strategy 2 (InnerTube with dynamic token) succeeded:', innerTubeCues.length, 'cues');
        return Response.json({ ok: true, cues: innerTubeCues }, { headers: corsHeaders });
      }
    }

    // Strategy 3: Use YouTube InnerTube with manual protobuf token fallback
    console.log('[Transcript Proxy] Attempting Strategy 3 (InnerTube manual protobuf)');
    const manualParams = buildTranscriptParams(videoId);
    const manualInnerTubeCues = await fetchViaInnerTube(videoId, manualParams, apiKey);
    if (manualInnerTubeCues && manualInnerTubeCues.length > 0) {
      console.log('[Transcript Proxy] Strategy 3 (InnerTube manual protobuf) succeeded:', manualInnerTubeCues.length, 'cues');
      return Response.json({ ok: true, cues: manualInnerTubeCues }, { headers: corsHeaders });
    }

    console.warn('[Transcript Proxy] All strategies failed for video:', videoId);
    return Response.json(
      { ok: true, cues: [] },
      { headers: corsHeaders },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown Transcript Proxy endpoint error.';
    console.error('[Transcript Proxy] Error:', message);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
