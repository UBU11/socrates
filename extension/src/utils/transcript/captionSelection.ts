import type { CaptionTrack, PlayerResponse } from './types';
import { readTrackLabel } from './youtube';

export function extractCaptionTracks(playerResponse: PlayerResponse | null): CaptionTrack[] {
  const tracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .filter((track) => Boolean(track.baseUrl && track.languageCode))
    .map((track) => ({
      baseUrl: track.baseUrl!,
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

  if (requestedLanguage) {
    const requested = requestedLanguage.toLowerCase();
    const exact = tracks.find((track) => track.languageCode.toLowerCase() === requested);
    if (exact) return exact;
  }

  const browserLanguage = navigator.language.toLowerCase();
  const browserPrimary = browserLanguage.split('-')[0];
  const browserMatch = tracks.find(
    (track) => track.languageCode.toLowerCase() === browserLanguage,
  );
  if (browserMatch) return browserMatch;

  const browserPrimaryMatch = tracks.find(
    (track) => track.languageCode.toLowerCase().split('-')[0] === browserPrimary,
  );
  if (browserPrimaryMatch) return browserPrimaryMatch;

  const englishManual = tracks.find(
    (track) => track.languageCode.toLowerCase().startsWith('en') && track.kind !== 'asr',
  );
  if (englishManual) return englishManual;

  const english = tracks.find((track) => track.languageCode.toLowerCase().startsWith('en'));
  if (english) return english;

  return tracks.find((track) => track.kind !== 'asr') ?? tracks[0];
}

export function withTranscriptFormat(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('fmt', 'srv3');
  return url.toString();
}
