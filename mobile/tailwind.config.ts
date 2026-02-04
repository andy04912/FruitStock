import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Design System Colors
        primary: '#7C3AED',
        'primary-light': '#A78BFA',
        secondary: '#A78BFA',
        cta: '#F43F5E',
        background: '#0F0F23',
        'background-card': 'rgba(15, 15, 35, 0.8)',
        'text-primary': '#E2E8F0',
        'text-secondary': '#94A3B8',
        // Taiwan Stock Colors (Red = Up, Green = Down)
        bullish: '#EF5350',
        bearish: '#26A69A',
        // UI Colors
        border: 'rgba(124, 58, 237, 0.2)',
        'border-focus': 'rgba(124, 58, 237, 0.5)',
        input: 'rgba(124, 58, 237, 0.1)',
        muted: '#475569',
      },
      fontFamily: {
        'heading': ['RussoOne', 'sans-serif'],
        'body': ['ChakraPetch', 'sans-serif'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      spacing: {
        '18': '72px',
        '88': '352px',
      },
    },
  },
  plugins: [],
};

export default config;
