import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { ModifierGroup } from '../types';
import { formatPriceDelta } from '../lib/format';

export function ModifierGroupView({
  group,
  selected,
  onChange,
}: {
  group: ModifierGroup;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(optionId: string) {
    if (group.type === 'single') {
      onChange([optionId]);
    } else {
      onChange(
        selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId],
      );
    }
  }

  return (
    <View className="mt-5">
      <View className="flex-row items-baseline justify-between mb-2">
        <Text className="text-cream text-base font-semibold">
          {group.name}
          {group.required && <Text className="text-accent"> *</Text>}
        </Text>
        <Text className="text-muted text-xs uppercase tracking-wider">
          {group.type === 'single' ? 'Pick one' : 'Optional · add any'}
        </Text>
      </View>
      <View className="gap-2">
        {group.options.map((opt) => {
          const isSel = selected.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => toggle(opt.id)}
              className={`flex-row items-center justify-between rounded-xl px-4 py-3 border ${
                isSel ? 'bg-accent/10 border-accent' : 'bg-surface border-border'
              }`}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className={`w-5 h-5 mr-3 items-center justify-center ${
                    group.type === 'single' ? 'rounded-full' : 'rounded'
                  } border ${isSel ? 'bg-accent border-accent' : 'border-muted'}`}
                >
                  {isSel && <Check color="#0E0B08" size={14} />}
                </View>
                <Text className={`text-base ${isSel ? 'text-cream' : 'text-cream/90'}`}>
                  {opt.name}
                </Text>
              </View>
              {opt.priceDelta !== 0 && (
                <Text className="text-muted text-sm">{formatPriceDelta(opt.priceDelta)}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
