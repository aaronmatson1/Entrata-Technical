import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.js';

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 0, // Q20: own one retry layer in app code, not SDK
    });
  }
  return client;
}
