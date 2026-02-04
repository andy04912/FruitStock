import React, { useState, useEffect, useCallback } from 'react';
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
import { ArrowLeft, Plus, Minus, RefreshCcw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { COLORS } from '../utils/constants';
import { formatMoney, formatNumber } from '../utils/format';
import { sounds } from '../utils/sound';

interface PlayingCardData {
  suit: string;
  rank: string;
  hidden?: boolean;
}

interface GameState {
  status: 'betting' | 'playing' | 'dealer_turn' | 'finished';
  player_hand: PlayingCardData[];
  dealer_hand: PlayingCardData[];
  player_value: number;
  dealer_value: number;
  bet: number;
  result?: 'win' | 'lose' | 'push' | 'blackjack';
  payout?: number;
}

// Playing Card Component
const PlayingCard = ({
  card,
  hidden = false,
}: {
  card: PlayingCardData;
  hidden?: boolean;
}) => {
  const getSuitColor = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? COLORS.bullish : '#1a1a2e';
  };

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'diamonds':
        return '♦';
      case 'clubs':
        return '♣';
      case 'spades':
        return '♠';
      default:
        return '';
    }
  };

  if (hidden) {
    return (
      <View className="h-24 w-16 items-center justify-center rounded-lg border border-primary bg-primary/20">
        <Text className="text-2xl text-primary">?</Text>
      </View>
    );
  }

  return (
    <View className="h-24 w-16 items-center justify-center rounded-lg border border-border bg-white">
      <Text className="text-lg font-bold" style={{ color: getSuitColor(card.suit) }}>
        {card.rank}
      </Text>
      <Text className="text-xl" style={{ color: getSuitColor(card.suit) }}>
        {getSuitSymbol(card.suit)}
      </Text>
    </View>
  );
};

// Hand Display Component
const HandDisplay = ({
  cards,
  value,
  label,
  hideSecond = false,
}: {
  cards: PlayingCardData[];
  value: number;
  label: string;
  hideSecond?: boolean;
}) => (
  <View className="items-center">
    <View className="mb-2 flex-row items-center gap-2">
      <Text className="text-sm font-semibold text-text-primary">{label}</Text>
      {!hideSecond && (
        <Badge variant="secondary" size="sm">
          {value}
        </Badge>
      )}
    </View>
    <View className="flex-row gap-2">
      {cards.map((card, index) => (
        <PlayingCard
          key={index}
          card={card}
          hidden={hideSecond && index === 1}
        />
      ))}
    </View>
  </View>
);

