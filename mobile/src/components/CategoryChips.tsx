import { Pressable, ScrollView, Text } from 'react-native';

export function CategoryChips({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  const all = ['All', ...categories];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // flexGrow/Shrink:0 stops react-native-web from making this ScrollView
      // stretch vertically when the sibling FlatList has fewer items.
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        gap: 8,
      }}
      className="py-3"
    >
      {all.map((cat) => {
        const isActive = cat === active;
        return (
          <Pressable
            key={cat}
            onPress={() => onChange(cat)}
            style={{ flexShrink: 0 }}
            className={`px-4 py-2 rounded-full border ${
              isActive
                ? 'bg-accent border-accent'
                : 'bg-surface border-border'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-bg' : 'text-cream'
              }`}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
