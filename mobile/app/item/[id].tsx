import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMenu } from '../../src/store/menu';
import { useCart } from '../../src/store/cart';
import { ModifierGroupView } from '../../src/components/ModifierGroupView';
import { QuantityStepper } from '../../src/components/QuantityStepper';
import { formatPrice } from '../../src/lib/format';
import type { SelectedModifier } from '../../src/types';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, load, byId } = useMenu();
  const addLine = useCart((s) => s.addLine);

  const item = byId(id);

  // Pick sane defaults: first option for required-single groups
  const initialSelections = useMemo<Record<string, string[]>>(() => {
    if (!item?.modifierGroups) return {};
    const out: Record<string, string[]> = {};
    for (const g of item.modifierGroups) {
      if (g.type === 'single' && g.required && g.options.length > 0) {
        out[g.id] = [g.options[0]!.id];
      } else {
        out[g.id] = [];
      }
    }
    return out;
  }, [item?.id]);

  const [selections, setSelections] = useState<Record<string, string[]>>(initialSelections);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!data) load();
  }, [data, load]);

  useEffect(() => {
    setSelections(initialSelections);
    setQty(1);
  }, [initialSelections]);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    let total = item.basePrice;
    for (const g of item.modifierGroups ?? []) {
      const picked = selections[g.id] ?? [];
      for (const optId of picked) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) total += opt.priceDelta;
      }
    }
    return total;
  }, [item, selections]);

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <View className="px-6 pt-4">
          <BackButton />
          <Text className="text-cream text-lg mt-6">Item not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function handleAdd() {
    const modifiers: SelectedModifier[] = (item!.modifierGroups ?? [])
      .map((g) => ({ groupId: g.id, optionIds: selections[g.id] ?? [] }))
      .filter((m) => m.optionIds.length > 0);
    addLine({
      itemId: item!.id,
      quantity: qty,
      modifiers,
      unitPrice,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative">
          <Image
            source={{ uri: item.image }}
            className="w-full h-72 bg-surface"
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-bg/30" />
          <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0">
            <View className="px-5 pt-2">
              <BackButton />
            </View>
          </SafeAreaView>
        </View>

        <View className="px-6 pt-5">
          <View className="flex-row items-start justify-between">
            <Text className="text-cream text-3xl font-bold flex-1 pr-3">{item.name}</Text>
            <Text className="text-accent text-xl font-bold">
              {formatPrice(item.basePrice)}
            </Text>
          </View>
          <Text className="text-muted text-base mt-2 leading-6">{item.description}</Text>

          {(item.modifierGroups ?? []).map((g) => (
            <ModifierGroupView
              key={g.id}
              group={g}
              selected={selections[g.id] ?? []}
              onChange={(next) => setSelections((s) => ({ ...s, [g.id]: next }))}
            />
          ))}

          <View className="mt-8 flex-row items-center justify-between">
            <Text className="text-cream text-base font-semibold">Quantity</Text>
            <QuantityStepper value={qty} onChange={setQty} />
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 bg-bg border-t border-border">
        <View className="px-6 pt-3 pb-1">
          <Pressable
            onPress={handleAdd}
            className="bg-accent rounded-2xl py-4 active:opacity-90 flex-row items-center justify-center"
          >
            <Text className="text-bg text-base font-bold">
              Add {qty > 1 ? `${qty} ` : ''}to cart
            </Text>
            <Text className="text-bg text-base font-bold mx-2">·</Text>
            <Text className="text-bg text-base font-bold">
              {formatPrice(unitPrice * qty)}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function BackButton() {
  return (
    <Pressable
      onPress={() => router.back()}
      className="w-10 h-10 rounded-full bg-bg/80 items-center justify-center active:opacity-80"
    >
      <ArrowLeft color="#F3E9D6" size={20} />
    </Pressable>
  );
}
