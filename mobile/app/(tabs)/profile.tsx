import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { toast } from 'burnt';
import axios from 'axios';
import {
  User,
  Wallet,
  TrendingUp,
  TrendingDown,
  Briefcase,
  History,
  Edit3,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../../components/ui';
import { LineChart } from '../../components/charts';
import { COLORS } from '../../utils/constants';
import {
  formatMoney,
  formatSmartMoney,
  formatPercent,
  formatNumber,
} from '../../utils/format';

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

interface Transaction {
  id: number;
  type: string;
  symbol: string;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
}

interface ProfileStats {
  total_trades: number;
  total_volume: number;
  win_rate: number;
  race_wins: number;
  race_total: number;
  slots_spins: number;
  slots_profit: number;
}

interface AssetHistoryPoint {
  timestamp: number;
  value: number;
}

// Net Worth Summary Card
const NetWorthCard = ({
  balance,
  stockValue,
  unrealizedPnl,
  todayPnl,
}: {
  balance: number;
  stockValue: number;
  unrealizedPnl: number;
  todayPnl: number;
}) => {
  const netWorth = balance + stockValue;

  return (
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
              {formatSmartMoney(balance)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-text-secondary">股票市值</Text>
            <Text className="font-mono text-sm font-semibold text-text-primary">
              {formatSmartMoney(stockValue)}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row gap-4 border-t border-border pt-4">
          <View className="flex-1">
            <Text className="text-xs text-text-secondary">未實現損益</Text>
            <Text
              className={`font-mono text-sm font-semibold ${
                unrealizedPnl >= 0 ? 'text-bullish' : 'text-bearish'
              }`}
            >
              {formatSmartMoney(unrealizedPnl)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-text-secondary">今日損益</Text>
            <Text
              className={`font-mono text-sm font-semibold ${
                todayPnl >= 0 ? 'text-bullish' : 'text-bearish'
              }`}
            >
              {formatSmartMoney(todayPnl)}
            </Text>
          </View>
        </View>
      </CardContent>
    </Card>
  );
};

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
              {formatNumber(item.quantity)} 股 @ {formatMoney(item.avg_cost)}
            </Text>
          </View>
          <View className="items-end">
            <Text
              className={`font-mono text-sm font-semibold ${
                isProfit ? 'text-bullish' : 'text-bearish'
              }`}
            >
              {formatSmartMoney(item.pnl)}
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

// Transaction Item
const TransactionItem = React.memo(({ item }: { item: Transaction }) => {
  const isBuy = item.type === 'BUY';
  const isShort = item.type === 'SHORT';
  const isCover = item.type === 'COVER';

  const getTypeLabel = () => {
    switch (item.type) {
      case 'BUY':
        return '買入';
      case 'SELL':
        return '賣出';
      case 'SHORT':
        return '做空';
      case 'COVER':
        return '回補';
      case 'DIVIDEND':
        return '配息';
      default:
        return item.type;
    }
  };

  const getTypeColor = () => {
    if (isBuy || isCover) return 'text-bullish';
    if (isShort) return 'text-secondary';
    return 'text-bearish';
  };

  return (
    <Card className="mb-2">
      <CardContent className="flex-row items-center justify-between p-3">
        <View>
          <View className="flex-row items-center gap-2">
            <Badge
              variant={isBuy || isCover ? 'bullish' : isShort ? 'secondary' : 'bearish'}
              size="sm"
            >
              {getTypeLabel()}
            </Badge>
            <Text className="font-semibold text-text-primary">{item.symbol}</Text>
          </View>
          <Text className="mt-1 text-xs text-text-secondary">
            {formatNumber(item.quantity)} 股 @ {formatMoney(item.price)}
          </Text>
        </View>
        <View className="items-end">
          <Text className={`font-mono text-sm font-semibold ${getTypeColor()}`}>
            {isBuy || isCover ? '-' : '+'}
            {formatSmartMoney(Math.abs(item.total))}
          </Text>
          <Text className="text-xs text-text-secondary">
            {new Date(item.created_at).toLocaleDateString('zh-TW')}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
});

type TabType = 'overview' | 'holdings' | 'history';

export default function ProfileScreen() {
  const { user, logout, refreshUser, API_URL } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [portfolioRes, transactionsRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/portfolio`),
        axios.get(`${API_URL}/transactions?limit=50`),
        axios.get(`${API_URL}/users/me/asset-history`).catch(() => ({ data: [] })),
      ]);

      setPortfolio(portfolioRes.data || []);
      setTransactions(transactionsRes.data || []);

      // Transform asset history for chart
      const history = (historyRes.data || []).map((item: any) => ({
        timestamp: new Date(item.timestamp || item.created_at).getTime(),
        value: item.net_worth || item.value || 0,
      }));
      setAssetHistory(history);

      await refreshUser();
    } catch (e) {
      console.error('Failed to fetch profile data:', e);
    } finally {
      setLoading(false);
    }
  }, [API_URL, refreshUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleLogout = () => {
    Alert.alert('登出', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleUpdateNickname = async () => {
    if (!newNickname.trim() || newNickname.length < 2 || newNickname.length > 16) {
      toast({ title: '暱稱需要 2-16 個字元', preset: 'error' });
      return;
    }

    try {
      await axios.patch(`${API_URL}/users/me`, { nickname: newNickname });
      toast({ title: '暱稱更新成功', preset: 'done' });
      setEditingNickname(false);
      await refreshUser();
    } catch (e: any) {
      toast({
        title: '更新失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
    }
  };

  // Calculate totals
  const stockValue = portfolio.reduce(
    (sum, p) => sum + (p.is_short ? 0 : p.current_price * p.quantity),
    0
  );
  const unrealizedPnl = portfolio.reduce((sum, p) => sum + p.pnl, 0);
  const todayPnl = 0; // Would need API support

  const longPositions = portfolio.filter((p) => !p.is_short);
  const shortPositions = portfolio.filter((p) => p.is_short);

  const renderPortfolioItem = useCallback(
    ({ item }: { item: Portfolio }) => <PortfolioItem item={item} />,
    []
  );

  const renderTransactionItem = useCallback(
    ({ item }: { item: Transaction }) => <TransactionItem item={item} />,
    []
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-4 pt-2">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <User size={24} color={COLORS.primary} />
          </View>
          <View>
            {editingNickname ? (
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={newNickname}
                  onChangeText={setNewNickname}
                  placeholder="輸入新暱稱"
                  placeholderTextColor={COLORS.textSecondary}
                  className="h-8 w-32 rounded border border-primary bg-input px-2 text-sm text-text-primary"
                  maxLength={16}
                />
                <Pressable onPress={handleUpdateNickname}>
                  <Text className="text-sm font-semibold text-primary">儲存</Text>
                </Pressable>
                <Pressable onPress={() => setEditingNickname(false)}>
                  <Text className="text-sm text-text-secondary">取消</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-bold text-text-primary">
                  {user?.nickname || user?.username}
                </Text>
                <Pressable
                  onPress={() => {
                    setNewNickname(user?.nickname || '');
                    setEditingNickname(true);
                  }}
                >
                  <Edit3 size={14} color={COLORS.textSecondary} />
                </Pressable>
              </View>
            )}
            <Text className="text-xs text-text-secondary">@{user?.username}</Text>
          </View>
        </View>
        <Pressable
          onPress={handleLogout}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-cta/20"
        >
          <LogOut size={20} color={COLORS.cta} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border">
        {[
          { key: 'overview', label: '總覽', icon: Wallet },
          { key: 'holdings', label: '持倉', icon: Briefcase },
          { key: 'history', label: '紀錄', icon: History },
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
        {activeTab === 'overview' && (
          <View className="py-4">
            <NetWorthCard
              balance={user?.balance || 0}
              stockValue={stockValue}
              unrealizedPnl={unrealizedPnl}
              todayPnl={todayPnl}
            />

            {/* Asset History Chart */}
            {assetHistory.length > 0 && (
              <Card className="mx-4 mb-4">
                <CardContent className="p-4">
                  <Text className="mb-3 font-semibold text-text-primary">
                    資產走勢
                  </Text>
                  <LineChart
                    data={assetHistory}
                    height={150}
                    formatValue={(v) => formatSmartMoney(v)}
                  />
                </CardContent>
              </Card>
            )}

            {/* Quick Holdings Preview */}
            {longPositions.length > 0 && (
              <View className="mb-4 px-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="font-semibold text-text-primary">多頭持倉</Text>
                  <Pressable
                    onPress={() => setActiveTab('holdings')}
                    className="flex-row items-center"
                  >
                    <Text className="text-xs text-primary">查看全部</Text>
                    <ChevronRight size={14} color={COLORS.primary} />
                  </Pressable>
                </View>
                {longPositions.slice(0, 3).map((item) => (
                  <PortfolioItem key={item.stock_id} item={item} />
                ))}
              </View>
            )}

            {/* Quick Short Preview */}
            {shortPositions.length > 0 && (
              <View className="px-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="font-semibold text-text-primary">空頭持倉</Text>
                  <Pressable
                    onPress={() => setActiveTab('holdings')}
                    className="flex-row items-center"
                  >
                    <Text className="text-xs text-primary">查看全部</Text>
                    <ChevronRight size={14} color={COLORS.primary} />
                  </Pressable>
                </View>
                {shortPositions.slice(0, 3).map((item) => (
                  <PortfolioItem key={item.stock_id} item={item} />
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'holdings' && (
          <View className="p-4">
            {/* Long Positions */}
            {longPositions.length > 0 && (
              <View className="mb-4">
                <Text className="mb-2 font-semibold text-bullish">
                  多頭持倉 ({longPositions.length})
                </Text>
                {longPositions.map((item) => (
                  <PortfolioItem key={item.stock_id} item={item} />
                ))}
              </View>
            )}

            {/* Short Positions */}
            {shortPositions.length > 0 && (
              <View>
                <Text className="mb-2 font-semibold text-bearish">
                  空頭持倉 ({shortPositions.length})
                </Text>
                {shortPositions.map((item) => (
                  <PortfolioItem key={item.stock_id} item={item} />
                ))}
              </View>
            )}

            {portfolio.length === 0 && (
              <View className="items-center justify-center py-10">
                <Briefcase size={48} color={COLORS.textSecondary} />
                <Text className="mt-4 text-text-secondary">尚無持倉</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'history' && (
          <View className="p-4">
            {transactions.length > 0 ? (
              transactions.map((item) => (
                <TransactionItem key={item.id} item={item} />
              ))
            ) : (
              <View className="items-center justify-center py-10">
                <History size={48} color={COLORS.textSecondary} />
                <Text className="mt-4 text-text-secondary">尚無交易紀錄</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
