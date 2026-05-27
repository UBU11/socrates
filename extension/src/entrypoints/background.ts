export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info('Socrates Transcript Extractor installed.', {
      id: browser.runtime.id,
    });
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return undefined;

    const msg = message as Record<string, unknown>;

    // == Strategy 1: Fetch timedtext XML/JSON3 directly ==
    if (msg.type === 'SOCRATES_BG_FETCH') {
      const { url } = message as { url: string };
      console.log('[Socrates Background] Fetching URL:', url);

      fetch(url)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const text = await response.text();
          sendResponse({ ok: true, text });
        })
        .catch((error: unknown) => {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error('[Socrates Background] Fetch error:', errMsg);
          sendResponse({ ok: false, error: errMsg });
        });

      return true; // Keep message port open
    }

    // == Strategy 2: Fetch via YouTube InnerTube API ==
    if (msg.type === 'SOCRATES_BG_TRANSCRIPT_FETCH') {
      const { params, videoId, apiKey } = message as { params: string; videoId: string; apiKey: string };
      console.log('[Socrates Background] Fetching InnerTube with videoId:', videoId);

      const url = `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}&prettyPrint=false`;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`InnerTube HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          sendResponse({ ok: true, data });
        })
        .catch((error: unknown) => {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error('[Socrates Background] InnerTube fetch error:', errMsg);
          sendResponse({ ok: false, error: errMsg });
        });

      return true; // Keep message port open
    }

    return undefined;
  });
});
