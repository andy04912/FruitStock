import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Card, CardContent, CardHeader, CardTitle, Button } from "../components/ui/components";
import BonusWidget from "../components/common/BonusWidget";

export default function PortfolioPage() {
    const { user, API_URL, refreshUser } = useAuth();
    const { marketData } = useSocket();
    const [holdings, setHoldings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [rawHoldings, setRawHoldings] = useState([]); // Store raw API data
    const [totalValue, setTotalValue] = useState(0);
    const [totalUnrealizedPnL, setTotalUnrealizedPnL] = useState(0);
    const [totalRealizedPnL, setTotalRealizedPnL] = useState(0);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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
    }, [user, API_URL]); // Removed marketData.stocks dependency

    // 2. Calculate Real-time Values (Runs on price update)
    useEffect(() => {
        // Even if rawHoldings is empty, we run to clear state usually, but map handles empty.
        
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
                pnlPercent
            };
        }).filter(h => h.quantity !== 0); 

        setHoldings(processedHoldings);

    // Calculations
        const tValue = processedHoldings.reduce((acc, curr) => acc + curr.marketValue, 0);
        const tUnrealized = processedHoldings.reduce((acc, curr) => acc + curr.unrealizedPnL, 0);
        
        // Calculate Total Realized PnL from transactions
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

            {/* Holdings Table */}
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
                                        <td className="p-2 font-mono text-right">${h.marketValue.toFixed(2)}</td>
                                        <td className={`p-2 font-mono font-bold text-right ${h.unrealizedPnL >= 0 ? "text-red-500" : "text-green-500"}`}>
                                            ${h.unrealizedPnL.toFixed(2)} ({h.pnlPercent.toFixed(1)}%)
                                        </td>
                                    </tr>
                                ))}
                                {holdings.length === 0 && (
                                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">暫無持倉</td></tr>
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
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Bonus Widget (Moved Here) */}
            <div className="w-full">
                 <BonusWidget apiUrl={API_URL} onClaim={refreshUser} />
            </div>

            {/* Transaction History Table */}
            <Card>
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
