import { ComponentType } from 'react';
import { ViewStyle, StyleProp } from 'react-native';

declare module '@shopify/flash-list' {
  export interface FlashListProps<T> {
    data: T[] | null | undefined;
    renderItem: (info: { item: T; index: number }) => React.ReactElement | null;
    keyExtractor?: (item: T, index: number) => string;
    estimatedItemSize?: number;
    contentContainerStyle?: StyleProp<ViewStyle>;
    refreshControl?: React.ReactElement;
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    extraData?: any;
    numColumns?: number;
    horizontal?: boolean;
    inverted?: boolean;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
  }

  export interface FlashListRef<T> {
    scrollToIndex: (params: { index: number; animated?: boolean }) => void;
    scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
    scrollToEnd: (params?: { animated?: boolean }) => void;
  }

  export class FlashList<T> extends React.Component<FlashListProps<T>> {}
}
