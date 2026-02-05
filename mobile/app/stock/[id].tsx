import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { toast } from 'burnt';
import axios from 'axios';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import { useSocket, Stock } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, Button, Badge } from '../../components/ui';
import { CandlestickChart } from '../../components/charts';
import { COLORS } from '../../utils/constants';
import {
  formatMoney,
  formatSmartMoney,
  formatPercent,
  formatNumber,
} from '../../utils/format';
import { sounds } from '../../utils/sound';

// Interface for candle data from API
interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Time interval options
const INTERVALS = [
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
  { label: '1時', value: '1h' },
  { label: '4時', value: '4h' },
  { label: '1日', value: '1d' },
];

// Trade type options
type TradeType = 'buy' | 'sell' | 'short' | 'cover';

interface Position {
  quantity: number;
  avg_cost: number;
  is_short: boolean;
}

export default function StockDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { marketData } = useSocket();
  const { API_URL, user, refreshUser } = useAuth();

  const [stock, setStock] = useState<Stock | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [shortPosition, setShortPosition] = useState<Position | null>(null);
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [tradeType, setTradeType] = useState<TradeType>('buy');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  // Find stock from market data
  useEffect(() => {
    const found = marketData.stocks.find((s) => s.id === parseInt(id));
    if (found) {
      setStock(found);
    }
  }, [id, marketData.stocks]);

  // Fetch position data
  const fetchPosition = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/portfolio`);
      const positions = res.data || [];

      const longPos = positions.find(
        (p: any) => p.stock_id === parseInt(id) && !p.is_short
      );
      const shortPos = positions.find(
        (p: any) => p.stock_id === parseInt(id) && p.is_short
      );

      setPosition(longPos || null);
      setShortPosition(shortPos || null);
    } catch (e) {
      console.error('Failed to fetch position:', e);
    } finally {
      setFetchingData(false);
    }
  }, [API_URL, id]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  // Fetch candle data
  const fetchCandleData = useCallback(async () => {
    setChartLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/stocks/${id}/history?interval=${selectedInterval}&limit=60`
      );
      const history = res.data || [];

      // Transform API data to chart format
      const candles: CandleData[] = history.map((item: any) => ({
        timestamp: new Date(item.timestamp).getTime(),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      setCandleData(candles);
    } catch (e) {
      console.error('Failed to fetch candle data:', e);
      // Generate mock data if API fails
      if (stock) {
        const mockCandles = generateMockCandles(stock.price, 60);
        setCandleData(mockCandles);
      }
    } finally {
      setChartLoading(false);
    }
  }, [API_URL, id, selectedInterval, stock]);

  // Generate mock candle data for testing/fallback
  const generateMockCandles = (currentPrice: number, count: number): CandleData[] => {
    const candles: CandleData[] = [];
    let price = currentPrice * 0.95; // Start slightly lower
    const now = Date.now();
    const intervalMs = getIntervalMs(selectedInterval);

    for (let i = count - 1; i >= 0; i--) {
      const volatility = 0.02;
      const change = (Math.random() - 0.48) * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);

      candles.push({
        timestamp: now - i * intervalMs,
        open,
        high,
        low,
        close,
      });

      price = close;
    }

    return candles;
  };

  // Convert interval string to milliseconds
  const getIntervalMs = (interval: string): number => {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return map[interval] || 60 * 1000;
  };

  useEffect(() => {
    if (stock) {
      fetchCandleData();
    }
  }, [selectedInterval, stock?.id]);

  const handleTrade = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast({ title: '請輸入有效數量', preset: 'error' });
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        tradeType === 'buy' || tradeType === 'sell'
          ? `${API_URL}/trade`
          : `${API_URL}/short`;

      await axios.post(endpoint, {
        stock_id: parseInt(id),
        quantity: qty,
        action: tradeType.toUpperCase(),
      });

      toast({ title: '交易成功', preset: 'done' });
      await sounds.playBuy();
      setQuantity('');
      await fetchPosition();
      await refreshUser();
    } catch (e: any) {
      toast({
        title: '交易失敗',
        message: e.response?.data?.detail || '請稍後再試',
        preset: 'error',
      });
      await sounds.playError();
    } finally {
      setLoading(false);
    }
  };

  const setPercentage = (percent: number) => {
    if (!stock || !user) return;

    let maxQty = 0;
    if (tradeType === 'buy') {
      maxQty = Math.floor(user.balance / stock.price);
    } else if (tradeType === 'sell') {
      maxQty = position?.quantity || 0;
    } else if (tradeType === 'short') {
      // Short requires 150% margin
      maxQty = Math.floor(user.balance / (stock.price * 1.5));
    } else if (tradeType === 'cover') {
      maxQty = shortPosition?.quantity || 0;
    }

    const qty = Math.floor(maxQty * percent);
    setQuantity(qty > 0 ? qty.toString() : '');
  };

  const setMax = () => setPercentage(1);

  if (!stock) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const isUp = stock.change_percent >= 0;
  const colorClass = isUp ? 'text-bullish' : 'text-bearish';

  // Calculate PnL for positions
  const longPnl = position
    ? (stock.price - position.avg_cost) * position.quantity
    : 0;
  const longPnlPercent = position
    ? ((stock.price - position.avg_cost) / position.avg_cost) * 100
    : 0;

  const shortPnl = shortPosition
    ? (shortPosition.avg_cost - stock.price) * shortPosition.quantity
    : 0;
  const shortPnlPercent = shortPosition
    ? ((shortPosition.avg_cost - stock.price) / shortPosition.avg_cost) * 100
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-primary/20"
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </Pressable>
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-text-primary">
              {stock.name}
            </Text>
            <Text className="font-mono text-xs text-text-secondary">
              {stock.symbol}
            </Text>
          </View>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1">
          {/* Price Section */}
          <View className="items-center py-6">
            <Text className={`font-mono text-4xl font-bold ${colorClass}`}>
              {formatMoney(stock.price)}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              {isUp ? (
                <TrendingUp size={16} color={COLORS.bullish} />
              ) : (
                <TrendingDown size={16} color={COLORS.bearish} />
              )}
              <Text className={`font-mono text-sm font-semibold ${colorClass}`}>
                {formatPercent(stock.change_percent)}
              </Text>
            </View>
          </View>

          {/* Candlestick Chart */}
          <Card className="mx-4 mb-4">
            <CardContent className="p-4">
              <CandlestickChart
                data={candleData}
                height={220}
                loading={chartLoading}
              />

              {/* Interval Buttons */}
              <View className="mt-4 flex-row flex-wrap justify-center gap-2">
                {INTERVALS.map((int) => (
                  <Pressable
                    key={int.value}
                    onPress={() => setSelectedInterval(int.value)}
                    className={`min-w-[48px] items-center rounded-lg px-3 py-2 ${
                      selectedInterval === int.value
                        ? 'bg-primary'
                        : 'bg-background'
                    }`}
                    style={{
                      borderWidth: selectedInterval === int.value ? 0 : 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        selectedInterval === int.value
                          ? 'text-white'
                          : 'text-text-secondary'
                      }`}
                    >
                      {int.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* Position Info */}
          {(position || shortPosition) && (
            <Card className="mx-4 mb-4">
              <CardContent className="p-4">
                <Text className="mb-3 font-semibold text-text-primary">
                  我的持倉
                </Text>

                {position && (
                  <View className="mb-3 flex-row items-center justify-between">
                    <View>
                      <Badge variant="bullish" size="sm">
                        多頭
                      </Badge>
                      <Text className="mt-1 text-xs text-text-secondary">
                        {formatNumber(position.quantity)} 股 @{' '}
                        {formatMoney(position.avg_cost)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`font-mono text-sm font-semibold ${
                          longPnl >= 0 ? 'text-bullish' : 'text-bearish'
                        }`}
                      >
                        {formatSmartMoney(longPnl)}
                      </Text>
                      <Text
                        className={`font-mono text-xs ${
                          longPnl >= 0 ? 'text-bullish' : 'text-bearish'
                        }`}
                      >
                        {formatPercent(longPnlPercent)}
                      </Text>
                    </View>
                  </View>
                )}

                {shortPosition && (
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Badge variant="bearish" size="sm">
                        空頭
                      </Badge>
                      <Text className="mt-1 text-xs text-text-secondary">
                        {formatNumber(shortPosition.quantity)} 股 @{' '}
                        {formatMoney(shortPosition.avg_cost)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`font-mono text-sm font-semibold ${
                          shortPnl >= 0 ? 'text-bullish' : 'text-bearish'
                        }`}
                      >
                        {formatSmartMoney(shortPnl)}
                      </Text>
                      <Text
                        className={`font-mono text-xs ${
                          shortPnl >= 0 ? 'text-bullish' : 'text-bearish'
                        }`}
                      >
                        {formatPercent(shortPnlPercent)}
                      </Text>
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>
          )}

          {/* Trade Panel */}
          <Card className="mx-4 mb-4">
            <CardContent className="p-4">
              {/* Trade Type Tabs */}
              <View className="mb-4 flex-row rounded-lg bg-background p-1">
                {[
                  { key: 'buy', label: '買入', color: COLORS.bullish },
                  { key: 'sell', label: '賣出', color: COLORS.bearish },
                ].map(({ key, label, color }) => (
                  <Pressable
                    key={key}
                    onPress={() => setTradeType(key as TradeType)}
                    className={`flex-1 items-center rounded-md py-2 ${
                      tradeType === key ? 'bg-primary/20' : ''
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        tradeType === key ? '' : 'text-text-secondary'
                      }`}
                      style={{ color: tradeType === key ? color : undefined }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Quantity Input */}
              <View className="mb-4">
                <Text className="mb-2 text-sm text-text-secondary">數量</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                    placeholder="輸入數量"
                    placeholderTextColor={COLORS.textSecondary}
                    className="flex-1 rounded-xl border border-border bg-input px-4 py-3 font-mono text-lg text-text-primary"
                  />
                  <Pressable
                    onPress={setMax}
                    className="rounded-lg bg-primary/20 px-3 py-3"
                  >
                    <Text className="text-sm font-semibold text-primary">
                      MAX
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Quick Percentage Buttons */}
              <View className="mb-4 flex-row gap-2">
                {[0.25, 0.5, 0.75].map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => setPercentage(pct)}
                    className="flex-1 items-center rounded-lg bg-background py-2"
                  >
                    <Text className="text-sm text-text-secondary">
                      {pct * 100}%
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Trade Summary */}
              {quantity && parseInt(quantity) > 0 && (
                <View className="mb-4 rounded-lg bg-background p-3">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text-secondary">預估金額</Text>
                    <Text className="font-mono text-sm font-semibold text-text-primary">
                      {formatSmartMoney(stock.price * parseInt(quantity))}
                    </Text>
                  </View>
                  {(tradeType === 'short' || tradeType === 'cover') && (
                    <View className="mt-2 flex-row justify-between">
                      <Text className="text-sm text-text-secondary">
                        保證金 (150%)
                      </Text>
                      <Text className="font-mono text-sm font-semibold text-text-primary">
                        {formatSmartMoney(
                          stock.price * parseInt(quantity) * 1.5
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Trade Button */}
              <Button
                onPress={handleTrade}
                loading={loading}
                variant={
                  tradeType === 'buy' || tradeType === 'cover'
                    ? 'default'
                    : 'destructive'
                }
              >
                {tradeType === 'buy'
                  ? '買入'
                  : tradeType === 'sell'
                  ? '賣出'
                  : tradeType === 'short'
                  ? '做空'
                  : '回補'}
              </Button>

              {/* Balance Info */}
              <View className="mt-4 items-center">
                <Text className="text-xs text-text-secondary">
                  可用餘額: {formatSmartMoney(user?.balance || 0)}
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Stock Info */}
          <Card className="mx-4 mb-8">
            <CardContent className="p-4">
              <Text className="mb-3 font-semibold text-text-primary">
                股票資訊
              </Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-text-secondary">類別</Text>
                  <Text className="text-sm text-text-primary">
                    {stock.category || 'FRUIT'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-text-secondary">波動率</Text>
                  <Text className="text-sm text-text-primary">
                    {(stock.volatility * 100).toFixed(1)}%
                  </Text>
                </View>
                {!!stock.dividend_yield && (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text-secondary">股息率</Text>
                    <Text className="text-sm text-primary">
                      {(stock.dividend_yield * 100).toFixed(2)}%
                    </Text>
                  </View>
                )}
                <View className="flex-row justify-between">
                  <Text className="text-sm text-text-secondary">成交量</Text>
                  <Text className="text-sm text-text-primary">
                    {formatNumber(stock.volume)}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
