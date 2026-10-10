// Deterministic, regex/keyword-based natural-language parser for cart actions.
// Free fallback — no LLM, no API key. Interchangeable with the Claude-backed parser.

import type {
  ChatMessage,
  CartLine,
  CartAction,
  SelectedModifier,
  MenuItem,
  ModifierGroup,
} from '../types.js';
import { MENU, findItem } from '../data/menu.js';

// ---- Vocabulary ----

const ADD_VERBS = [
  "i'd like",
  "i'll have",
  'i would like',
  'i want',
  'can i get',
  'could i get',
  'give me',
  'make me',
  'pour me',
  'grab me',
  'add',
  'order',
  'get',
];

const REMOVE_VERBS = [
  'take off',
  'take out',
  'cancel the',
  'no more',
  'remove',
  'delete',
  'drop',
];

const CLEAR_PHRASES = [
  'remove everything',
  'clear my cart',
  'clear the cart',
  'clear cart',
  'empty cart',
  'empty my cart',
  'empty the cart',
  'start over',
  'reset cart',
  'cancel everything',
  'cancel my order',
  'nevermind',
  'never mind',
  'nothing',
  'clear',
  'empty',
];

const RECOMMEND_PHRASES = [
  "what's popular",
  'whats popular',
  "what's good",
  'whats good',
  'recommend',
  'suggest',
  'surprise me',
  'what do you have',
  'what should i get',
  'what should i order',
];

const SPLIT_REGEX = /\s*(?:,|&|\+|\band\b|\bplus\b|\balso\b)\s*/i;

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
  few: 3,
  dozen: 12,
};

const SIZE_ALIASES: Record<string, string> = {
  small: 'sm',
  sm: 'sm',
  medium: 'md',
  med: 'md',
  md: 'md',
  regular: 'md',
  large: 'lg',
  lg: 'lg',
  big: 'lg',
};

const MILK_ALIASES: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /\boat(?:\s*milk)?\b/i, id: 'oat' },
  { pattern: /\balmond(?:\s*milk)?\b/i, id: 'almond' },
  { pattern: /\bsoy(?:\s*milk)?\b/i, id: 'soy' },
  { pattern: /\bwhole(?:\s*milk)?\b/i, id: 'whole' },
  { pattern: /\b(?:2%|two\s*percent|two-percent)\b/i, id: 'two' },
  { pattern: /\b(?:skim|nonfat|non-fat|fat-free)\b/i, id: 'skim' },
];

const SYRUP_KEYWORDS = ['vanilla', 'caramel', 'hazelnut', 'lavender', 'honey'];

const EXTRA_ALIASES: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /\b(?:extra\s+shot|double\s+shot|extra\s+espresso)\b/i, id: 'shot' },
  { pattern: /\b(?:decaf|decaffeinated)\b/i, id: 'decaf' },
  { pattern: /\b(?:whipped\s+cream|whipped|whip)\b/i, id: 'whip' },
];

const FILLER_WORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'please',
  'pls',
  'with',
  'and',
  'to',
  'me',
  'my',
  'some',
  'just',
  'order',
  'have',
  'get',
  'want',
  'like',
  'add',
  'extra',
  'double',
  'shot',
  'milk',
  'iced',
  'hot',
  'cup',
  'cups',
]);

// ---- Helpers ----

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w%\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function getLastUserMessage(messages: ChatMessage[]): string | null {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  if (last.role !== 'user') return null;
  return last.content;
}

function getGroup(item: MenuItem, groupId: string): ModifierGroup | undefined {
  return item.modifierGroups?.find((g) => g.id === groupId);
}

function getOption(group: ModifierGroup, optId: string) {
  return group.options.find((o) => o.id === optId);
}

function optionName(item: MenuItem, groupId: string, optId: string): string {
  const g = getGroup(item, groupId);
  if (!g) return optId;
  return getOption(g, optId)?.name ?? optId;
}

