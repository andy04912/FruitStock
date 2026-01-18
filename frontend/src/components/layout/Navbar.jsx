
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { LineChart, Wallet, LogOut, Newspaper, Trophy, Menu, X, Gamepad2, Users, User } from 'lucide-react'; // Added Trophy, Gamepad2, Users, User
import { Button } from '../ui/components';

export default function Navbar() {
    const { user, logout, API_URL } = useAuth();
    const { isConnected, marketData } = useSocket();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Net Worth Logic
    const [portfolio, setPortfolio] = useState([]);
    const [showDetail, setShowDetail] = useState(false);
    const detailRef = useRef(null);

    const isActive = (path) => location.pathname === path;

    // Fetch portfolio for calculation
    useEffect(() => {
        if (user) {
            axios.get(`${API_URL}/portfolio`).then(res => setPortfolio(res.data)).catch(console.error);
        }
    }, [user, API_URL]);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event) {
            if (detailRef.current && !detailRef.current.contains(event.target)) {
                setShowDetail(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [detailRef]);

    // Calculate Values
    const stockValue = portfolio.reduce((acc, item) => {
        if (!marketData?.stocks) return acc;
        const stock = marketData.stocks.find(s => s.id === item.stock_id);
        const price = stock ? stock.price : 0; 
        return acc + (item.quantity * price);
    }, 0);

    const netWorth = (user?.balance || 0) + stockValue;

    const navLinks = [
        { path: '/', label: '市場綜覽', icon: LineChart, color: 'text-cyan-400' },
        { path: '/news', label: '新聞中心', icon: Newspaper, color: 'text-blue-400' },
        { path: '/leaderboard', label: '排行榜', icon: Trophy, color: 'text-yellow-400' }, 
        { path: '/race', label: '賽馬場', icon: Gamepad2, color: 'text-purple-400' },
        { path: '/slots', label: '老虎機', icon: Gamepad2, color: 'text-pink-400' },
        { path: '/blackjack', label: '21點', icon: Gamepad2, color: 'text-emerald-400' },
        { path: '/profile', label: '個人資料', icon: User, color: 'text-orange-400' },
    ];


    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/50 backdrop-blur-md">
            <div className="container mx-auto max-w-screen-2xl flex h-16 items-center justify-between px-4">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Link to="/" className="flex items-center gap-2 group">
                        <img 
                            src="/logo.jpg" 
                            alt="股票菜市場" 
                            className="h-10 w-10 rounded-lg object-cover shadow-neon group-hover:scale-110 transition-transform" 
                        />
                        <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                            股票 Project
                        </span>
                    </Link>
                </div>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`relative flex items-center gap-2 px-4 py-2 font-medium transition-all duration-300 rounded-full hover:bg-white/5 group ${
                                isActive(link.path) ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isActive(link.path) && (
                                <span className="absolute inset-0 rounded-full bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.1)] border border-white/10" />
                            )}
                            <link.icon className={`h-4 w-4 transition-colors ${isActive(link.path) ? link.color : 'group-hover:text-white'}`} />
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* User Info & Actions */}
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Net Worth Dropdown */}
                    <div className="relative" ref={detailRef}>
                        <button 
                            className="flex flex-col items-end mr-2 text-right group hover:opacity-80 transition-opacity outline-none"
                            onClick={() => setShowDetail(!showDetail)}
                        >
                            <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-bold group-hover:text-primary transition-colors flex items-center gap-1">
                                <span className="hidden md:inline">Net Worth</span> <span className="md:hidden">財富</span> <span className="text-[10px]">▼</span>
                            </span>
                            <span className={`font-mono font-bold text-sm md:text-lg ${netWorth > 10000 ? "text-emerald-400 shadow-emerald-400/20" : "text-white"}`}>
                                ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </button>

                        {/* Dropdown Content */}
                        {showDetail && (
                            <div className="absolute top-full right-0 mt-3 w-56 bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                                 <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <div className="h-2 w-2 rounded-full bg-slate-400" />
                                            現金 Cash
                                        </div>
                                        <span className="font-mono font-bold text-white">
                                            ${user.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            股票 Stocks
                                        </div>
                                        <span className="font-mono font-bold text-blue-400">
                                            ${stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                    <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                                     <div className="flex justify-between items-center pt-1">
                                        <span className="text-emerald-400 font-bold text-sm">💰 總資產 Total</span>
                                        <span className="font-mono font-bold text-emerald-400 text-lg">
                                            ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                 </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block h-8 w-[1px] bg-white/10" />
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleLogout}
                        className="hidden md:flex text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>

                    {/* Mobile Menu Toggle */}
                    <button 
                        className="md:hidden p-2 text-slate-400 hover:text-white ml-1"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </div>

            {/* Mobile Nav */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl absolute w-full animate-in slide-in-from-top-2">
                    <div className="p-4 space-y-2">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 font-medium rounded-lg transition-colors ${
                                    isActive(link.path) 
                                    ? 'bg-primary/10 text-primary border border-primary/20' 
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <link.icon className={`h-5 w-5 ${isActive(link.path) ? link.color : ''}`} />
                                {link.label}
                            </Link>
                        ))}
                        <button 
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-colors mt-2"
                        >
                            <LogOut className="h-5 w-5" />
                            登出
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}
