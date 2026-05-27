import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  USER_AGENT,
  extractJsonFromHtml,
  findTranscriptParams,
  extractApiKey,
  fetchViaCaptionTracks,
  fetchViaInnerTube,
} from '@/lib/youtube/client';
import { buildTranscriptParams } from '@/lib/youtube/protobuf';
import { mistral } from '@/lib/ai/mistral';
import { SOCRATIC_SYSTEM_PROMPT, buildSocraticUserPrompt } from '@/lib/ai/prompts';
import { safetyParseSocraticCard } from '@/lib/ai/parsers';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.post('/api/transcript', async (c) => {
  try {
    const body = await c.req.json<{ videoId: string; languageCode?: string }>();
    const videoId = body.videoId;

    if (!videoId || typeof videoId !== 'string') {
      return c.json({ error: 'Missing or invalid videoId parameter.' }, 400);
    }

    console.log('[Transcript Hono Proxy] Fetching transcript for video:', videoId);

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
        console.error('[Transcript Hono Proxy] Watch page fetch returned HTTP', watchResponse.status);
      }
    } catch (e) {
      console.error('[Transcript Hono Proxy] Failed to fetch watch page HTML:', e);
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
        console.log('[Transcript Hono Proxy] Strategy 1 succeeded:', cues.length, 'cues');
        return c.json({ ok: true, cues });
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
      console.log('[Transcript Hono Proxy] Extracted dynamic transcript token, length:', dynamicParams.length);
      const innerTubeCues = await fetchViaInnerTube(videoId, dynamicParams, apiKey);
      if (innerTubeCues && innerTubeCues.length > 0) {
        console.log('[Transcript Hono Proxy] Strategy 2 succeeded:', innerTubeCues.length, 'cues');
        return c.json({ ok: true, cues: innerTubeCues });
      }
    }

    // Strategy 3: Use YouTube InnerTube with manual protobuf token fallback
    console.log('[Transcript Hono Proxy] Attempting Strategy 3 (InnerTube manual protobuf)');
    const manualParams = buildTranscriptParams(videoId);
    const manualInnerTubeCues = await fetchViaInnerTube(videoId, manualParams, apiKey);
    if (manualInnerTubeCues && manualInnerTubeCues.length > 0) {
      console.log('[Transcript Hono Proxy] Strategy 3 succeeded:', manualInnerTubeCues.length, 'cues');
      return c.json({ ok: true, cues: manualInnerTubeCues });
    }

    console.warn('[Transcript Hono Proxy] All strategies failed for video:', videoId);
    return c.json({ ok: true, cues: [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Transcript Proxy error.';
    console.error('[Transcript Hono Proxy] Error:', message);
    return c.json({ error: message }, 500);
  }
});

app.post('/api/socratic', async (c) => {
  try {
    const body = await c.req.json<{
      segment?: { startTime: number; endTime: number; text: string };
      priorConcepts?: string[];
      videoId?: string;
    }>();
    const { segment, priorConcepts = [] } = body;

    if (!segment || typeof segment.text !== 'string' || typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number') {
      return c.json({ error: 'Invalid or missing segment context.' }, 400);
    }

    const systemMessage = { role: 'system' as const, content: SOCRATIC_SYSTEM_PROMPT };
    const userMessage = {
      role: 'user' as const,
      content: buildSocraticUserPrompt({
        segmentText: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        priorConcepts,
      }),
    };

    const completion = await mistral.createChatCompletion([systemMessage, userMessage]);
    const parsedCard = safetyParseSocraticCard(completion, {
      startTime: segment.startTime,
      endTime: segment.endTime,
    });

    return c.json({ ok: true, data: parsedCard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Socratic endpoint error.';
    console.error('[Socratic Hono Proxy] Error:', message);
    return c.json({ error: message }, 500);
  }
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
