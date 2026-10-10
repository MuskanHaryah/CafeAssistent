import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { buildSystemPrompt } from './systemPrompt.js';
import { findItem, getMenu, MENU } from '../data/menu.js';
import type { CartAction, CartLine, ChatMessage, MenuItem, SelectedModifier } from '../types.js';

// ---- Fuzzy item resolution ------------------------------------------------
// The LLM sometimes passes display-friendly strings instead of strict item_ids
// (e.g. "sandwich" instead of "avocado-toast", "Latte" instead of "latte").
// We accept those by:
//   1. trying the exact id (current behavior)
//   2. case-insensitive id match
//   3. name match (case-insensitive, contains)
//   4. category match — but ONLY when exactly one item is in that category
//   5. token-overlap fallback (e.g. "cold" -> "cold-brew")

function normalizeId(s: string): string {
  return s.toLowerCase().trim().replace(/[\s_]+/g, '-');
}

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

export function resolveItem(raw: string): MenuItem | null {
  if (!raw) return null;
  const norm = normalizeId(raw);

  // 1. exact id
  const exact = MENU.find((it) => it.id === norm);
  if (exact) return exact;

  // 2. name (case-insensitive, includes)
  const lower = raw.toLowerCase().trim();
  const byName = MENU.filter((it) => it.name.toLowerCase() === lower);
  if (byName.length === 1) return byName[0];
  const nameContains = MENU.filter((it) => it.name.toLowerCase().includes(lower));
  if (nameContains.length === 1) return nameContains[0];

  // 3. single-item category match — "sandwich" -> avocado-toast
  const catMatches = MENU.filter((it) =>
    it.category.toLowerCase().startsWith(lower) ||
    lower.startsWith(it.category.toLowerCase()),
  );
  if (catMatches.length === 1) return catMatches[0];
  // also try singular -> plural and vice versa for category
  const lowerPlural = lower.endsWith('s') ? lower : `${lower}s`;
  const catMatches2 = MENU.filter((it) => it.category.toLowerCase() === lowerPlural);
  if (catMatches2.length === 1) return catMatches2[0];

  // 4. token overlap on name
  const wanted = new Set(tokens(raw));
  if (wanted.size === 0) return null;
  let best: { item: MenuItem; score: number } | null = null;
  for (const it of MENU) {
    const itTokens = tokens(it.name);
    let score = 0;
    for (const t of itTokens) if (wanted.has(t)) score++;
    if (score > 0 && (!best || score > best.score)) best = { item: it, score };
  }
  return best?.item ?? null;
}

// Tool definitions (OpenAI function-calling schema). Mirrors the Anthropic
// tool set in ./tools.ts; snake_case argument names are translated to the
// camelCase CartAction shape inside this file.
const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_item',
      description:
        'Add a menu item to the cart. Use the EXACT item_id from the menu (never invent ids or use the display name). ' +
        'For drinks with a required Size or Milk modifier group, you MUST include those modifiers. ' +
        'If the user did not specify, pick a sensible default (Medium size, Whole milk) and mention it in your text reply. ' +
        'Each modifier references the group by its exact group_id and one or more option_ids that belong to that group. ' +
        'You may call this tool multiple times in one turn to add several different items at once.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'Exact menu item id (e.g. "latte").' },
          quantity: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            default: 1,
            description: 'How many of this configured item to add. Defaults to 1.',
          },
          modifiers: {
            type: 'array',
            description: 'Selected modifier groups. Use exact group_id and option_id values.',
            items: {
              type: 'object',
              properties: {
                group_id: { type: 'string' },
                option_ids: { type: 'array', items: { type: 'string' } },
              },
              required: ['group_id', 'option_ids'],
              additionalProperties: false,
            },
          },
        },
        required: ['item_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_quantity',
      description:
        'Change the quantity of an existing cart line. Use the cart line_id (not item name). ' +
        'Passing quantity: 0 removes the line.',
      parameters: {
        type: 'object',
        properties: {
          line_id: { type: 'string' },
          quantity: { type: 'integer', minimum: 0 },
        },
        required: ['line_id', 'quantity'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_item',
      description:
        'Remove a specific cart line entirely. Use the cart line_id (not item name). ' +
        'Prefer this over update_quantity:0 when the user says "remove the latte".',
      parameters: {
        type: 'object',
        properties: { line_id: { type: 'string' } },
        required: ['line_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_cart',
      description:
        'Empty the entire cart. Only when the user clearly wants to start over ("clear my cart", "cancel everything").',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend',
      description:
        'Non-mutating suggestion. Use when the user asks "what\'s good?" or wants a recommendation BEFORE adding it. ' +
        'After calling this, describe the recommendation in your text reply and ask if they want it added.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['item_id', 'reason'],
        additionalProperties: false,
      },
    },
  },
];

// ---- Argument-parsing helpers ----------------------------------------------

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  return {};
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

type RawModifier = { group_id: string; option_ids: string[] };

function asModifiers(v: unknown): RawModifier[] {
  if (!Array.isArray(v)) return [];
  const out: RawModifier[] = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') continue;
    const obj = m as Record<string, unknown>;
    const gid = asString(obj.group_id);
    const opts = Array.isArray(obj.option_ids)
      ? obj.option_ids.filter((x): x is string => typeof x === 'string')
      : null;
    if (!gid || !opts) continue;
    out.push({ group_id: gid, option_ids: opts });
  }
  return out;
}