// ---- Matching ----

function matchItem(fragment: string): MenuItem | null {
  const lower = fragment.toLowerCase();

  // 1. Exact id match
  for (const item of MENU) {
    const re = new RegExp(`\\b${item.id.replace(/-/g, '[-\\s]?')}\\b`, 'i');
    if (re.test(lower)) return item;
  }

  // 2. Exact name substring (prefer longest)
  const nameHits = MENU.filter((it) => lower.includes(it.name.toLowerCase()));
  if (nameHits.length > 0) {
    nameHits.sort((a, b) => b.name.length - a.name.length);
    return nameHits[0];
  }

  // 3. Token overlap
  const inputTokens = new Set(tokenize(fragment).filter((t) => !FILLER_WORDS.has(t)));
  let best: { item: MenuItem; score: number } | null = null;
  for (const item of MENU) {
    const itemTokens = tokenize(item.name);
    let score = 0;
    for (const t of itemTokens) {
      if (inputTokens.has(t)) score++;
    }
    if (score > 0) {
      if (
        !best ||
        score > best.score ||
        (score === best.score && item.basePrice < best.item.basePrice)
      ) {
        best = { item, score };
      }
    }
  }
  return best?.item ?? null;
}

function matchCartLine(fragment: string, lines: CartLine[]): CartLine | null {
  if (lines.length === 0) return null;
  const inputTokens = new Set(tokenize(fragment).filter((t) => !FILLER_WORDS.has(t)));
  let best: { line: CartLine; score: number } | null = null;
  for (const line of lines) {
    const item = findItem(line.itemId);
    if (!item) continue;
    const itemTokens = tokenize(item.name);
    let score = 0;
    for (const t of itemTokens) {
      if (inputTokens.has(t)) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { line, score };
    }
  }
  return best?.line ?? null;
}

// ---- Extract modifiers + qty from one fragment ----

type FragmentParse = {
  quantity: number;
  modifiers: SelectedModifier[];
  defaultedGroups: string[]; // group ids where we filled in a default
};

function extractFragment(fragment: string, item: MenuItem): FragmentParse {
  const lower = fragment.toLowerCase();
  const tokens = tokenize(fragment);

  // Quantity: digits first, then number words
  let quantity = 1;
  const digitMatch = lower.match(/\b(\d+)\b/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (n > 0 && n < 1000) quantity = n;
  } else {
    for (const t of tokens) {
      if (t in NUMBER_WORDS) {
        quantity = NUMBER_WORDS[t];
        break;
      }
    }
  }

  const modifiers: SelectedModifier[] = [];
  const defaultedGroups: string[] = [];

  // Size
  const sizeGroup = getGroup(item, 'size');
  if (sizeGroup) {
    let sizeId: string | null = null;
    for (const t of tokens) {
      if (t in SIZE_ALIASES) {
        sizeId = SIZE_ALIASES[t];
        break;
      }
    }
    if (sizeId) {
      // Make sure the option exists on this item's size group, else fall back to md
      if (!getOption(sizeGroup, sizeId)) {
        if (getOption(sizeGroup, 'md')) sizeId = 'md';
        else sizeId = sizeGroup.options[0].id;
      }
      modifiers.push({ groupId: 'size', optionIds: [sizeId] });
    } else if (sizeGroup.required) {
      const def = getOption(sizeGroup, 'md') ? 'md' : sizeGroup.options[0].id;
      modifiers.push({ groupId: 'size', optionIds: [def] });
      defaultedGroups.push('size');
    }
  }

  // Milk
  const milkGroup = getGroup(item, 'milk');
  if (milkGroup) {
    let milkId: string | null = null;
    for (const alias of MILK_ALIASES) {
      if (alias.pattern.test(lower) && getOption(milkGroup, alias.id)) {
        milkId = alias.id;
        break;
      }
    }
    if (milkId) {
      modifiers.push({ groupId: 'milk', optionIds: [milkId] });
    } else if (milkGroup.required) {
      const def = getOption(milkGroup, 'whole') ? 'whole' : milkGroup.options[0].id;
      modifiers.push({ groupId: 'milk', optionIds: [def] });
      defaultedGroups.push('milk');
    }
  }

  // Syrups
  const syrupGroup = getGroup(item, 'syrups');
  if (syrupGroup) {
    const found: string[] = [];
    for (const s of SYRUP_KEYWORDS) {
      if (new RegExp(`\\b${s}\\b`, 'i').test(lower) && getOption(syrupGroup, s)) {
        found.push(s);
      }
    }
    if (found.length > 0) {
      modifiers.push({ groupId: 'syrups', optionIds: found });
    }
  }

  // Extras
  const extrasGroup = getGroup(item, 'extras');
  if (extrasGroup) {
    const found: string[] = [];
    for (const alias of EXTRA_ALIASES) {
      if (alias.pattern.test(lower) && getOption(extrasGroup, alias.id)) {
        if (!found.includes(alias.id)) found.push(alias.id);
      }
    }
    if (found.length > 0) {
      modifiers.push({ groupId: 'extras', optionIds: found });
    }
  }

  return { quantity, modifiers, defaultedGroups };
}

