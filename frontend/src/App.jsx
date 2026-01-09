import React, { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "./components/ui/components";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Navbar from "./components/layout/Navbar";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import StockDetailPage from "./pages/StockDetailPage";
import PortfolioPage from "./pages/PortfolioPage";
import NewsPage from "./pages/NewsPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import BankPage from './pages/BankPage';

import NewsTicker from "./components/common/NewsTicker";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

function AppContent() {
    const { token, user, refreshUser, API_URL } = useAuth();
    const [bankStatus, setBankStatus] = useState(null);

    // Global Polling for User Status (Freeze Check)
    useEffect(() => {
        if (!token) return;
        
        const interval = setInterval(() => {
            refreshUser();
            // If frozen, also fetch detailed bank status for the debt info
            if (user?.is_trading_frozen) {
                fetchBankStatus();
            }
        }, 5000); // Check every 5 seconds to be responsive
        
        return () => clearInterval(interval);
    }, [token, user?.is_trading_frozen]);

    // Fetch Bank Status on demand (only need when frozen really)
    const fetchBankStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/bank/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBankStatus(data);
            }
        } catch (e) {
            console.error("BG Fetch error", e);
        }
    };
    
    // Initial fetch if frozen detected on load
    useEffect(() => {
        if (user?.is_trading_frozen) {
            fetchBankStatus();
        }
    }, [user?.is_trading_frozen]);

    return (
        <SocketProvider>
            <div className="h-screen w-screen overflow-hidden bg-background font-sans antialiased text-foreground flex flex-col relative">
                <Navbar />
                
                {/* Global Frozen Alert Overlay */}
                {user?.is_trading_frozen && (
                   <div className="flex-none bg-red-500/90 text-white p-4 shadow-lg border-b-2 border-red-600 backdrop-blur-md animate-in slide-in-from-top duration-300">
                        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/20 rounded-full">
                                    <Lock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        ⚠️ 帳戶已凍結
                                    </h2>
                                    <div className="flex flex-wrap items-center gap-2 text-sm opacity-90">
                                        <span>原因: {user.frozen_reason}</span>
                                        {bankStatus && (
                                            <span className="font-mono bg-black/20 px-2 py-0.5 rounded">
                                                剩餘債務: ${Math.floor(bankStatus.total_debt).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <a href="/bank" className="w-full md:w-auto text-center bg-white text-red-600 px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-sm">
                                    前往銀行處理
                                </a>
                            </div>
                        </div>
                   </div> 
                )}

                <NewsTicker />
                <div id="main-content" className="flex-1 overflow-y-auto relative scroll-smooth">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route 
                            path="/" 
                            element={<PrivateRoute><Dashboard /></PrivateRoute>} 
                        />
                        <Route 
                            path="/stock/:id" 
                            element={<PrivateRoute><StockDetailPage /></PrivateRoute>} 
                        />
                        <Route 
                            path="/portfolio" 
                            element={<PrivateRoute><PortfolioPage /></PrivateRoute>} 
                        />
                        <Route 
                            path="/news" 
                            element={<PrivateRoute><NewsPage /></PrivateRoute>} 
                        />
                        <Route 
                            path="/leaderboard" 
                            element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} 
                        />
                        <Route 
                            path="/bank" 
                            element={<PrivateRoute><BankPage /></PrivateRoute>} 
                        />
                    </Routes>
                </div>
                <Toaster theme="dark" position="bottom-right" toastOptions={{
                    style: {
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid #d946ef',
                        color: '#d946ef',
                        backdropFilter: 'blur(4px)'
                    }
                }}/>
            </div>
        </SocketProvider>
    );
}

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    </Router>
  );
}
