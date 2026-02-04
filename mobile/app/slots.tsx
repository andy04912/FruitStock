import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { toast } from 'burnt';
import axios from 'axios';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { ArrowLeft, Play, RotateCcw, Zap } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { COLORS } from '../utils/constants';
import { formatMoney, formatNumber } from '../utils/format';
import { sounds } from '../utils/sound';

// Slot symbols
const SYMBOLS = ['7', '💎', '🔔', '🍇', '🍋', '🍒', '➖'];

interface SpinResult {
  reels: string[];
  payout: number;
  multiplier: number;
  balance: number;
}

// Single Reel Component
const Reel = ({
  symbol,
  spinning,
  delay,
}: {
  symbol: string;
  spinning: boolean;
  delay: number;
}) => {
  const [displaySymbol, setDisplaySymbol] = useState(symbol);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      // Spin animation
      translateY.value = withSequence(
        withRepeat(
          withTiming(-50, { duration: 100, easing: Easing.linear }),
          10,
          true
        ),
        withTiming(0, { duration: 200 })
      );

      // Shuffle symbols during spin
      const shuffleInterval = setInterval(() => {
        const randomSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        setDisplaySymbol(randomSymbol);
      }, 100);

      // Stop at final symbol
      setTimeout(() => {
        clearInterval(shuffleInterval);
        setDisplaySymbol(symbol);
      }, delay);

      return () => clearInterval(shuffleInterval);
    } else {
      setDisplaySymbol(symbol);
    }
  }, [spinning, symbol, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      className="h-24 w-24 items-center justify-center rounded-xl border-2 border-primary/30 bg-background-card"
      style={animatedStyle}
    >
      <Text className="text-5xl">{displaySymbol}</Text>
    </Animated.View>
  );
};

