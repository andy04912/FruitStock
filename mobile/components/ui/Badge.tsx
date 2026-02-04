import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

interface BadgeProps extends ViewProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'bullish' | 'bearish';
  size?: 'sm' | 'md';
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary/20',
  destructive: 'bg-cta',
  outline: 'border border-border bg-transparent',
  bullish: 'bg-bullish/20',
  bearish: 'bg-bearish/20',
};

const variantTextStyles: Record<string, string> = {
  default: 'text-white',
  secondary: 'text-secondary',
  destructive: 'text-white',
  outline: 'text-text-primary',
  bullish: 'text-bullish',
  bearish: 'text-bearish',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5',
  md: 'px-2.5 py-1',
};

const sizeTextStyles: Record<string, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  className,
  textClassName,
  children,
  ...props
}) => {
  return (
    <View
      className={cn(
        'flex-row items-center rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {typeof children === 'string' ? (
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
    </View>
  );
};

export default Badge;
