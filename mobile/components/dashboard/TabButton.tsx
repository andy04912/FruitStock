import React from 'react';
import { Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { sounds } from '../../utils/sound';

interface TabButtonProps {
  label: string;
  emoji: string;
  active: boolean;
  color: string;
  onPress: () => void;
}

export const TabButton = ({ label, emoji, active, color, onPress }: TabButtonProps) => {
  const handlePress = async () => {
    if (!active) {
      await Haptics.selectionAsync();
      await sounds.playTap();
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-1 items-center border-b-2 pb-3 pt-2 transition-all ${
        active ? `border-${color} opacity-100` : 'border-transparent opacity-60'
      }`}
      style={{ borderBottomColor: active ? color : 'transparent' }}
    >
      <Text
        className={`text-base font-bold tracking-wide ${active ? 'scale-105 transform' : 'text-text-secondary'}`}
        style={{ color: active ? color : undefined }}
      >
        {emoji} {label}
      </Text>
    </Pressable>
  );
};
