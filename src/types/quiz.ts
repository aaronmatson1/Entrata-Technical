export type Difficulty = 'easy' | 'medium' | 'hard';
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type FlagCategory = 'inaccurate' | 'ambiguous' | 'poorly_worded' | 'other';

export interface GeneratedQuestion {
  id: string;
  question: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
  explanation: string;
}

export interface GeneratedQuiz {
  topic: string;
  difficulty: Difficulty;
  questions: GeneratedQuestion[];
}

export interface ClassifierResult {
  viable: boolean;
  appropriate: boolean;
  intent: 'legitimate' | 'careless' | 'deliberate' | 'unclear';
  reason: string;
}

export interface RefusalResult {
  reason: string;
  category: 'harmful' | 'ungroundable' | 'ambiguous';
}

export interface CompletedQuiz {
  id: string;
  topic: string;
  difficulty: Difficulty;
  completedAt: number;
  score: { correct: number; total: number };
  questions: GeneratedQuestion[];
  answers: Record<string, OptionKey>;
  flagged: string[];
}

export interface QuizHistoryEnvelope {
  version: 1;
  quizzes: CompletedQuiz[];
}

export type GenerateStage = 'wikipedia' | 'generating' | 'validating' | 'done' | 'error';

export interface GenerateStreamEvent {
  stage: GenerateStage;
  payload?: GeneratedQuiz | RefusalResult;
  error?: string;
}
