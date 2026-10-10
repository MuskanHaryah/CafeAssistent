import { useEffect, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { ChatBubble } from '../../src/components/ChatBubble';
import { ChatInput } from '../../src/components/ChatInput';
import { SuggestionRow } from '../../src/components/SuggestionRow';
import { useChat, type UiMessage } from '../../src/store/chat';
import { useMenu } from '../../src/store/menu';

export default function ChatScreen() {
  const messages = useChat((s) => s.messages);
  const pending = useChat((s) => s.pending);
  const send = useChat((s) => s.send);
  const reset = useChat((s) => s.reset);
  const loadMenu = useMenu((s) => s.load);
  const menuData = useMenu((s) => s.data);

  const listRef = useRef<FlatList<UiMessage>>(null);

  // Make sure the menu is hydrated so action chips can resolve item names.
  useEffect(() => {
    if (!menuData) loadMenu().catch(() => {});
  }, [menuData, loadMenu]);

  function handleSend(text: string) {
    send(text).catch(() => {});
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-3 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-cream text-3xl font-bold">Assistant</Text>
            <Text className="text-muted mt-1">
              Order anything in plain English.
            </Text>
          </View>
          {messages.length > 0 && (
            <Pressable
              onPress={() => reset()}
              hitSlop={10}
              className="px-3 py-1 active:opacity-60"
            >
              <Text className="text-accent text-sm font-semibold">Reset</Text>
            </Pressable>
          )}
        </View>

        {messages.length === 0 ? (
          <EmptyState onPick={handleSend} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatBubble msg={item} />}
            // extraData forces every row to re-evaluate when any message
            // mutates (e.g. pending: true -> false with new content).
            extraData={messages.map((m) => `${m.id}:${m.pending ? 'p' : ''}:${m.content?.length ?? 0}`).join(',')}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 16,
            }}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          />
        )}

        <ChatInput onSubmit={handleSend} disabled={pending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View className="flex-1 justify-center">
      <View className="items-center px-6">
        <View
          className="bg-card border border-border items-center justify-center mb-5"
          style={{ width: 96, height: 96, borderRadius: 48 }}
        >
          <Sparkles color="#C68A4B" size={40} />
        </View>
        <Text className="text-cream text-xl font-semibold">
          Hi! I&apos;m your barista.
        </Text>
        <Text className="text-muted mt-2 text-center">
          Try one of these to get started:
        </Text>
      </View>
      <View className="mt-6">
        <SuggestionRow onPick={onPick} />
      </View>
    </View>
  );
}
