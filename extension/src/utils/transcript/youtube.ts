import type { PlayerResponse } from './types';

export function getCurrentVideoId(): string | null {
  const url = new URL(window.location.href);

  if (url.hostname === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (!url.hostname.endsWith('youtube.com')) {
    return null;
  }

  if (url.pathname === '/watch') {
    return url.searchParams.get('v');
  }

  return document
    .querySelector<HTMLElement>('ytd-watch-flexy[video-id]')
    ?.getAttribute('video-id') ?? null;
}

export function readVideoTitle(playerResponse?: PlayerResponse | null): string {
  const fromPlayer = playerResponse?.videoDetails?.title?.trim();
  if (fromPlayer) return fromPlayer;

  const fromHeading = document
    .querySelector<HTMLElement>('h1.ytd-watch-metadata yt-formatted-string')
    ?.textContent
    ?.trim();
  if (fromHeading) return fromHeading;

  return document.title.replace(/\s+-\s+YouTube$/i, '').trim() || 'YouTube video';
}

export async function readPlayerResponse(videoId?: string): Promise<PlayerResponse | null> {
  try {
    const injectedResponse = await new Promise<PlayerResponse | null>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'SOCRATES_PLAYER_RESPONSE_EXTRACTED') {
          window.removeEventListener('message', handler);
          const response = event.data.payload as PlayerResponse;
          if ((event.data as any).initialData) {
            (response as any)._socratesInitialData = (event.data as any).initialData;
          }
          if (!videoId || response.videoDetails?.videoId === videoId) {
            resolve(response);
          } else {
            resolve(null);
          }
        }
      };
      window.addEventListener('message', handler);

      const script = document.createElement('script');
      script.src = browser.runtime.getURL('/inject.js');
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();

      // Fallback timeout if injection fails or doesn't fire
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 1000);
    });

    if (injectedResponse) {
      console.log('[Socrates] Successfully grabbed YouTube data from main world memory!');
      return injectedResponse;
    }
  } catch (e) {
    console.error('[Socrates] Main world injection failed:', e);
  }

  // 2. Fallback to existing sandbox scraping
  const player = document.querySelector('#movie_player') as
    | (HTMLElement & { getPlayerResponse?: () => PlayerResponse })
    | null;

  try {
    const response = player?.getPlayerResponse?.();
    if (response?.captions || response?.videoDetails) {
      if (!videoId || response.videoDetails?.videoId === videoId) {
        return response;
      }
    }
  } catch {
    // YouTube's player sandbox can sometimes restrict context sharing
  }

  const scripts = Array.from(document.scripts);
  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (!text.includes('ytInitialPlayerResponse')) continue;

    const assignmentIndex = text.indexOf('ytInitialPlayerResponse');
    const objectStart = text.indexOf('{', assignmentIndex);
    if (objectStart === -1) continue;

    const objectText = readBalancedJsonObject(text, objectStart);
    if (!objectText) continue;

    try {
      const response = JSON.parse(objectText) as PlayerResponse;
      if (!videoId || response.videoDetails?.videoId === videoId) {
        return response;
      }
    } catch {
      continue;
    }
  }

  if (videoId) {
    try {
      const htmlResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      if (htmlResponse.ok) {
        const htmlText = await htmlResponse.text();
        const searchStr = 'ytInitialPlayerResponse';
        let assignmentIndex = htmlText.indexOf(searchStr);
        while (assignmentIndex !== -1) {
          const objectStart = htmlText.indexOf('{', assignmentIndex);
          if (objectStart !== -1) {
            const objectText = readBalancedJsonObject(htmlText, objectStart);
            if (objectText) {
              try {
                const response = JSON.parse(objectText) as PlayerResponse;
                if (response.videoDetails?.videoId === videoId) {
                  return response;
                }
              } catch {
                // Ignore and try next match
              }
            }
          }
          assignmentIndex = htmlText.indexOf(searchStr, assignmentIndex + 1);
        }
      }
    } catch (e) {
      console.error('[Socrates] Failed to fetch fallback player response:', e);
    }
  }

  return null;
}

export function readApiKey(): string | null {
  const scripts = Array.from(document.scripts);
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = text.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/i) ||
                  text.match(/"innertubeApiKey"\s*:\s*"([^"]+)"/i);
    if (match) return match[1];
  }
  return null;
}

export function readTrackLabel(name?: { simpleText?: string; runs?: Array<{ text?: string }> }): string {
  if (name?.simpleText) return name.simpleText;
  return (name?.runs ?? []).map((run) => run.text ?? '').join('').trim();
}

export function readBalancedJsonObject(text: string, startIndex: number): string | null {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
