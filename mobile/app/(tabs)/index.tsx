import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { toast } from 'burnt';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';

import { useSocket, Stock } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { NewsTicker } from '../../components/common';
import { COLORS, STOCK_CATEGORIES } from '../../utils/constants';

// Imported Components
import { StockCard } from '../../components/dashboard/StockCard';
import { TabButton } from '../../components/dashboard/TabButton';

export default function DashboardScreen() {
  const { marketData, isConnected } = useSocket();
  const { API_URL, token } = useAuth();
  
  // Use Set for O(1) watchlist lookup (Performance Rule: list-performance-item-expensive)
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<string>(STOCK_CATEGORIES.FRUIT);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch watchlist
  useEffect(() => {
    if (!API_URL || !token) return;

    const fetchWatchlist = async () => {
      try {
        const res = await axios.get(`${API_URL}/watchlist`);
        // Convert array to Set immediately
        setWatchlist(new Set(res.data.map((s: any) => s.id)));
      } catch (e) {
        console.error('Failed to fetch watchlist:', e);
      }
    };

    fetchWatchlist();
  }, [API_URL, token]);

  const toggleWatchlist = useCallback(async (stockId: number) => {
    try {
      if (watchlist.has(stockId)) {
        await axios.delete(`${API_URL}/watchlist/${stockId}`);
        setWatchlist((prev) => {
          const next = new Set(prev);
          next.delete(stockId);
          return next;
        });
        toast({ title: '已移除自選', preset: 'done' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await axios.post(`${API_URL}/watchlist/${stockId}`);
        setWatchlist((prev) => {
          const next = new Set(prev);
          next.add(stockId);
          return next;
        });
        toast({ title: '已加入自選', preset: 'done' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      toast({ title: '操作失敗', preset: 'error' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [API_URL, watchlist]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // WebSocket handles real-time updates, so just wait a bit
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  // Filter and sort stocks
  const getStocksByCategory = useCallback(
    (category: string) => {
      // Use efficient sorting (JS Performance Rule: js-min-max-loop / js-tosorted-immutable)
      return (marketData.stocks || [])
        .filter((s) => (category === 'FRUIT' ? !s.category || s.category === 'FRUIT' : s.category === category))
        .sort((a, b) => {
          const aFav = watchlist.has(a.id);
          const bFav = watchlist.has(b.id);
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
    ({ item, index }: { item: Stock; index: number }) => (
      <StockCard
        stock={item}
        isWatchlist={watchlist.has(item.id)}
        onToggleWatchlist={() => toggleWatchlist(item.id)}
        index={index}
      />
    ),
    [watchlist, toggleWatchlist]
  );

  const keyExtractor = useCallback((item: Stock) => item.id.toString(), []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-4 pt-2 shadow-sm bg-background z-10">
        <Text className="text-3xl font-extrabold text-primary tracking-tighter">FruitStock</Text>
        
        {/* Debug Button */}
        <Link href="/stock/1" asChild>
            <Pressable className="bg-red-500 px-3 py-1 rounded">
                <Text className="text-white text-xs">Test Nav</Text>
            </Pressable>
        </Link>
        <View className={`flex-row items-center gap-2 rounded-full border px-3 py-1 ${isConnected ? 'border-primary/20 bg-primary/10' : 'border-cta/20 bg-cta/10'}`}>
          <View
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-primary shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-cta'
            }`}
          />
          <Text className={`font-mono text-xs font-bold ${isConnected ? 'text-primary' : 'text-cta'}`}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* News Ticker */}
      <View className="shadow-sm z-0">
         {/* <NewsTicker /> */}
      </View>

      {marketData.stocks.length === 0 ? (
        // Loading State
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="mt-4 font-mono text-primary animate-pulse">正在連接交易所...</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="pt-2" />

          {/* Market Tabs */}
          <View className="flex-row border-b border-border px-4 pb-2 mb-2">
            <TabButton
              label="水果"
              emoji="🍎"
              active={activeTab === STOCK_CATEGORIES.FRUIT}
              color="#22c55e"
              onPress={() => setActiveTab(STOCK_CATEGORIES.FRUIT)}
            />
            <TabButton
              label="根莖"
              emoji="🥕"
              active={activeTab === STOCK_CATEGORIES.ROOT}
              color="#f59e0b"
              onPress={() => setActiveTab(STOCK_CATEGORIES.ROOT)}
            />
            <TabButton
              label="肉類"
              emoji="🍖"
              active={activeTab === STOCK_CATEGORIES.MEAT}
              color="#ef4444"
              onPress={() => setActiveTab(STOCK_CATEGORIES.MEAT)}
            />
          </View>

          {/* Category Description */}
          {activeTab === STOCK_CATEGORIES.ROOT && (
            <View className="px-4 py-2 bg-yellow-500/5 mb-2 mx-4 rounded-lg border border-yellow-500/20">
              <Text className="text-center font-mono text-xs text-yellow-600 font-bold">
                ✨ 穩定配息 (Stable Dividend) - 低波動避險首選
              </Text>
            </View>
          )}
          {activeTab === STOCK_CATEGORIES.MEAT && (
            <View className="px-4 py-2 bg-red-500/5 mb-2 mx-4 rounded-lg border border-red-500/20">
              <Text className="text-center font-mono text-xs text-cta font-bold">
                ⚠️ 高風險高報酬 (High Volatility) - 強心臟專區
              </Text>
            </View>
          )}

          {/* Stock List */}
          <FlatList
            data={currentStocks}
            renderItem={renderStockItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-20 opacity-50">
                <Text className="text-6xl mb-4">😶‍🌫️</Text>
                <Text className="text-text-secondary font-bold text-lg">
                  {activeTab === STOCK_CATEGORIES.FRUIT && '水果市場暫無商品...'}
                  {activeTab === STOCK_CATEGORIES.ROOT && '根莖市場暫無商品...'}
                  {activeTab === STOCK_CATEGORIES.MEAT && '肉類市場籌備中...'}
                </Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}
