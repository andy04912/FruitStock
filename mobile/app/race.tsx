import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
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
  runOnJS,
  useFrameCallback,
} from 'react-native-reanimated';
import { ArrowLeft, Trophy, Clock, DollarSign } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { COLORS } from '../utils/constants';
import { formatMoney, formatNumber } from '../utils/format';
import { sounds } from '../utils/sound';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRACK_WIDTH = SCREEN_WIDTH - 80;

interface Horse {
  id: number;
  name: string;
  speed: number;
  stamina: number;
  luck: number;
  odds: number;
}

interface Race {
  id: number;
  status: 'BETTING' | 'RACING' | 'FINISHED';
  betting_end_time?: string;
  horses: Horse[];
  results?: { horse_id: number; position: number }[];
}

interface Bet {
  horse_id: number;
  amount: number;
}

// Horse Track Component
const HorseTrack = ({
  horse,
  progress,
  isWinner,
  position,
}: {
  horse: Horse;
  progress: number;
  isWinner: boolean;
  position: number;
}) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(progress * TRACK_WIDTH, { duration: 100 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="mb-3">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-primary">
          #{position} {horse.name}
        </Text>
        <Badge variant={isWinner ? 'bullish' : 'secondary'} size="sm">
          {horse.odds.toFixed(1)}x
        </Badge>
      </View>
      <View className="h-10 overflow-hidden rounded-lg bg-background">
        <Animated.View
          className="h-full w-8 items-center justify-center rounded-lg bg-primary"
          style={animatedStyle}
        >
          <Text className="text-lg">{isWinner ? '🏆' : '🐴'}</Text>
        </Animated.View>
      </View>
    </View>
  );
};

