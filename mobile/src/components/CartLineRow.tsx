import { Alert, Image, Pressable, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { CartLine, MenuItem } from '../types';
import { useMenu } from '../store/menu';
import { useCart } from '../store/cart';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice } from '../lib/format';

function buildModifierSummary(item: MenuItem, line: CartLine): string {
  const parts: string[] = [];
  for (const sel of line.modifiers) {
    if (!sel.optionIds.length) continue;
    const group = item.modifierGroups?.find((g) => g.id === sel.groupId);
    if (!group) continue;
    const names = sel.optionIds
      .map((oid) => group.options.find((o) => o.id === oid)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) continue;
    parts.push(names.join(', '));
  }
  return parts.join(' · ');
}

export function CartLineRow({ line }: { line: CartLine }) {
  const item = useMenu((s) => s.byId(line.itemId));
  const updateQty = useCart((s) => s.updateQty);
  const removeLine = useCart((s) => s.removeLine);

  const name = item?.name ?? 'Item';
  const image = item?.image;
  const summary = item ? buildModifierSummary(item, line) : '';

  function handleQtyChange(next: number) {
    Haptics.selectionAsync().catch(() => {});
    updateQty(line.id, next);
  }

  function handleRemove() {
    Alert.alert(
      'Remove item?',
      `Remove ${name} from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
              () => {},
            );
            removeLine(line.id);
          },
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <View className="flex-row items-stretch py-4 border-b border-border">
      <View className="w-16 h-16 rounded-xl overflow-hidden bg-surface">
        {image && (
          <Image
            source={{ uri: image }}
            className="w-full h-full"
            resizeMode="cover"
          />
        )}
      </View>

      <View className="flex-1 px-3 justify-between">
        <View>
          <Text className="text-cream text-base font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {summary.length > 0 && (
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
              {summary}
            </Text>
          )}
        </View>
        <Text className="text-muted text-xs">{formatPrice(line.unitPrice)} each</Text>
      </View>

      <View className="items-end justify-between" style={{ minHeight: 64 }}>
        <Pressable
          onPress={handleRemove}
          hitSlop={10}
          className="active:opacity-70 p-1"
        >
          <Trash2 color="#8A7A66" size={18} />
        </Pressable>
        <QuantityStepper
          value={line.quantity}
          onChange={handleQtyChange}
          min={0}
          size="sm"
        />
      </View>
    </View>
  );
}
