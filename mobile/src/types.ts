// Mirror of backend/src/types.ts — keep in sync.

export type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number; // cents
};

export type ModifierGroup = {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required?: boolean;
  options: ModifierOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  basePrice: number; // cents
  category: string;
  image: string;
  modifierGroups?: ModifierGroup[];
  tags?: string[];
};

export type SelectedModifier = {
  groupId: string;
  optionIds: string[];
};

export type CartLine = {
  id: string;
  itemId: string;
  quantity: number;
  modifiers: SelectedModifier[];
  unitPrice: number;
};

export type CartAction =
  | { type: 'add'; item_id: string; quantity: number; modifiers?: SelectedModifier[] }
  | { type: 'update'; line_id: string; quantity: number }
  | { type: 'remove'; line_id: string }
  | { type: 'clear' };

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type MenuResponse = {
  categories: string[];
  items: MenuItem[];
};

export type ChatRequest = {
  messages: ChatMessage[];
  cart: { lines: CartLine[] };
};

export type ChatResponse = {
  reply: string;
  actions: CartAction[];
};
