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
import { formatMoney, formatNumber, formatPrice, formatPercent } from "../utils/format";

const TradePanel = ({ stock, user, API_URL, onTrade, holdingQuantity, holdingAvgCost }) => {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);

    // 判斷是否為空頭倉位
    const isShortPosition = holdingQuantity < 0;
    const absHolding = Math.abs(holdingQuantity);

    // Estimate cost
    const cost = stock.price * quantity;
    const canBuy = user.balance >= cost;

    // 計算做空所需保證金（150%）
    const shortMargin = stock.price * quantity * 1.5;
    const canShort = user.balance >= shortMargin;

    const handleTrade = async (type) => { // 'buy', 'sell', 'short', 'cover'
        if (quantity <= 0 || loading) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/trade/${type}?stock_id=${stock.id}&quantity=${quantity}`);

            if (res.data.status === 'error') {
                toast.error(res.data.message);
                sounds.playError();
            } else {
                onTrade();

                // 顯示實際成交價格
                const actualPrice = res.data.transaction?.price;
                const actualQty = res.data.transaction?.quantity;
                const profit = res.data.transaction?.profit;

                const actionText = {
                    'buy': '買入',
                    'sell': '賣出',
                    'short': '做空',
                    'cover': '回補'
                }[type] || type;

                let message = `${actionText}成功！${stock.name} x${formatNumber(actualQty || quantity)}`;

                // 總是顯示實際成交價
                if (actualPrice) {
                    message += ` @ ${formatPrice(actualPrice)}`;

                    // 如果價格有明顯差異，特別標註
                    const priceDiff = actualPrice - stock.price;
                    if (Math.abs(priceDiff) > 0.01) {
                        const diffText = priceDiff > 0 ? `+${formatMoney(priceDiff)}` : formatMoney(priceDiff);
                        message += ` (價差 ${diffText})`;
                    }
                }

                // 顯示損益（賣出/回補時）
                if (profit !== undefined && profit !== null) {
                    const profitSign = profit >= 0 ? '+' : '';
                    message += ` 損益: ${profitSign}${formatMoney(profit)}`;
                }

                toast.success(message, { duration: 4000 });

                if (type === 'buy' || type === 'cover') {
                    sounds.playBuy();
                } else {
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
                    <span className="font-bold">{formatMoney(user.balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>目前持有</span>
                    <span className={`font-bold ${isShortPosition ? 'text-red-500' : 'text-blue-500'}`}>
                        {isShortPosition && '⬇️ 空單 '}
                        {formatNumber(holdingQuantity || 0)} 股
                        {holdingQuantity !== 0 && (() => {
                            // 多頭損益：現價 > 成本 = 賺
                            // 空頭損益：成本 > 現價 = 賺
                            const pnl = isShortPosition
                                ? ((holdingAvgCost - stock.price) / holdingAvgCost) * 100
                                : ((stock.price - holdingAvgCost) / holdingAvgCost) * 100;
                            const isPositive = pnl >= 0;
                            return (
                                <span className="text-xs ml-1">
                                    <span className="text-slate-400 mr-1">(@{formatPrice(holdingAvgCost)})</span>
                                    <span className={isPositive ? "text-red-500" : "text-green-500"}>
                                        {formatPercent(pnl)}
                                    </span>
                                </span>
                            );
                        })()}
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>現價</span>
                    <span className="font-mono">{formatPrice(stock.price)}</span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className=" px-2 text-sm">數量</label>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                onClick={() => {
                                    if (isShortPosition) {
                                        // 空頭倉位：MAX = 全部空單
                                        setQuantity(absHolding);
                                    } else if (holdingQuantity > 0) {
                                        // 多頭倉位：MAX = 全部持股
                                        setQuantity(holdingQuantity);
                                    } else {
                                        // 無倉位：MAX 買入（預留 2% 緩衝避免價格波動）
                                        const maxBuy = Math.floor((user.balance * 0.98) / stock.price);
                                        setQuantity(maxBuy > 0 ? maxBuy : 1);
                                    }
                                }}
                            >
                                MAX
                            </Button>
                            {!isShortPosition && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs border-orange-500/30 text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
                                    onClick={() => {
                                        // MAX 做空（30% 限額，預留 2% 緩衝）
                                        const maxShortValue = user.balance * 0.3;
                                        const maxShortQty = Math.floor((maxShortValue * 0.98) / (stock.price * 1.5));
                                        setQuantity(maxShortQty > 0 ? maxShortQty : 1);
                                    }}
                                    title="最大做空數量（帳戶 30% 限額）"
                                >
                                    MAX⬇
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            min="1"
                            value={quantity}
                            className="border border-blue-500/30 px-2 text-sm flex-1"
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        />
                        {/* 快速比例按鈕 */}
                        <div className="flex gap-1">
                            {[25, 50, 75].map((percent) => (
                                <Button
                                    key={percent}
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-2 text-xs border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 transition-colors"
                                    onClick={() => {
                                        if (isShortPosition) {
                                            // 空頭倉位：按比例回補
                                            const qty = Math.floor(absHolding * (percent / 100));
                                            setQuantity(qty > 0 ? qty : 1);
                                        } else if (holdingQuantity > 0) {
                                            // 多頭倉位：按比例賣出
                                            const qty = Math.floor(holdingQuantity * (percent / 100));
                                            setQuantity(qty > 0 ? qty : 1);
                                        } else {
                                            // 無倉位：按比例買入（預留 2% 緩衝）
                                            const maxBuy = Math.floor((user.balance * 0.98) / stock.price);
                                            const qty = Math.floor(maxBuy * (percent / 100));
                                            setQuantity(qty > 0 ? qty : 1);
                                        }
                                    }}
                                    title={`快速填入 ${percent}% 數量`}
                                >
                                    {percent}%
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                

                {/* 預估金額顯示 */}
                {!isShortPosition ? (
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm font-bold pt-2 border-t">
                            <span>預估總額</span>
                            <span>{formatMoney(cost)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-400">
                            <span>做空保證金</span>
                            <span>{formatMoney(shortMargin)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between text-sm font-bold pt-2 border-t">
                        <span>回補成本</span>
                        <span>{formatMoney(cost)}</span>
                    </div>
                )}

                {/* 根據倉位類型顯示不同按鈕 */}
                {isShortPosition ? (
                    // 空頭倉位：只顯示回補按鈕
                    <div className="space-y-3">
                        <div className="text-xs text-orange-500 text-center bg-orange-500/10 p-2 rounded border border-orange-500/30">
                            ⚠️ 您有 {absHolding} 股空單，需先回補才能進行其他操作
                        </div>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 w-full text-base py-6"
                            onClick={() => handleTrade('cover')}
                            disabled={loading || quantity > absHolding}
                        >
                            🔺 回補空單 ({absHolding} 股可回補)
                        </Button>
                        {quantity > absHolding && (
                            <div className="text-xs text-red-500 text-center bg-red-500/10 p-2 rounded">
                                回補數量不能超過空單數量 ({absHolding} 股)
                            </div>
                        )}
                    </div>
                ) : (
                    // 多頭倉位或無倉位：顯示所有按鈕
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                className="bg-green-600 hover:bg-green-700 w-full py-3"
                                onClick={() => handleTrade('buy')}
                                disabled={loading || !canBuy}
                                title={`以市價買入 ${quantity} 股（約 ${formatMoney(cost)}）`}
                            >
                                市價買入 🟢
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 w-full py-3"
                                onClick={() => handleTrade('sell')}
                                disabled={loading || holdingQuantity <= 0}
                                title={`以市價賣出 ${quantity} 股`}
                            >
                                市價賣出 🔴
                            </Button>
                        </div>
                        <Button
                            className="bg-orange-600 hover:bg-orange-700 w-full border border-orange-400/30 py-3"
                            onClick={() => handleTrade('short')}
                            disabled={loading || !canShort}
                            title={`以市價做空 ${quantity} 股（保證金 ${formatMoney(shortMargin)}）`}
                        >
                            市價做空 ⬇️ (保證金 {formatMoney(shortMargin, 0)})
                        </Button>

                        {/* 錯誤提示 */}
                        {!canShort && quantity > 0 && (
                            <div className="text-xs text-orange-500 text-center bg-orange-500/10 p-2 rounded border border-orange-500/30">
                                💰 保證金不足：需要 {formatMoney(shortMargin)}，當前餘額 {formatMoney(user.balance)}
                            </div>
                        )}
                        {!canBuy && !isShortPosition && quantity > 0 && (
                            <div className="text-xs text-red-500 text-center bg-red-500/10 p-2 rounded">
                                💰 餘額不足：需要 {formatMoney(cost)}，當前餘額 {formatMoney(user.balance)}
                            </div>
                        )}
                        {holdingQuantity <= 0 && (
                            <div className="text-xs text-zinc-500 text-center">
                                💡 提示：點擊 MAX 快速計算最大可買/做空數量
                            </div>
                        )}
                    </div>
                )}

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
    const [fitTrigger, setFitTrigger] = useState(0);
    const [news, setNews] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastEventRef = React.useRef(null);
    const hasMoreHistory = React.useRef(true);

    const handleLoadMore = async () => {
        if (loadingMore || !history.length || !hasMoreHistory.current) return;
        
        setLoadingMore(true);
        try {
            const oldestTime = history[0].time;
            // API expects unix timestamp for 'before'
            const res = await axios.get(`${API_URL}/stocks/${id}/history`, { 
                params: { 
                    interval, 
                    limit: 5000, 
                    before: oldestTime 
                } 
            });
            
            if (res.data.length > 0) {
                // Prepend data using functional update to avoid race conditions
                setHistory(prev => {
                    if (prev.length === 0) return res.data;
                    
                    const internalOldest = prev[0].time;
                    // Strict filtering to prevent overlap/order issues
                    // This protects against backend returning overlapping data or latest data by mistake
                    const validNewCandles = res.data.filter(d => d.time < internalOldest);
                    
                    if (validNewCandles.length === 0) {
                        // If we got data but all of it was filtered out, it means we reached the end or backend returned wrong range
                         return prev;
                    }
                    
                    // console.log(`Prepending ${validNewCandles.length} candles. End: ${validNewCandles[validNewCandles.length-1].time}, Start: ${internalOldest}`);
                    return [...validNewCandles, ...prev];
                });
                toast.success(`載入 ${res.data.length} 筆歷史資料`);
            } else {
                hasMoreHistory.current = false;
                toast.info("已載入所有歷史資料");
            }
        } catch (e) {
            console.error("Load more failed", e);
        } finally {
            setLoadingMore(false);
        }
    };

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

    // Filter data logic removed: We pass FULL history to chart,
    // and let the chart handle "Today" view via setVisibleRange.
    // This allows user to scroll back ("往左滑") to see previous data.
    const chartData = history;

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
                                    {stock.category === 'ROOT' && (
                                                <div className="mt-1 flex flex-col items-center animate-in fade-in slide-in-from-right-4 duration-500">
                                                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-600/50 hover:bg-amber-500/30 text-[10px] px-1.5 py-0.5 h-auto gap-1 mb-0.5 cursor-help" title="持有此股票每 2 小時會自動發放股息，費率每期變動 (1%~5%)">
                                                        💰 下期殖利率 {((stock.dividend_yield || 0.01) * 100).toFixed(2)}%
                                                    </Badge>
                                                    {holdingQuantity > 0 && (
                                                        <span className="text-[10px] text-amber-300/80 font-mono">
                                                            預估下次股息: ${(holdingQuantity * stock.price * (stock.dividend_yield || 0.01)).toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                </div>
                                <div className="flex items-center gap-4">
                                     <div className="text-right">
                                         <div className={`text-3xl font-mono font-bold ${(stock.price - stock.day_open) >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                             ${stock.price.toFixed(2)}
                                         </div>
                                         <div className="flex flex-col items-end">
                                            {stock.day_open > 0 && (
                                                <div className={`text-sm font-mono font-bold ${(stock.price - stock.day_open) >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                                    {(stock.price - stock.day_open) >= 0 ? "+" : ""}{((stock.price - stock.day_open) / stock.day_open * 100).toFixed(2)}%
                                                </div>
                                            )}
                                            
                                        </div>
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
                                            onClick={() => {
                                                setViewMode("history");
                                                setFitTrigger(prev => prev + 1);
                                            }}
                                         >
                                            完整歷史
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
                                <CandlestickChart 
                                    data={chartData} 
                                    fitTrigger={fitTrigger} 
                                    viewMode={viewMode}
                                    onLoadMore={handleLoadMore} 
                                />
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
