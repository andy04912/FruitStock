// API Configuration
// In production, this should be configured via environment variables or app config

// Default to localhost for development
// For Android emulator, use 10.0.2.2 instead of localhost
// For iOS simulator, localhost works fine
// For physical devices, use your computer's IP address

export const API_URL = __DEV__
  ? 'http://10.0.2.2:8080/api'  // Android emulator
  : 'https://your-production-api.com/api';

// For development on different platforms, you might want to use:
// const getApiUrl = () => {
//   if (Platform.OS === 'android') {
//     return 'http://10.0.2.2:8080/api';  // Android emulator
//   }
//   return 'http://localhost:8080/api';  // iOS simulator
// };

// Design System Colors
export const COLORS = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  secondary: '#A78BFA',
  cta: '#F43F5E',
  background: '#0F0F23',
  backgroundCard: 'rgba(15, 15, 35, 0.8)',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  // Taiwan Stock Market Convention: Red = Up, Green = Down
  bullish: '#EF5350',
  bearish: '#26A69A',
  border: 'rgba(124, 58, 237, 0.2)',
  borderFocus: 'rgba(124, 58, 237, 0.5)',
  input: 'rgba(124, 58, 237, 0.1)',
  muted: '#475569',
} as const;

// Animation durations (in ms)
export const ANIMATION = {
  micro: 150,
  short: 200,
  medium: 300,
  long: 500,
} as const;

// Touch target sizes (for accessibility)
export const TOUCH = {
  minSize: 44,
  minGap: 8,
} as const;

// Stock categories
export const STOCK_CATEGORIES = {
  FRUIT: 'FRUIT',
  MEAT: 'MEAT',
  ROOT: 'ROOT',
} as const;

export type StockCategory = keyof typeof STOCK_CATEGORIES;
