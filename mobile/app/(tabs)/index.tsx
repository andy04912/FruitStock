import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { toast } from 'burnt';
import axios from 'axios';
import {
  TrendingUp,
  TrendingDown,
  Heart,
  Gamepad2,
  Gift,
  Ticket,
} from 'lucide-react-native';
import { useSocket, Stock } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, Button } from '../../components/ui';
import { formatPrice, formatPercent } from '../../utils/format';
import { sounds } from '../../utils/sound';
import { COLORS, STOCK_CATEGORIES } from '../../utils/constants';

// Stock Card Component
interface StockCardProps {
  stock: Stock;
  isWatchlist: boolean;
  onToggleWatchlist: () => void;
}

const StockCard = React.memo(({ stock, isWatchlist, onToggleWatchlist }: StockCardProps) => {
  const isUp = stock.change_percent >= 0;
  const colorClass = isUp ? 'text-bullish' : 'text-bearish';

  const handlePress = () => {
    router.push(`/stock/${stock.id}`);
  };

  const handleHeartPress = async () => {
    await sounds.playTap();
    onToggleWatchlist();
  };

  return (
    <Pressable onPress={handlePress} className="mb-3">
      <Card className="bg-background-card active:opacity-80">
        <CardContent className="flex-row items-center justify-between p-4">
          {/* Left Side: Heart + Name */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={handleHeartPress}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-primary/20"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Heart
                size={20}
                color={isWatchlist ? COLORS.cta : COLORS.textSecondary}
                fill={isWatchlist ? COLORS.cta : 'transparent'}
              />
            </Pressable>

            <View>
              <Text className="text-lg font-bold text-text-primary">
                {stock.name}
              </Text>
              <Text className="font-mono text-xs text-text-secondary">
                {stock.symbol}
              </Text>
            </View>
          </View>

          {/* Right Side: Price */}
          <View className="items-end">
            <Text className={`font-mono text-xl font-bold ${colorClass}`}>
              {formatPrice(stock.price)}
            </Text>
            <Text className={`font-mono text-xs font-semibold ${colorClass}`}>
              {formatPercent(stock.change_percent)}
            </Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
});

// Game Entry Card
interface GameCardProps {
  title: string;
  icon: React.ReactNode;
  route: string;
  color: string;
}

const GameCard = ({ title, icon, route, color }: GameCardProps) => (
  <Pressable
    onPress={() => router.push(route as any)}
    className="flex-1 items-center justify-center rounded-xl border border-border bg-background-card p-4 active:opacity-80"
    style={{ minHeight: 80 }}
  >
    {icon}
    <Text className="mt-2 text-xs font-semibold text-text-primary">{title}</Text>
  </Pressable>
);

// Market Tab Button
interface TabButtonProps {
  label: string;
  emoji: string;
  active: boolean;
  color: string;
  onPress: () => void;
}

const TabButton = ({ label, emoji, active, color, onPress }: TabButtonProps) => (
  <Pressable
    onPress={onPress}
    className={`flex-1 items-center border-b-2 pb-2 ${
      active ? `border-${color}` : 'border-transparent'
    }`}
    style={{ borderBottomColor: active ? color : 'transparent' }}
  >
    <Text
      className={`text-base font-bold ${active ? '' : 'text-text-secondary'}`}
      style={{ color: active ? color : undefined }}
    >
      {emoji} {label}
    </Text>
  </Pressable>
);

export default function DashboardScreen() {
  const { marketData, isConnected } = useSocket();
  const { API_URL, token } = useAuth();
  const [watchlist, setWatchlist] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<string>(STOCK_CATEGORIES.FRUIT);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch watchlist
  useEffect(() => {
    if (!API_URL || !token) return;

    const fetchWatchlist = async () => {
      try {
        const res = await axios.get(`${API_URL}/watchlist`);
        setWatchlist(res.data.map((s: any) => s.id));
      } catch (e) {
        console.error('Failed to fetch watchlist:', e);
      }
    };

    fetchWatchlist();
  }, [API_URL, token]);

  const toggleWatchlist = useCallback(async (stockId: number) => {
    try {
      if (watchlist.includes(stockId)) {
        await axios.delete(`${API_URL}/watchlist/${stockId}`);
        setWatchlist((prev) => prev.filter((id) => id !== stockId));
        toast({ title: '已移除自選', preset: 'done' });
      } else {
        await axios.post(`${API_URL}/watchlist/${stockId}`);
        setWatchlist((prev) => [...prev, stockId]);
        toast({ title: '已加入自選', preset: 'done' });
      }
    } catch (e) {
      toast({ title: '操作失敗', preset: 'error' });
    }
  }, [API_URL, watchlist]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // WebSocket handles real-time updates, so just wait a bit
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  // Filter and sort stocks
  const getStocksByCategory = useCallback(
    (category: string) => {
      return (marketData.stocks || [])
        .filter((s) => (category === 'FRUIT' ? !s.category || s.category === 'FRUIT' : s.category === category))
        .sort((a, b) => {
          const aFav = watchlist.includes(a.id);
          const bFav = watchlist.includes(b.id);
          if (aFav && !bFav) return -1;
          if (!aFav && bFav) return 1;
          return a.id - b.id;
        });
    },
    [marketData.stocks, watchlist]
  );

  const currentStocks = useMemo(
    () => getStocksByCategory(activeTab),
    [activeTab, getStocksByCategory]
  );

  const renderStockItem = useCallback(
    ({ item }: { item: Stock }) => (
      <StockCard
        stock={item}
        isWatchlist={watchlist.includes(item.id)}
        onToggleWatchlist={() => toggleWatchlist(item.id)}
      />
    ),
    [watchlist, toggleWatchlist]
  );

  const keyExtractor = useCallback((item: Stock) => item.id.toString(), []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-4 pt-2">
        <Text className="text-2xl font-bold text-primary">市場綜覽</Text>
        <View className="flex-row items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
          <View
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-primary' : 'bg-cta'
            }`}
          />
          <Text className="font-mono text-xs text-primary">
            {isConnected ? '連線中' : '斷線'}
          </Text>
        </View>
      </View>

      {marketData.stocks.length === 0 ? (
        // Loading State
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="mt-4 font-mono text-primary">正在連接交易所...</Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Game Shortcuts */}
          <View className="flex-row gap-3 px-4 py-4">
            <GameCard
              title="賽馬"
              icon={<Ticket size={24} color={COLORS.cta} />}
              route="/race"
              color={COLORS.cta}
            />
            <GameCard
              title="老虎機"
              icon={<Gamepad2 size={24} color={COLORS.primary} />}
              route="/slots"
              color={COLORS.primary}
            />
            <GameCard
              title="21點"
              icon={<Gift size={24} color={COLORS.bearish} />}
              route="/blackjack"
              color={COLORS.bearish}
            />
            <GameCard
              title="抽卡"
              icon={<Gift size={24} color={COLORS.bullish} />}
              route="/cardstore"
              color={COLORS.bullish}
            />
          </View>

          {/* Market Tabs */}
          <View className="flex-row border-b border-border px-4 pb-2">
            <TabButton
              label="水果"
              emoji=""
              active={activeTab === STOCK_CATEGORIES.FRUIT}
              color="#22c55e"
              onPress={() => setActiveTab(STOCK_CATEGORIES.FRUIT)}
            />
            <TabButton
              label="根莖"
              emoji=""
              active={activeTab === STOCK_CATEGORIES.ROOT}
              color="#f59e0b"
              onPress={() => setActiveTab(STOCK_CATEGORIES.ROOT)}
            />
            <TabButton
              label="肉類"
              emoji=""
              active={activeTab === STOCK_CATEGORIES.MEAT}
              color="#ef4444"
              onPress={() => setActiveTab(STOCK_CATEGORIES.MEAT)}
            />
          </View>

          {/* Category Description */}
          {activeTab === STOCK_CATEGORIES.ROOT && (
            <View className="px-4 py-2">
              <Text className="text-center font-mono text-xs text-secondary">
                穩定配息 (Stable Dividend) - 低波動
              </Text>
            </View>
          )}
          {activeTab === STOCK_CATEGORIES.MEAT && (
            <View className="px-4 py-2">
              <Text className="text-center font-mono text-xs text-cta">
                高風險高報酬 (High Volatility)
              </Text>
            </View>
          )}

          {/* Stock List */}
          <FlashList
            data={currentStocks}
            renderItem={renderStockItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={80}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Text className="text-text-secondary">暫無商品...</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}
