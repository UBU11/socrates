export type TranscriptProxyRequestBody = {
  videoId: string;
  languageCode?: string;
  baseUrl?: string;
};

export type TranscriptCue = {
  start: number;
  duration: number;
  end: number;
  text: string;
};