export default function BlackjackScreen() {
  const { API_URL, user, refreshUser } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Start new game
  const startGame = async () => {
    if ((user?.balance || 0) < betAmount) {
      toast({ title: '餘額不足', preset: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post<GameState>(`${API_URL}/blackjack/start`, {
        bet: betAmount,
      });

      setGame(res.data);
      await refreshUser();
      await sounds.playCardFlip();
    } catch (e: any) {
      toast({
        title: '開始遊戲失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Player actions
  const playerAction = async (action: 'hit' | 'stand' | 'double') => {
    if (!game) return;

    setActionLoading(true);
    try {
      const res = await axios.post<GameState>(`${API_URL}/blackjack/action`, {
        action,
      });

      setGame(res.data);
      await sounds.playCardFlip();

      if (res.data.status === 'finished') {
        await refreshUser();
        await handleGameEnd(res.data);
      }
    } catch (e: any) {
      toast({
        title: '操作失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGameEnd = async (gameState: GameState) => {
    if (gameState.result === 'blackjack') {
      await sounds.playWin();
      toast({
        title: 'Blackjack!',
        message: `贏得 ${formatMoney(gameState.payout || 0)}`,
        preset: 'done',
      });
    } else if (gameState.result === 'win') {
      await sounds.playWin();
      toast({
        title: '你贏了!',
        message: `贏得 ${formatMoney(gameState.payout || 0)}`,
        preset: 'done',
      });
    } else if (gameState.result === 'push') {
      toast({
        title: '平手',
        message: '下注金額已退還',
        preset: 'custom',
        icon: { ios: { name: 'equal.circle', color: COLORS.secondary } },
      });
    } else {
      await sounds.playError();
      toast({
        title: '你輸了',
        message: `損失 ${formatMoney(gameState.bet)}`,
        preset: 'error',
      });
    }
  };

  const getResultColor = () => {
    if (!game?.result) return '';
    switch (game.result) {
      case 'blackjack':
      case 'win':
        return 'text-bullish';
      case 'lose':
        return 'text-bearish';
      default:
        return 'text-secondary';
    }
  };

  const getResultText = () => {
    if (!game?.result) return '';
    switch (game.result) {
      case 'blackjack':
        return 'BLACKJACK!';
      case 'win':
        return '你贏了!';
      case 'lose':
        return '你輸了';
      case 'push':
        return '平手';
      default:
        return '';
    }
  };

  const isPlaying = game?.status === 'playing';
  const isFinished = game?.status === 'finished';
  const canDouble = isPlaying && game.player_hand.length === 2 && (user?.balance || 0) >= game.bet;

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
        <Text className="text-xl font-bold text-primary">21點</Text>
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

        {/* Game Table */}
        <Card className="mb-4">
          <CardContent className="p-6">
            {!game ? (
              // Betting Phase
              <View className="items-center">
                <Text className="mb-4 text-lg font-semibold text-text-primary">
                  選擇下注金額
                </Text>

                {/* Bet Amount Selection */}
                <View className="mb-6 w-full flex-row gap-2">
                  {[100, 500, 1000, 5000].map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => setBetAmount(amt)}
                      className={`flex-1 items-center rounded-xl py-3 ${
                        betAmount === amt ? 'bg-primary' : 'bg-background'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          betAmount === amt ? 'text-white' : 'text-text-secondary'
                        }`}
                      >
                        ${formatNumber(amt)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Button
                  onPress={startGame}
                  loading={loading}
                  variant="cta"
                  className="w-full"
                >
                  開始遊戲 (${formatNumber(betAmount)})
                </Button>
              </View>
            ) : (
              // Game in Progress
              <View className="items-center gap-6">
                {/* Dealer Hand */}
                <HandDisplay
                  cards={game.dealer_hand}
                  value={game.dealer_value}
                  label="莊家"
                  hideSecond={isPlaying}
                />

                {/* Game Result */}
                {isFinished && (
                  <View className="py-4">
                    <Text className={`text-center text-2xl font-bold ${getResultColor()}`}>
                      {getResultText()}
                    </Text>
                    {game.payout && game.payout > 0 && (
                      <Text className="mt-1 text-center text-lg text-bullish">
                        +{formatMoney(game.payout)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Player Hand */}
                <HandDisplay
                  cards={game.player_hand}
                  value={game.player_value}
                  label="你"
                />

                {/* Action Buttons */}
                {isPlaying && (
                  <View className="w-full flex-row gap-2">
                    <Button
                      onPress={() => playerAction('hit')}
                      loading={actionLoading}
                      className="flex-1"
                    >
                      <View className="flex-row items-center gap-1">
                        <Plus size={16} color="white" />
                        <Text className="font-semibold text-white">要牌</Text>
                      </View>
                    </Button>
                    <Button
                      onPress={() => playerAction('stand')}
                      loading={actionLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      <View className="flex-row items-center gap-1">
                        <Minus size={16} color={COLORS.primary} />
                        <Text className="font-semibold text-primary">停牌</Text>
                      </View>
                    </Button>
                    {canDouble && (
                      <Button
                        onPress={() => playerAction('double')}
                        loading={actionLoading}
                        variant="cta"
                        className="flex-1"
                      >
                        <Text className="font-semibold text-white">加倍</Text>
                      </Button>
                    )}
                  </View>
                )}

                {/* New Game Button */}
                {isFinished && (
                  <Button
                    onPress={() => setGame(null)}
                    variant="cta"
                    className="w-full"
                  >
                    <View className="flex-row items-center gap-2">
                      <RefreshCcw size={16} color="white" />
                      <Text className="font-semibold text-white">再玩一局</Text>
                    </View>
                  </Button>
                )}

                {/* Current Bet Display */}
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-text-secondary">下注:</Text>
                  <Text className="font-mono text-sm font-semibold text-primary">
                    ${formatNumber(game.bet)}
                  </Text>
                </View>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <Text className="mb-3 font-semibold text-text-primary">遊戲規則</Text>
            <View className="gap-2">
              <Text className="text-sm text-text-secondary">
                • 目標是讓手牌點數接近 21 點，但不能超過
              </Text>
              <Text className="text-sm text-text-secondary">
                • A 可以算 1 或 11 點，J/Q/K 算 10 點
              </Text>
              <Text className="text-sm text-text-secondary">
                • Blackjack (首兩張為 21 點) 賠率 1.5x
              </Text>
              <Text className="text-sm text-text-secondary">
                • 一般獲勝賠率 1x，平手退還下注
              </Text>
              <Text className="text-sm text-text-secondary">
                • 加倍：只能在首兩張牌時使用，下注翻倍但只能再拿一張牌
              </Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
