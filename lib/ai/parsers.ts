export type SocraticCard = {
  concept: string;
  factualClaim: string;
  socraticQuestion: string;
  questionType: 'conceptual' | 'factual' | 'analytical';
  timestamps: {
    startTime: number;
    endTime: number;
  };
};

export function safetyParseSocraticCard(
  rawText: string,
  fallbackTime: { startTime: number; endTime: number },
): SocraticCard {
  let cleaned = rawText.trim();

  // Strip JSON markdown fences if the model generated them despite instructions
  if (cleaned.startsWith('```')) {
    const jsonMatch = /```(?:json)?\s*([\s\S]+?)\s*```/.exec(cleaned);
    if (jsonMatch?.[1]) {
      cleaned = jsonMatch[1].trim();
    }
  }

  try {
    const parsed = JSON.parse(cleaned) as Partial<SocraticCard>;

    const concept = typeof parsed.concept === 'string' && parsed.concept.trim() 
      ? parsed.concept.trim() 
      : 'Key Concept';

    const factualClaim = typeof parsed.factualClaim === 'string' && parsed.factualClaim.trim()
      ? parsed.factualClaim.trim()
      : 'Factual statement from video.';

    const socraticQuestion = typeof parsed.socraticQuestion === 'string' && parsed.socraticQuestion.trim()
      ? parsed.socraticQuestion.trim()
      : 'What is your interpretation of this segment?';

    const questionType = 
      parsed.questionType === 'conceptual' || 
      parsed.questionType === 'factual' || 
      parsed.questionType === 'analytical'
        ? parsed.questionType
        : 'conceptual';

    const timestamps = parsed.timestamps && 
      typeof parsed.timestamps.startTime === 'number' && 
      typeof parsed.timestamps.endTime === 'number'
        ? { startTime: parsed.timestamps.startTime, endTime: parsed.timestamps.endTime }
        : fallbackTime;

    return {
      concept,
      factualClaim,
      socraticQuestion,
      questionType,
      timestamps,
    };
  } catch (error) {
    // If JSON parsing fails entirely, return a graceful fallback structure
    return {
      concept: 'Concept Exploration',
      factualClaim: 'Analysis of key segments.',
      socraticQuestion: 'How would you explain the core concepts discussed in this part of the video?',
      questionType: 'conceptual',
      timestamps: fallbackTime,
    };
  }
}
