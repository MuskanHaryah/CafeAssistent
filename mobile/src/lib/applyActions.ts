import * as Haptics from 'expo-haptics';
import type { CartAction, ModifierGroup, SelectedModifier } from '../types';
import { useCart } from '../store/cart';
import { useMenu } from '../store/menu';

function safeHaptic(fn: () => Promise<unknown>): void {
  fn().catch(() => {});
}

function resolveModifiers(
  groups: ModifierGroup[] | undefined,
  incoming: SelectedModifier[] | undefined,
): { mods: SelectedModifier[]; unitDelta: number } {
  if (!groups || !incoming || incoming.length === 0) {
    return { mods: [], unitDelta: 0 };
  }
  const mods: SelectedModifier[] = [];
  let unitDelta = 0;
  for (const sel of incoming) {
    const group = groups.find((g) => g.id === sel.groupId);
    if (!group) continue;
    const validIds: string[] = [];
    for (const oid of sel.optionIds) {
      const opt = group.options.find((o) => o.id === oid);
      if (!opt) continue;
      validIds.push(opt.id);
      unitDelta += opt.priceDelta;
    }
    if (validIds.length > 0) {
      mods.push({ groupId: group.id, optionIds: validIds });
    }
  }
  return { mods, unitDelta };
}

export function applyActions(actions: CartAction[]): void {
  if (!actions || actions.length === 0) return;
  const cart = useCart.getState();
  const menu = useMenu.getState();

  for (const action of actions) {
    switch (action.type) {
      case 'add': {
        const item = menu.byId(action.item_id);
        if (!item) continue;
        const { mods, unitDelta } = resolveModifiers(
          item.modifierGroups,
          action.modifiers,
        );
        const unitPrice = item.basePrice + unitDelta;
        const quantity = Math.max(1, Math.floor(action.quantity || 1));
        cart.addLine({
          itemId: item.id,
          quantity,
          modifiers: mods,
          unitPrice,
        });
        safeHaptic(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        );
        break;
      }
      case 'update': {
        cart.updateQty(action.line_id, action.quantity);
        safeHaptic(() => Haptics.selectionAsync());
        break;
      }
      case 'remove': {
        cart.removeLine(action.line_id);
        safeHaptic(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
        );
        break;
      }
      case 'clear': {
        cart.clear();
        safeHaptic(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
        );
        break;
      }
    }
  }
}
