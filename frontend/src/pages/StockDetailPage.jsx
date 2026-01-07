import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { CandlestickChart } from "../components/charts/CandlestickChart";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from "../components/ui/components";
import { toast } from "sonner";
import { sounds } from "../utils/sound";
import { Newspaper, TrendingUp } from "lucide-react";

const TradePanel = ({ stock, user, API_URL, onTrade, holdingQuantity, holdingAvgCost }) => {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Estimate cost
    const cost = stock.price * quantity;
    const canBuy = user.balance >= cost;

    const handleTrade = async (type) => { // 'buy' or 'sell'
        if (quantity <= 0) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/trade/${type}?stock_id=${stock.id}&quantity=${quantity}`);
            
            if (res.data.status === 'error') {
                toast.error(res.data.message);
                sounds.playError();
            } else {
                onTrade();
                if (type === 'buy') {
                    toast.success(`買入成功！ (${stock.name} x${quantity})`);
                    sounds.playBuy();
                } else {
                    toast.success(`賣出成功！ (${stock.name} x${quantity})`);
                    sounds.playSell();
                }
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || "交易失敗");
            sounds.playError();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>交易面板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                    <span>當前餘額</span>
                    <span className="font-bold">${user.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>目前持有</span>
                    <span className="font-bold text-blue-500">
                        {holdingQuantity || 0} 股 
                        {holdingQuantity > 0 && (() => {
                            const pnl = ((stock.price - holdingAvgCost) / holdingAvgCost) * 100;
                            const isPositive = pnl >= 0;
                            return (
                                <span className="text-xs ml-1">
                                    <span className="text-slate-400 mr-1">(@${holdingAvgCost.toFixed(1)})</span>
                                    <span className={isPositive ? "text-red-500" : "text-green-500"}>
                                        {isPositive ? "+" : ""}{pnl.toFixed(2)}%
                                    </span>
                                </span>
                            );
                        })()}
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>現價</span>
                    <span className="font-mono">${stock.price.toFixed(2)}</span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className=" px-2 text-sm">數量</label>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                            onClick={() => {
                                // Logic: If we have holdings, prioritize selling ALL holdings (User request: "Spot quantity")
                                // If holding is 0 (or already set to holding), switch to Max Buyable
                                if (holdingQuantity > 0 && quantity !== holdingQuantity) {
                                    setQuantity(holdingQuantity);
                                } else {
                                    const maxBuy = Math.floor(user.balance / stock.price);
                                    setQuantity(maxBuy > 0 ? maxBuy : 1);
                                }
                            }}
                        >
                            MAX
                        </Button>
                    </div>
                    <Input 
                        type="number" 
                        min="1" 
                        value={quantity} 
                        className="border border-blue-500/30 px-2 text-sm"
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} 
                    />
                </div>
                
                <div className="flex justify-between text-sm font-bold pt-2 border-t">
                    <span>預估總額</span>
                    <span>${(cost).toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Button 
                        className="bg-green-600 hover:bg-green-700 w-full" 
                        onClick={() => handleTrade('buy')}
                        disabled={loading || !canBuy}
                    >
                        買入
                    </Button>
                    <Button 
                        className="bg-red-600 hover:bg-red-700 w-full" 
                        onClick={() => handleTrade('sell')}
                        disabled={loading}
                    >
                        賣出
                    </Button>
                </div>
                {!canBuy && <div className="text-xs text-red-500 text-center">餘額不足</div>}
            </CardContent>
        </Card>
    );
};

export default function StockDetailPage() {
    const { id } = useParams();
    const { user, API_URL, refreshUser } = useAuth();
    const { marketData } = useSocket();
    const [history, setHistory] = useState([]);
    const [stock, setStock] = useState(null);
    const [interval, setInterval] = useState("1m");
    const [viewMode, setViewMode] = useState("today"); 
    const [holdingQuantity, setHoldingQuantity] = useState(0); 
    const [holdingAvgCost, setHoldingAvgCost] = useState(0); 
    const [tradeTrigger, setTradeTrigger] = useState(0); // Trigger for refetching
    const [news, setNews] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const lastEventRef = React.useRef(null);

    // 1. Sync Price from Socket (Real-time)
    useEffect(() => {
        if (marketData.stocks) {
            const s = marketData.stocks.find(s => s.id === parseInt(id));
            if (s) setStock(s);
        }
    }, [id, marketData.stocks]);

    // 2. Fetch Static Data (History, News, Portfolio) - Runs mainly on mount/change
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch History
                const histRes = await axios.get(`${API_URL}/stocks/${id}/history`, { params: { interval } });
                setHistory(histRes.data);
                
                // Fetch News
                const newsRes = await axios.get(`${API_URL}/stocks/${id}/news`);
                setNews(newsRes.data);

                // Fetch Predictions
                const predsRes = await axios.get(`${API_URL}/stocks/${id}/predictions`);
                setPredictions(predsRes.data);

                // Fetch Portfolio
                if (user) {
                    const portRes = await axios.get(`${API_URL}/portfolio`);
                    const myHolding = portRes.data.find(p => p.stock_id === parseInt(id));
                    setHoldingQuantity(myHolding ? myHolding.quantity : 0);
                    setHoldingAvgCost(myHolding ? myHolding.average_cost : 0);
                }
            } catch (e) {
                console.error("Failed to fetch stock details:", e);
            }
        };
        fetchData();
    }, [id, API_URL, interval, user, tradeTrigger]);

    // 3. Listen for Real-time Events for THIS stock
    // 3. Listen for Real-time Events & Price Updates
    useEffect(() => {
        // (A) Handle Events
        const evt = marketData.event;
        if (evt && evt.target_stock_id === parseInt(id)) {
            // Deduplicate logic using Ref
            const eventKey = `${evt.title}-${evt.created_at}`;
            
            if (lastEventRef.current !== eventKey) {
                lastEventRef.current = eventKey;
                
                setNews(prev => {
                    const exists = prev.find(p => p.title === evt.title && p.created_at === evt.created_at);
                    if (exists) return prev;
                    return [evt, ...prev];
                });
                toast.info(`個股快訊: ${evt.title}`);
            }
        }

        // (B) Handle Real-time Candle Updates
        if (marketData.stocks) {
            const stockInfo = marketData.stocks.find(s => s.id === parseInt(id));
            if (stockInfo) {
                const currentPrice = stockInfo.price;
                const now = Math.floor(Date.now() / 1000); // UTC Seconds
                
                const intervalMap = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
                const intervalSec = intervalMap[interval] || 60;

                setHistory(prev => {
                    if (prev.length === 0) return prev;
                    
                    const lastCandle = { ...prev[prev.length - 1] };
                    // Backend timestamps are UTC+8. So we compare against UTC+8 now.
                    const nowTaiwan = now + 28800; // UTC+8
                    
                    // Check if we pushed into a new interval
                    // lastCandle.time is the start of the bucket
                    if (nowTaiwan - lastCandle.time >= intervalSec) {
                        // Create New Candle
                        const newTime = lastCandle.time + intervalSec;
                        // Determine opening price? Ideally last close. But here use current.
                        const newCandle = {
                            time: newTime,
                            open: currentPrice, 
                            high: currentPrice,
                            low: currentPrice,
                            close: currentPrice,
                            volume: 0
                        };
                        return [...prev, newCandle];
                    } else {
                        // Update Existing Candle
                        lastCandle.close = currentPrice;
                        lastCandle.high = Math.max(lastCandle.high, currentPrice);
                        lastCandle.low = Math.min(lastCandle.low, currentPrice);
                        return [...prev.slice(0, -1), lastCandle];
                    }
                });
            }
        }
    }, [marketData, id, interval]);

    if (!stock) return <div className="p-8 font-mono text-primary animate-pulse">正在載入股價資訊...</div>;

    // Filter data based on View Mode
    const getChartData = () => {
        if (viewMode === "history") return history;
        
        // Filter for Today (00:00 to now)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startOfDay = Math.floor(now.getTime() / 1000);
        return history.filter(d => d.time >= startOfDay);
    };

    const chartData = getChartData();

    return (
        <div className="container mx-auto p-4 max-w-screen-xl">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Chart & News */}
                <div className="flex-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center flex-wrap gap-4">
                                <div className="flex items-center gap-2">
                                    <span>{stock.name} ({stock.symbol})</span>
                                </div>
                                <div className="flex items-center gap-4">
                                     <div className="text-right">
                                         <div className={`text-3xl font-mono font-bold ${(stock.price - stock.day_open) >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                             ${stock.price.toFixed(2)}
                                         </div>
                                         {stock.day_open > 0 && (
                                             <div className={`text-sm font-mono font-bold ${(stock.price - stock.day_open) >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                                 {(stock.price - stock.day_open) >= 0 ? "+" : ""}{((stock.price - stock.day_open) / stock.day_open * 100).toFixed(2)}%
                                             </div>
                                         )}
                                     </div>
                                     <div className="flex gap-2">
                                         <Button 
                                            size="sm" 
                                            variant={viewMode === "today" ? "default" : "outline"}
                                            onClick={() => setViewMode("today")}
                                         >
                                            今日走勢
                                         </Button>
                                         <Button 
                                            size="sm" 
                                            variant={viewMode === "history" ? "default" : "outline"}
                                            onClick={() => setViewMode("history")}
                                         >
                                            歷史走勢
                                         </Button>
                                     </div>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Timeframe Selector (Only show for History mode or if relevant) */}
                            {viewMode === "history" && (
                                <div className="flex gap-2 border-b border-primary/20 pb-2 overflow-x-auto">
                                    {["1m", "5m", "15m", "1h", "4h", "1d"].map(tf => (
                                        <Button 
                                            key={tf} 
                                            variant={interval === tf ? "default" : "ghost"} 
                                            size="sm"
                                            onClick={() => setInterval(tf)}
                                            className={interval === tf ? "bg-primary text-black" : "text-slate-400 hover:text-foreground"}
                                        >
                                            {tf}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            <div>
                                <CandlestickChart data={chartData} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Trade Panel */}
                    <TradePanel 
                        stock={stock} 
                        user={user} 
                        API_URL={API_URL} 
                        holdingQuantity={holdingQuantity} 
                        holdingAvgCost={holdingAvgCost} 
                        onTrade={() => { 
                            refreshUser(); 
                            setTradeTrigger(prev => prev + 1); 
                        }} 
                    />
                </div>

                {/* Right: Trade */}
                <div className="w-full lg:w-[350px]">
                    {/* Guru Predictions Section */}
                    <Card className="mb-6">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                                <TrendingUp className="mr-2 h-5 w-5 text-purple-500" />
                                專家預測
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-3">
                                {predictions.map((pred) => (
                                    <div key={pred.id} className="border-b last:border-0 pb-3 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <Badge variant="outline" className="mb-1 text-xs px-1 py-0 h-5 border-purple-500 text-purple-400">
                                                {pred.guru_name}
                                            </Badge>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(pred.deadline).toLocaleDateString()} 到期
                                            </span>
                                        </div>
                                        <p className="font-bold text-sm mb-1">
                                            目標價 ${pred.target_price} 
                                            <span className={pred.prediction_type === "BULL" ? "text-red-500 ml-1" : "text-green-500 ml-1"}>
                                                ({pred.prediction_type === "BULL" ? "看漲" : "看跌"})
                                            </span>
                                        </p>
                                        <div className="text-xs text-slate-400">
                                            {pred.description}
                                        </div>
                                        {pred.guru_stats && (
                                            <div className="mt-2 text-[10px] text-slate-500 bg-slate-900/50 p-1 rounded flex justify-between">
                                                <span>準確率: {pred.guru_stats.win_rate}%</span>
                                                <span>勝場: {pred.guru_stats.wins}/{pred.guru_stats.total}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {predictions.length === 0 && <p className="text-center text-slate-400 text-sm py-4">暫無專家預測</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stock News Section */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                                <Newspaper className="mr-2 h-5 w-5 text-blue-500" />
                                相關新聞與事件
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {news.map((item) => (
                                    <div key={item.id} className="border-b last:border-0 pb-3 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <Badge variant={Math.abs(item.impact_multiplier) < 0.03 ? "secondary" : item.impact_multiplier > 0 ? "default" : "destructive"} className="mb-1 text-xs px-1 py-0 h-5">
                                                {Math.abs(item.impact_multiplier) < 0.03 ? "八卦" : item.impact_multiplier > 0 ? "利多" : "利空"}
                                            </Badge>
                                            <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="font-bold text-sm">{item.title}</p>
                                        <p className="text-xs text-slate-400">{item.description}</p>
                                    </div>
                                ))}
                                {news.length === 0 && <p className="text-center text-slate-400 text-sm py-4">暫無相關新聞</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
