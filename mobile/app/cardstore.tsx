import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { toast } from 'burnt';
import axios from 'axios';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { ArrowLeft, Gift, Sparkles } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { COLORS } from '../utils/constants';
import { formatMoney, formatNumber } from '../utils/format';
import { sounds } from '../utils/sound';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 64) / 3;

// Card rarities and their rates
const RARITIES = {
  N: { color: '#9CA3AF', label: 'N', rate: 60 },
  R: { color: '#3B82F6', label: 'R', rate: 25 },
  SR: { color: '#A855F7', label: 'SR', rate: 12 },
  SSR: { color: '#F59E0B', label: 'SSR', rate: 3 },
};

// Card templates
const CARD_TEMPLATES = [
  { rarity: 'N', name: '零錢', reward: 200 },
  { rarity: 'N', name: '紅包', reward: 500 },
  { rarity: 'N', name: '信封', reward: 1000 },
  { rarity: 'R', name: '鈔票', reward: 2000 },
  { rarity: 'R', name: '金幣', reward: 5000 },
  { rarity: 'SR', name: '金條', reward: 10000 },
  { rarity: 'SR', name: '鑽石', reward: 25000 },
  { rarity: 'SSR', name: '財神', reward: 50000 },
  { rarity: 'SSR', name: '聚寶盆', reward: 100000 },
];

interface DrawnCard {
  id: string;
  rarity: keyof typeof RARITIES;
  name: string;
  reward: number;
  flipped: boolean;
}