// ---- Reply text rendering ----

function describeAdd(item: MenuItem, qty: number, modifiers: SelectedModifier[]): string {
  const parts: string[] = [];
  const sizeMod = modifiers.find((m) => m.groupId === 'size');
  if (sizeMod && sizeMod.optionIds[0]) {
    const n = optionName(item, 'size', sizeMod.optionIds[0]);
    // strip parenthesized volume, keep just the size word
    parts.push(n.replace(/\s*\(.*?\)\s*/g, '').toLowerCase());
  }
  const milkMod = modifiers.find((m) => m.groupId === 'milk');
  if (milkMod && milkMod.optionIds[0]) {
    parts.push(optionName(item, 'milk', milkMod.optionIds[0]).toLowerCase());
  }
  parts.push(qty > 1 ? `${item.name.toLowerCase()}s` : item.name.toLowerCase());
  const head = qty > 1 ? `${qty} ` : 'a ';
  return head + parts.join(' ');
}

// ---- Intent detection ----

function startsWithAny(text: string, phrases: string[]): string | null {
  for (const p of phrases) {
    if (text.startsWith(p + ' ') || text === p) return p;
  }
  return null;
}

function includesAny(text: string, phrases: string[]): string | null {
  for (const p of phrases) {
    if (new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return p;
  }
  return null;
}

// ---- Main entry point ----

export async function regexParse(input: {
  messages: ChatMessage[];
  cart: { lines: CartLine[] };
}): Promise<{ reply: string; actions: CartAction[] }> {
  const raw = getLastUserMessage(input.messages);
  if (!raw) return { reply: 'Hmm?', actions: [] };

  const text = normalize(raw);
  const cart = input.cart.lines;

  // 1. CLEAR — check whole-message match first
  if (CLEAR_PHRASES.some((p) => text === p || text === p + '.')) {
    return { reply: 'Cleared your cart.', actions: [{ type: 'clear' }] };
  }

  // 2. RECOMMEND
  if (includesAny(text, RECOMMEND_PHRASES)) {
    const popular = MENU.filter((it) => it.tags?.some((t) => t === 'popular' || t === 'new'));
    const picks = (popular.length >= 2 ? popular : MENU).slice(0, 2);
    if (picks.length >= 2) {
      return {
        reply: `Try our **${picks[0].name}** — it's a customer favorite. Or the **${picks[1].name}** if you want something different.`,
        actions: [],
      };
    }
    return { reply: `Try our **${picks[0].name}**.`, actions: [] };
  }

  // 3. UPDATE quantity — check before remove/add (more specific patterns)
  const updateResult = tryUpdate(text, cart);
  if (updateResult) return updateResult;

  // 4. REMOVE
  const removeVerb = REMOVE_VERBS.find((v) => text.startsWith(v + ' ') || text.includes(' ' + v + ' '));
  if (removeVerb) {
    return doRemove(text, cart);
  }

  // 5. ADD
  const addVerb = startsWithAny(text, ADD_VERBS);
  if (addVerb) {
    return doAdd(text.slice(addVerb.length).trim(), cart);
  }
  // Also try if any add verb appears at start (handles trailing punctuation/whitespace)
  for (const v of ADD_VERBS) {
    if (text.startsWith(v)) {
      const rest = text.slice(v.length).trim();
      if (rest.length > 0) return doAdd(rest, cart);
    }
  }

  // 6. Default
  return {
    reply:
      'I can add items, remove them, change quantities, or clear your cart. Try "add a large oat latte".',
    actions: [],
  };
}

// ---- UPDATE ----

function tryUpdate(text: string, cart: CartLine[]): { reply: string; actions: CartAction[] } | null {
  // "double my order"
  if (/\bdouble\s+(?:my|the)\s+order\b/i.test(text)) {
    if (cart.length === 0) return { reply: "Your cart's empty.", actions: [] };
    const actions: CartAction[] = cart.map((l) => ({
      type: 'update' as const,
      line_id: l.id,
      quantity: l.quantity * 2,
    }));
    return { reply: 'Doubled your order.', actions };
  }

  // "N more X" / "N less X"
  const moreLess = text.match(/\b(\w+)\s+(more|less|fewer)\s+(.+)/i);
  if (moreLess) {
    const nWord = moreLess[1].toLowerCase();
    const direction = moreLess[2].toLowerCase();
    const itemPart = moreLess[3];
    let delta: number | null = null;
    if (/^\d+$/.test(nWord)) delta = parseInt(nWord, 10);
    else if (nWord in NUMBER_WORDS) delta = NUMBER_WORDS[nWord];
    if (delta != null) {
      const line = matchCartLine(itemPart, cart);
      if (!line) {
        return {
          reply: `I couldn't find "${itemPart}" in your cart.`,
          actions: [],
        };
      }
      const sign = direction === 'more' ? 1 : -1;
      const newQty = Math.max(0, line.quantity + sign * delta);
      if (newQty === 0) {
        return { reply: 'Removed it from your cart.', actions: [{ type: 'remove', line_id: line.id }] };
      }
      return {
        reply: `Updated to ${newQty}.`,
        actions: [{ type: 'update', line_id: line.id, quantity: newQty }],
      };
    }
  }

  // "make/change/update/set ... <qty>"  e.g. "make my latte 3", "make it two lattes", "change the muffin to 4"
  if (/^(make|change|update|set)\b/i.test(text)) {
    // Try "make X N" or "make X to N" patterns
    const trailingNum = text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*$/i);
    const leadingNum = text.match(
      /^(?:make|change|update|set)\s+(?:it\s+|my\s+|the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)/i,
    );
    if (leadingNum) {
      const qtyTok = leadingNum[1].toLowerCase();
      const qty = /^\d+$/.test(qtyTok) ? parseInt(qtyTok, 10) : NUMBER_WORDS[qtyTok];
      const itemPart = leadingNum[2];
      const line = matchCartLine(itemPart, cart);
      if (line && qty) {
        return {
          reply: `Updated to ${qty}.`,
          actions: [{ type: 'update', line_id: line.id, quantity: qty }],
        };
      }
    }
    if (trailingNum) {
      const qtyTok = trailingNum[1].toLowerCase();
      const qty = /^\d+$/.test(qtyTok) ? parseInt(qtyTok, 10) : NUMBER_WORDS[qtyTok];
      // strip "make/change/update/set" and the trailing number
      const middle = text
        .replace(/^(make|change|update|set)\b/i, '')
        .replace(/\b(my|the|it|to)\b/gi, ' ')
        .replace(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*$/i, '')
        .trim();
      const line = matchCartLine(middle, cart);
      if (line && qty) {
        return {
          reply: `Updated to ${qty}.`,
          actions: [{ type: 'update', line_id: line.id, quantity: qty }],
        };
      }
    }
  }

  return null;
}

