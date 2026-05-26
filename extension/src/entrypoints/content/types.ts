import type { TranscriptResult } from '@/utils/transcript';
import type { SocraticCardData } from '@/utils/ai';

export type TranscriptState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  videoId: string | null;
  result: TranscriptResult | null;
  error: string | null;
  
  // Socratic AI pipeline state attributes
  aiStatus: 'idle' | 'fetching' | 'ready' | 'error';
  socraticCard: SocraticCardData | null;
  userAnswer: string;
  savedAnswer: string | null;
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