export default function SlotsScreen() {
  const { API_URL, user, refreshUser } = useAuth();
  const [reels, setReels] = useState(['🍒', '🍒', '🍒']);
  const [spinning, setSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(100);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [isAutoSpin, setIsAutoSpin] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    spins: 0,
    totalBet: 0,
    totalPayout: 0,
  });
  const autoSpinRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle spin
  const handleSpin = useCallback(async () => {
    if (spinning) return;
    if ((user?.balance || 0) < betAmount) {
      toast({ title: '餘額不足', preset: 'error' });
      setIsAutoSpin(false);
      return;
    }

    setSpinning(true);
    await sounds.playSlotSpin();

    try {
      const res = await axios.post<SpinResult>(`${API_URL}/slots/spin`, {
        bet_amount: betAmount,
      });

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setReels(res.data.reels);
      setLastResult(res.data);

      // Update session stats
      setSessionStats((prev) => ({
        spins: prev.spins + 1,
        totalBet: prev.totalBet + betAmount,
        totalPayout: prev.totalPayout + res.data.payout,
      }));

      await refreshUser();

      if (res.data.payout > 0) {
        await sounds.playWin();
        toast({
          title: `贏了 ${formatMoney(res.data.payout)}`,
          message: `${res.data.multiplier}x`,
          preset: 'done',
        });
      }
    } catch (e: any) {
      toast({
        title: '轉動失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
      await sounds.playError();
      setIsAutoSpin(false);
    } finally {
      setSpinning(false);
    }
  }, [API_URL, betAmount, spinning, user?.balance, refreshUser]);

  // Auto spin effect
  useEffect(() => {
    if (isAutoSpin && !spinning) {
      autoSpinRef.current = setTimeout(() => {
        handleSpin();
      }, 1000);
    }

    return () => {
      if (autoSpinRef.current) {
        clearTimeout(autoSpinRef.current);
      }
    };
  }, [isAutoSpin, spinning, handleSpin]);

  const toggleAutoSpin = () => {
    setIsAutoSpin((prev) => !prev);
  };

  const netProfit = sessionStats.totalPayout - sessionStats.totalBet;
  const roi = sessionStats.totalBet > 0
    ? ((sessionStats.totalPayout / sessionStats.totalBet) * 100 - 100)
    : 0;

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
        <Text className="text-xl font-bold text-primary">老虎機</Text>
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

        {/* Slot Machine */}
        <Card className="mb-4">
          <CardContent className="items-center p-6">
            {/* Reels */}
            <View className="mb-6 flex-row gap-3">
              <Reel symbol={reels[0]} spinning={spinning} delay={800} />
              <Reel symbol={reels[1]} spinning={spinning} delay={1100} />
              <Reel symbol={reels[2]} spinning={spinning} delay={1400} />
            </View>

            {/* Last Win Display */}
            {lastResult && lastResult.payout > 0 && (
              <View className="mb-4 rounded-xl bg-bullish/20 px-4 py-2">
                <Text className="text-center text-lg font-bold text-bullish">
                  贏了 {formatMoney(lastResult.payout)}!
                </Text>
                <Text className="text-center text-sm text-bullish">
                  {lastResult.multiplier}x 倍率
                </Text>
              </View>
            )}

            {/* Bet Amount Selection */}
            <View className="mb-4 w-full">
              <Text className="mb-2 text-center text-sm text-text-secondary">
                下注金額
              </Text>
              <View className="flex-row gap-2">
                {[100, 500, 1000].map((amt) => (
                  <Pressable
                    key={amt}
                    onPress={() => setBetAmount(amt)}
                    disabled={spinning}
                    className={`flex-1 items-center rounded-xl py-3 ${
                      betAmount === amt ? 'bg-primary' : 'bg-background'
                    } ${spinning ? 'opacity-50' : ''}`}
                  >
                    <Text
                      className={`font-semibold ${
                        betAmount === amt ? 'text-white' : 'text-text-secondary'
                      }`}
                    >
                      ${formatNumber(amt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Spin Buttons */}
            <View className="w-full flex-row gap-3">
              <Button
                onPress={handleSpin}
                loading={spinning}
                disabled={isAutoSpin}
                className="flex-1"
                variant="cta"
              >
                <View className="flex-row items-center gap-2">
                  <Play size={18} color="white" />
                  <Text className="font-semibold text-white">轉動</Text>
                </View>
              </Button>
              <Pressable
                onPress={toggleAutoSpin}
                disabled={spinning}
                className={`items-center justify-center rounded-xl px-4 ${
                  isAutoSpin ? 'bg-cta' : 'bg-background'
                }`}
              >
                <RotateCcw
                  size={20}
                  color={isAutoSpin ? 'white' : COLORS.textSecondary}
                />
              </Pressable>
            </View>

            {isAutoSpin && (
              <Text className="mt-2 text-xs text-cta">自動轉動中...</Text>
            )}
          </CardContent>
        </Card>

        {/* Session Stats */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Text className="mb-3 font-semibold text-text-primary">
              本輪統計
            </Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">轉動次數</Text>
                <Text className="font-mono text-sm text-text-primary">
                  {sessionStats.spins}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">總下注</Text>
                <Text className="font-mono text-sm text-text-primary">
                  {formatMoney(sessionStats.totalBet)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">總回收</Text>
                <Text className="font-mono text-sm text-text-primary">
                  {formatMoney(sessionStats.totalPayout)}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-border pt-2">
                <Text className="text-sm font-semibold text-text-secondary">
                  損益
                </Text>
                <Text
                  className={`font-mono text-sm font-semibold ${
                    netProfit >= 0 ? 'text-bullish' : 'text-bearish'
                  }`}
                >
                  {formatMoney(netProfit)} ({roi >= 0 ? '+' : ''}
                  {roi.toFixed(1)}%)
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Payout Table */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <Text className="mb-3 font-semibold text-text-primary">賠率表</Text>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">7️⃣ 7️⃣ 7️⃣</Text>
                <Badge variant="bullish">100x</Badge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">💎 💎 💎</Text>
                <Badge variant="secondary">50x</Badge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">🔔 🔔 🔔</Text>
                <Badge variant="secondary">20x</Badge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">🍇 🍇 🍇</Text>
                <Badge variant="secondary">10x</Badge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">🍋 🍋 🍋</Text>
                <Badge variant="secondary">5x</Badge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">🍒 🍒 🍒</Text>
                <Badge variant="secondary">3x</Badge>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-2xl">🍒 🍒 ❓</Text>
                <Badge variant="outline">2x</Badge>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
