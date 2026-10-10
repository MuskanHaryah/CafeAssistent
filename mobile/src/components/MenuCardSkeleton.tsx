import { View } from 'react-native';

export function MenuCardSkeleton() {
  return (
    <View className="bg-card rounded-2xl overflow-hidden border border-border">
      <View className="w-full h-40 bg-surface" />
      <View className="p-4">
        <View className="h-5 bg-surface rounded w-1/2" />
        <View className="h-4 bg-surface rounded w-full mt-3" />
        <View className="h-4 bg-surface rounded w-3/4 mt-2" />
      </View>
    </View>
  );
}
