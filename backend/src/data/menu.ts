import type { MenuItem, ModifierGroup, MenuResponse } from '../types.js';

// ---- Reusable modifier groups ----

const SIZE: ModifierGroup = {
  id: 'size',
  name: 'Size',
  type: 'single',
  required: true,
  options: [
    { id: 'sm', name: 'Small (8 oz)', priceDelta: 0 },
    { id: 'md', name: 'Medium (12 oz)', priceDelta: 50 },
    { id: 'lg', name: 'Large (16 oz)', priceDelta: 100 },
  ],
};

const ICED_SIZE: ModifierGroup = {
  id: 'size',
  name: 'Size',
  type: 'single',
  required: true,
  options: [
    { id: 'md', name: 'Medium (16 oz)', priceDelta: 0 },
    { id: 'lg', name: 'Large (24 oz)', priceDelta: 100 },
  ],
};

const MILK: ModifierGroup = {
  id: 'milk',
  name: 'Milk',
  type: 'single',
  required: true,
  options: [
    { id: 'whole', name: 'Whole', priceDelta: 0 },
    { id: 'two', name: '2%', priceDelta: 0 },
    { id: 'skim', name: 'Skim', priceDelta: 0 },
    { id: 'oat', name: 'Oat', priceDelta: 75 },
    { id: 'almond', name: 'Almond', priceDelta: 75 },
    { id: 'soy', name: 'Soy', priceDelta: 75 },
  ],
};

const SYRUPS: ModifierGroup = {
  id: 'syrups',
  name: 'Syrups',
  type: 'multi',
  required: false,
  options: [
    { id: 'vanilla', name: 'Vanilla', priceDelta: 75 },
    { id: 'caramel', name: 'Caramel', priceDelta: 75 },
    { id: 'hazelnut', name: 'Hazelnut', priceDelta: 75 },
    { id: 'lavender', name: 'Lavender', priceDelta: 100 },
    { id: 'honey', name: 'Honey', priceDelta: 50 },
  ],
};

const EXTRAS: ModifierGroup = {
  id: 'extras',
  name: 'Extras',
  type: 'multi',
  required: false,
  options: [
    { id: 'shot', name: 'Extra Espresso Shot', priceDelta: 125 },
    { id: 'decaf', name: 'Decaf', priceDelta: 0 },
    { id: 'whip', name: 'Whipped Cream', priceDelta: 50 },
  ],
};

// ---- Items ----

export const MENU: MenuItem[] = [
  // Espresso
  {
    id: 'espresso',
    name: 'Espresso',
    description: 'A bold double shot of our house blend. Bright, syrupy, and unapologetic.',
    basePrice: 350,
    category: 'Espresso',
    image: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80',
    modifierGroups: [EXTRAS],
    tags: ['popular'],
  },
  {
    id: 'americano',
    name: 'Americano',
    description: 'Two espresso shots cut with hot water. Clean, full-bodied, ready to focus.',
    basePrice: 400,
    category: 'Espresso',
    image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=800&q=80',
    modifierGroups: [SIZE, EXTRAS],
  },
  {
    id: 'latte',
    name: 'Latte',
    description: 'Espresso layered with velvety steamed milk and a delicate foam crown.',
    basePrice: 550,
    category: 'Espresso',
    image: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&q=80',
    modifierGroups: [SIZE, MILK, SYRUPS, EXTRAS],
    tags: ['popular'],
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    description: 'Equal parts espresso, steamed milk, and airy foam. A morning classic.',
    basePrice: 500,
    category: 'Espresso',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80',
    modifierGroups: [SIZE, MILK, EXTRAS],
  },
  {
    id: 'mocha',
    name: 'Mocha',
    description: 'Rich espresso meets house-made dark chocolate and steamed milk.',
    basePrice: 575,
    category: 'Espresso',
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&q=80',
    modifierGroups: [SIZE, MILK, SYRUPS, EXTRAS],
  },

  // Brewed
  {
    id: 'drip',
    name: 'Drip Coffee',
    description: 'Today\'s single-origin pour. Smooth, balanced, refill at will.',
    basePrice: 350,
    category: 'Brewed',
    image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80',
    modifierGroups: [SIZE, MILK],
  },
  {
    id: 'cold-brew',
    name: 'Cold Brew',
    description: 'Slow-steeped 18 hours for chocolatey depth. Served over ice.',
    basePrice: 500,
    category: 'Brewed',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80',
    modifierGroups: [ICED_SIZE, MILK, SYRUPS],
    tags: ['popular'],
  },
  {
    id: 'pour-over',
    name: 'Pour Over',
    description: 'Hand-poured Chemex of our weekly rotating single-origin bean.',
    basePrice: 600,
    category: 'Brewed',
    image: 'https://images.unsplash.com/photo-1542223616-740d5dff7f56?w=800&q=80',
    tags: ['new'],
  },

  // Tea & Other
  {
    id: 'matcha-latte',
    name: 'Matcha Latte',
    description: 'Stone-ground ceremonial matcha whisked with steamed milk.',
    basePrice: 600,
    category: 'Tea & Other',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&q=80',
    modifierGroups: [SIZE, MILK, SYRUPS],
    tags: ['vegan-friendly'],
  },
  {
    id: 'chai-latte',
    name: 'Chai Latte',
    description: 'Black tea steeped with cardamom, clove, and cinnamon. Lightly sweet.',
    basePrice: 550,
    category: 'Tea & Other',
    image: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&q=80',
    modifierGroups: [SIZE, MILK],
  },
  {
    id: 'hot-chocolate',
    name: 'Hot Chocolate',
    description: 'Slow-melted Belgian dark chocolate with steamed milk and a cocoa dust.',
    basePrice: 450,
    category: 'Tea & Other',
    image: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&q=80',
    modifierGroups: [SIZE, MILK],
  },

  // Pastries
  {
    id: 'croissant',
    name: 'Butter Croissant',
    description: 'Laminated 81 layers. Crisp shell, pillowy interior. Baked at dawn.',
    basePrice: 400,
    category: 'Pastries',
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80',
    tags: ['popular'],
  },
  {
    id: 'blueberry-muffin',
    name: 'Blueberry Muffin',
    description: 'Wild Maine blueberries, brown butter crumb topping.',
    basePrice: 375,
    category: 'Pastries',
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=800&q=80',
  },
  {
    id: 'biscotti',
    name: 'Almond Biscotti',
    description: 'Twice-baked with toasted almonds and a hint of orange zest.',
    basePrice: 300,
    category: 'Pastries',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80',
  },

  // Sandwiches
  {
    id: 'avocado-toast',
    name: 'Avocado Toast',
    description: 'Smashed avocado on country sourdough, lemon, chili flake, flaky salt.',
    basePrice: 950,
    category: 'Sandwiches',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
    tags: ['vegan-friendly'],
  },
];

const CATEGORY_ORDER = ['Espresso', 'Brewed', 'Tea & Other', 'Pastries', 'Sandwiches'];

export function getMenu(): MenuResponse {
  return {
    categories: CATEGORY_ORDER,
    items: MENU,
  };
}

export function findItem(id: string): MenuItem | undefined {
  return MENU.find((it) => it.id === id);
}
