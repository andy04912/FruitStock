import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Card, CardContent, CardHeader, CardTitle, Button } from "../components/ui/components";
import BonusWidget from "../components/common/BonusWidget";
import { toast } from "sonner";

export default function PortfolioPage() {
    const { user, API_URL, refreshUser, token } = useAuth();
    const { marketData } = useSocket();
    const [holdings, setHoldings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [rawHoldings, setRawHoldings] = useState([]);
    const [activeTab, setActiveTab] = useState("holdings"); // holdings | dividends | friends
    const [totalValue, setTotalValue] = useState(0);
    const [totalUnrealizedPnL, setTotalUnrealizedPnL] = useState(0);
    const [totalRealizedPnL, setTotalRealizedPnL] = useState(0);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // Friends state
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Fetch Data (Only on mount/user change)
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [portRes, txnRes] = await Promise.all([
                    axios.get(`${API_URL}/portfolio`),
                    axios.get(`${API_URL}/transactions`)
                ]);
                setRawHoldings(portRes.data);
                setTransactions(txnRes.data);
            } catch (error) {
                console.error("Failed to fetch portfolio data", error);
            }
        };

        if (user) fetchData();
    }, [user, API_URL]); 

    // 2. Calculate Real-time Values (Runs on price update)
    useEffect(() => {
        const processedHoldings = rawHoldings.map(h => {
            const stock = marketData.stocks.find(s => s.id === h.stock_id);
            const currentPrice = stock ? stock.price : 0;
            const marketValue = h.quantity * currentPrice;
            const unrealizedPnL = (currentPrice - h.average_cost) * h.quantity;
            const pnlPercent = h.average_cost > 0 ? (unrealizedPnL / (h.average_cost * h.quantity)) * 100 : 0;

            return {
                ...h,
                name: stock ? stock.name : "Unknown",
                symbol: stock ? stock.symbol : "UNKNOWN",
                currentPrice,
                marketValue,
                unrealizedPnL,
                pnlPercent,
                dividendYield: stock ? (stock.dividend_yield || 0) : 0,
                estimatedIncome: stock ? (stock.dividend_yield || 0) * marketValue : 0
            };
        }).filter(h => h.quantity !== 0); 

        setHoldings(processedHoldings);

        const tValue = processedHoldings.reduce((acc, curr) => acc + curr.marketValue, 0);
        const tUnrealized = processedHoldings.reduce((acc, curr) => acc + curr.unrealizedPnL, 0);
        
        const tRealized = transactions.reduce((acc, curr) => {
            return acc + (curr.profit || 0);
        }, 0);

        setTotalValue(tValue);
        setTotalUnrealizedPnL(tUnrealized);
        setTotalRealizedPnL(tRealized);

    }, [rawHoldings, marketData.stocks, transactions]);

    // Pagination Logic
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    const displayedTransactions = transactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Friends Functions
    const fetchFriends = async () => {
        try {
            const res = await axios.get(`${API_URL}/friends`, { headers });
            setFriends(res.data);
        } catch (e) {}
    };
    
    const fetchPending = async () => {
        try {
            const res = await axios.get(`${API_URL}/friends/pending`, { headers });
            setPendingRequests(res.data);
        } catch (e) {}
    };
    
    useEffect(() => {
        if (activeTab === "friends") {
            fetchFriends();
            fetchPending();
        }
    }, [activeTab]);
    
    const searchUsers = async (q) => {
        if (q.length < 2) { setSearchResults([]); return; }
        try {
            const res = await axios.get(`${API_URL}/friends/search?q=${encodeURIComponent(q)}`, { headers });
            setSearchResults(res.data);
        } catch (e) {}
    };
    
    useEffect(() => {
        const timer = setTimeout(() => searchUsers(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    
    const sendRequest = async (userId) => {
        try {
            const res = await axios.post(`${API_URL}/friends/request/${userId}`, {}, { headers });
            if (res.data.status === "success") {
                toast.success(res.data.message);
                searchUsers(searchQuery);
            } else toast.error(res.data.message);
        } catch (e) { toast.error("發送失敗"); }
    };
    
    const acceptRequest = async (requestId) => {
        try {
            const res = await axios.post(`${API_URL}/friends/accept/${requestId}`, {}, { headers });
            if (res.data.status === "success") {
                toast.success(res.data.message);
                fetchPending();
                fetchFriends();
            }
        } catch (e) {}
    };
    
    const rejectRequest = async (requestId) => {
        try {
            await axios.post(`${API_URL}/friends/reject/${requestId}`, {}, { headers });
            toast.success("已拒絕");
            fetchPending();
        } catch (e) {}
    };
    
    const removeFriend = async (friendId, username) => {
        if (!confirm(`確定要刪除好友 ${username} 嗎？`)) return;
        try {
            const res = await axios.delete(`${API_URL}/friends/${friendId}`, { headers });
            if (res.data.status === "success") {
                toast.success("已刪除好友");
                fetchFriends();
            }
        } catch (e) {}
    };

    return (
        <div className="container mx-auto p-4 max-w-screen-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold">我的投資組合</h1>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">總資產</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl md:text-2xl font-bold">${(user?.balance + totalValue).toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">持倉市值</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl md:text-2xl font-bold text-blue-400">${totalValue.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">未實現損益</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-xl md:text-2xl font-bold ${totalUnrealizedPnL >= 0 ? "text-red-500" : "text-green-500"}`}>
                            {totalUnrealizedPnL >= 0 ? "+" : ""}{totalUnrealizedPnL.toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">已實現損益</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-xl md:text-2xl font-bold ${totalRealizedPnL >= 0 ? "text-red-500" : "text-green-500"}`}>
                            {totalRealizedPnL >= 0 ? "+" : ""}{totalRealizedPnL.toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <div className="flex gap-4 border-b border-border mb-4">
                <button 
                    onClick={() => setActiveTab("holdings")}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeTab === "holdings" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                >
                    持倉概況
                </button>
                <button 
                    onClick={() => setActiveTab("dividends")}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeTab === "dividends" ? "border-amber-500 text-amber-500" : "border-transparent text-muted-foreground"}`}
                >
                    配息紀錄 💰
                </button>
                <button 
                    onClick={() => setActiveTab("friends")}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors relative ${activeTab === "friends" ? "border-orange-500 text-orange-500" : "border-transparent text-muted-foreground"}`}
                >
                    好友 👥
                    {pendingRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {/* View: HOLDINGS */}
            {activeTab === "holdings" && (
            <Card>
                <CardHeader><CardTitle>持倉明細</CardTitle></CardHeader>
                <CardContent>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-2">股票</th>
                                    <th className="p-2 text-right">數量</th>
                                    <th className="p-2 text-right">平均成本</th>
                                    <th className="p-2 text-right">現價</th>
                                    <th className="p-2 text-right">當前殖利率</th>
                                    <th className="p-2 text-right">預估股息</th>
                                    <th className="p-2 text-right">市值</th>
                                    <th className="p-2 text-right">未實現損益</th>
                                </tr>
                            </thead>
                            <tbody>
                                {holdings.map(h => (
                                    <tr key={h.id} className="border-t hover:bg-muted/50 transition-colors">
                                        <td className="p-2">
                                            <Link to={`/stock/${h.stock_id}`} className="hover:underline cursor-pointer group">
                                                <div className="font-bold group-hover:text-primary transition-colors">{h.name}</div>
                                                <div className="text-xs text-muted-foreground">{h.symbol}</div>
                                            </Link>
                                        </td>
                                        <td className="p-2 font-mono text-right">{h.quantity}</td>
                                        <td className="p-2 font-mono text-right">${h.average_cost.toFixed(2)}</td>
                                        <td className="p-2 font-mono text-right">${h.currentPrice.toFixed(2)}</td>
                                        <td className="p-2 font-mono text-right text-amber-400">{(h.dividendYield * 100).toFixed(2)}%</td>
                                        <td className="p-2 font-mono text-right text-amber-400">${h.estimatedIncome.toFixed(2)}</td>
                                        <td className="p-2 font-mono text-right">${h.marketValue.toFixed(2)}</td>
                                        <td className={`p-2 font-mono font-bold text-right ${h.unrealizedPnL >= 0 ? "text-red-500" : "text-green-500"}`}>
                                            ${h.unrealizedPnL.toFixed(2)} ({h.pnlPercent.toFixed(1)}%)
                                        </td>
                                    </tr>
                                ))}
                                {holdings.length === 0 && (
                                    <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">暫無持倉</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {holdings.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">暫無持倉</div>
                        ) : holdings.map(h => (
                            <div key={h.id} className="bg-muted/20 rounded-lg p-3 border border-border/50">
                                <div className="flex justify-between items-start mb-2 border-b border-border/30 pb-2">
                                    <Link to={`/stock/${h.stock_id}`} className="font-bold text-lg text-primary hover:underline">
                                        {h.name} <span className="text-xs text-muted-foreground font-normal">({h.symbol})</span>
                                    </Link>
                                    <div className={`text-right font-mono font-bold ${h.unrealizedPnL >= 0 ? "text-red-500" : "text-green-500"}`}>
                                        <div className="text-lg">{h.unrealizedPnL >= 0 ? "+" : ""}{h.unrealizedPnL.toFixed(0)}</div>
                                        <div className="text-xs opacity-90">{h.pnlPercent.toFixed(1)}%</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground text-xs">數量</span>
                                        <span className="font-mono font-medium">{h.quantity}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground text-xs">市值</span>
                                        <span className="font-mono font-medium">${h.marketValue.toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground text-xs">成本</span>
                                        <span className="font-mono text-muted-foreground">${h.average_cost.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground text-xs">現價</span>
                                        <span className="font-mono text-muted-foreground">${h.currentPrice.toFixed(1)}</span>
                                    </div>
                                    {h.dividendYield > 0 && (
                                        <div className="col-span-2 flex justify-between items-center mt-1 pt-1 border-t border-white/5">
                                             <span className="text-amber-500 text-xs">預估配息 ({ (h.dividendYield * 100).toFixed(1) }%)</span>
                                             <span className="font-mono text-amber-400 font-bold">+${h.estimatedIncome.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            )}

            {/* View: DIVIDENDS */}
            {activeTab === "dividends" && (
                <Card className="border-amber-500/20">
                    <CardHeader>
                        <CardTitle className="flex justify-between">
                            <span>📜 歷史配息明細</span>
                            <span className="text-amber-500 text-base">累計領取: ${transactions.filter(t => t.type === 'dividend').reduce((acc, t) => acc + (t.profit||0), 0).toFixed(2)}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-amber-950/20 text-amber-400">
                                    <tr>
                                        <th className="p-3">時間</th>
                                        <th className="p-3">發放股票</th>
                                        <th className="p-3 text-right">持有股數</th>
                                        <th className="p-3 text-right">配息金額</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.filter(t => t.type === 'dividend').length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">尚無配息紀錄</td></tr>
                                    ) : (
                                        transactions
                                        .filter(t => t.type === 'dividend')
                                        .map(t => (
                                            <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="p-3">{new Date(t.timestamp).toLocaleString("zh-TW")}</td>
                                                <td className="p-3 font-bold">{t.name} ({t.symbol})</td>
                                                <td className="p-3 text-right font-mono">{t.quantity}</td>
                                                <td className="p-3 text-right font-mono text-amber-400 font-bold">+${t.profit.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* View: FRIENDS */}
            {activeTab === "friends" && (
                <Card className="border-orange-500/20">
                    <CardHeader>
                        <CardTitle>👥 好友管理</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 待處理請求 */}
                        {pendingRequests.length > 0 && (
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                                <h3 className="font-bold text-orange-400 mb-3">📩 待處理的好友請求 ({pendingRequests.length})</h3>
                                <div className="space-y-2">
                                    {pendingRequests.map(req => (
                                        <div key={req.request_id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                                            <span className="font-medium">{req.username}</span>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => acceptRequest(req.request_id)} className="bg-emerald-600 hover:bg-emerald-500">接受</Button>
                                                <Button size="sm" variant="outline" onClick={() => rejectRequest(req.request_id)}>拒絕</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* 搜尋加好友 */}
                        <div>
                            <h3 className="font-bold mb-3">🔍 加好友</h3>
                            <input
                                type="text"
                                placeholder="輸入用戶名搜尋（至少 2 個字）"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                            />
                            {searchResults.length > 0 && (
                                <div className="space-y-2">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                                            <span className="font-medium">{user.username}</span>
                                            {user.status === "friend" ? (
                                                <span className="text-emerald-400 text-sm">✓ 已是好友</span>
                                            ) : user.status === "pending_sent" ? (
                                                <span className="text-yellow-400 text-sm">⏳ 已發送請求</span>
                                            ) : user.status === "pending_received" ? (
                                                <span className="text-blue-400 text-sm">📩 待你接受</span>
                                            ) : (
                                                <Button size="sm" onClick={() => sendRequest(user.id)} className="bg-orange-600 hover:bg-orange-500">加好友</Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchQuery.length >= 2 && searchResults.length === 0 && (
                                <div className="text-center text-zinc-500 py-4">找不到用戶</div>
                            )}
                        </div>
                        
                        {/* 好友列表 */}
                        <div>
                            <h3 className="font-bold mb-3">我的好友 ({friends.length})</h3>
                            {friends.length === 0 ? (
                                <div className="text-center text-zinc-500 py-4">還沒有好友</div>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map(f => (
                                        <div key={f.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                                            <div>
                                                <span className="font-medium">{f.username}</span>
                                                <span className="text-zinc-500 text-sm ml-2">淨值: ${f.net_worth.toLocaleString()}</span>
                                            </div>
                                            <button onClick={() => removeFriend(f.id, f.username)} className="text-red-400 hover:text-red-300 text-sm">刪除</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bonus Widget (Moved Here) */}
            <div className="w-full">
                 <BonusWidget apiUrl={API_URL} onClaim={refreshUser} />
            </div>

            {/* Transaction History Table */}
            <Card className="mt-8">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>交易紀錄</CardTitle>
                    <div className="text-sm text-muted-foreground font-normal">
                        共 {transactions.length} 筆
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
                        <table className="w-full text-sm text-left min-w-[600px]">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-2">時間</th>
                                    <th className="p-2">股票</th>
                                    <th className="p-2">類型</th>
                                    <th className="p-2">價格</th>
                                    <th className="p-2">數量</th>
                                    <th className="p-2">總額</th>
                                    <th className="p-2">單筆損益</th> 
                                </tr>
                            </thead>
                            <tbody>
                                {displayedTransactions.map(t => (
                                    <tr key={t.id} className="border-t">
                                        <td className="p-2">{new Date(t.timestamp).toLocaleString("zh-TW")}</td>
                                        <td className="p-2">
                                            <Link to={`/stock/${t.stock_id}`} className="hover:text-primary hover:underline">
                                                {t.name} ({t.symbol})
                                            </Link>
                                        </td>
                                        <td className={`p-2 font-bold ${
                                            t.type === 'buy' ? 'text-red-500' : 
                                            t.type === 'dividend' ? 'text-amber-400' : 'text-green-500'
                                        }`}>
                                            {t.type === 'buy' ? "買入" : t.type === 'dividend' ? "領息 💰" : "賣出"}
                                        </td>
                                        <td className="p-2 font-mono">${t.price.toFixed(2)}</td>
                                        <td className="p-2 font-mono">{t.quantity}</td>
                                        <td className="p-2 font-mono">${t.total.toFixed(2)}</td>
                                        <td className="p-2 font-mono font-bold">
                                            {t.profit !== null && t.profit !== undefined ? (
                                                <span className={t.profit >= 0 ? (t.type === 'dividend' ? "text-amber-400" : "text-red-500") : "text-green-500"}>
                                                    {t.profit >= 0 ? "+" : ""}{t.profit.toFixed(2)}
                                                </span>
                                            ) : "-"}
                                        </td>
                                    </tr>
                                ))}
                                {displayedTransactions.length === 0 && (
                                    <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">暫無交易紀錄</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1}
                            >
                                上一頁
                            </Button>
                            <span className="text-sm font-mono text-muted-foreground">
                                {currentPage} / {totalPages}
                            </span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                disabled={currentPage === totalPages}
                            >
                                下一頁
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
