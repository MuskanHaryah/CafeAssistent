import { Pressable, ScrollView, Text } from 'react-native';

const SUGGESTIONS: string[] = [
  'Two large oat lattes please',
  'Add a blueberry muffin',
  'Make my cart all-decaf',
  "What's popular?",
  'Surprise me',
];

export function SuggestionRow({ onPick }: { onPick: (text: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {SUGGESTIONS.map((s) => (
        <Pressable
          key={s}
          onPress={() => onPick(s)}
          className="bg-surface border border-border rounded-full px-4 py-2 active:opacity-70"
        >
          <Text className="text-cream text-sm">{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
