import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, hasAnthropicKey } from './client.js';
import { TOOLS } from './tools.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { findItem, getMenu } from '../data/menu.js';
// Share the same fuzzy item resolver as OpenAI so Claude mode behaves the same.
import { resolveItem } from './openai.js';
import type {
  CartAction,
  CartLine,
  ChatMessage,
  SelectedModifier,
} from '../types.js';

const addItemInputSchema = z.object({
  item_id: z.string(),
  quantity: z.number().int().min(1).max(20).default(1),
  modifiers: z
    .array(
      z.object({
        group_id: z.string(),
        option_ids: z.array(z.string()),
      }),
    )
    .optional(),
});

const updateQuantityInputSchema = z.object({
  line_id: z.string(),
  quantity: z.number().int().min(0),
});

const removeItemInputSchema = z.object({ line_id: z.string() });

function validateAddItem(input: z.infer<typeof addItemInputSchema>): CartAction | string {
  let item = findItem(input.item_id);
  if (!item) item = resolveItem(input.item_id) ?? undefined;
  if (!item) return `couldn't find "${input.item_id}" on the menu`;

  const cleanModifiers: SelectedModifier[] = [];
  if (input.modifiers) {
    for (const mod of input.modifiers) {
      const group = item.modifierGroups?.find((g) => g.id === mod.group_id);
      if (!group) return `"${item.name}" has no modifier group "${mod.group_id}"`;
      const validOptionIds = new Set(group.options.map((o) => o.id));
      const optionIds = mod.option_ids.filter((oid) => validOptionIds.has(oid));
      if (optionIds.length !== mod.option_ids.length) {
        const bad = mod.option_ids.filter((oid) => !validOptionIds.has(oid));
        return `invalid option(s) for "${group.name}": ${bad.join(', ')}`;
      }
      cleanModifiers.push({ groupId: mod.group_id, optionIds });
    }
  }

  return {
    type: 'add',
    item_id: input.item_id,
    quantity: input.quantity,
    modifiers: cleanModifiers,
  };
}

export async function anthropicParse(input: {
  messages: ChatMessage[];
  cart: { lines: CartLine[] };
}): Promise<{ reply: string; actions: CartAction[] }> {
  if (!hasAnthropicKey()) {
    return {
      reply: 'AI is offline — set ANTHROPIC_API_KEY in backend/.env to enable the Anthropic assistant.',
      actions: [],
    };
  }

  const menu = getMenu();
  const system = buildSystemPrompt({ menu, cart: input.cart });

  const client = getAnthropicClient();
  const result = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    tools: TOOLS,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const textChunks: string[] = [];
  const actions: CartAction[] = [];
  const notes: string[] = [];

  for (const block of result.content) {
    if (block.type === 'text') {
      if (block.text.trim().length > 0) textChunks.push(block.text);
      continue;
    }
    if (block.type !== 'tool_use') continue;
    const tu = block as Anthropic.ToolUseBlock;
    const rawInput = tu.input as unknown;

    switch (tu.name) {
      case 'add_item': {
        const parsedInput = addItemInputSchema.safeParse(rawInput);
        if (!parsedInput.success) {
          notes.push('(note: I tried to add an item but the request was malformed.)');
          break;
        }
        const action = validateAddItem(parsedInput.data);
        if (typeof action === 'string') notes.push(`(note: ${action})`);
        else actions.push(action);
        break;
      }
      case 'update_quantity': {
        const parsedInput = updateQuantityInputSchema.safeParse(rawInput);
        if (!parsedInput.success) {
          notes.push("(note: couldn't update quantity — malformed request.)");
          break;
        }
        actions.push({
          type: 'update',
          line_id: parsedInput.data.line_id,
          quantity: parsedInput.data.quantity,
        });
        break;
      }
      case 'remove_item': {
        const parsedInput = removeItemInputSchema.safeParse(rawInput);
        if (!parsedInput.success) {
          notes.push("(note: couldn't remove item — malformed request.)");
          break;
        }
        actions.push({ type: 'remove', line_id: parsedInput.data.line_id });
        break;
      }
      case 'clear_cart': {
        actions.push({ type: 'clear' });
        break;
      }
      case 'recommend':
        break;
      default:
        notes.push(`(note: unknown tool "${tu.name}" was ignored.)`);
        break;
    }
  }

  let reply = textChunks.join('\n').trim();
  if (notes.length > 0) {
    reply = [reply, notes.join(' ')].filter((s) => s.length > 0).join('\n');
  }
  if (reply.length === 0) {
    if (actions.length > 0) {
      reply = 'Got it — updated your cart.';
    } else {
      reply =
        "Hmm, I didn't catch that — could you tell me which menu item you'd like? " +
        'For example: "add a latte" or "give me a chai".';
    }
  }

  return { reply, actions };
}
