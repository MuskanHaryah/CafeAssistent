import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { regexParse } from '../ai/regexParser.js';
import { openaiParse } from '../ai/openai.js';
import { anthropicParse } from '../ai/anthropic.js';
import type { ChatResponse } from '../types.js';

export const chatRouter = Router();

const selectedModifierSchema = z.object({
  groupId: z.string(),
  optionIds: z.array(z.string()),
});

const cartLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  quantity: z.number().int().min(0),
  modifiers: z.array(selectedModifierSchema),
  unitPrice: z.number().int(),
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  cart: z.object({ lines: z.array(cartLineSchema) }),
});

type ParserMode = 'regex' | 'openai' | 'anthropic';

function resolveMode(): ParserMode {
  const raw = (process.env.PARSER_MODE ?? '').toLowerCase().trim();
  if (raw === 'openai') return 'openai';
  if (raw === 'anthropic' || raw === 'claude') return 'anthropic';
  return 'regex';
}

chatRouter.post('/', async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }

  const mode = resolveMode();
  const input = parsed.data;

  try {
    let result: ChatResponse;
    if (mode === 'openai') {
      result = await openaiParse(input);
    } else if (mode === 'anthropic') {
      result = await anthropicParse(input);
    } else {
      result = await regexParse(input);
    }
    res.setHeader('X-Parser-Mode', mode);
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat:${mode}] failed:`, message);
    return res.status(500).json({ error: 'AI request failed', detail: message, mode });
  }
});