// Validate an add_item against the live menu. Returns either a CartAction or a
// short human-readable reason it was rejected. Uses fuzzy resolution so the LLM
// can pass display names ("Latte") or category words ("sandwich") and still hit
// the right item.
function validateAddItem(args: {
  item_id: string;
  quantity: number;
  modifiers: RawModifier[];
}): CartAction | string {
  let item = findItem(args.item_id);
  if (!item) item = resolveItem(args.item_id) ?? undefined;
  if (!item) return `couldn't find "${args.item_id}" on the menu`;

  const cleanModifiers: SelectedModifier[] = [];
  for (const mod of args.modifiers) {
    const group = item.modifierGroups?.find((g) => g.id === mod.group_id);
    if (!group) return `"${item.name}" has no modifier group "${mod.group_id}"`;
    const valid = new Set(group.options.map((o) => o.id));
    const bad = mod.option_ids.filter((o) => !valid.has(o));
    if (bad.length > 0) return `invalid option(s) for "${group.name}": ${bad.join(', ')}`;
    cleanModifiers.push({ groupId: mod.group_id, optionIds: mod.option_ids });
  }

  return {
    type: 'add',
    item_id: args.item_id,
    quantity: args.quantity,
    modifiers: cleanModifiers,
  };
}

// ---- Public entry point ----------------------------------------------------

export async function openaiParse(input: {
  messages: ChatMessage[];
  cart: { lines: CartLine[] };
}): Promise<{ reply: string; actions: CartAction[] }> {
  // 1. Missing-key graceful path. Do this BEFORE constructing the client.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      reply:
        'AI is offline — set OPENAI_API_KEY in backend/.env to enable the OpenAI assistant.',
      actions: [],
    };
  }

  // 2. Lazy-construct the client.
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  // 3. Build messages (system + history).
  const system = buildSystemPrompt({ menu: getMenu(), cart: input.cart });
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...input.messages.map(
      (m): ChatCompletionMessageParam => ({ role: m.role, content: m.content }),
    ),
  ];

  // 4. Call the API. Errors bubble up to the caller.
  const response = await client.chat.completions.create({
    model,
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
  });

  const msg = response.choices[0]?.message;
  const toolCalls = msg?.tool_calls ?? [];

  // 5. Translate tool_calls → CartActions (validating add_item against menu).
  const actions: CartAction[] = [];
  const notes: string[] = [];
  const recommendReasons: string[] = [];

  for (const call of toolCalls) {
    if (call.type !== 'function') continue;
    const args = parseArgs(call.function.arguments);

    switch (call.function.name) {
      case 'add_item': {
        const item_id = asString(args.item_id);
        if (!item_id) {
          notes.push('(note: I tried to add an item but the request was malformed.)');
          break;
        }
        const validated = validateAddItem({
          item_id,
          quantity: asInt(args.quantity, 1, 1, 20),
          modifiers: asModifiers(args.modifiers),
        });
        if (typeof validated === 'string') notes.push(`(note: ${validated})`);
        else actions.push(validated);
        break;
      }
      case 'update_quantity': {
        const line_id = asString(args.line_id);
        const quantity = asInt(args.quantity, -1, 0, 999);
        if (!line_id || quantity < 0) {
          notes.push("(note: couldn't update quantity — malformed request.)");
          break;
        }
        actions.push({ type: 'update', line_id, quantity });
        break;
      }
      case 'remove_item': {
        const line_id = asString(args.line_id);
        if (!line_id) {
          notes.push("(note: couldn't remove item — malformed request.)");
          break;
        }
        actions.push({ type: 'remove', line_id });
        break;
      }
      case 'clear_cart': {
        actions.push({ type: 'clear' });
        break;
      }
      case 'recommend': {
        const reason = asString(args.reason);
        if (reason) recommendReasons.push(reason);
        break;
      }
      default: {
        notes.push(`(note: unknown tool "${call.function.name}" was ignored.)`);
        break;
      }
    }
  }

  // 6. Assemble the reply text.
  let reply = (msg?.content ?? '').trim();
  if (reply.length === 0 && recommendReasons.length > 0) reply = recommendReasons.join(' ');
  if (notes.length > 0) reply = [reply, notes.join(' ')].filter((s) => s.length > 0).join('\n');

  // Fallback chain — never return an empty reply, never a generic "Done!" that
  // tells the user nothing. If we have actions, confirm them; otherwise admit
  // we didn't catch the request and ask for a rephrase.
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
