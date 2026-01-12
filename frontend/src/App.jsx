import React from "react";
import { Toaster } from "sonner";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Navbar from "./components/layout/Navbar";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import StockDetailPage from "./pages/StockDetailPage";
import PortfolioPage from "./pages/PortfolioPage";
import NewsPage from "./pages/NewsPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import RacePage from "./pages/RacePage";
import SlotMachine from "./pages/SlotMachine";

import NewsTicker from "./components/common/NewsTicker";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

function AppContent() {
    return (
        <SocketProvider>
            <div className="h-screen w-screen overflow-hidden bg-background font-sans antialiased text-foreground flex flex-col">
                <Navbar />
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
                            path="/race" 
                            element={<PrivateRoute><RacePage /></PrivateRoute>} 
                        />
                         <Route 
                            path="/slots" 
                            element={<PrivateRoute><SlotMachine /></PrivateRoute>} 
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
