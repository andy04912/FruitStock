import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { toast } from 'burnt';
import { TrendingUp } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '../../components/ui';
import { sounds } from '../../utils/sound';
import { COLORS } from '../../utils/constants';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      toast({
        title: '請填寫帳號和密碼',
        preset: 'error',
      });
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        const res = await register(username, password, nickname || undefined);
        if (res && res.status === 'exists') {
          toast({
            title: '此帳號已存在',
            message: '請直接登入！',
            preset: 'custom',
            icon: { ios: { name: 'exclamationmark.triangle', color: COLORS.cta } },
          });
          setIsRegister(false);
        } else if (res && res.status === 'nickname_exists') {
          toast({
            title: '此暱稱已被使用',
            message: '請更換一個！',
            preset: 'custom',
            icon: { ios: { name: 'exclamationmark.triangle', color: COLORS.cta } },
          });
        } else {
          toast({
            title: '註冊成功',
            message: '請登入！',
            preset: 'done',
          });
          setIsRegister(false);
        }
      } else {
        const res = await login(username, password);
        if (res && res.status === 'unregistered') {
          toast({
            title: '此帳號尚未註冊',
            message: '請先註冊！',
            preset: 'custom',
            icon: { ios: { name: 'info.circle', color: COLORS.primary } },
          });
          setIsRegister(true);
        } else if (res && res.status === 'failed') {
          toast({
            title: '登入失敗',
            message: res.message || '帳號或密碼錯誤',
            preset: 'error',
          });
          await sounds.playError();
        } else {
          toast({
            title: '登入成功！',
            preset: 'done',
          });
          await sounds.playBuy();
          // Navigation handled by auth state change in _layout.tsx
        }
      }
    } catch (err: any) {
      toast({
        title: '操作失敗',
        message: err.message || '請稍後再試',
        preset: 'error',
      });
      await sounds.playError();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          className="px-6"
        >
          <Card className="mx-auto w-full max-w-[350px]">
            <CardHeader className="items-center">
              {/* Logo */}
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-xl border-2 border-primary/20 bg-primary/10">
                <TrendingUp size={40} color={COLORS.primary} />
              </View>

              {/* App Title */}
              <Text className="mb-2 text-xl font-bold text-primary">
                股票菜市場
              </Text>

              <CardTitle>{isRegister ? '註冊帳戶' : '登入系統'}</CardTitle>
            </CardHeader>

            <CardContent>
              <View className="gap-4">
                {/* Username Input */}
                <Input
                  placeholder="使用者名稱"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Nickname Input (only for registration) */}
                {isRegister && (
                  <Input
                    placeholder="暱稱 (選填，之後可修改)"
                    value={nickname}
                    onChangeText={setNickname}
                  />
                )}

                {/* Password Input */}
                <Input
                  placeholder="密碼"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                {/* Submit Button */}
                <Button
                  onPress={handleSubmit}
                  loading={isLoading}
                  className="mt-2"
                >
                  {isRegister ? '註冊' : '登入'}
                </Button>

                {/* Toggle Login/Register */}
                <View className="items-center">
                  <Pressable onPress={() => setIsRegister(!isRegister)}>
                    <Text className="text-sm text-primary">
                      {isRegister ? '已有帳號？登入' : '沒有帳號？註冊'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