// Single Gacha Card Component
const GachaCard = ({
  card,
  onFlip,
  index,
}: {
  card: DrawnCard;
  onFlip: (id: string) => void;
  index: number;
}) => {
  const flipProgress = useSharedValue(card.flipped ? 1 : 0);
  const rarityInfo = RARITIES[card.rarity];

  const handlePress = async () => {
    if (card.flipped) return;

    await sounds.playCardFlip();
    flipProgress.value = withTiming(1, { duration: 300 });
    onFlip(card.id);
  };

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      flipProgress.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      flipProgress.value,
      [0, 1],
      [180, 360],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity: flipProgress.value >= 0.5 ? 1 : 0,
    };
  });

  const isSSR = card.rarity === 'SSR';

  return (
    <Pressable
      onPress={handlePress}
      style={{ width: CARD_WIDTH, height: CARD_WIDTH * 1.4 }}
      className="relative"
    >
      {/* Card Back (before flip) */}
      <Animated.View
        className={`absolute inset-0 items-center justify-center rounded-xl border-2 ${
          isSSR ? 'border-yellow-500 bg-yellow-500/20' : 'border-primary bg-primary/20'
        }`}
        style={[frontStyle, { backfaceVisibility: 'hidden' }]}
      >
        <Gift size={32} color={isSSR ? '#F59E0B' : COLORS.primary} />
        <Text className={`mt-2 text-xs ${isSSR ? 'text-yellow-500' : 'text-primary'}`}>
          點擊翻開
        </Text>
        {isSSR && (
          <Sparkles
            size={16}
            color="#F59E0B"
            className="absolute right-2 top-2"
          />
        )}
      </Animated.View>

      {/* Card Front (after flip) */}
      <Animated.View
        className="absolute inset-0 items-center justify-center rounded-xl border-2"
        style={[
          backStyle,
          {
            backfaceVisibility: 'hidden',
            borderColor: rarityInfo.color,
            backgroundColor: `${rarityInfo.color}20`,
          },
        ]}
      >
        <Badge
          className="absolute right-1 top-1"
          style={{ backgroundColor: rarityInfo.color }}
        >
          <Text className="text-[10px] font-bold text-white">
            {rarityInfo.label}
          </Text>
        </Badge>
        <Text className="text-2xl mb-1">{
          card.rarity === 'SSR' ? '👑' :
          card.rarity === 'SR' ? '💎' :
          card.rarity === 'R' ? '🪙' : '💵'
        }</Text>
        <Text className="text-sm font-semibold text-text-primary">
          {card.name}
        </Text>
        <Text
          className="mt-1 font-mono text-xs font-bold"
          style={{ color: rarityInfo.color }}
        >
          +{formatMoney(card.reward)}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export default function CardStoreScreen() {
  const { API_URL, user, refreshUser } = useAuth();
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [pulling, setPulling] = useState(false);
  const [totalReward, setTotalReward] = useState(0);

  // Generate random card based on rates
  const generateCard = (): DrawnCard => {
    const roll = Math.random() * 100;
    let rarity: keyof typeof RARITIES;

    if (roll < RARITIES.SSR.rate) {
      rarity = 'SSR';
    } else if (roll < RARITIES.SSR.rate + RARITIES.SR.rate) {
      rarity = 'SR';
    } else if (roll < RARITIES.SSR.rate + RARITIES.SR.rate + RARITIES.R.rate) {
      rarity = 'R';
    } else {
      rarity = 'N';
    }

    const templates = CARD_TEMPLATES.filter((t) => t.rarity === rarity);
    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      id: Math.random().toString(36).substr(2, 9),
      rarity,
      name: template.name,
      reward: template.reward,
      flipped: false,
    };
  };

  // Pull cards
  const pullCards = async (count: number) => {
    const cost = count === 1 ? 1000 : 9000;

    if ((user?.balance || 0) < cost) {
      toast({ title: '餘額不足', preset: 'error' });
      return;
    }

    setPulling(true);
    try {
      // TODO: Replace with actual API call when backend supports it
      // For now, client-side generation (matches web version behavior)

      // Deduct cost (simulated)
      // In production, this would be an API call

      const newCards: DrawnCard[] = [];
      for (let i = 0; i < count; i++) {
        newCards.push(generateCard());
      }

      setDrawnCards(newCards);
      setTotalReward(0);
      await sounds.playCardFlip();

      // Simulate balance deduction
      toast({
        title: `抽卡成功`,
        message: `消耗 ${formatMoney(cost)}`,
        preset: 'done',
      });
    } catch (e: any) {
      toast({
        title: '抽卡失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
    } finally {
      setPulling(false);
    }
  };

  const handleFlip = (cardId: string) => {
    setDrawnCards((prev) =>
      prev.map((card) => {
        if (card.id === cardId && !card.flipped) {
          setTotalReward((r) => r + card.reward);
          return { ...card, flipped: true };
        }
        return card;
      })
    );
  };

  const revealAll = async () => {
    await sounds.playCardFlip();
    setDrawnCards((prev) => {
      let newTotal = 0;
      const updated = prev.map((card) => {
        if (!card.flipped) {
          newTotal += card.reward;
        }
        return { ...card, flipped: true };
      });
      setTotalReward((r) => r + newTotal);
      return updated;
    });
  };

  const allFlipped = drawnCards.length > 0 && drawnCards.every((c) => c.flipped);
  const hasUnflipped = drawnCards.some((c) => !c.flipped);

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-4 pt-2">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-primary/20"
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text className="text-xl font-bold text-primary">卡牌商店</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Balance Display */}
        <Card className="mb-4">
          <CardContent className="flex-row items-center justify-between p-4">
            <Text className="text-sm text-text-secondary">餘額</Text>
            <Text className="font-mono text-xl font-bold text-primary">
              {formatMoney(user?.balance || 0)}
            </Text>
          </CardContent>
        </Card>

        {/* Pull Buttons */}
        <View className="mb-4 flex-row gap-3">
          <Button
            onPress={() => pullCards(1)}
            loading={pulling}
            className="flex-1"
          >
            <View className="items-center">
              <Text className="font-semibold text-white">單抽</Text>
              <Text className="text-xs text-white/80">$1,000</Text>
            </View>
          </Button>
          <Button
            onPress={() => pullCards(10)}
            loading={pulling}
            variant="cta"
            className="flex-1"
          >
            <View className="items-center">
              <Text className="font-semibold text-white">十連抽</Text>
              <Text className="text-xs text-white/80">$9,000 (9折)</Text>
            </View>
          </Button>
        </View>

        {/* Drawn Cards */}
        {drawnCards.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="font-semibold text-text-primary">抽卡結果</Text>
                {hasUnflipped && (
                  <Pressable onPress={revealAll}>
                    <Text className="text-sm text-primary">全部翻開</Text>
                  </Pressable>
                )}
              </View>

              <View className="flex-row flex-wrap justify-center gap-3">
                {drawnCards.map((card, index) => (
                  <GachaCard
                    key={card.id}
                    card={card}
                    onFlip={handleFlip}
                    index={index}
                  />
                ))}
              </View>

              {/* Total Reward */}
              {totalReward > 0 && (
                <View className="mt-4 items-center rounded-xl bg-bullish/20 p-3">
                  <Text className="text-sm text-text-secondary">總獎勵</Text>
                  <Text className="text-2xl font-bold text-bullish">
                    +{formatMoney(totalReward)}
                  </Text>
                </View>
              )}

              {/* Clear and Draw Again */}
              {allFlipped && (
                <Button
                  onPress={() => setDrawnCards([])}
                  variant="outline"
                  className="mt-4"
                >
                  清除並重新抽卡
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Rates Table */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <Text className="mb-3 font-semibold text-text-primary">機率表</Text>
            <View className="gap-3">
              {(Object.entries(RARITIES) as [keyof typeof RARITIES, typeof RARITIES.N][]).map(
                ([key, info]) => (
                  <View key={key} className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="h-6 w-6 items-center justify-center rounded"
                        style={{ backgroundColor: `${info.color}30` }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: info.color }}
                        >
                          {info.label}
                        </Text>
                      </View>
                      <Text className="text-sm text-text-secondary">
                        {key === 'N'
                          ? '普通'
                          : key === 'R'
                          ? '稀有'
                          : key === 'SR'
                          ? '超稀有'
                          : '傳說'}
                      </Text>
                    </View>
                    <Text className="font-mono text-sm" style={{ color: info.color }}>
                      {info.rate}%
                    </Text>
                  </View>
                )
              )}
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
