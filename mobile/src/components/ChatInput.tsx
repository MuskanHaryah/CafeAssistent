import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowUp } from 'lucide-react-native';

export function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  function handleSend() {
    if (!canSend) return;
    const text = trimmed;
    setValue('');
    onSubmit(text);
  }

  return (
    <View className="flex-row items-center px-4 pb-2 pt-2 gap-2">
      <View className="flex-1 bg-surface border border-border rounded-full px-4 py-1">
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Order anything... 'add two large oat lattes'"
          placeholderTextColor="#8A7A66"
          className="text-cream text-base"
          style={{ paddingVertical: 8 }}
          multiline
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!disabled}
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        className={`w-11 h-11 rounded-full items-center justify-center ${
          canSend ? 'bg-accent' : 'bg-surface border border-border opacity-50'
        }`}
      >
        <ArrowUp color={canSend ? '#0E0B08' : '#8A7A66'} size={20} />
      </Pressable>
    </View>
  );
}
