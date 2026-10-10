import type { CartLine, MenuItem, MenuResponse, ModifierGroup } from '../types.js';

// Format cents as a human-readable $X.XX string.
function fmtPrice(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${dollars}.${remainder}`;
}

// Format a price *delta* explicitly with sign so options like "+$0.75" are obvious.
function fmtDelta(cents: number): string {
  if (cents === 0) return '+$0.00';
  if (cents > 0) return `+${fmtPrice(cents)}`;
  return `-${fmtPrice(Math.abs(cents))}`;
}

function renderGroup(group: ModifierGroup): string {
  const kind = group.type === 'single' ? 'required-single' : 'optional-multi';
  const reqLabel = group.required ? 'required' : 'optional';
  const header = `    - group_id="${group.id}"  name="${group.name}"  kind=${kind}  (${reqLabel})`;
  const opts = group.options
    .map((o) => `        * option_id="${o.id}"  name="${o.name}"  delta=${fmtDelta(o.priceDelta)}`)
    .join('\n');
  return `${header}\n${opts}`;
}

function renderItem(item: MenuItem): string {
  const tagPart = item.tags && item.tags.length > 0 ? `  tags=[${item.tags.join(', ')}]` : '';
  const head = `- item_id="${item.id}"  name="${item.name}"  base=${fmtPrice(item.basePrice)}  category="${item.category}"${tagPart}`;
  const desc = `    description: ${item.description}`;
  const groups =
    item.modifierGroups && item.modifierGroups.length > 0
      ? `\n    modifier_groups:\n${item.modifierGroups.map(renderGroup).join('\n')}`
      : '\n    modifier_groups: (none)';
  return `${head}\n${desc}${groups}`;
}

function renderMenu(menu: MenuResponse): string {
  return menu.items.map(renderItem).join('\n\n');
}

function renderCart(cart: { lines: CartLine[] }, menu: MenuResponse): string {
  if (cart.lines.length === 0) return 'Cart is currently empty.';
  const itemsById = new Map(menu.items.map((i) => [i.id, i] as const));
  return cart.lines
    .map((line) => {
      const item = itemsById.get(line.itemId);
      const itemName = item ? item.name : line.itemId;
      const modSummary =
        line.modifiers.length === 0
          ? '(no modifiers)'
          : line.modifiers
              .map((m) => {
                const group = item?.modifierGroups?.find((g) => g.id === m.groupId);
                const optNames = m.optionIds
                  .map((oid) => group?.options.find((o) => o.id === oid)?.name ?? oid)
                  .join(', ');
                const groupName = group?.name ?? m.groupId;
                return `${groupName}: ${optNames}`;
              })
              .join('; ');
      return `- line_id="${line.id}"  item="${itemName}"  qty=${line.quantity}  unitPrice=${fmtPrice(line.unitPrice)}  modifiers={${modSummary}}`;
    })
    .join('\n');
}

export function buildSystemPrompt(args: {
  menu: MenuResponse;
  cart: { lines: CartLine[] };
}): string {
  const { menu, cart } = args;

  // Compact "name -> id" quick-lookup so the LLM doesn't have to scan the full
  // menu block to find a string match. This makes single-token requests like
  // "add a sandwich" or "add chai" resolve reliably on the first try.
  const idIndex = menu.items
    .map((it) => `  "${it.name}" -> item_id="${it.id}"  (category: ${it.category})`)
    .join('\n');

  return `You are the friendly barista assistant for a cozy coffee shop. Keep replies short (1–2 sentences), warm, and confident.

# How to respond — decide which case applies first
1. **User asks for something ON the menu** (matches a name or category in the lookup below):
   - Call \`add_item\` (or \`update_quantity\`, \`remove_item\`, \`clear_cart\`) with the EXACT \`item_id\` from the lookup.
   - Multiple items in one message → emit multiple \`add_item\` calls in the SAME turn.
   - Also reply with one short warm sentence (e.g. "Adding a Latte and a muffin — anything else?").
   - For category words ("sandwich", "muffin", "pastry"), use the menu lookup below to map to the right item_id. A sandwich = avocado-toast. A muffin = blueberry-muffin.

2. **User asks for something NOT on the menu** (water, soda, espresso martini, food we don't serve):
   - Do NOT call any tools.
   - Reply with a short polite text like: "Sorry, we don't have water — but we do have iced cold brew or a hot chocolate if you'd like."
   - ALWAYS reply with a non-empty sentence in this case. Never return an empty reply.

3. **User's request is ambiguous** ("the usual", "surprise me", "make it special", "a pastry" when there are multiple):
   - Do NOT call any tools.
   - Ask one short clarifying question in your text reply.

4. **User is just chatting / asking a question** ("what's good?", "hi"):
   - Reply in text. Optionally call \`recommend\` if suggesting one specific item.

# Hard rules
- Always use \`item_id\` / \`group_id\` / \`option_id\` values EXACTLY as they appear in the menu lookup below. Never invent ids; never use display names as ids.
- For drinks with a required Size or Milk modifier group, you MUST include those modifiers. If the user didn't specify, default to Medium size + Whole milk and mention it.
- When modifying or removing existing items, use the cart \`line_id\` (not item names).
- Prices: mention dollars in text ("$5.50"), even though they're stored as integer cents internally.
- Your text reply must NEVER be empty. If a tool call covers everything, still write a one-line confirmation.

# Quick item_id lookup (use these EXACT ids)
${idIndex}

# Full menu (with modifiers + descriptions)
${renderMenu(menu)}

# Current cart
${renderCart(cart, menu)}
`;
}
