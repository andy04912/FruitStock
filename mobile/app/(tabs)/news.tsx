import React, { useState, useEffect, useCallback } from 'react';
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
import axios from 'axios';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Trophy,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, Badge } from '../../components/ui';
import { COLORS } from '../../utils/constants';
import { formatMoney } from '../../utils/format';

interface NewsItem {
  id: number;
  event_type: string;
  title: string;
  description: string;
  impact_multiplier?: number;
  target_stock?: string;
  created_at: string;
}

interface Prediction {
  id: number;
  guru_name: string;
  stock_id: number;
  stock_symbol: string;
  prediction: 'BULLISH' | 'BEARISH';
  reason: string;
  confidence: number;
  created_at: string;
  resolved_at?: string;
  is_correct?: boolean;
}

// News Item Component
const NewsCard = React.memo(({ item }: { item: NewsItem }) => {
  const isRace = item.event_type?.toLowerCase().includes('race');
  const isBullish = !!(item.impact_multiplier && item.impact_multiplier > 1);
  const isBearish = !!(item.impact_multiplier && item.impact_multiplier < 1);

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              {isBullish && (
                <Badge variant="bullish" size="sm">
                  <TrendingUp size={12} color={COLORS.bullish} />
                  <Text className="ml-1 text-[10px] text-bullish">利多</Text>
                </Badge>
              )}
              {isBearish && (
                <Badge variant="bearish" size="sm">
                  <TrendingDown size={12} color={COLORS.bearish} />
                  <Text className="ml-1 text-[10px] text-bearish">利空</Text>
                </Badge>
              )}
              {isRace && (
                <Badge variant="secondary" size="sm">
                  <Trophy size={12} color={COLORS.secondary} />
                  <Text className="ml-1 text-[10px] text-secondary">賽馬</Text>
                </Badge>
              )}
            </View>
            <Text className="text-base font-semibold text-text-primary">
              {item.title || item.description}
            </Text>
            {item.target_stock && (
              <Text className="mt-1 text-xs text-primary">
                相關股票: {item.target_stock}
              </Text>
            )}
          </View>
        </View>
        <Text className="mt-2 text-xs text-text-secondary">
          {new Date(item.created_at).toLocaleString('zh-TW')}
        </Text>
      </CardContent>
    </Card>
  );
});

// Prediction Card Component
const PredictionCard = React.memo(({ item }: { item: Prediction }) => {
  const isBullish = item.prediction === 'BULLISH';

  return (
    <Pressable onPress={() => router.push(`/stock/${item.stock_id}`)}>
      <Card className="mb-3 active:opacity-80">
        <CardContent className="p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <MessageCircle size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text className="text-sm font-bold text-secondary">
                  {item.guru_name}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {item.stock_symbol}
                </Text>
              </View>
            </View>
            <Badge variant={isBullish ? 'bullish' : 'bearish'}>
              {isBullish ? (
                <>
                  <TrendingUp size={12} color={COLORS.bullish} />
                  <Text className="ml-1 text-xs text-bullish">看漲</Text>
                </>
              ) : (
                <>
                  <TrendingDown size={12} color={COLORS.bearish} />
                  <Text className="ml-1 text-xs text-bearish">看跌</Text>
                </>
              )}
            </Badge>
          </View>
          <Text className="mt-3 text-sm text-text-primary" numberOfLines={2}>
            {item.reason}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-text-secondary">
              信心度: {(item.confidence * 100).toFixed(0)}%
            </Text>
            {item.is_correct !== undefined && (
              <Badge variant={item.is_correct ? 'bullish' : 'bearish'} size="sm">
                {item.is_correct ? '預測成功' : '預測失敗'}
              </Badge>
            )}
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
});

type TabType = 'news' | 'race' | 'guru';

export default function NewsScreen() {
  const { API_URL } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('news');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [newsRes, predictionsRes] = await Promise.all([
        axios.get(`${API_URL}/news?limit=50`),
        axios.get(`${API_URL}/predictions?limit=30`),
      ]);
      setNews(newsRes.data || []);
      setPredictions(predictionsRes.data || []);
    } catch (e) {
      console.error('Failed to fetch news:', e);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Filter news based on tab
  const marketNews = news.filter(
    (n) => !n.event_type?.toLowerCase().includes('race')
  );
  const raceNews = news.filter((n) =>
    n.event_type?.toLowerCase().includes('race')
  );

  const renderNewsItem = useCallback(
    ({ item }: { item: NewsItem }) => <NewsCard item={item} />,
    []
  );

  const renderPredictionItem = useCallback(
    ({ item }: { item: Prediction }) => <PredictionCard item={item} />,
    []
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case 'news':
        return { data: marketNews, renderItem: renderNewsItem };
      case 'race':
        return { data: raceNews, renderItem: renderNewsItem };
      case 'guru':
        return { data: predictions, renderItem: renderPredictionItem };
    }
  };

  const { data, renderItem } = getCurrentData();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="border-b border-border px-4 pb-4 pt-2">
        <Text className="text-2xl font-bold text-primary">新聞中心</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border">
        {[
          { key: 'news', label: '市場快訊', icon: Newspaper },
          { key: 'race', label: '賽馬戰報', icon: Trophy },
          { key: 'guru', label: '名嘴預言', icon: MessageCircle },
        ].map(({ key, label, icon: Icon }) => (
          <Pressable
            key={key}
            onPress={() => setActiveTab(key as TabType)}
            className={`flex-1 flex-row items-center justify-center gap-2 py-3 ${
              activeTab === key ? 'border-b-2 border-primary' : ''
            }`}
          >
            <Icon
              size={16}
              color={activeTab === key ? COLORS.primary : COLORS.textSecondary}
            />
            <Text
              className={`text-sm font-medium ${
                activeTab === key ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlashList
          data={data as any[]}
          renderItem={renderItem as any}
          keyExtractor={(item: any) => item.id.toString()}
          estimatedItemSize={120}
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
              <Text className="text-text-secondary">暫無資料...</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
