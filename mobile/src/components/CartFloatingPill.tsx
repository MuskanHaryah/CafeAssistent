import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCart, cartCount, cartSubtotal } from '../store/cart';
import { formatPrice } from '../lib/format';

export function CartFloatingPill() {
  const lines = useCart((s) => s.lines);
  const count = cartCount(lines);
  const subtotal = cartSubtotal(lines);

  const scale = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > prevCountRef.current) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.08,
          useNativeDriver: true,
          friction: 4,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
        }),
      ]).start();
    }
    prevCountRef.current = count;
  }, [count, scale]);

  if (count === 0) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 16,
        alignItems: 'center',
        transform: [{ scale }],
      }}
    >
      <Pressable
        onPress={() => router.push('/(tabs)/cart')}
        className="bg-accent rounded-full flex-row items-center active:opacity-90"
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          minWidth: 240,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View
          className="bg-bg rounded-full items-center justify-center"
          style={{ width: 26, height: 26 }}
        >
          <Text className="text-accent text-xs font-bold">{count}</Text>
        </View>
        <Text className="text-bg text-sm font-bold flex-1 text-center px-3">
          View Cart
        </Text>
        <Text className="text-bg text-sm font-bold">{formatPrice(subtotal)}</Text>
      </Pressable>
    </Animated.View>
  );
}
