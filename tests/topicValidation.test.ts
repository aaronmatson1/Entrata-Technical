/**
 * Tests for TopicInput validation logic.
 *
 * The component's validation rules are pure computed properties derived from
 * a single string value. We mirror the exact same logic here as plain
 * functions — this tests the RULES, not the Vue rendering.
 *
 * Rules (from TopicInput.vue):
 *   MIN = 3, MAX = 100
 *   trimmed  = value.trim()
 *   tooShort = trimmed.length > 0 && trimmed.length < MIN
 *   tooLong  = trimmed.length > MAX
 *   empty    = trimmed.length === 0
 *   invalid  = empty || tooShort || tooLong
 *
 * errorMessage logic (only shown after touch):
 *   empty    → 'Enter a topic to continue.'
 *   tooShort → 'Topic must be at least 3 characters.'
 *   tooLong  → 'Topic must be at most 100 characters.'
 *   valid    → null
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Mirror the composable logic as testable pure functions
// ---------------------------------------------------------------------------

const MIN = 3;
const MAX = 100;

function validate(value: string) {
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN;
  const tooLong = trimmed.length > MAX;
  const empty = trimmed.length === 0;
  const invalid = empty || tooShort || tooLong;

  function errorMessage(touched: boolean): string | null {
    if (!touched) return null;
    if (empty) return 'Enter a topic to continue.';
    if (tooShort) return `Topic must be at least ${MIN} characters.`;
    if (tooLong) return `Topic must be at most ${MAX} characters.`;
    return null;
  }

  return { trimmed, tooShort, tooLong, empty, invalid, errorMessage };
}

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('empty string is empty and invalid', () => {
    const v = validate('');
    expect(v.empty).toBe(true);
    expect(v.invalid).toBe(true);
  });

  it('whitespace-only string is treated as empty', () => {
    const v = validate('   ');
    expect(v.empty).toBe(true);
    expect(v.invalid).toBe(true);
  });

  it('shows enter-a-topic error after touch when empty', () => {
    const v = validate('');
    expect(v.errorMessage(true)).toBe('Enter a topic to continue.');
  });

  it('shows no error before touch even when empty', () => {
    const v = validate('');
    expect(v.errorMessage(false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tooShort
// ---------------------------------------------------------------------------

describe('tooShort state', () => {
  it('single character is tooShort', () => {
    const v = validate('x');
    expect(v.tooShort).toBe(true);
    expect(v.invalid).toBe(true);
  });

  it('two characters is tooShort', () => {
    const v = validate('ab');
    expect(v.tooShort).toBe(true);
  });

  it('exactly 3 characters is NOT tooShort', () => {
    const v = validate('abc');
    expect(v.tooShort).toBe(false);
    expect(v.invalid).toBe(false);
  });

  it('whitespace-padded 2-char string is tooShort after trimming', () => {
    const v = validate('  ab  ');
    expect(v.tooShort).toBe(true);
  });

  it('whitespace-padded 3-char string is valid after trimming', () => {
    const v = validate('  abc  ');
    expect(v.tooShort).toBe(false);
    expect(v.invalid).toBe(false);
  });

  it('shows tooShort error after touch', () => {
    const v = validate('ab');
    expect(v.errorMessage(true)).toBe(`Topic must be at least ${MIN} characters.`);
  });
});

// ---------------------------------------------------------------------------
// tooLong
// ---------------------------------------------------------------------------

describe('tooLong state', () => {
  it('101 characters is tooLong', () => {
    const v = validate('x'.repeat(101));
    expect(v.tooLong).toBe(true);
    expect(v.invalid).toBe(true);
  });

  it('exactly 100 characters is NOT tooLong', () => {
    const v = validate('x'.repeat(100));
    expect(v.tooLong).toBe(false);
    expect(v.invalid).toBe(false);
  });

  it('99 characters is valid', () => {
    const v = validate('x'.repeat(99));
    expect(v.tooLong).toBe(false);
    expect(v.invalid).toBe(false);
  });

  it('shows tooLong error after touch', () => {
    const v = validate('x'.repeat(101));
    expect(v.errorMessage(true)).toBe(`Topic must be at most ${MAX} characters.`);
  });
});

// ---------------------------------------------------------------------------
// valid state
// ---------------------------------------------------------------------------

describe('valid state', () => {
  it('a normal topic string is valid', () => {
    const v = validate('photosynthesis');
    expect(v.invalid).toBe(false);
    expect(v.empty).toBe(false);
    expect(v.tooShort).toBe(false);
    expect(v.tooLong).toBe(false);
  });

  it('returns null error message for a valid topic after touch', () => {
    const v = validate('the French Revolution');
    expect(v.errorMessage(true)).toBeNull();
  });

  it('returns null error message for a valid topic before touch', () => {
    const v = validate('photosynthesis');
    expect(v.errorMessage(false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// trimmed value
// ---------------------------------------------------------------------------

describe('trimmed value', () => {
  it('trims leading and trailing whitespace', () => {
    const v = validate('  ancient Rome  ');
    expect(v.trimmed).toBe('ancient Rome');
  });

  it('does not trim internal whitespace', () => {
    const v = validate('ancient   Rome');
    expect(v.trimmed).toBe('ancient   Rome');
  });
});

// ---------------------------------------------------------------------------
// invalid flag is a union of all error states
// ---------------------------------------------------------------------------

describe('invalid is the union of all error conditions', () => {
  it('invalid is false only when trimmed length is between MIN and MAX inclusive', () => {
    expect(validate('').invalid).toBe(true);          // empty
    expect(validate('ab').invalid).toBe(true);         // tooShort
    expect(validate('abc').invalid).toBe(false);       // exactly MIN — valid
    expect(validate('x'.repeat(100)).invalid).toBe(false); // exactly MAX — valid
    expect(validate('x'.repeat(101)).invalid).toBe(true);  // tooLong
  });
});
