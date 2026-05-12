function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export const env = {
  get ANTHROPIC_API_KEY(): string {
    return required('ANTHROPIC_API_KEY');
  },
  get UPSTASH_REDIS_REST_URL(): string | undefined {
    return process.env.UPSTASH_REDIS_REST_URL;
  },
  get UPSTASH_REDIS_REST_TOKEN(): string | undefined {
    return process.env.UPSTASH_REDIS_REST_TOKEN;
  },
  get MODEL_CLASSIFIER(): string {
    return optional('ANTHROPIC_MODEL_CLASSIFIER', 'claude-haiku-4-5-20251001');
  },
  get MODEL_GENERATOR(): string {
    return optional('ANTHROPIC_MODEL_GENERATOR', 'claude-sonnet-4-6');
  },
};
