import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  PressableProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { cn } from '../../lib/utils';
import { sounds } from '../../utils/sound';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'cta';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  default: 'bg-primary active:bg-primary/80',
  outline: 'border border-primary bg-transparent active:bg-primary/10',
  ghost: 'bg-transparent active:bg-primary/10',
  destructive: 'bg-cta active:bg-cta/80',
  cta: 'bg-cta active:bg-cta/80',
};

const variantTextStyles: Record<string, string> = {
  default: 'text-white',
  outline: 'text-primary',
  ghost: 'text-primary',
  destructive: 'text-white',
  cta: 'text-white',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-2 min-h-[36px]',
  md: 'px-4 py-2.5 min-h-[44px]',
  lg: 'px-6 py-3 min-h-[52px]',
};

const sizeTextStyles: Record<string, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  className,
  textClassName,
  children,
  onPress,
  ...props
}) => {
  const handlePress = async (e: any) => {
    if (!disabled && !loading) {
      await sounds.playTap();
      onPress?.(e);
    }
  };

  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-center rounded-xl',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'opacity-50',
        className
      )}
      disabled={disabled || loading}
      onPress={handlePress}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#7C3AED' : '#FFFFFF'}
        />
      ) : typeof children === 'string' ? (
        <Text
          className={cn(
            'font-semibold',
            variantTextStyles[variant],
            sizeTextStyles[size],
            textClassName
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
};

export default Button;
