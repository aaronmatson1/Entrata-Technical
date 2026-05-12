import { z } from 'zod';

const TOPIC_MIN = 3;
const TOPIC_MAX = 100;

export const classifyRequestSchema = z.object({
  topic: z.string().trim().min(TOPIC_MIN).max(TOPIC_MAX),
});

export const difficultyEnum = z.enum(['easy', 'medium', 'hard']);
export const optionKeyEnum = z.enum(['A', 'B', 'C', 'D']);

export const generateRequestSchema = z.object({
  topic: z.string().trim().min(TOPIC_MIN).max(TOPIC_MAX),
  difficulty: difficultyEnum,
});

export const classifierToolInputSchema = z.object({
  viable: z.boolean(),
  appropriate: z.boolean(),
  intent: z.enum(['legitimate', 'careless', 'deliberate', 'unclear']),
  reason: z.string().max(300),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(5),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
  }),
  correct: optionKeyEnum,
  explanation: z.string().min(5),
});

export const generateQuizToolInputSchema = z.object({
  questions: z.array(questionSchema).length(5),
});

export const refuseTopicToolInputSchema = z.object({
  reason: z.string().min(1),
  category: z.enum(['harmful', 'ungroundable', 'ambiguous']),
});

export const flagRequestSchema = z.object({
  quizId: z.string().min(1),
  questionId: z.string().min(1),
  topic: z.string().min(1),
  category: z.enum(['inaccurate', 'ambiguous', 'poorly_worded', 'other']),
  generatedAt: z.number().int(),
});

export const errorReportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(10000).optional(),
  info: z.string().max(500).optional(),
  route: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});

export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type ClassifierResult = z.infer<typeof classifierToolInputSchema>;
export type GeneratedQuiz = z.infer<typeof generateQuizToolInputSchema>;
export type RefusalResult = z.infer<typeof refuseTopicToolInputSchema>;
