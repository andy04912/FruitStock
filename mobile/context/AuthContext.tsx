import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../utils/constants';

// User type definition
export interface User {
  id: number;
  username: string;
  nickname: string;
  balance: number;
  karma_score: number;
  is_trading_frozen: boolean;
  created_at: string;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<any>;
  register: (username: string, password: string, nickname?: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  API_URL: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token storage key
const TOKEN_KEY = 'auth_token';

// Set up global axios interceptor for auth token
axios.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get token from secure store:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from secure store on mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
        }
      } catch (error) {
        console.error('Failed to load token:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  // Set up 401 interceptor
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Fetch user when token changes
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setUser(null);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get<User>(`${API_URL}/users/me`);
      setUser(res.data);
    } catch (error) {
      console.error('Fetch user failed:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await logout();
      }
    }
  };

  const login = async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const res = await axios.post(`${API_URL}/token`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (res.data.status === 'unregistered') {
      return res.data;
    }

    const accessToken = res.data.access_token;
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    setToken(accessToken);
    return res.data;
  };

  const register = async (username: string, password: string, nickname?: string) => {
    const res = await axios.post(`${API_URL}/register`, {
      username,
      hashed_password: password, // Backend expects 'hashed_password' but will hash it
      nickname: nickname || undefined,
    });
    return res.data;
  };

  const logout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to delete token:', error);
    }
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser();
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        API_URL,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
