import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Gamepad2,
  Gift,
  Ticket,
  Dice5,
} from 'lucide-react-native';
import { COLORS } from '../../utils/constants';

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  color: string;
}

const GameCard = ({ title, description, icon, route, color }: GameCardProps) => (
  <Pressable
    onPress={() => router.push(route as any)}
    className="mb-4 overflow-hidden rounded-xl border border-border bg-background-card active:opacity-90"
  >
    <View className="flex-row items-center p-4">
      <View
        className="h-12 w-12 items-center justify-center rounded-full bg-opacity-20"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-text-primary">{title}</Text>
        <Text className="text-sm text-text-secondary">{description}</Text>
      </View>
    </View>
  </Pressable>
);

export default function GamesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="border-b border-border px-4 pb-4 pt-2">
        <Text className="text-2xl font-bold text-primary">娛樂中心</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="mb-4 text-sm text-text-secondary">
          使用您的資產來參與各種市場遊戲，贏取更多獎勵！
        </Text>

        <GameCard
          title="賽馬"
          description="預測冠軍馬匹，贏取高額倍率獎金！"
          icon={<Ticket size={28} color={COLORS.cta} />}
          route="/race"
          color={COLORS.cta}
        />

        <GameCard
          title="老虎機"
          description="經典拉霸機，試試您的運氣！"
          icon={<Gamepad2 size={28} color={COLORS.primary} />}
          route="/slots"
          color={COLORS.primary}
        />

        <GameCard
          title="21點"
          description="與莊家對決，考驗您的策略與膽識！"
          icon={<Dice5 size={28} color={COLORS.bearish} />}
          route="/blackjack"
          color={COLORS.bearish}
        />

        <GameCard
          title="抽卡"
          description="收集稀有卡片，解鎖特殊成就！"
          icon={<Gift size={28} color={COLORS.bullish} />}
          route="/cardstore"
          color={COLORS.bullish}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
