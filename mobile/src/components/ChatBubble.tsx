import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import type { UiMessage } from '../store/chat';
import { ActionChip } from './ActionChip';

function TypingDots() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 3), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <View className="flex-row items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className="w-2 h-2 rounded-full bg-muted"
          style={{ opacity: tick === i ? 1 : 0.35 }}
        />
      ))}
    </View>
  );
}

export function ChatBubble({ msg }: { msg: UiMessage }) {
  if (msg.role === 'user') {
    return (
      <View className="w-full items-end my-1.5">
        <View
          className="bg-accent px-4 py-3 rounded-3xl rounded-br-md"
          style={{ maxWidth: '80%' }}
        >
          <Text className="text-bg text-base leading-5">{msg.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="w-full items-start my-1.5">
      <View
        className="bg-card border border-border px-4 py-3 rounded-3xl rounded-bl-md"
        style={{ maxWidth: '85%' }}
      >
        {msg.pending ? (
          <TypingDots />
        ) : msg.error ? (
          // Error path keeps the flex-row layout (icon + text). Text needs
          // flex-shrink to wrap rather than flex-1 (which can collapse to 0
          // when the parent has no explicit width).
          <View className="flex-row items-start">
            <View className="mr-2 mt-0.5">
              <AlertTriangle color="#E26464" size={14} />
            </View>
            <Text
              className="text-cream text-base leading-5"
              style={{ flexShrink: 1 }}
            >
              {msg.content && msg.content.trim().length > 0
                ? msg.content
                : "Hmm, I didn't catch that — could you rephrase?"}
            </Text>
          </View>
        ) : (
          // No icon → render Text directly. No flex-row, no flex-1, no
          // zero-width trap. Text wraps naturally inside the bubble's
          // maxWidth: 85%.
          <Text className="text-cream text-base leading-5">
            {msg.content && msg.content.trim().length > 0
              ? msg.content
              : "Hmm, I didn't catch that — could you rephrase?"}
          </Text>
        )}
      </View>
      {msg.actions && msg.actions.length > 0 && !msg.pending && (
        <View
          className="flex-row flex-wrap gap-1.5 mt-2 ml-1"
          style={{ maxWidth: '90%' }}
        >
          {msg.actions.map((action, idx) => (
            <ActionChip key={idx} action={action} />
          ))}
        </View>
      )}
    </View>
  );
}
