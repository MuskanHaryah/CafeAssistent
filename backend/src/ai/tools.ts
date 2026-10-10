import type Anthropic from '@anthropic-ai/sdk';

// Tool schemas exposed to Claude for the conversational ordering assistant.
// Each tool corresponds to a CartAction the client will apply, except
// `recommend` which is purely informational (no cart mutation).
//
// IMPORTANT: keep input_schema field names in sync with the parsing logic in
// routes/chat.ts — that handler translates snake_case tool inputs into the
// camelCase CartAction shape consumed by the mobile app.

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_item',
    description:
      'Add a menu item to the cart. Use the EXACT item_id from the menu (never invent ids or use the display name). ' +
      'For drinks with a required Size or Milk modifier group, you MUST include those modifiers. ' +
      'If the user did not specify, pick a sensible default (Medium size, Whole milk) and mention it in your text reply. ' +
      'Each modifier entry references the group by its exact group_id and one or more option_ids that belong to that group. ' +
      'You may call this tool multiple times in one turn to add several different items at once.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'Exact menu item id (e.g. "latte", "blueberry-muffin").',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 1,
          description: 'How many of this configured item to add. Defaults to 1.',
        },
        modifiers: {
          type: 'array',
          description:
            'Selected modifier groups for this item. Use exact group_id and option_id values from the menu.',
          items: {
            type: 'object',
            properties: {
              group_id: {
                type: 'string',
                description: 'Exact modifier group id (e.g. "size", "milk", "syrups").',
              },
              option_ids: {
                type: 'array',
                description:
                  'One option_id for single-select groups, or one-or-more for multi-select groups.',
                items: { type: 'string' },
              },
            },
            required: ['group_id', 'option_ids'],
          },
        },
      },
      required: ['item_id'],
    },
  },
  {
    name: 'update_quantity',
    description:
      'Change the quantity of an existing cart line. Use the cart line_id (not the item name). ' +
      'Passing quantity: 0 removes the line. Use this when the user says things like "make it 3" or "actually just one".',
    input_schema: {
      type: 'object',
      properties: {
        line_id: {
          type: 'string',
          description: 'The id of the cart line to update (from the current cart shown in the system prompt).',
        },
        quantity: {
          type: 'integer',
          minimum: 0,
          description: 'New quantity for this line. 0 means remove the line entirely.',
        },
      },
      required: ['line_id', 'quantity'],
    },
  },
  {
    name: 'remove_item',
    description:
      'Remove a specific cart line entirely. Use the cart line_id from the current cart, not the item name. ' +
      'Prefer this over update_quantity:0 when the user says "remove the latte" or "take that off".',
    input_schema: {
      type: 'object',
      properties: {
        line_id: {
          type: 'string',
          description: 'The id of the cart line to remove.',
        },
      },
      required: ['line_id'],
    },
  },
  {
    name: 'clear_cart',
    description:
      'Empty the entire cart. Use only when the user clearly wants to start over (e.g. "clear my cart", "start fresh", "cancel everything").',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'recommend',
    description:
      'Non-mutating suggestion. Use when the user asks "what\'s good?", "surprise me", or wants a recommendation BEFORE committing to add it. ' +
      'This does NOT add anything to the cart — it just records which item you are recommending so the UI can highlight it. ' +
      'After calling this, your text reply should describe the recommendation and ask if they want it added.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'Exact menu item id you are recommending.',
        },
        reason: {
          type: 'string',
          description: 'Short, friendly justification shown alongside the recommendation.',
        },
      },
      required: ['item_id', 'reason'],
    },
  },
];
