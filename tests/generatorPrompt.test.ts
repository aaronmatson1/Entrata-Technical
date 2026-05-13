/**
 * Tests for generator prompt — difficulty rubric mapping.
 *
 * The snapshot tests in prompts.test.ts lock the full prompt text.
 * These unit tests verify the STRUCTURAL contracts of buildGeneratorMessages:
 *
 * - Each difficulty level produces a user message that includes the correct
 *   rubric keyword (EASY / MEDIUM / HARD) so the model sees the right level.
 * - validationFeedback is included when provided and absent when not.
 * - The Wikipedia context (title, summary, url) is embedded in the message.
 * - The topic is embedded in the message.
 *
 * These tests are intentionally independent of the full prompt text (which
 * the snapshots own) — they verify the logic branches in buildGeneratorMessages.
 */

import { describe, it, expect } from 'vitest';
import { buildGeneratorMessages } from '../api/_lib/prompts/generator';
import type { Difficulty } from '@/types/quiz';

const BASE_CONTEXT = {
  title: 'Photosynthesis',
  summary: 'Photosynthesis converts light into chemical energy.',
  url: 'https://en.wikipedia.org/wiki/Photosynthesis',
};

// ---------------------------------------------------------------------------
// Difficulty keyword injection
// ---------------------------------------------------------------------------

describe('buildGeneratorMessages — difficulty rubric', () => {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  it.each(difficulties)(
    'includes the uppercased difficulty "%s" in the user message',
    (difficulty) => {
      const messages = buildGeneratorMessages({
        topic: 'Photosynthesis',
        difficulty,
        context: BASE_CONTEXT,
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toContain(`Difficulty: ${difficulty.toUpperCase()}`);
    },
  );

  it('easy message does not contain "MEDIUM" or "HARD" difficulty label', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'easy',
      context: BASE_CONTEXT,
    });
    // The difficulty label line must match "EASY"
    const lines = msg!.content.split('\n');
    const diffLine = lines.find((l) => l.startsWith('Difficulty:'));
    expect(diffLine).toBe('Difficulty: EASY');
  });

  it('hard message difficulty label is exactly "HARD"', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'hard facts',
      difficulty: 'hard',
      context: BASE_CONTEXT,
    });
    const lines = msg!.content.split('\n');
    const diffLine = lines.find((l) => l.startsWith('Difficulty:'));
    expect(diffLine).toBe('Difficulty: HARD');
  });
});

// ---------------------------------------------------------------------------
// Context embedding
// ---------------------------------------------------------------------------

describe('buildGeneratorMessages — context embedding', () => {
  it('embeds the Wikipedia article title', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'medium',
      context: { title: 'My Article Title', summary: 'Summary.', url: 'https://example.com' },
    });
    expect(msg!.content).toContain('My Article Title');
  });

  it('embeds the summary text', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'medium',
      context: { title: 'Title', summary: 'Unique summary content here.', url: 'https://example.com' },
    });
    expect(msg!.content).toContain('Unique summary content here.');
  });

  it('embeds the source URL', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'medium',
      context: { title: 'T', summary: 'S', url: 'https://en.wikipedia.org/wiki/Rome' },
    });
    expect(msg!.content).toContain('https://en.wikipedia.org/wiki/Rome');
  });

  it('embeds the topic', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'ancient Rome',
      difficulty: 'easy',
      context: BASE_CONTEXT,
    });
    expect(msg!.content).toContain('ancient Rome');
  });
});

// ---------------------------------------------------------------------------
// validationFeedback
// ---------------------------------------------------------------------------

describe('buildGeneratorMessages — validationFeedback', () => {
  it('does not include validation feedback block when omitted', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'easy',
      context: BASE_CONTEXT,
    });
    expect(msg!.content).not.toContain('PREVIOUS ATTEMPT FAILED VALIDATION');
  });

  it('includes feedback block when validationFeedback is provided', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'medium',
      context: BASE_CONTEXT,
      validationFeedback: 'questions: must contain exactly 5 items',
    });
    expect(msg!.content).toContain('PREVIOUS ATTEMPT FAILED VALIDATION');
    expect(msg!.content).toContain('questions: must contain exactly 5 items');
  });

  it('instructs regeneration when feedback is present', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'hard',
      context: BASE_CONTEXT,
      validationFeedback: 'correct must be A, B, C, or D',
    });
    expect(msg!.content).toContain('Regenerate, correcting the issue.');
  });

  it('does not include "Regenerate" instruction when no feedback', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Photosynthesis',
      difficulty: 'easy',
      context: BASE_CONTEXT,
    });
    expect(msg!.content).not.toContain('Regenerate');
  });
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe('buildGeneratorMessages — return shape', () => {
  it('always returns exactly one message', () => {
    const messages = buildGeneratorMessages({
      topic: 'Test',
      difficulty: 'medium',
      context: BASE_CONTEXT,
    });
    expect(messages).toHaveLength(1);
  });

  it('returned message has role "user"', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Test',
      difficulty: 'medium',
      context: BASE_CONTEXT,
    });
    expect(msg!.role).toBe('user');
  });

  it('content is a non-empty string', () => {
    const [msg] = buildGeneratorMessages({
      topic: 'Test',
      difficulty: 'easy',
      context: BASE_CONTEXT,
    });
    expect(typeof msg!.content).toBe('string');
    expect(msg!.content.length).toBeGreaterThan(0);
  });
});
