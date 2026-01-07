import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, Button } from "../components/ui/components";
import axios from "axios";
import { toast } from "sonner";
import { sounds } from "../utils/sound";
import { TrendingUp, TrendingDown, RefreshCcw, Heart } from "lucide-react";

const EventTicker = ({ event }) => {
    if (!event) return <div className="h-10 bg-muted/30 rounded flex items-center px-4 text-sm text-muted-foreground">目前市場平靜...</div>;
    return (
        <div className="h-10 bg-accent text-accent-foreground rounded flex items-center px-4 animate-pulse">
            <span className="font-bold mr-2">📢 快訊:</span> {event.title} - {event.description}
        </div>
    );
};

const StockCard = ({ stock, isWatchlist, onToggleWatchlist }) => {
    // Taiwan/Asian Market: Red = UP, Green = DOWN
    const isUp = (stock.price - stock.day_open) >= 0;
    const colorClass = isUp ? "text-rose-400" : "text-emerald-400"; // High visibility variants
    const sign = isUp ? "+" : "";

    return (
        <div className="relative group">
            <Link to={`/stock/${stock.id}`}>
                <Card className="bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md">
                    <CardContent className="p-4 flex justify-between items-center relative overflow-hidden">
                        
                        {/* Left Side: Heart + Name */}
                        <div className="relative z-10 flex items-center gap-3">
                             <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onToggleWatchlist?.();
                                }}
                                className="p-2 rounded-full hover:bg-slate-700/80 transition-all shadow-sm active:scale-95 group/btn"
                                title={isWatchlist ? "移除自選" : "加入自選"}
                            >
                                <Heart 
                                    className={`w-5 h-5 transition-all ${isWatchlist ? "fill-rose-500 text-rose-500 scale-110" : "text-slate-500 group-hover/btn:text-rose-400"}`} 
                                />
                            </button>
                            
                            <div>
                                <div className="font-bold text-lg md:text-xl tracking-tight text-slate-100 group-hover:text-blue-300 transition-colors">{stock.name}</div>
                                <div className="text-xs md:text-sm text-slate-400 font-mono font-medium">{stock.symbol}</div>
                            </div>
                        </div>

                        <div className="text-right relative z-10">
                            <div className={`text-xl md:text-2xl font-mono font-bold ${colorClass}`}>
                                ${stock.price.toFixed(2)}
                            </div>
                            {stock.day_open && stock.day_open > 0 && (
                                <div className={`text-xs font-mono mt-0.5 font-bold ${colorClass}`}>
                                    {sign}{((stock.price - stock.day_open) / stock.day_open * 100).toFixed(2)}%
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
};

// Widgets moved to common components

export default function Dashboard() {
    const { marketData, isConnected } = useSocket();
    const { API_URL } = useAuth();
    
    const [watchlist, setWatchlist] = useState([]);

    useEffect(() => {
        if (!API_URL) return;
        const fetchWatchlist = async () => {
             try {
                 const res = await axios.get(`${API_URL}/watchlist`);
                 // API returns list of { id, symbol, ... }
                 // We store array of IDs for easy checking
                 setWatchlist(res.data.map(s => s.id));
             } catch (e) { console.error(e) }
        };
        fetchWatchlist();
    }, [API_URL]);

    const toggleWatchlist = async (stockId) => {
        try {
            if (watchlist.includes(stockId)) {
                await axios.delete(`${API_URL}/watchlist/${stockId}`);
                setWatchlist(prev => prev.filter(id => id !== stockId));
                toast.success("已移除自選");
            } else {
                await axios.post(`${API_URL}/watchlist/${stockId}`);
                setWatchlist(prev => [...prev, stockId]);
                toast.success("已加入自選");
            }
        } catch (e) {
            toast.error("操作失敗");
        }
    };

    return (
        <div className="container mx-auto p-2 md:p-4 max-w-screen-2xl space-y-4 md:space-y-8 mt-2 md:mt-4">
            {/* Top Bar removed ticer */}
            <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                        市場綜覽
                    </h1>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur">
                     <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-primary shadow-[0_0_8px_cyan]" : "bg-red-500"} animate-pulse`} />
                     <span className="text-xs font-mono text-primary/80">{isConnected ? "連線中" : "斷線"}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8">
                {/* Main Stock Grid - Full Width */}
                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {marketData.stocks.length === 0 ? (
                        <div className="col-span-full py-20 text-center">
                             <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                             <div className="mt-4 font-mono text-primary animate-pulse">正在連接交易所...</div>
                        </div>
                    ) : (
                        [...marketData.stocks]
                            .sort((a, b) => {
                                const aFav = watchlist.includes(a.id);
                                const bFav = watchlist.includes(b.id);
                                if (aFav && !bFav) return -1;
                                if (!aFav && bFav) return 1;
                                return a.id - b.id;
                            })
                            .map((stock) => (
                            <StockCard 
                                key={stock.id} 
                                stock={stock} 
                                isWatchlist={watchlist.includes(stock.id)}
                                onToggleWatchlist={() => toggleWatchlist(stock.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
