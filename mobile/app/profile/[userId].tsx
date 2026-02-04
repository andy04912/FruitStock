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
import { useLocalSearchParams, router } from 'expo-router';
import { toast } from 'burnt';
import axios from 'axios';
import {
  ArrowLeft,
  User,
  UserPlus,
  UserMinus,
  Briefcase,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../../components/ui';
import { COLORS } from '../../utils/constants';
import {
  formatMoney,
  formatSmartMoney,
  formatPercent,
  formatNumber,
} from '../../utils/format';

interface UserProfile {
  id: number;
  username: string;
  nickname?: string;
  balance: number;
  created_at: string;
}

interface Portfolio {
  stock_id: number;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
  is_short?: boolean;
}

// Portfolio Item
const PortfolioItem = React.memo(({ item }: { item: Portfolio }) => {
  const isProfit = item.pnl >= 0;

  return (
    <Pressable onPress={() => router.push(`/stock/${item.stock_id}`)}>
      <Card className="mb-2">
        <CardContent className="flex-row items-center justify-between p-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-text-primary">
                {item.name}
              </Text>
              {item.is_short && (
                <Badge variant="bearish" size="sm">
                  空
                </Badge>
              )}
            </View>
            <Text className="text-xs text-text-secondary">
              {formatNumber(item.quantity)} 股
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-mono text-sm text-text-primary">
              {formatSmartMoney(item.current_price * item.quantity)}
            </Text>
            <Text
              className={`font-mono text-xs ${
                isProfit ? 'text-bullish' : 'text-bearish'
              }`}
            >
              {formatPercent(item.pnl_percent)}
            </Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
});

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { API_URL, user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, portfolioRes, friendsRes] = await Promise.all([
        axios.get(`${API_URL}/users/${userId}`),
        axios.get(`${API_URL}/users/${userId}/portfolio`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/friends`).catch(() => ({ data: [] })),
      ]);

      setProfile(profileRes.data);
      setPortfolio(portfolioRes.data || []);

      // Check if this user is a friend
      const friends = friendsRes.data || [];
      setIsFriend(friends.some((f: any) => f.id === parseInt(userId)));
    } catch (e) {
      console.error('Failed to fetch user profile:', e);
      toast({ title: '無法載入用戶資料', preset: 'error' });
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAddFriend = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/friends/request`, {
        to_user_id: parseInt(userId),
      });
      toast({ title: '好友邀請已發送', preset: 'done' });
      setPendingRequest(true);
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

  const handleRemoveFriend = async () => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/friends/${userId}`);
      toast({ title: '已移除好友', preset: 'done' });
      setIsFriend(false);
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

  // Calculate totals
  const stockValue = portfolio.reduce(
    (sum, p) => sum + (p.is_short ? 0 : p.current_price * p.quantity),
    0
  );
  const netWorth = (profile?.balance || 0) + stockValue;
  const longPositions = portfolio.filter((p) => !p.is_short);
  const shortPositions = portfolio.filter((p) => p.is_short);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-text-secondary">找不到此用戶</Text>
        <Button onPress={() => router.back()} className="mt-4">
          返回
        </Button>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

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
        <Text className="text-lg font-bold text-text-primary">
          {profile.nickname || profile.username}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Profile Header */}
        <View className="items-center py-6">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/20">
            <User size={40} color={COLORS.primary} />
          </View>
          <Text className="text-xl font-bold text-text-primary">
            {profile.nickname || profile.username}
          </Text>
          <Text className="text-sm text-text-secondary">@{profile.username}</Text>

          {/* Friend Action Button */}
          {!isOwnProfile && (
            <View className="mt-4">
              {isFriend ? (
                <Button
                  onPress={handleRemoveFriend}
                  loading={actionLoading}
                  variant="outline"
                >
                  <View className="flex-row items-center gap-2">
                    <UserMinus size={16} color={COLORS.primary} />
                    <Text className="text-primary">移除好友</Text>
                  </View>
                </Button>
              ) : pendingRequest ? (
                <Badge variant="secondary">邀請已發送</Badge>
              ) : (
                <Button
                  onPress={handleAddFriend}
                  loading={actionLoading}
                >
                  <View className="flex-row items-center gap-2">
                    <UserPlus size={16} color="white" />
                    <Text className="text-white">加為好友</Text>
                  </View>
                </Button>
              )}
            </View>
          )}
        </View>

        {/* Net Worth Card */}
        <Card className="mx-4 mb-4">
          <CardContent className="p-4">
            <Text className="mb-1 text-sm text-text-secondary">總資產</Text>
            <Text className="mb-4 text-3xl font-bold text-primary">
              {formatSmartMoney(netWorth)}
            </Text>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs text-text-secondary">現金</Text>
                <Text className="font-mono text-sm font-semibold text-text-primary">
                  {formatSmartMoney(profile.balance)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-text-secondary">股票市值</Text>
                <Text className="font-mono text-sm font-semibold text-text-primary">
                  {formatSmartMoney(stockValue)}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Portfolio */}
        <View className="px-4 pb-8">
          <Text className="mb-3 font-semibold text-text-primary">持倉</Text>

          {/* Long Positions */}
          {longPositions.length > 0 && (
            <View className="mb-4">
              <Text className="mb-2 text-sm text-bullish">
                多頭 ({longPositions.length})
              </Text>
              {longPositions.map((item) => (
                <PortfolioItem key={item.stock_id} item={item} />
              ))}
            </View>
          )}

          {/* Short Positions */}
          {shortPositions.length > 0 && (
            <View className="mb-4">
              <Text className="mb-2 text-sm text-bearish">
                空頭 ({shortPositions.length})
              </Text>
              {shortPositions.map((item) => (
                <PortfolioItem key={item.stock_id} item={item} />
              ))}
            </View>
          )}

          {portfolio.length === 0 && (
            <View className="items-center justify-center py-10">
              <Briefcase size={48} color={COLORS.textSecondary} />
              <Text className="mt-4 text-text-secondary">此用戶尚無持倉</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
