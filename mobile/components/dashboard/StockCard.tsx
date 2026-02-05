import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Heart } from 'lucide-react-native';

import { Card, CardContent } from '../ui';
import { formatPrice, formatPercent } from '../../utils/format';
import { sounds } from '../../utils/sound';
import { COLORS } from '../../utils/constants';
import { Stock } from '../../context/SocketContext';

interface StockCardProps {
  stock: Stock;
  isWatchlist: boolean;
  onToggleWatchlist: () => void;
  index: number;
}

export const StockCard = React.memo(({ stock, isWatchlist, onToggleWatchlist, index }: StockCardProps) => {
  const isUp = stock.change_percent >= 0;
  const color = isUp ? COLORS.bullish : COLORS.bearish;
  

  const handleHeartPress = async () => {
    await sounds.playTap();
    onToggleWatchlist();
  };

  return (
      <Link href={`/stock/${stock.id}`} asChild>
        <Pressable className="mb-3">
          <Card className="bg-background-card border border-border shadow-sm active:opacity-90 active:scale-[0.99] transition-all">
            <CardContent className="flex-row items-center justify-between p-4">
              {/* Left Side: Heart + Name */}
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleHeartPress();
                  }}
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
                  <Text className="text-lg font-bold text-text-primary tracking-tight">
                    {stock.name}
                  </Text>
                  <Text className="font-mono text-xs font-medium text-text-secondary">
                    {stock.symbol}
                  </Text>
                </View>
              </View>

              {/* Right Side: Price */}
              <View className="items-end">
                <Text 
                  className="font-mono text-xl font-bold tracking-tight"
                  style={{ color }}
                >
                  {formatPrice(stock.price)}
                </Text>
                <View className={`flex-row items-center justify-end rounded px-1.5 py-0.5 ${isUp ? 'bg-bullish/10' : 'bg-bearish/10'}`}>
                   <Text 
                    className="font-mono text-xs font-bold"
                    style={{ color }}
                  >
                    {formatPercent(stock.change_percent)}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </Pressable>
      </Link>
  );
});
