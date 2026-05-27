type TranscriptProxyRequestBody = {
  baseUrl: string;
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
    const body = (await request.json()) as TranscriptProxyRequestBody;
    const { baseUrl } = body;

    if (!baseUrl || typeof baseUrl !== 'string') {
      return Response.json(
        { error: 'Missing or invalid baseUrl parameter.' },
        { status: 400 },
      );
    }

    console.log('[Transcript Proxy] Fetching from YouTube timedtext API:', baseUrl);

    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return Response.json(
        { error: `YouTube API returned HTTP status ${response.status}.` },
        { status: 502, headers: corsHeaders }
      );
    }

    const payload = await response.text();
    console.log('[Transcript Proxy] Successfully retrieved payload. Length:', payload.length);

    return Response.json(
      { ok: true, payload },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Transcript Proxy endpoint error.';
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
