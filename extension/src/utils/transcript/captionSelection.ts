import type { CaptionTrack, PlayerResponse } from './types';
import { readTrackLabel } from './youtube';

export function extractCaptionTracks(playerResponse: PlayerResponse | null): CaptionTrack[] {
  const tracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .filter((track) => Boolean(track.baseUrl && track.languageCode))
    .map((track) => ({
      baseUrl: track.baseUrl!.replace(/&amp;/g, '&'),
      languageCode: track.languageCode!,
      label: readTrackLabel(track.name) || track.languageCode!,
      kind: track.kind,
      isTranslatable: track.isTranslatable,
    }));
}

export function selectCaptionTrack(
  tracks: CaptionTrack[],
  requestedLanguage?: string,
): CaptionTrack | null {
  if (tracks.length === 0) return null;

  const findBestTrack = (language: string): CaptionTrack | null => {
    const lang = language.toLowerCase();
    const primary = lang.split('-')[0];
    
    // 1. Try to find manual track with exact language match
    const exactManual = tracks.find(
      (t) => t.languageCode.toLowerCase() === lang && t.kind !== 'asr'
    );
    if (exactManual) return exactManual;

    // 2. Try to find manual track with primary language match
    const primaryManual = tracks.find(
      (t) => t.languageCode.toLowerCase().split('-')[0] === primary && t.kind !== 'asr'
    );
    if (primaryManual) return primaryManual;

    // 3. Fallback to auto-generated track with exact language match
    const exactAsr = tracks.find(
      (t) => t.languageCode.toLowerCase() === lang && t.kind === 'asr'
    );
    if (exactAsr) return exactAsr;

    // 4. Fallback to auto-generated track with primary language match
    const primaryAsr = tracks.find(
      (t) => t.languageCode.toLowerCase().split('-')[0] === primary && t.kind === 'asr'
    );
    if (primaryAsr) return primaryAsr;

    return null;
  };

  if (requestedLanguage) {
    const match = findBestTrack(requestedLanguage);
    if (match) return match;
  }

  const browserLanguage = navigator.language;
  const match = findBestTrack(browserLanguage);
  if (match) return match;

  // English manual fallback
  const englishManual = tracks.find(
    (t) => t.languageCode.toLowerCase().startsWith('en') && t.kind !== 'asr'
  );
  if (englishManual) return englishManual;

  // English auto fallback
  const englishAsr = tracks.find(
    (t) => t.languageCode.toLowerCase().startsWith('en') && t.kind === 'asr'
  );
  if (englishAsr) return englishAsr;

  return tracks.find((t) => t.kind !== 'asr') ?? tracks[0];
}

export function withTranscriptFormat(baseUrl: string): string {
  const url = new URL(baseUrl, 'https://www.youtube.com');
  url.searchParams.set('fmt', 'json3');
  return url.toString();
}
