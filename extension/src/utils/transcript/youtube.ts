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

export function readPlayerResponse(): PlayerResponse | null {
  const player = document.querySelector('#movie_player') as
    | (HTMLElement & { getPlayerResponse?: () => PlayerResponse })
    | null;

  try {
    const response = player?.getPlayerResponse?.();
    if (response?.captions || response?.videoDetails) {
      return response;
    }
  } catch {
    // Fall through to script parsing because YouTube alters or sandboxes the JS context regularly.
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
      return JSON.parse(objectText) as PlayerResponse;
    } catch {
      continue;
    }
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
