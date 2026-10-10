import Anthropic from '@anthropic-ai/sdk';

// Single shared client. Lazily constructed so a missing API key at import time
// doesn't crash the server boot (the /api/chat route handles the no-key case
// explicitly with a graceful degraded response).
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export function hasAnthropicKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return typeof k === 'string' && k.trim().length > 0;
}
