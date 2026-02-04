import React from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart as WagmiLineChart } from 'react-native-wagmi-charts';
import { COLORS } from '../../utils/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DataPoint {
  timestamp: number;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  loading?: boolean;
  color?: string;
  showTooltip?: boolean;
  formatValue?: (value: number) => string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 150,
  loading = false,
  color = COLORS.primary,
  showTooltip = true,
  formatValue = (v) => `$${v.toFixed(2)}`,
}) => {
  if (loading) {
    return (
      <View
        className="items-center justify-center rounded-xl bg-background"
        style={{ height }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  // Determine if overall trend is positive
  const firstValue = data[0]?.value || 0;
  const lastValue = data[data.length - 1]?.value || 0;
  const isPositive = lastValue >= firstValue;
  const lineColor = color || (isPositive ? COLORS.bullish : COLORS.bearish);

  return (
    <View style={{ height }}>
      <WagmiLineChart.Provider data={data}>
        <WagmiLineChart height={height} width={SCREEN_WIDTH - 32}>
          <WagmiLineChart.Path color={lineColor} width={2} />
          <WagmiLineChart.CursorCrosshair color={lineColor}>
            {showTooltip && (
              <WagmiLineChart.Tooltip
                style={{
                  backgroundColor: COLORS.background,
                  borderRadius: 8,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
                textStyle={{
                  color: COLORS.textPrimary,
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              />
            )}
          </WagmiLineChart.CursorCrosshair>
          <WagmiLineChart.Gradient color={lineColor} />
        </WagmiLineChart>

        {/* Current Value */}
        <View className="mt-2 flex-row items-center justify-between px-2">
          <WagmiLineChart.PriceText
            format={({ value }) => formatValue(Number(value) || 0)}
            style={{
              color: lineColor,
              fontSize: 14,
              fontWeight: 'bold',
              fontFamily: 'monospace',
            }}
          />
          <WagmiLineChart.DatetimeText
            style={{
              color: COLORS.textSecondary,
              fontSize: 10,
            }}
          />
        </View>
      </WagmiLineChart.Provider>
    </View>
  );
};

export default LineChart;
