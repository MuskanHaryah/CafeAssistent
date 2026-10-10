import { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 32 : 40;
  const icon = size === 'sm' ? 16 : 20;

  const minusOpacity = useRef(new Animated.Value(1)).current;
  const plusOpacity = useRef(new Animated.Value(1)).current;

  const animateTo = (target: Animated.Value, toValue: number) => {
    Animated.spring(target, {
      toValue,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  return (
    <View className="flex-row items-center bg-surface rounded-full border border-border">
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        onPressIn={() => animateTo(minusOpacity, 0.6)}
        onPressOut={() => animateTo(minusOpacity, 1)}
        disabled={value <= min}
      >
        <Animated.View
          className="items-center justify-center"
          style={{ width: dim, height: dim, opacity: minusOpacity }}
        >
          <Minus color={value <= min ? '#5C4E3F' : '#F3E9D6'} size={icon} />
        </Animated.View>
      </Pressable>
      <Text
        className="text-cream font-semibold text-base text-center"
        style={{ minWidth: 24 }}
      >
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        onPressIn={() => animateTo(plusOpacity, 0.6)}
        onPressOut={() => animateTo(plusOpacity, 1)}
        disabled={value >= max}
      >
        <Animated.View
          className="items-center justify-center"
          style={{ width: dim, height: dim, opacity: plusOpacity }}
        >
          <Plus color={value >= max ? '#5C4E3F' : '#F3E9D6'} size={icon} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
