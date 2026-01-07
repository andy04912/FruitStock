import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import axios from "axios";
import { Button } from "../ui/components";
import LeaderboardWidget from "../common/LeaderboardWidget";
import { Trophy, PieChart, LogOut, Wallet, Newspaper, TrendingUp } from "lucide-react";

export default function Navbar() {
  const { user, logout, API_URL } = useAuth(); 
  const { marketData } = useSocket();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [portfolio, setPortfolio] = useState([]);

  // Fetch portfolio for Net Worth calculation
  React.useEffect(() => {
      if (user) {
          axios.get(`${API_URL}/portfolio`)
            .then(res => setPortfolio(res.data))
            .catch(console.error);
      }
  }, [user, API_URL]); // Refetch when user (balance) changes

  // Calculate Real-time Net Worth
  const stockValue = portfolio.reduce((acc, item) => {
      if (!marketData.stocks) return acc;
      const stock = marketData.stocks.find(s => s.id === item.stock_id);
      const price = stock ? stock.price : 0; 
      return acc + (item.quantity * price);
  }, 0);

  const netWorth = user ? user.balance + stockValue : 0;

  return (
    <>
        <nav className="border-b border-slate-800 bg-slate-900 sticky top-0 z-50 shadow-sm">
          <div className="container flex h-16 items-center px-4 max-w-screen-2xl mx-auto justify-between">
            <Link to="/" className="flex items-center space-x-2 group">
              <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="h-10 w-10 object-contain group-hover:scale-110 transition-transform drop-shadow-md" />
              <span className="font-bold text-xl text-slate-100 tracking-tight hidden sm:inline-block">水果證交所 <span className="text-xs text-slate-500 font-normal ml-1">PRO</span></span>
            </Link>
            <div className="flex items-center gap-2 md:gap-4">
              {user ? (
                <>
                  <div className="flex flex-col items-end md:flex-row md:items-center md:gap-3 mr-1 bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 shadow-inner group relative cursor-help">
                     <span className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest font-semibold hidden md:inline">Net Worth</span>
                     <div className="flex items-center text-emerald-400 drop-shadow-sm">
                        <Wallet className="w-3 h-3 mr-1.5 md:hidden" />
                        <span className="font-mono font-bold text-sm md:text-lg tracking-tight">${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                     </div>
                     
                     {/* Tooltip for Cash Breakdown */}
                     <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-md shadow-xl p-3 text-xs hidden group-hover:block z-50">
                        <div className="flex justify-between text-slate-400 mb-1">
                            <span>現金 Cash:</span>
                            <span className="font-mono text-slate-200">${user.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                            <span>股票 Stocks:</span>
                            <span className="font-mono text-blue-400">${stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="h-8 w-px bg-slate-800 mx-1 hidden md:block"></div>

                  <Link to="/news">
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-9 px-3 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        title="新聞 News"
                    >
                        <Newspaper className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline font-medium">新聞</span>
                    </Button>
                  </Link>

                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 px-3 text-slate-300 hover:text-yellow-400 hover:bg-slate-800 transition-colors"
                    onClick={() => setShowLeaderboard(true)}
                    title="排行榜 Rank"
                  >
                    <Trophy className="h-5 w-5 md:mr-2" />
                    <span className="hidden md:inline font-medium">排行</span>
                  </Button>

                  <Link to="/portfolio">
                    <Button size="sm" className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md border border-blue-400/20 hover:shadow-lg transition-all" title="資產 Portfolio">
                        <PieChart className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">資產</span>
                    </Button>
                  </Link>
                  
                  <Button onClick={logout} size="sm" variant="ghost" className="h-9 w-9 px-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="登出">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <Link to="/login"><Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6">登入 Login</Button></Link>
              )}
            </div>
          </div>
        </nav>

        {/* Leaderboard Modal Overlay */}
        {showLeaderboard && (
            <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLeaderboard(false)}>
                <div className="w-full max-w-md animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="absolute -top-10 right-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowLeaderboard(false)}
                        >
                            關閉 X
                        </Button>
                        <LeaderboardWidget apiUrl={API_URL} />
                    </div>
                </div>
            </div>
        )}
    </>
  );
}
