import type { TranscriptSegment } from './transcript';

export type SocraticCardData = {
  concept: string;
  factualClaim: string;
  socraticQuestion: string;
  questionType: 'conceptual' | 'factual' | 'analytical';
  timestamps: {
    startTime: number;
    endTime: number;
  };
};

export async function fetchSocraticQuestion(params: {
  segment: TranscriptSegment;
  priorConcepts: string[];
  videoId: string;
}): Promise<SocraticCardData> {
  const response = await fetch('http://127.0.0.1:3000/api/socratic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      segment: {
        startTime: params.segment.startTime,
        endTime: params.segment.endTime,
        text: params.segment.text,
      },
      priorConcepts: params.priorConcepts,
      videoId: params.videoId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json() as { error?: string };
    throw new Error(errorData.error || `Socratic API request failed with status ${response.status}.`);
  }

  const payload = await response.json() as { ok: boolean; data: SocraticCardData };
  return payload.data;
}
