import { mistral } from '@/lib/ai/mistral';
import { SOCRATIC_SYSTEM_PROMPT, buildSocraticUserPrompt } from '@/lib/ai/prompts';
import { safetyParseSocraticCard } from '@/lib/ai/parsers';

type SocraticRequestBody = {
  segment?: {
    startTime: number;
    endTime: number;
    text: string;
  };
  priorConcepts?: string[];
  videoId?: string;
};

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
    const body = (await request.json()) as SocraticRequestBody;
    const { segment, priorConcepts = [], videoId } = body;

    if (!segment || typeof segment.text !== 'string' || typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number') {
      return Response.json(
        { error: 'Invalid or missing segment context.' },
        { status: 400, headers: corsHeaders }
      );
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

    return Response.json(
      { ok: true, data: parsedCard },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Socratic endpoint error.';
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
