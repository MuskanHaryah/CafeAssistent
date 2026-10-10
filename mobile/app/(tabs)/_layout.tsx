import { Tabs } from 'expo-router';
import { Coffee, ShoppingBag, Sparkles } from 'lucide-react-native';
import { useCart, cartCount } from '../../src/store/cart';

export default function TabsLayout() {
  const lines = useCart((s) => s.lines);
  const count = cartCount(lines);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A1612',
          borderTopColor: '#3A2E22',
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarActiveTintColor: '#C68A4B',
        tabBarInactiveTintColor: '#8A7A66',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => <Coffee color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#C68A4B',
            color: '#0E0B08',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
    </Tabs>
  );
}
