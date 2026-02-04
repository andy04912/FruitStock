import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { CandlestickChart as WagmiCandlestickChart } from 'react-native-wagmi-charts';
import { COLORS } from '../../utils/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandlestickChartProps {
  data: CandleData[];
  height?: number;
  loading?: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  height = 200,
  loading = false,
}) => {
  if (loading) {
    return (
      <View
        className="items-center justify-center rounded-xl bg-background"
        style={{ height }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-2 text-sm text-text-secondary">載入中...</Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-xl bg-background"
        style={{ height }}
      >
        <Text className="text-sm text-text-secondary">暫無數據</Text>
      </View>
    );
  }

  // Transform data for wagmi-charts
  const chartData = data.map((candle) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));

  return (
    <View style={{ height }}>
      <WagmiCandlestickChart.Provider data={chartData}>
        <WagmiCandlestickChart height={height} width={SCREEN_WIDTH - 32}>
          <WagmiCandlestickChart.Candles
            positiveColor={COLORS.bullish}
            negativeColor={COLORS.bearish}
          />
          <WagmiCandlestickChart.Crosshair>
            <WagmiCandlestickChart.Tooltip />
          </WagmiCandlestickChart.Crosshair>
        </WagmiCandlestickChart>

        {/* Price Labels */}
        <View className="mt-2 flex-row justify-between px-2">
          <WagmiCandlestickChart.PriceText
            type="open"
            format={({ value }) => `O: $${value ? Number(value).toFixed(2) : '-'}`}
            style={{ color: COLORS.textSecondary, fontSize: 10 }}
          />
          <WagmiCandlestickChart.PriceText
            type="high"
            format={({ value }) => `H: $${value ? Number(value).toFixed(2) : '-'}`}
            style={{ color: COLORS.bullish, fontSize: 10 }}
          />
          <WagmiCandlestickChart.PriceText
            type="low"
            format={({ value }) => `L: $${value ? Number(value).toFixed(2) : '-'}`}
            style={{ color: COLORS.bearish, fontSize: 10 }}
          />
          <WagmiCandlestickChart.PriceText
            type="close"
            format={({ value }) => `C: $${value ? Number(value).toFixed(2) : '-'}`}
            style={{ color: COLORS.textPrimary, fontSize: 10 }}
          />
        </View>
      </WagmiCandlestickChart.Provider>
    </View>
  );
};

export default CandlestickChart;
