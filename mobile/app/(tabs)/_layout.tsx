import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import {
  Gamepad2,
  TrendingUp,
  Newspaper,
  Trophy,
  User,
} from 'lucide-react-native';
import { COLORS } from '../../utils/constants';

interface TabIconProps {
  Icon: React.ElementType;
  label: string;
  focused: boolean;
}

function TabIcon({ Icon, label, focused }: TabIconProps) {
  return (
    <View className="items-center justify-center pt-2">
      <Icon
        size={24}
        color={focused ? COLORS.primary : COLORS.textSecondary}
        strokeWidth={focused ? 2.5 : 2}
      />
      <Text
        className={`mt-1 text-[10px] ${
          focused ? 'font-semibold text-primary' : 'text-text-secondary'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
      }}
    >
      <Tabs.Screen
        name="games"
        options={{
          title: '娛樂',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Gamepad2} label="娛樂" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: '新聞',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Newspaper} label="新聞" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '市場',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={TrendingUp} label="市場" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: '排行',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Trophy} label="排行" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={User} label="我的" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
