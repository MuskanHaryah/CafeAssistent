import { useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import type { MenuItem } from '../types';
import { formatPrice } from '../lib/format';

// Picks a coffee-toned background per item id so fallbacks look intentional
function fallbackTint(id: string) {
  const palette = ['#3A2E22', '#5A3A24', '#4A2E1E', '#6B4423', '#3F2E1A'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function MenuCard({ item }: { item: MenuItem }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [imgFailed, setImgFailed] = useState(false);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable
        className="active:opacity-80"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <View className="bg-card rounded-2xl overflow-hidden border border-border">
            <View className="relative">
              {imgFailed ? (
                <View
                  className="w-full h-40 items-center justify-center"
                  style={{ backgroundColor: fallbackTint(item.id) }}
                >
                  <Text className="text-cream text-2xl font-bold opacity-80">
                    {item.name}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: item.image }}
                  className="w-full h-40 bg-surface"
                  resizeMode="cover"
                  onError={() => setImgFailed(true)}
                />
              )}
              {item.tags?.includes('popular') && (
                <View className="absolute top-3 left-3 bg-accent/95 px-2.5 py-1 rounded-full">
                  <Text className="text-bg text-[10px] font-bold uppercase tracking-wider">
                    Popular
                  </Text>
                </View>
              )}
              {item.tags?.includes('new') && (
                <View className="absolute top-3 left-3 bg-cream px-2.5 py-1 rounded-full">
                  <Text className="text-bg text-[10px] font-bold uppercase tracking-wider">
                    New
                  </Text>
                </View>
              )}
            </View>
            <View className="p-4">
              <View className="flex-row items-start justify-between">
                <Text className="text-cream text-lg font-semibold flex-1 pr-3">
                  {item.name}
                </Text>
                <Text className="text-accent text-base font-semibold">
                  {formatPrice(item.basePrice)}
                </Text>
              </View>
              <Text className="text-muted text-sm mt-1.5 leading-5" numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Link>
  );
}
