import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';

// Stock type
export interface Stock {
  id: number;
  symbol: string;
  name: string;
  category: 'FRUIT' | 'MEAT' | 'ROOT';
  price: number;
  prev_close: number;
  change_percent: number;
  volume: number;
  volatility: number;
  dividend_yield?: number;
}

// Market event type
export interface MarketEvent {
  id: number;
  event_type: string;
  description: string;
  impact_multiplier: number;
  target_stock?: string;
  created_at: string;
}

// Race info type
export interface RaceInfo {
  id: number;
  status: string;
  betting_end_time?: string;
  race_start_time?: string;
  horses?: any[];
}

// Forecast type
export interface Forecast {
  guru_name: string;
  stock_symbol: string;
  prediction: 'BULLISH' | 'BEARISH';
  confidence: number;
  reason: string;
}

// Market data type
export interface MarketData {
  stocks: Stock[];
  event: MarketEvent | null;
  race: RaceInfo | null;
  forecast: Forecast | null;
}

// Socket context type
interface SocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  marketData: MarketData;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { API_URL } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [marketData, setMarketData] = useState<MarketData>({
    stocks: [],
    event: null,
    race: null,
    forecast: null,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [retry, setRetry] = useState(0);
  const appState = useRef(AppState.currentState);
  const socketRef = useRef<WebSocket | null>(null);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - reconnect if disconnected
        if (!isConnected && socketRef.current?.readyState !== WebSocket.OPEN) {
          setRetry((r) => r + 1);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isConnected]);

  // WebSocket connection
  useEffect(() => {
    // Determine WS URL
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws';

    // Connect
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Market Stream');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'tick') {
          // Update market state
          // Update market state with calculated change_percent
          const rawStocks = data.stocks || [];
          const processedStocks = rawStocks.map((stock: any) => {
            // Calculate change percent if not provided
            // Use day_open (prev_close) as base
            const basePrice = stock.day_open || stock.prev_close || stock.price;
            let changePercent = stock.change_percent;
            
            if (changePercent === undefined || changePercent === null) {
              if (basePrice > 0) {
                changePercent = ((stock.price - basePrice) / basePrice) * 100;
              } else {
                changePercent = 0;
              }
            }
            
            return {
              ...stock,
              change_percent: changePercent,
              prev_close: basePrice, // Ensure prev_close is mapped from day_open if needed
            };
          });

          setMarketData({
            stocks: processedStocks,
            event: data.event || null,
            race: data.race || null,
            forecast: data.forecast || null,
          });
        }
      } catch (e) {
        console.error('WS Parse Error', e);
      }
    };

    ws.onclose = () => {
      console.warn('WS Disconnected. Reconnecting in 3s...');
      setIsConnected(false);
      // Auto-reconnect mechanism
      setTimeout(() => setRetry((r) => r + 1), 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    setSocket(ws);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [API_URL, retry]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, marketData }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