// ---- REMOVE ----

function doRemove(text: string, cart: CartLine[]): { reply: string; actions: CartAction[] } {
  // "remove everything" handled in main, but double-check here
  if (/\b(remove\s+everything|remove\s+all|delete\s+everything|delete\s+all)\b/i.test(text)) {
    return { reply: 'Cleared your cart.', actions: [{ type: 'clear' }] };
  }

  // Strip remove verb prefix to get item reference
  let rest = text;
  for (const v of REMOVE_VERBS) {
    if (rest.startsWith(v + ' ')) {
      rest = rest.slice(v.length).trim();
      break;
    }
    const idx = rest.indexOf(' ' + v + ' ');
    if (idx >= 0) {
      rest = rest.slice(idx + v.length + 2).trim();
      break;
    }
  }

  if (cart.length === 0) {
    return { reply: "Your cart's already empty.", actions: [] };
  }

  // Count matches to detect ambiguity
  const inputTokens = new Set(tokenize(rest).filter((t) => !FILLER_WORDS.has(t)));
  const candidates: Array<{ line: CartLine; score: number }> = [];
  for (const line of cart) {
    const item = findItem(line.itemId);
    if (!item) continue;
    const itemTokens = tokenize(item.name);
    let score = 0;
    for (const t of itemTokens) if (inputTokens.has(t)) score++;
    if (score > 0) candidates.push({ line, score });
  }
  if (candidates.length === 0) {
    return {
      reply: `I couldn't find "${rest}" in your cart.`,
      actions: [],
    };
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked = candidates[0].line;
  const item = findItem(picked.itemId);
  const note =
    candidates.length > 1 ? ' (multiple matched — removed the first one)' : '';
  return {
    reply: `Took the ${item?.name.toLowerCase() ?? 'item'} off your order.${note}`,
    actions: [{ type: 'remove', line_id: picked.id }],
  };
}

// ---- ADD ----

function doAdd(body: string, _cart: CartLine[]): { reply: string; actions: CartAction[] } {
  const fragments = body.split(SPLIT_REGEX).map((f) => f.trim()).filter(Boolean);
  if (fragments.length === 0) {
    return { reply: "What would you like?", actions: [] };
  }

  const actions: CartAction[] = [];
  const descriptions: string[] = [];
  const unrecognized: string[] = [];
  let anyDefaulted = false;

  for (const frag of fragments) {
    const item = matchItem(frag);
    if (!item) {
      unrecognized.push(frag);
      continue;
    }
    const parsed = extractFragment(frag, item);
    actions.push({
      type: 'add',
      item_id: item.id,
      quantity: parsed.quantity,
      modifiers: parsed.modifiers,
    });
    descriptions.push(describeAdd(item, parsed.quantity, parsed.modifiers));
    if (parsed.defaultedGroups.length > 0) anyDefaulted = true;
  }

  if (actions.length === 0) {
    return {
      reply: `I couldn't find "${unrecognized.join(', ')}" on the menu.`,
      actions: [],
    };
  }

  // Build reply
  let reply: string;
  if (descriptions.length === 1) {
    reply = `Added ${descriptions[0]} — anything else?`;
  } else {
    const last = descriptions[descriptions.length - 1];
    const head = descriptions.slice(0, -1).join(', ');
    reply = `Added ${head} and ${last} — anything else?`;
  }
  if (unrecognized.length > 0) {
    reply += ` (I couldn't find "${unrecognized.join(', ')}" on the menu.)`;
  }
  if (anyDefaulted) {
    reply += ' (Going with defaults — say the word to change.)';
  }

  return { reply, actions };
}
