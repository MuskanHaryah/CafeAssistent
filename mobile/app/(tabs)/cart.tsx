import { useEffect } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCart, cartCount, cartSubtotal } from '../../src/store/cart';
import { useMenu } from '../../src/store/menu';
import { CartLineRow } from '../../src/components/CartLineRow';
import { formatPrice } from '../../src/lib/format';

const TAX_RATE = 0.085;

export default function CartScreen() {
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const menuData = useMenu((s) => s.data);
  const loadMenu = useMenu((s) => s.load);

  // Ensure menu is loaded so CartLineRow can resolve names/images.
  useEffect(() => {
    if (!menuData) loadMenu();
  }, [menuData, loadMenu]);

  const count = cartCount(lines);
  const subtotal = cartSubtotal(lines);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  function handlePlaceOrder() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      'Order placed',
      'Your order has been sent to the kitchen.\n\n(Demo only — no real order was placed.)',
      [
        {
          text: 'OK',
          onPress: () => clear(),
        },
      ],
    );
  }

  function handleClear() {
    Alert.alert(
      'Clear cart?',
      'This will remove all items from your cart.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
              () => {},
            );
            clear();
          },
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-6 pt-2 pb-3">
        <Text className="text-cream text-3xl font-bold">Your Order</Text>
        <Text className="text-muted mt-1">
          {count === 0 ? 'No items yet' : `${count} ${count === 1 ? 'item' : 'items'}`}
        </Text>
      </View>

      {count === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="bg-card border border-border rounded-full items-center justify-center"
            style={{ width: 96, height: 96 }}
          >
            <ShoppingBag color="#C68A4B" size={40} />
          </View>
          <Text className="text-cream text-lg font-semibold mt-5">
            Your cart is empty
          </Text>
          <Text className="text-muted text-center mt-2 leading-5">
            Browse the menu or ask the assistant to add something
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/menu')}
            className="bg-accent rounded-2xl px-6 py-3 mt-6 active:opacity-90"
          >
            <Text className="text-bg text-base font-bold">Browse Menu</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => <CartLineRow line={item} />}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 220 }}
            showsVerticalScrollIndicator={false}
          />

          <SafeAreaView
            edges={['bottom']}
            className="absolute bottom-0 left-0 right-0 bg-bg border-t border-border"
          >
            <View className="px-6 pt-4">
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-muted text-sm">Subtotal</Text>
                <Text className="text-cream text-sm">{formatPrice(subtotal)}</Text>
              </View>
              <View className="flex-row justify-between mb-2.5">
                <Text className="text-muted text-sm">Tax (8.5%)</Text>
                <Text className="text-cream text-sm">{formatPrice(tax)}</Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className="text-cream text-base font-semibold">Total</Text>
                <Text className="text-cream text-base font-semibold">
                  {formatPrice(total)}
                </Text>
              </View>

              <Pressable
                onPress={handlePlaceOrder}
                className="bg-accent rounded-2xl py-4 active:opacity-90 items-center"
              >
                <Text className="text-bg text-base font-bold">
                  Place Order — {formatPrice(total)}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleClear}
                className="py-3 mt-1 items-center active:opacity-70"
              >
                <Text className="text-muted text-sm">Clear cart</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </>
      )}
    </SafeAreaView>
  );
}
