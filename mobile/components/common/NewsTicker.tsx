import React, { useEffect } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSocket } from '../../context/SocketContext';
import { COLORS } from '../../utils/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NewsTickerProps {
  className?: string;
}

export const NewsTicker: React.FC<NewsTickerProps> = ({ className }) => {
  const { marketData, isConnected } = useSocket();
  const translateX = useSharedValue(0);

  // Construct ticker text
  const getTickerText = () => {
    const parts: string[] = [];

    // Connection status
    parts.push(isConnected ? '🟢 連線中' : '🔴 斷線中');

    // Market event
    if (marketData.event) {
      parts.push(`📢 ${marketData.event.description}`);
    }

    // Race info
    if (marketData.race) {
      const status =
        marketData.race.status === 'BETTING'
          ? '下注中'
          : marketData.race.status === 'RACING'
          ? '比賽中'
          : '已結束';
      parts.push(`🏇 賽馬: ${status}`);
    }

    // Forecast
    if (marketData.forecast) {
      const direction = marketData.forecast.prediction === 'BULLISH' ? '📈' : '📉';
      parts.push(
        `${direction} ${marketData.forecast.guru_name}: ${marketData.forecast.stock_symbol}`
      );
    }

    // Default message if no data
    if (parts.length === 1) {
      parts.push('歡迎來到股票菜市場！');
    }

    return parts.join('  •  ');
  };

  const tickerText = getTickerText();
  const textWidth = tickerText.length * 10; // Approximate width

  useEffect(() => {
    translateX.value = SCREEN_WIDTH;
    translateX.value = withRepeat(
      withTiming(-textWidth, {
        duration: Math.max(10000, textWidth * 30),
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, [tickerText, textWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      className={`h-8 overflow-hidden bg-primary/10 ${className}`}
    >
      <View className="h-full flex-row items-center">
        <Animated.View style={animatedStyle}>
          <Text
            className="whitespace-nowrap font-mono text-xs text-primary"
            numberOfLines={1}
          >
            {tickerText}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

export default NewsTicker;
