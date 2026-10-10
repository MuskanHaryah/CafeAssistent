import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { useMenu } from '../../src/store/menu';
import { MenuCard } from '../../src/components/MenuCard';
import { MenuCardSkeleton } from '../../src/components/MenuCardSkeleton';
import { CategoryChips } from '../../src/components/CategoryChips';
import { CartFloatingPill } from '../../src/components/CartFloatingPill';
import { API_BASE } from '../../src/api/client';

export default function MenuScreen() {
  const { data, loading, error, load } = useMenu();
  const [refreshing, setRefreshing] = useState(false);
  const [activeCat, setActiveCat] = useState('All');

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  const items = useMemo(() => {
    if (!data) return [];
    if (activeCat === 'All') return data.items;
    return data.items.filter((it) => it.category === activeCat);
  }, [data, activeCat]);

  return (
    <View className="flex-1 bg-bg">
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-6 pt-2 pb-1">
        <Text className="text-muted text-xs uppercase tracking-[3px]">Cafe AI</Text>
        <Text className="text-cream text-3xl font-bold mt-1">Good morning</Text>
        <Text className="text-muted mt-1">What can we brew for you today?</Text>
      </View>

      {data && (
        <CategoryChips
          categories={data.categories}
          active={activeCat}
          onChange={setActiveCat}
        />
      )}

      {loading && !data && (
        <View className="px-6 pt-2" style={{ gap: 14 }}>
          <MenuCardSkeleton />
          <MenuCardSkeleton />
          <MenuCardSkeleton />
        </View>
      )}

      {error && !data && (
        <View className="px-6 pt-10 items-center">
          <AlertTriangle color="#C68A4B" size={40} />
          <Text className="text-cream text-lg font-semibold mt-3">
            Can't reach the kitchen
          </Text>
          <Text className="text-muted text-center mt-2">{error}</Text>
          <Text className="text-muted text-xs mt-4 text-center">
            Make sure the backend is running at {API_BASE}.
          </Text>
        </View>
      )}

      {data && (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => <MenuCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 96, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C68A4B"
            />
          }
          ListEmptyComponent={
            <View className="pt-10 items-center">
              <Text className="text-muted">No items in this category yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
    <CartFloatingPill />
    </View>
  );
}
