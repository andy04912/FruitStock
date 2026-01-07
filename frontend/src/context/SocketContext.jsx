import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { API_URL } = useAuth();
  const [socket, setSocket] = useState(null);
  const [marketData, setMarketData] = useState({ stocks: [], event: null });
  const [isConnected, setIsConnected] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // Determine WS URL
    const wsUrl = API_URL.replace("http", "ws") + "/ws";
    
    // Connect
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to Market Stream");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "tick") {
            // Update market state
            setMarketData({
                stocks: data.stocks,
                event: data.event || null 
            });
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    ws.onclose = () => {
        console.warn("WS Disconnected. Reconnecting in 3s...");
        setIsConnected(false);
        // Auto-reconnect mechanism
        setTimeout(() => setRetry(r => r + 1), 3000); 
    };

    setSocket(ws);

    return () => {
        if (ws.readyState === 1) ws.close();
    };
  }, [API_URL, retry]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, marketData }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
