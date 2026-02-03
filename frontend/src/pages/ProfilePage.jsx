import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/components";
import {
    User, Wallet, TrendingUp, TrendingDown, PiggyBank,
    History, Gift, Users, Gamepad2, Edit2, Check, X,
    ChevronDown, ChevronUp, DollarSign
} from "lucide-react";
import { formatMoney, formatNumber, formatPrice, formatPercent, formatCompactNumber, formatSmartMoney } from "../utils/format";
import { LineChart } from "../components/charts/LineChart";

export default function ProfilePage() {
    const { API_URL, token, user } = useAuth();
    const { userId } = useParams(); // Get user ID from URL
    const isReadOnly = !!userId && parseInt(userId) !== user?.id; // Check if determining other user
    

    
    const [profile, setProfile] = useState(null);
    const [assetHistory, setAssetHistory] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    // Reset tab when userId changes
    useEffect(() => {
        setActiveTab("overview");
    }, [userId]);

    
    // 暱稱編輯
    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const [newNickname, setNewNickname] = useState("");
    
    // 好友搜尋
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    const headers = { Authorization: `Bearer ${token}` };

    const fetchProfile = async () => {
        setLoading(true);
        try {
            if (isReadOnly) {
                // Fetch Friend's Profile
                const res = await axios.get(`${API_URL}/users/${userId}/full_profile`, { headers });
                const data = res.data;
                
                setProfile(data.profile);
                setAssetHistory(data.asset_history);
                setTransactions(data.transactions);
                setHoldings(data.holdings);
                setStocks(data.stocks); // Should return basic stock list
                setFriends([]); // Hide friends list for now or fetch if API supports
                setPendingRequests([]);
                setNewNickname(data.profile.nickname);
            } else {
                // Fetch Own Profile
                const [profileRes, historyRes, txRes, portfolioRes, stocksRes, friendsRes, pendingRes] = await Promise.all([
                    axios.get(`${API_URL}/profile`, { headers }),
                    axios.get(`${API_URL}/profile/asset-history`, { headers }),
                    axios.get(`${API_URL}/transactions`, { headers }),
                    axios.get(`${API_URL}/portfolio`, { headers }),
                    axios.get(`${API_URL}/stocks`),
                    axios.get(`${API_URL}/friends`, { headers }),
                    axios.get(`${API_URL}/friends/pending`, { headers })
                ]);
                
                setProfile(profileRes.data);
                setAssetHistory(historyRes.data);
                setTransactions(txRes.data);
                setHoldings(portfolioRes.data);
                setStocks(stocksRes.data);
                setFriends(friendsRes.data);
                setPendingRequests(pendingRes.data);
                setNewNickname(profileRes.data.nickname);
            }
        } catch (e) {
            console.error(e);
            toast.error("載入個人資料失敗");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
        const interval = setInterval(fetchProfile, 30000);
        return () => clearInterval(interval);
    }, [API_URL, token, userId]); // Add userId dependency

    const updateNickname = async () => {
        if (newNickname.length < 2 || newNickname.length > 16) {
            toast.error("暱稱長度必須在 2-16 字元之間");
            return;
        }
        
        try {
            const res = await axios.put(`${API_URL}/profile/nickname`, 
                { nickname: newNickname }, 
                { headers }
            );
            if (res.data.status === "success") {
                toast.success("暱稱已更新");
                setProfile(prev => ({ ...prev, nickname: newNickname }));
                setIsEditingNickname(false);
            } else {
                toast.error(res.data.message);
            }
        } catch (e) {
            toast.error("更新暱稱失敗");
        }
    };

    const searchUsers = async (query) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await axios.get(`${API_URL}/friends/search?q=${query}`, { headers });
            setSearchResults(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const sendFriendRequest = async (userId) => {
        try {
            const res = await axios.post(`${API_URL}/friends/request/${userId}`, {}, { headers });
            if (res.data.status === "success") {
                toast.success(res.data.message);
                searchUsers(searchQuery);
            } else {
                toast.error(res.data.message);
            }
        } catch (e) {
            toast.error("發送請求失敗");
        }
    };

    const acceptRequest = async (requestId) => {
        try {
            const res = await axios.post(`${API_URL}/friends/accept/${requestId}`, {}, { headers });
            if (res.data.status === "success") {
                toast.success(res.data.message);
                fetchProfile();
            }
        } catch (e) {
            toast.error("接受請求失敗");
        }
    };

    const rejectRequest = async (requestId) => {
        try {
            await axios.post(`${API_URL}/friends/reject/${requestId}`, {}, { headers });
            fetchProfile();
        } catch (e) {
            toast.error("拒絕請求失敗");
        }
    };

    // 計算持股資訊
    const stockMap = useMemo(() => {
        const map = {};
        stocks.forEach(s => { map[s.id] = s; });
        return map;
    }, [stocks]);

    // 分離多頭和空頭倉位
    const { longHoldings, shortHoldings } = useMemo(() => {
        const longs = [];
        const shorts = [];

        holdings.forEach(p => {
            const stock = stockMap[p.stock_id];
            if (!stock) return;

            const isShort = p.quantity < 0;
            const absQuantity = Math.abs(p.quantity);

            if (isShort) {
                // 空頭損益：成本 - 現價（價格下跌才賺錢）
                const marketValue = stock.price * absQuantity;
                const costBasis = p.average_cost * absQuantity;
                const unrealizedPnl = costBasis - marketValue;
                const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

                shorts.push({
                    ...p,
                    absQuantity,
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    marketValue,
                    unrealizedPnl,
                    unrealizedPct
                });
            } else if (p.quantity > 0) {
                // 多頭損益：現價 - 成本
                const marketValue = stock.price * p.quantity;
                const costBasis = p.average_cost * p.quantity;
                const unrealizedPnl = marketValue - costBasis;
                const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

                longs.push({
                    ...p,
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    marketValue,
                    unrealizedPnl,
                    unrealizedPct
                });
            }
        });

        return { longHoldings: longs, shortHoldings: shorts };
    }, [holdings, stockMap]);

    // 保持向後相容（合併多空倉位）
    const enrichedHoldings = [...longHoldings, ...shortHoldings];

    // 篩選交易類型
    const dividendTransactions = useMemo(() => 
        transactions.filter(t => t.type === "dividend"), [transactions]);
    const tradeTransactions = useMemo(() => 
        transactions.filter(t => t.type !== "dividend"), [transactions]);

    // 格式化函數已從 utils/format.js 導入

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    const tabs = [
        { id: "overview", label: "總覽", icon: Wallet },
        { id: "holdings", label: "持倉/交易", icon: TrendingUp },
        // Only show Friends tab if NOT read-only
        ...(!isReadOnly ? [{ id: "friends", label: "好友", icon: Users }] : []),
        { id: "stats", label: "戰績", icon: Gamepad2 },
    ];

    return (
        <div className="container mx-auto p-4 max-w-screen-xl min-h-[calc(100vh-80px)] space-y-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-emerald-900/50 to-cyan-900/50 rounded-2xl p-6 border border-emerald-500/20">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Avatar */}
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 p-1 shadow-lg shadow-emerald-500/20">
                        <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-4xl font-black text-emerald-400">
                            {(profile?.nickname || user?.username)?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                            {isEditingNickname ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newNickname}
                                        onChange={(e) => setNewNickname(e.target.value)}
                                        className="px-3 py-1 bg-zinc-800 border border-zinc-600 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        maxLength={16}
                                    />
                                    <button onClick={updateNickname} className="p-1 text-emerald-400 hover:text-emerald-300">
                                        <Check className="h-5 w-5" />
                                    </button>
                                    <button onClick={() => {
                                        setIsEditingNickname(false);
                                        setNewNickname(profile?.nickname);
                                    }} className="p-1 text-red-400 hover:text-red-300">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                {profile.nickname || profile.username}
                            </h2>
                            
                            
                            {!isReadOnly && profile.username !== (profile.nickname || profile.username) && (
                                <div className="mt-1 flex items-center gap-2">
                                     <button 
                                        onClick={() => setIsEditingNickname(true)}
                                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                                     >
                                        <Edit2 className="h-3 w-3" />
                                     </button>
                                </div>
                            )}
                            {!isReadOnly && profile.username === (profile.nickname || profile.username) && (
                                <button 
                                    onClick={() => setIsEditingNickname(true)}
                                    className="mt-1 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                >
                                    <Edit2 className="h-3 w-3" /> 設定暱稱
                                </button>
                            )}    </>
                            )}
                        </div>
                        <p className="text-zinc-400 text-sm">@{profile.username}</p>
                        <p className="text-muted-foreground">{isReadOnly ? `${profile.nickname || profile.username} 的個人檔案` : '我的投資組合'}</p>
                        {profile?.nickname_updated_at && (
                            <p className="text-zinc-500 text-xs mt-1">
                                暱稱更新於：{new Date(profile.nickname_updated_at).toLocaleDateString()}（7天內不可再更改）
                            </p>
                        )}
                    </div>
                    
                    {/* Total Assets */}
                    <div className="text-center md:text-right">
                        <p className="text-zinc-400 text-sm">總資產</p>
                        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            {formatMoney(profile?.total_assets)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs - Mobile friendly */}
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                            activeTab === tab.id
                                ? "bg-emerald-500 text-white"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    現金餘額
                                </div>
                                <div className="text-2xl font-bold text-emerald-400">{formatSmartMoney(profile?.balance)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                                    <PiggyBank className="h-4 w-4" />
                                    持倉市值
                                </div>
                                <div className="text-2xl font-bold text-blue-400">{formatSmartMoney(profile?.stock_value)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    未實現損益
                                </div>
                                    <div className={`text-2xl font-bold ${profile.unrealized_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {profile.unrealized_pnl >= 0 ? "+" : ""}{formatSmartMoney(profile.unrealized_pnl)}
                                    </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                                    <History className="h-4 w-4" />
                                    今日已實現損益
                                </div>
                                <div className={`text-2xl font-bold ${(profile?.today_realized_pnl || 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {(profile?.today_realized_pnl || 0) >= 0 ? '+' : ''}{formatSmartMoney(profile?.today_realized_pnl || 0)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Holdings Preview */}
                    {enrichedHoldings.length > 0 && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                                    <PiggyBank className="h-5 w-5 text-emerald-400" />
                                    持股概覽
                                </h3>
                                <div className="space-y-2">
                                    {enrichedHoldings.slice(0, 5).map(h => (
                                        <div key={h.stock_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                            <div>
                                                <Link to={`/stock/${h.stock_id}`} className="font-bold hover:text-emerald-400 transition-colors">{h.symbol}</Link>
                                                <span className="text-zinc-400 ml-2 text-sm">{formatNumber(h.quantity)} 股</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono">{formatMoney(h.marketValue)}</div>
                                                <div className={`text-sm ${h.unrealizedPnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {formatPercent(h.unrealizedPct)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {enrichedHoldings.length > 5 && (
                                    <button 
                                        onClick={() => setActiveTab("holdings")}
                                        className="w-full mt-3 text-center text-emerald-400 hover:text-emerald-300 text-sm"
                                    >
                                        查看全部 {enrichedHoldings.length} 支持股 →
                                    </button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Short Positions Preview */}
                    {shortHoldings.length > 0 && (
                        <Card className="bg-zinc-900/50 border-red-900/30 border-2">
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                                    <TrendingDown className="h-5 w-5 text-red-400" />
                                    空頭倉位 ⬇️
                                </h3>
                                <div className="space-y-2">
                                    {shortHoldings.map(h => (
                                        <div key={h.stock_id} className="flex items-center justify-between p-3 bg-red-950/30 rounded-lg border border-red-900/30">
                                            <div>
                                                <Link to={`/stock/${h.stock_id}`} className="font-bold hover:text-red-400 transition-colors text-red-300">
                                                    {h.symbol}
                                                </Link>
                                                <span className="text-zinc-400 ml-2 text-sm">-{formatNumber(h.absQuantity)} 股</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono text-zinc-300">{formatMoney(h.marketValue)}</div>
                                                <div className={`text-sm ${h.unrealizedPnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {formatPercent(h.unrealizedPct)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 p-2 bg-orange-500/10 rounded text-xs text-orange-400 border border-orange-500/30">
                                    ⚠️ 空頭倉位每日收取 0.01% 利息
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Asset History Chart */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-cyan-400" />
                                    資產走勢
                                </h3>
                                {assetHistory.length > 0 && (
                                    <div className="text-sm text-zinc-400">
                                        最近 {assetHistory.length} 天
                                    </div>
                                )}
                            </div>

                            {assetHistory.length > 0 ? (
                                <>
                                    {/* 資產摘要 */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-zinc-800/50 rounded-lg p-3">
                                            <div className="text-xs text-zinc-500 mb-1">目前資產</div>
                                            <div className="text-lg font-bold text-white">
                                                {formatSmartMoney(profile.total_assets)}
                                            </div>
                                        </div>
                                        <div className="bg-zinc-800/50 rounded-lg p-3">
                                            <div className="text-xs text-zinc-500 mb-1">今日變化</div>
                                            {(() => {
                                                // 取得昨日資產（歷史記錄的最後一筆）
                                                const yesterdayAssets = assetHistory.length > 0 ? assetHistory[assetHistory.length - 1]?.total_assets : profile.total_assets;
                                                const todayChange = profile.total_assets - yesterdayAssets;
                                                return (
                                                    <div className={`text-lg font-bold ${todayChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {todayChange >= 0 ? '+' : ''}
                                                        {formatSmartMoney(todayChange)}
                                                        {yesterdayAssets > 0 && (
                                                            <span className="text-xs ml-1">
                                                                ({formatPercent(todayChange / yesterdayAssets)})
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* 折線圖 */}
                                    <LineChart
                                        data={assetHistory}
                                        height={300}
                                        series={['total_assets', 'cash', 'stock_value']}
                                        showLegend={true}
                                    />
                                </>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
                                    <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                                    <p className="text-center">
                                        尚無資產歷史記錄
                                    </p>
                                    <p className="text-sm text-center mt-2">
                                        系統每天會自動記錄您的資產快照
                                    </p>
                                    <p className="text-xs text-center mt-1 text-zinc-600">
                                        明天開始就能看到資產走勢圖囉！
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === "holdings" && (
                <div className="space-y-6">
                    {/* Long Holdings */}
                    {longHoldings.length > 0 && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                                    多頭持倉
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-zinc-400 border-b border-zinc-700">
                                            <tr>
                                                <th className="text-left py-2">股票</th>
                                                <th className="text-right py-2">數量</th>
                                                <th className="text-right py-2 hidden md:table-cell">成本</th>
                                                <th className="text-right py-2 hidden md:table-cell">現價</th>
                                                <th className="text-right py-2">市值</th>
                                                <th className="text-right py-2">損益</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {longHoldings.map(h => (
                                                <tr key={h.stock_id} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                                                    <td className="py-3">
                                                        <Link to={`/stock/${h.stock_id}`} className="hover:text-emerald-400 transition-colors">
                                                            <span className="font-bold">{h.symbol}</span>
                                                            <span className="text-zinc-500 text-xs block md:inline md:ml-2">{h.name}</span>
                                                        </Link>
                                                    </td>
                                                    <td className="text-right py-3">{formatNumber(h.quantity)}</td>
                                                    <td className="text-right py-3 hidden md:table-cell">{formatPrice(h.average_cost)}</td>
                                                    <td className="text-right py-3 hidden md:table-cell">{formatPrice(h.currentPrice)}</td>
                                                    <td className="text-right py-3 font-mono">{formatMoney(h.marketValue)}</td>
                                                    <td className={`text-right py-3 font-mono ${h.unrealizedPnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {formatMoney(h.unrealizedPnl)}
                                                        <span className="text-xs block">{formatPercent(h.unrealizedPct)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Short Holdings */}
                    {shortHoldings.length > 0 && (
                        <Card className="bg-zinc-900/50 border-red-900/30 border-2">
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <TrendingDown className="h-5 w-5 text-red-400" />
                                    空頭持倉 ⬇️
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-zinc-400 border-b border-zinc-700">
                                            <tr>
                                                <th className="text-left py-2">股票</th>
                                                <th className="text-right py-2">數量</th>
                                                <th className="text-right py-2 hidden md:table-cell">開倉價</th>
                                                <th className="text-right py-2 hidden md:table-cell">現價</th>
                                                <th className="text-right py-2">市值</th>
                                                <th className="text-right py-2">損益</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shortHoldings.map(h => (
                                                <tr key={h.stock_id} className="border-b border-zinc-800 hover:bg-red-950/30 transition-colors">
                                                    <td className="py-3">
                                                        <Link to={`/stock/${h.stock_id}`} className="hover:text-red-400 transition-colors">
                                                            <span className="font-bold text-red-300">{h.symbol}</span>
                                                            <span className="text-zinc-500 text-xs block md:inline md:ml-2">{h.name}</span>
                                                        </Link>
                                                    </td>
                                                    <td className="text-right py-3 text-red-400">-{formatNumber(h.absQuantity)}</td>
                                                    <td className="text-right py-3 hidden md:table-cell">{formatPrice(h.average_cost)}</td>
                                                    <td className="text-right py-3 hidden md:table-cell">{formatPrice(h.currentPrice)}</td>
                                                    <td className="text-right py-3 font-mono">{formatMoney(h.marketValue)}</td>
                                                    <td className={`text-right py-3 font-mono ${h.unrealizedPnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {formatMoney(h.unrealizedPnl)}
                                                        <span className="text-xs block">{formatPercent(h.unrealizedPct)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 p-3 bg-orange-500/10 rounded text-xs text-orange-400 border border-orange-500/30">
                                    ⚠️ 空頭倉位每日收取 0.01% 利息，保證金比率低於 110% 將被強制平倉
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* No Holdings */}
                    {longHoldings.length === 0 && shortHoldings.length === 0 && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-8">
                                <p className="text-zinc-500 text-center">尚無持倉</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Dividends */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-4">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Gift className="h-5 w-5 text-yellow-400" />
                                配息紀錄
                            </h3>
                            {dividendTransactions.length === 0 ? (
                                <p className="text-zinc-500 text-center py-4">尚無配息紀錄</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {dividendTransactions.slice(0, 20).map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-2 bg-zinc-800/50 rounded-lg">
                                            <div>
                                                <span className="font-bold">{t.symbol}</span>
                                                <span className="text-zinc-400 text-xs ml-2">
                                                    {new Date(t.timestamp).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span className="text-yellow-400 font-mono">+{formatMoney(t.profit)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Trade History */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-4">
                            <h3 className="font-bold text-lg mb-4">交易紀錄</h3>
                            {tradeTransactions.length === 0 ? (
                                <p className="text-zinc-500 text-center py-4">尚無交易紀錄</p>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {tradeTransactions.slice(0, 30).map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    t.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {t.type === 'buy' ? '買入' : '賣出'}
                                                </span>
                                                <div>
                                                    <span className="font-bold">{t.symbol}</span>
                                                    <span className="text-zinc-400 text-sm ml-2">x{t.quantity}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono">{formatPrice(t.price)}</div>
                                                {t.profit !== null && (
                                                    <div className={`text-xs ${t.profit >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {t.profit >= 0 ? '+' : ''}{formatMoney(t.profit)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                        </Card>
                    </div>
            )}

            {activeTab === "stats" && (
                <div className="space-y-6">
                    {/* Race Stats */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                🏇 賽馬統計
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">總下注次數</div>
                                    <div className="text-2xl font-bold">{profile?.race_stats?.total_bets || 0}</div>
                                </div>
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">總下注金額</div>
                                    <div className="text-2xl font-bold text-yellow-400">
                                        {formatSmartMoney(profile?.race_stats?.total_wagered || 0)}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">勝率</div>
                                    <div className="text-2xl font-bold">
                                        {profile?.race_stats?.total_bets > 0 
                                            ? ((profile?.race_stats?.wins / profile?.race_stats?.total_bets) * 100).toFixed(1)
                                            : 0}%
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">淨損益</div>
                                    <div className={`text-2xl font-bold ${
                                        (profile?.race_stats?.net_profit || 0) >= 0 ? 'text-red-400' : 'text-green-400'
                                    }`}>
                                        {formatSmartMoney(profile?.race_stats?.net_profit || 0)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Slots Stats */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                🎰 老虎機統計
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">總轉動次數</div>
                                    <div className="text-2xl font-bold">{profile?.slots_stats?.total_spins || 0}</div>
                                </div>
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">總下注金額</div>
                                    <div className="text-2xl font-bold text-pink-400">
                                        {formatSmartMoney(profile?.slots_stats?.total_wagered || 0)}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">總贏得金額</div>
                                    <div className="text-2xl font-bold text-white">
                                        {formatSmartMoney(profile?.slots_stats?.total_won || 0)}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="text-zinc-400 text-sm">淨損益</div>
                                    <div className={`text-2xl font-bold ${
                                        (profile?.slots_stats?.net_profit || 0) >= 0 ? 'text-red-400' : 'text-green-400'
                                    }`}>
                                        {formatSmartMoney(profile?.slots_stats?.net_profit || 0)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Combined Stats */}
                    <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/20">
                        <CardContent className="p-6">
                            <h3 className="font-bold text-lg mb-2">🎲 賭場總結</h3>
                            <div className="flex flex-col md:flex-row justify-around items-center gap-4">
                                <div className="text-center">
                                    <div className="text-zinc-400 text-sm">總投入</div>
                                    <div className="text-xl font-bold">
                                        {formatSmartMoney((profile?.race_stats?.total_wagered || 0) + (profile?.slots_stats?.total_wagered || 0))}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-zinc-400 text-sm">總回收</div>
                                    <div className="text-xl font-bold text-yellow-400">
                                        {formatSmartMoney((profile?.race_stats?.total_won || 0) + (profile?.slots_stats?.total_won || 0))}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-zinc-400 text-sm">淨損益</div>
                                    <div className={`text-2xl font-black ${
                                        ((profile?.race_stats?.net_profit || 0) + (profile?.slots_stats?.net_profit || 0)) >= 0
                                            ? 'text-red-400'
                                            : 'text-green-400'
                                    }`}>
                                        {formatSmartMoney((profile?.race_stats?.net_profit || 0) + (profile?.slots_stats?.net_profit || 0))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === "friends" && (
                <div className="space-y-6">
                    {/* Search */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-4">
                            <h3 className="font-bold text-lg mb-3">搜尋用戶</h3>
                            <input
                                type="text"
                                placeholder="輸入用戶名或暱稱搜尋（至少 2 個字）"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    searchUsers(e.target.value);
                                }}
                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            {searchResults.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {searchResults.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                            <span>{u.nickname || u.username}</span>
                                            {u.status === "none" && (
                                                <button
                                                    onClick={() => sendFriendRequest(u.id)}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm"
                                                >
                                                    加好友
                                                </button>
                                            )}
                                            {u.status === "pending_sent" && (
                                                <span className="text-zinc-400 text-sm">已發送請求</span>
                                            )}
                                            {u.status === "friend" && (
                                                <span className="text-emerald-400 text-sm">已是好友</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg mb-3">待處理請求 ({pendingRequests.length})</h3>
                                <div className="space-y-2">
                                    {pendingRequests.map(req => (
                                        <div key={req.request_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                            <span className="font-bold">{req.username}</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => acceptRequest(req.request_id)}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm"
                                                >
                                                    接受
                                                </button>
                                                <button
                                                    onClick={() => rejectRequest(req.request_id)}
                                                    className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm"
                                                >
                                                    拒絕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Friends List */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardContent className="p-4">
                            <h3 className="font-bold text-lg mb-3">好友列表 ({friends.length})</h3>
                            {friends.length === 0 ? (
                                <p className="text-zinc-500 text-center py-8">還沒有好友，快去搜尋添加吧！</p>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map(f => (
                                        <div key={f.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                            <Link to={`/profile/${f.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1">
                                                <div className="h-10 w-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold">
                                                    {f.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white">{f.nickname}</div>
                                                    <div className="text-xs text-zinc-500">@{f.username}</div>
                                                </div>
                                            </Link>    <div className="text-right">
                                                <div className="font-mono text-yellow-400">{formatMoney(f.net_worth)}</div>
                                                <div className="text-xs text-zinc-400">淨值</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
