import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../config";

// Global Request Interceptor to inject token
axios.interceptors.request.use(
  (config) => {
    const currentToken = localStorage.getItem("token");
    if (currentToken) {
       config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    // Global 401 Interceptor
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);



  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setUser(null);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/me`);
      setUser(res.data);
    } catch (error) {
      console.error("Fetch user failed:", error);
      if (error.response && error.response.status === 401) {
          logout();
      }
    }
  };

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    
    const res = await axios.post(`${API_URL}/token`, formData);
    
    if (res.data.status === 'unregistered') {
        return res.data;
    }

    const accessToken = res.data.access_token;
    localStorage.setItem("token", accessToken);
    setToken(accessToken);
    return res.data;
  };

  const register = async (username, password, nickname) => {
    const res = await axios.post(`${API_URL}/register`, {
      username,
      hashed_password: password, // Backend expects 'hashed_password' but will hash it.
      nickname: nickname || undefined 
    });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, login, register, logout, API_URL, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