export default function RaceScreen() {
  const { API_URL, user, refreshUser } = useAuth();
  const [race, setRace] = useState<Race | null>(null);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [betAmount, setBetAmount] = useState('100');
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [betting, setBetting] = useState(false);
  const [horseProgress, setHorseProgress] = useState<Record<number, number>>({});
  const [countdown, setCountdown] = useState<number | null>(null);

  // Fetch race data
  const fetchRace = useCallback(async () => {
    try {
      const [raceRes, betsRes] = await Promise.all([
        axios.get(`${API_URL}/race/current`),
        axios.get(`${API_URL}/race/my-bets`).catch(() => ({ data: [] })),
      ]);

      setRace(raceRes.data);
      setMyBets(betsRes.data || []);

      // Initialize progress
      if (raceRes.data?.horses) {
        const initialProgress: Record<number, number> = {};
        raceRes.data.horses.forEach((h: Horse) => {
          initialProgress[h.id] = 0;
        });
        setHorseProgress(initialProgress);
      }
    } catch (e) {
      console.error('Failed to fetch race:', e);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchRace();
    const interval = setInterval(fetchRace, 2000);
    return () => clearInterval(interval);
  }, [fetchRace]);

  // Countdown timer
  useEffect(() => {
    if (race?.status === 'BETTING' && race.betting_end_time) {
      const updateCountdown = () => {
        const endTime = new Date(race.betting_end_time!).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        setCountdown(diff);
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [race?.status, race?.betting_end_time]);

  // Simulate race animation when racing
  useEffect(() => {
    if (race?.status === 'RACING') {
      const interval = setInterval(() => {
        setHorseProgress((prev) => {
          const next = { ...prev };
          race.horses.forEach((horse) => {
            // Simple random progress based on horse stats
            const speed = horse.speed / 100;
            const randomFactor = 0.5 + Math.random() * horse.luck / 100;
            next[horse.id] = Math.min(1, (prev[horse.id] || 0) + speed * randomFactor * 0.1);
          });
          return next;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [race?.status, race?.horses]);

  const handleBet = async () => {
    if (!selectedHorse || !betAmount) {
      toast({ title: '請選擇馬匹和金額', preset: 'error' });
      return;
    }

    const amount = parseInt(betAmount);
    if (amount <= 0) {
      toast({ title: '請輸入有效金額', preset: 'error' });
      return;
    }

    setBetting(true);
    try {
      await axios.post(`${API_URL}/race/bet`, {
        horse_id: selectedHorse,
        amount,
      });

      toast({ title: '下注成功', preset: 'done' });
      await sounds.playBuy();
      await fetchRace();
      await refreshUser();
      setSelectedHorse(null);
    } catch (e: any) {
      toast({
        title: '下注失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
      await sounds.playError();
    } finally {
      setBetting(false);
    }
  };

  const getWinnerId = () => {
    if (race?.results && race.results.length > 0) {
      const winner = race.results.find((r) => r.position === 1);
      return winner?.horse_id;
    }
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const winnerId = getWinnerId();

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
        <Text className="text-xl font-bold text-primary">賽馬場</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Race Status */}
        <Card className="mb-4">
          <CardContent className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-2">
              <Trophy size={20} color={COLORS.cta} />
              <Text className="font-semibold text-text-primary">
                第 {race?.id || 0} 場
              </Text>
            </View>
            <Badge
              variant={
                race?.status === 'BETTING'
                  ? 'default'
                  : race?.status === 'RACING'
                  ? 'bullish'
                  : 'secondary'
              }
            >
              {race?.status === 'BETTING'
                ? '下注中'
                : race?.status === 'RACING'
                ? '比賽中'
                : '已結束'}
            </Badge>
          </CardContent>
        </Card>

        {/* Countdown */}
        {countdown !== null && countdown > 0 && (
          <Card className="mb-4">
            <CardContent className="flex-row items-center justify-center gap-2 p-4">
              <Clock size={20} color={COLORS.cta} />
              <Text className="text-lg font-bold text-cta">
                剩餘 {countdown} 秒
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Race Track */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Text className="mb-4 font-semibold text-text-primary">賽道</Text>
            {race?.horses.map((horse, index) => (
              <HorseTrack
                key={horse.id}
                horse={horse}
                progress={horseProgress[horse.id] || 0}
                isWinner={horse.id === winnerId}
                position={index + 1}
              />
            ))}
          </CardContent>
        </Card>

        {/* Betting Panel (only during betting phase) */}
        {race?.status === 'BETTING' && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <Text className="mb-4 font-semibold text-text-primary">下注</Text>

              {/* Horse Selection */}
              <View className="mb-4 gap-2">
                {race.horses.map((horse) => (
                  <Pressable
                    key={horse.id}
                    onPress={() => setSelectedHorse(horse.id)}
                    className={`flex-row items-center justify-between rounded-xl border p-3 ${
                      selectedHorse === horse.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background'
                    }`}
                  >
                    <View>
                      <Text className="font-semibold text-text-primary">
                        {horse.name}
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        速度: {horse.speed} | 耐力: {horse.stamina} | 幸運:{' '}
                        {horse.luck}
                      </Text>
                    </View>
                    <Badge variant="secondary">{horse.odds.toFixed(1)}x</Badge>
                  </Pressable>
                ))}
              </View>

              {/* Amount Input */}
              <View className="mb-4">
                <Text className="mb-2 text-sm text-text-secondary">下注金額</Text>
                <View className="flex-row gap-2">
                  {[100, 500, 1000].map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => setBetAmount(amt.toString())}
                      className={`flex-1 items-center rounded-lg py-2 ${
                        betAmount === amt.toString()
                          ? 'bg-primary'
                          : 'bg-background'
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          betAmount === amt.toString()
                            ? 'text-white'
                            : 'text-text-secondary'
                        }`}
                      >
                        ${formatNumber(amt)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Button onPress={handleBet} loading={betting} variant="cta">
                下注 ${formatNumber(parseInt(betAmount) || 0)}
              </Button>

              {/* Balance */}
              <View className="mt-3 items-center">
                <Text className="text-xs text-text-secondary">
                  可用餘額: {formatMoney(user?.balance || 0)}
                </Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* My Bets */}
        {myBets.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <Text className="mb-3 font-semibold text-text-primary">
                我的下注
              </Text>
              {myBets.map((bet, index) => {
                const horse = race?.horses.find((h) => h.id === bet.horse_id);
                const isWinningBet = bet.horse_id === winnerId;

                return (
                  <View
                    key={index}
                    className="mb-2 flex-row items-center justify-between rounded-lg bg-background p-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="font-medium text-text-primary">
                        {horse?.name || `馬匹 #${bet.horse_id}`}
                      </Text>
                      {isWinningBet && race?.status === 'FINISHED' && (
                        <Badge variant="bullish" size="sm">
                          勝出
                        </Badge>
                      )}
                    </View>
                    <Text className="font-mono text-sm text-primary">
                      ${formatNumber(bet.amount)}
                    </Text>
                  </View>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {race?.status === 'FINISHED' && race.results && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <Text className="mb-3 font-semibold text-text-primary">比賽結果</Text>
              {race.results
                .sort((a, b) => a.position - b.position)
                .map((result) => {
                  const horse = race.horses.find((h) => h.id === result.horse_id);
                  return (
                    <View
                      key={result.horse_id}
                      className="mb-2 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2">
                        <Text className="text-lg">
                          {result.position === 1
                            ? '🥇'
                            : result.position === 2
                            ? '🥈'
                            : result.position === 3
                            ? '🥉'
                            : `#${result.position}`}
                        </Text>
                        <Text className="font-medium text-text-primary">
                          {horse?.name}
                        </Text>
                      </View>
                      {result.position === 1 && (
                        <Badge variant="bullish">{horse?.odds.toFixed(1)}x</Badge>
                      )}
                    </View>
                  );
                })}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
