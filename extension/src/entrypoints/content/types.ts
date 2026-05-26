import type { TranscriptResult } from '@/utils/transcript';

export type TranscriptState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  videoId: string | null;
  result: TranscriptResult | null;
  error: string | null;
};

export type TranscriptMessage =
  | {
      type: 'SOCRATES_EXTRACT_TRANSCRIPT';
      force?: boolean;
      languageCode?: string;
    }
  | {
      type: 'SOCRATES_GET_TRANSCRIPT_STATE';
    };
