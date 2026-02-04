import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { cn } from '../../lib/utils';

interface InputProps extends TextInputProps {
  className?: string;
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  className,
  label,
  error,
  containerClassName,
  ...props
}) => {
  return (
    <View className={cn('w-full', containerClassName)}>
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-text-primary">
          {label}
        </Text>
      )}
      <TextInput
        className={cn(
          'h-12 w-full rounded-xl border border-border bg-input px-4 text-base text-text-primary',
          'focus:border-primary',
          error && 'border-cta',
          className
        )}
        placeholderTextColor="#64748b"
        {...props}
      />
      {error && (
        <Text className="mt-1 text-xs text-cta">
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;
