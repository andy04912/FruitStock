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
  Trophy,
  Users,
  Calendar,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, Badge } from '../../components/ui';
import { COLORS } from '../../utils/constants';
import { formatSmartMoney, formatCompactNumber } from '../../utils/format';

interface LeaderboardEntry {
  user_id: number;
  username: string;
  nickname?: string;
  net_worth: number;
  rank: number;
  rank_change?: number;
}

interface HallOfFameEntry {
  user_id: number;
  username: string;
  nickname?: string;
  champion_days: number;
}

// Podium Component for Top 3
const Podium = ({ entries }: { entries: LeaderboardEntry[] }) => {
  const top3 = entries.slice(0, 3);
  const positions = [1, 0, 2]; // Order: 2nd, 1st, 3rd for visual layout

  const getColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FFD700'; // Gold
      case 2:
        return '#C0C0C0'; // Silver
      case 3:
        return '#CD7F32'; // Bronze
      default:
        return COLORS.textSecondary;
    }
  };

  const getHeight = (rank: number) => {
    switch (rank) {
      case 1:
        return 100;
      case 2:
        return 80;
      case 3:
        return 60;
      default:
        return 50;
    }
  };

  return (
    <View className="mb-4 flex-row items-end justify-center gap-2 px-4">
      {positions.map((pos) => {
        const entry = top3[pos];
        if (!entry) return <View key={pos} className="flex-1" />;

        const rank = pos + 1;
        const color = getColor(rank);
        const height = getHeight(rank);

        return (
          <Pressable
            key={entry.user_id}
            onPress={() => router.push(`/profile/${entry.user_id}`)}
            className="flex-1 items-center"
          >
            <View
              className="w-full items-center justify-center rounded-t-xl"
              style={{ height, backgroundColor: `${color}20` }}
            >
              <Text className="text-2xl font-bold" style={{ color }}>
                #{rank}
              </Text>
              <Trophy size={20} color={color} />
            </View>
            <View className="w-full items-center rounded-b-xl bg-background-card p-2">
              <Text
                className="text-sm font-bold text-text-primary"
                numberOfLines={1}
              >
                {entry.nickname || entry.username}
              </Text>
              <Text className="font-mono text-xs text-primary">
                {formatSmartMoney(entry.net_worth)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

// Leaderboard Row Component
const LeaderboardRow = React.memo(
  ({
    entry,
    currentUserId,
  }: {
    entry: LeaderboardEntry;
    currentUserId?: number;
  }) => {
    const isCurrentUser = entry.user_id === currentUserId;

    const getRankChangeIcon = () => {
      if (!entry.rank_change || entry.rank_change === 0) {
        return <Minus size={12} color={COLORS.textSecondary} />;
      }
      if (entry.rank_change > 0) {
        return <TrendingUp size={12} color={COLORS.bullish} />;
      }
      return <TrendingDown size={12} color={COLORS.bearish} />;
    };

    return (
      <Pressable onPress={() => router.push(`/profile/${entry.user_id}`)}>
        <Card
          className={`mb-2 ${isCurrentUser ? 'border-primary' : ''}`}
        >
          <CardContent className="flex-row items-center justify-between p-3">
            <View className="flex-row items-center gap-3">
              <View className="h-8 w-8 items-center justify-center">
                <Text className="text-lg font-bold text-text-secondary">
                  #{entry.rank}
                </Text>
              </View>
              <View>
                <View className="flex-row items-center gap-2">
                  <Text
                    className={`text-sm font-semibold ${
                      isCurrentUser ? 'text-primary' : 'text-text-primary'
                    }`}
                  >
                    {entry.nickname || entry.username}
                  </Text>
                  {isCurrentUser && (
                    <Badge variant="default" size="sm">
                      YOU
                    </Badge>
                  )}
                </View>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="font-mono text-sm font-semibold text-primary">
                {formatSmartMoney(entry.net_worth)}
              </Text>
              {getRankChangeIcon()}
            </View>
          </CardContent>
        </Card>
      </Pressable>
    );
  }
);

// Hall of Fame Row
const HallOfFameRow = React.memo(({ entry, rank }: { entry: HallOfFameEntry; rank: number }) => (
  <Pressable onPress={() => router.push(`/profile/${entry.user_id}`)}>
    <Card className="mb-2">
      <CardContent className="flex-row items-center justify-between p-3">
        <View className="flex-row items-center gap-3">
          <Star size={20} color="#FFD700" fill="#FFD700" />
          <Text className="text-sm font-semibold text-text-primary">
            {entry.nickname || entry.username}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="font-mono text-sm font-bold text-primary">
            {entry.champion_days}
          </Text>
          <Text className="text-xs text-text-secondary">天</Text>
        </View>
      </CardContent>
    </Card>
  </Pressable>
));

type TabType = 'global' | 'friends' | 'history' | 'fame';

export default function LeaderboardScreen() {
  const { API_URL, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [globalData, setGlobalData] = useState<LeaderboardEntry[]>([]);
  const [friendsData, setFriendsData] = useState<LeaderboardEntry[]>([]);
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [globalRes, friendsRes, fameRes] = await Promise.all([
        axios.get(`${API_URL}/leaderboard?limit=100`),
        axios.get(`${API_URL}/leaderboard/friends`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/leaderboard/hall-of-fame`).catch(() => ({ data: [] })),
      ]);

      setGlobalData(
        globalRes.data.map((entry: any, index: number) => ({
          ...entry,
          rank: index + 1,
        }))
      );
      setFriendsData(
        friendsRes.data.map((entry: any, index: number) => ({
          ...entry,
          rank: index + 1,
        }))
      );
      setHallOfFame(fameRes.data || []);
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const renderLeaderboardItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow entry={item} currentUserId={user?.id} />
    ),
    [user?.id]
  );

  const renderFameItem = useCallback(
    ({ item, index }: { item: HallOfFameEntry; index: number }) => (
      <HallOfFameRow entry={item} rank={index + 1} />
    ),
    []
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case 'global':
        return globalData;
      case 'friends':
        return friendsData;
      case 'fame':
        return hallOfFame;
      default:
        return globalData;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="border-b border-border px-4 pb-4 pt-2">
        <Text className="text-2xl font-bold text-primary">排行榜</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border">
        {[
          { key: 'global', label: '全服', icon: Trophy },
          { key: 'friends', label: '好友', icon: Users },
          { key: 'fame', label: '名人堂', icon: Star },
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
        <View className="flex-1">
          {/* Podium for global/friends tabs */}
          {(activeTab === 'global' || activeTab === 'friends') &&
            getCurrentData().length > 0 && (
              <Podium entries={getCurrentData() as LeaderboardEntry[]} />
            )}

          {/* List */}
          <FlashList
            data={
              activeTab === 'fame'
                ? getCurrentData()
                : (getCurrentData() as LeaderboardEntry[]).slice(3)
            }
            renderItem={
              activeTab === 'fame'
                ? (renderFameItem as any)
                : renderLeaderboardItem
            }
            keyExtractor={(item: any) =>
              item.user_id?.toString() || item.id?.toString()
            }
            estimatedItemSize={60}
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
        </View>
      )}
    </SafeAreaView>
  );
}
