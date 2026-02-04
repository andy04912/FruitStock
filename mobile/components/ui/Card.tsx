import React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';
import { cn } from '../../lib/utils';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

interface CardTextProps extends TextProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => (
  <View
    className={cn(
      'rounded-xl border border-border bg-background-card',
      className
    )}
    {...props}
  >
    {children}
  </View>
);

export const CardHeader: React.FC<CardProps> = ({ className, children, ...props }) => (
  <View
    className={cn('flex flex-col gap-1.5 p-4', className)}
    {...props}
  >
    {children}
  </View>
);

export const CardTitle: React.FC<CardTextProps> = ({ className, children, ...props }) => (
  <Text
    className={cn('text-lg font-semibold text-text-primary', className)}
    {...props}
  >
    {children}
  </Text>
);

export const CardDescription: React.FC<CardTextProps> = ({ className, children, ...props }) => (
  <Text
    className={cn('text-sm text-text-secondary', className)}
    {...props}
  >
    {children}
  </Text>
);

export const CardContent: React.FC<CardProps> = ({ className, children, ...props }) => (
  <View
    className={cn('p-4 pt-0', className)}
    {...props}
  >
    {children}
  </View>
);

export const CardFooter: React.FC<CardProps> = ({ className, children, ...props }) => (
  <View
    className={cn('flex flex-row items-center p-4 pt-0', className)}
    {...props}
  >
    {children}
  </View>
);

export default Card;
