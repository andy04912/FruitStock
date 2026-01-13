import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("adminKey") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState([]);
  const [market, setMarket] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // WebSocket 連接
  useEffect(() => {
    if (isAuthenticated) {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log("[Admin WS] Connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "tick") {
            // 更新市場狀態
            setMarket(prev => ({
              ...prev,
              market_regimes: data.market_regimes,
              regime_durations: data.regime_durations,
              stocks: data.stocks
            }));
          }
        } catch (err) {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log("[Admin WS] Disconnected");
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      return () => {
        ws.close();
      };
    }
  }, [isAuthenticated]);

  // 驗證密鑰
  const authenticate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { "X-Admin-Key": adminKey }
      });
      if (res.status === 404) {
        toast.error("密鑰錯誤");
        setIsAuthenticated(false);
      } else if (res.ok) {
        localStorage.setItem("adminKey", adminKey);
        setIsAuthenticated(true);
        const data = await res.json();
        setUsers(data);
        toast.success("認證成功");
        fetchMarket();
      }
    } catch (err) {
      toast.error("連線失敗");
    }
    setLoading(false);
  };

  // 取得市場狀態
  const fetchMarket = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/market`, {
        headers: { "X-Admin-Key": adminKey }
      });
      if (res.ok) {
        setMarket(await res.json());
      }
    } catch (err) {}
  };

  // 取得用戶詳情
  const fetchUserDetail = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { "X-Admin-Key": adminKey }
      });
      if (res.ok) {
        setSelectedUser(await res.json());
      }
    } catch (err) {}
  };

  // 刷新用戶數據
  const refreshUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { "X-Admin-Key": adminKey }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {}
    setLoading(false);
  };

  // 用戶數據每 10 秒刷新
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(refreshUsers, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // 嘗試自動登入
  useEffect(() => {
    if (adminKey && !isAuthenticated) {
      authenticate();
    }
  }, []);

  // Regime 顏色
  const getRegimeColor = (regime) => {
    switch (regime) {
      case "BOOM": return "text-green-400 bg-green-400/10";
      case "CRASH": return "text-red-400 bg-red-400/10";
      case "CHAOS": return "text-purple-400 bg-purple-400/10";
      default: return "text-zinc-300 bg-zinc-700/50";
    }
  };

  // 登入頁面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-[400px] shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">🔐 管理後台</h1>
          <input
            type="password"
            placeholder="請輸入管理密鑰"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
          />
          <button
            onClick={authenticate}
            disabled={loading || !adminKey}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "驗證中..." : "進入後台"}
          </button>
        </div>
      </div>
    );
  }

  // 管理後台
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">📊 管理後台</h1>
          <span className={`px-2 py-1 rounded text-xs ${wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {wsConnected ? '🟢 即時連線' : '🔴 離線'}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshUsers}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            {loading ? "刷新中..." : "🔄 刷新用戶"}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("adminKey");
              setIsAuthenticated(false);
              setAdminKey("");
            }}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
          >
            登出
          </button>
        </div>
      </div>

      {/* Market Status - 各市場獨立狀態 */}
      {market && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">📈 市場狀態</h2>
            <span className="text-zinc-500 text-sm">股票數: {market.stocks?.length || 0}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {["FRUIT", "MEAT", "ROOT"].map(category => {
              const regime = market.market_regimes?.[category] || "NORMAL";
              const duration = market.regime_durations?.[category] || 0;
              const categoryNames = { FRUIT: "🍎 水果", MEAT: "🥩 肉類", ROOT: "🥔 根莖" };
              
              // 中文狀態名稱
              const regimeNames = {
                "NORMAL": "平穩",
                "BOOM": "牛市 🚀",
                "CRASH": "崩盤 📉",
                "CHAOS": "混亂 🌪️"
              };
              
              // 預期波動幅度（每分鐘）
              const volatilityInfo = {
                "NORMAL": { range: "±6%", direction: "" },
                "BOOM": { range: "±9%", direction: "↗ 向上" },
                "CRASH": { range: "±12%", direction: "↘ 向下" },
                "CHAOS": { range: "±24%", direction: "⚡ 劇烈" }
              };
              const volInfo = volatilityInfo[regime] || volatilityInfo["NORMAL"];
              
              return (
                <div key={category} className="bg-zinc-800 rounded-lg p-4">
                  <div className="text-sm text-zinc-400 mb-2">{categoryNames[category]}</div>
                  <div className={`text-lg font-bold mb-1 ${getRegimeColor(regime).split(' ')[0]}`}>
                    {regimeNames[regime] || regime}
                  </div>
                  <div className="text-sm text-zinc-300 mb-2">
                    <span className="text-yellow-400 font-medium">{volInfo.range}/分鐘</span>
                    {volInfo.direction && <span className="text-zinc-400 ml-2">{volInfo.direction}</span>}
                  </div>
                  <div className="text-xs text-zinc-500">剩餘 {duration} 秒</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">👥 用戶列表 ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">用戶名</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase">餘額</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase">股票市值</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase">淨值</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-400">{user.id}</td>
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">${user.balance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-blue-400">${user.stock_value.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-yellow-400">${user.net_worth.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => fetchUserDetail(user.id)}
                      className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm transition-colors"
                    >
                      詳情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900">
              <h2 className="text-xl font-bold">{selectedUser.username} 的詳細資訊</h2>
              <button onClick={() => setSelectedUser(null)} className="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <div className="text-zinc-400 text-sm">餘額</div>
                  <div className="text-xl font-bold text-emerald-400">${selectedUser.balance.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <div className="text-zinc-400 text-sm">股票市值</div>
                  <div className="text-xl font-bold text-blue-400">${selectedUser.stock_value.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <div className="text-zinc-400 text-sm">淨值</div>
                  <div className="text-xl font-bold text-yellow-400">${selectedUser.net_worth.toLocaleString()}</div>
                </div>
              </div>

              {/* Holdings */}
              {selectedUser.holdings?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">📦 持股</h3>
                  <div className="bg-zinc-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-700/50">
                        <tr>
                          <th className="px-3 py-2 text-left">股票</th>
                          <th className="px-3 py-2 text-right">數量</th>
                          <th className="px-3 py-2 text-right">均價</th>
                          <th className="px-3 py-2 text-right">現價</th>
                          <th className="px-3 py-2 text-right">損益</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700">
                        {selectedUser.holdings.map(h => (
                          <tr key={h.stock_id}>
                            <td className="px-3 py-2">{h.symbol}</td>
                            <td className="px-3 py-2 text-right">{h.quantity}</td>
                            <td className="px-3 py-2 text-right">${h.avg_cost}</td>
                            <td className="px-3 py-2 text-right">${h.current_price}</td>
                            <td className={`px-3 py-2 text-right font-medium ${h.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {h.pnl >= 0 ? '+' : ''}{h.pnl.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {selectedUser.recent_transactions?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">📜 最近交易</h3>
                  <div className="bg-zinc-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-700/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">類型</th>
                          <th className="px-3 py-2 text-left">股票</th>
                          <th className="px-3 py-2 text-right">價格</th>
                          <th className="px-3 py-2 text-right">數量</th>
                          <th className="px-3 py-2 text-right">損益</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700">
                        {selectedUser.recent_transactions.map(tx => (
                          <tr key={tx.id}>
                            <td className={`px-3 py-2 font-medium ${tx.type === 'buy' ? 'text-green-400' : tx.type === 'sell' ? 'text-red-400' : 'text-blue-400'}`}>
                              {tx.type.toUpperCase()}
                            </td>
                            <td className="px-3 py-2">{tx.stock_symbol}</td>
                            <td className="px-3 py-2 text-right">${tx.price}</td>
                            <td className="px-3 py-2 text-right">{tx.quantity}</td>
                            <td className="px-3 py-2 text-right">
                              {tx.profit != null ? (tx.profit >= 0 ? '+' : '') + tx.profit.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
