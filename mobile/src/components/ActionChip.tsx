import { Text, View } from 'react-native';
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react-native';
import type { CartAction } from '../types';
import { useMenu } from '../store/menu';
import { modifierSummary } from '../lib/cartModSummary';

const ACCENT = '#C68A4B';

function labelFor(action: CartAction): string {
  const menu = useMenu.getState();
  switch (action.type) {
    case 'add': {
      const item = menu.byId(action.item_id);
      const name = item?.name ?? 'item';
      const mods = modifierSummary(item, action.modifiers);
      const base = `Added ${action.quantity}× ${name}`;
      return mods ? `${base} (${mods})` : base;
    }
    case 'update':
      return action.quantity === 0
        ? 'Removed'
        : `Updated to ${action.quantity}`;
    case 'remove':
      return 'Removed item';
    case 'clear':
      return 'Cleared cart';
  }
}

function IconFor({ action }: { action: CartAction }) {
  const size = 12;
  switch (action.type) {
    case 'add':
      return <Plus color={ACCENT} size={size} />;
    case 'update':
      return <Pencil color={ACCENT} size={size} />;
    case 'remove':
      return <Trash2 color={ACCENT} size={size} />;
    case 'clear':
      return <RotateCcw color={ACCENT} size={size} />;
  }
}

export function ActionChip({ action }: { action: CartAction }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-bg/40 border border-accent/40 rounded-full px-3 py-1 self-start">
      <IconFor action={action} />
      <Text className="text-accent text-xs font-semibold">
        {labelFor(action)}
      </Text>
    </View>
  );
}
