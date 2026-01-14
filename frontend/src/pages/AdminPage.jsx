import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Settings, Users, TrendingUp, Gamepad2, Calendar, BarChart3,
  ChevronDown, ChevronUp, RefreshCw, Save, RotateCcw
} from "lucide-react";

// 使用環境變數，支援部署到任何環境
const API_URL = import.meta.env.VITE_API_URL || "";
// 從 API_URL 動態生成 WebSocket URL
const getWsUrl = () => {
  const wsBase = import.meta.env.VITE_WS_URL;
  if (wsBase) return wsBase;
  if (API_URL) {
    return API_URL.replace(/^http/, 'ws') + '/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};
const WS_URL = getWsUrl();

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("adminKey") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Data States
  const [users, setUsers] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [horses, setHorses] = useState([]);
  const [events, setEvents] = useState([]);
  const [configs, setConfigs] = useState({});
  const [stats, setStats] = useState(null);
  const [market, setMarket] = useState(null);
  
  // Modal States
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedHorse, setSelectedHorse] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // WebSocket
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Headers helper
  const headers = { "X-Admin-Key": adminKey };

  // WebSocket 連接
  useEffect(() => {
    if (isAuthenticated) {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "tick") {
            setMarket(prev => ({
              ...prev,
              market_regimes: data.market_regimes,
              regime_durations: data.regime_durations,
              stocks: data.stocks
            }));
          }
        } catch (err) {}
      };
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      return () => ws.close();
    }
  }, [isAuthenticated]);

  // API Calls
  const fetchData = async (endpoint) => {
    const res = await fetch(`${API_URL}/api/admin/${endpoint}`, { headers });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  };

  const postData = async (endpoint, body) => {
    const res = await fetch(`${API_URL}/api/admin/${endpoint}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  const putData = async (endpoint, body) => {
    const res = await fetch(`${API_URL}/api/admin/${endpoint}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  // Auth
  const authenticate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, { headers });
      if (res.status === 404) {
        toast.error("密鑰錯誤");
        setIsAuthenticated(false);
      } else if (res.ok) {
        localStorage.setItem("adminKey", adminKey);
        setIsAuthenticated(true);
        const data = await res.json();
        setUsers(data);
        toast.success("認證成功");
        refreshAll();
      }
    } catch (err) {
      toast.error("連線失敗");
    }
    setLoading(false);
  };

  const refreshAll = async () => {
    try {
      const [usersData, stocksData, horsesData, eventsData, configsData, statsData, marketData] = await Promise.all([
        fetchData("users"),
        fetchData("stocks"),
        fetchData("horses"),
        fetchData("events"),
        fetchData("config"),
        fetchData("stats"),
        fetchData("market")
      ]);
      setUsers(usersData);
      setStocks(stocksData);
      setHorses(horsesData);
      setEvents(eventsData);
      setConfigs(configsData);
      setStats(statsData);
      setMarket(marketData);
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(refreshAll, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (adminKey && !isAuthenticated) authenticate();
  }, []);

  // Config handlers
  const updateConfig = async (key, value) => {
    const res = await putData(`config/${key}`, { value });
    if (res.status === "success") {
      toast.success(res.message);
      setConfigs(prev => ({
        ...prev,
        [key]: { ...prev[key], value, is_default: false }
      }));
    } else {
      toast.error(res.message);
    }
  };

  const resetConfigs = async () => {
    if (!confirm("確定要重置所有配置為預設值嗎？")) return;
    const res = await postData("config/reset", {});
    if (res.status === "success") {
      toast.success(res.message);
      const newConfigs = await fetchData("config");
      setConfigs(newConfigs);
    }
  };

  // User handlers
  const adjustBalance = async (userId, amount, reason) => {
    const res = await putData(`users/${userId}/balance`, { amount, reason });
    if (res.status === "success") {
      toast.success(res.message);
      refreshAll();
    } else {
      toast.error(res.message);
    }
  };

  const toggleFreeze = async (userId, freeze) => {
    const res = await putData(`users/${userId}/freeze`, { freeze });
    if (res.status === "success") {
      toast.success(res.message);
      refreshAll();
    }
  };

  // Stock handlers
  const setStockPrice = async (stockId, price) => {
    const res = await postData(`stocks/${stockId}/price`, { price });
    if (res.status === "success") {
      toast.success(res.message);
      refreshAll();
    } else {
      toast.error(res.message);
    }
  };

  // Horse handlers
  const updateHorse = async (horseId, updates) => {
    const res = await putData(`horses/${horseId}`, updates);
    if (res.status === "success") {
      toast.success(res.message);
      refreshAll();
    }
  };

  // Event handlers
  const createEvent = async (eventData) => {
    const res = await postData("events", eventData);
    if (res.status === "success") {
      toast.success(res.message);
      setShowEventModal(false);
      refreshAll();
    }
  };

  // Regime colors
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

  // Tabs
  const tabs = [
    { id: "dashboard", label: "儀表板", icon: BarChart3 },
    { id: "users", label: "用戶", icon: Users },
    { id: "market", label: "市場", icon: TrendingUp },
    { id: "stocks", label: "股票", icon: TrendingUp },
    { id: "racing", label: "賽馬", icon: Gamepad2 },
    { id: "events", label: "事件", icon: Calendar },
    { id: "config", label: "系統設定", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">📊 管理後台</h1>
            <span className={`px-2 py-1 rounded text-xs ${wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {wsConnected ? '🟢 即時連線' : '🔴 離線'}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshAll} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm flex items-center gap-1">
              <RefreshCw className="h-4 w-4" /> 刷新
            </button>
            <button onClick={() => { localStorage.removeItem("adminKey"); setIsAuthenticated(false); }} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-sm">
              登出
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="用戶數" value={stats.users.total} color="blue" />
              <StatCard title="總現金" value={`$${stats.users.total_cash.toLocaleString()}`} color="green" />
              <StatCard title="總股票市值" value={`$${stats.users.total_stock_value.toLocaleString()}`} color="purple" />
              <StatCard title="系統總資產" value={`$${stats.users.total_assets.toLocaleString()}`} color="yellow" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="今日交易數" value={stats.today.transactions} color="cyan" />
              <StatCard title="今日買入" value={stats.today.buy_count} color="green" />
              <StatCard title="今日賣出" value={stats.today.sell_count} color="red" />
              <StatCard title="今日成交量" value={`$${stats.today.volume.toLocaleString()}`} color="pink" />
            </div>
            
            {/* Market Regimes */}
            {market && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3">📈 市場狀態</h3>
                <div className="grid grid-cols-3 gap-4">
                  {["FRUIT", "MEAT", "ROOT"].map(cat => {
                    const regime = market.market_regimes?.[cat] || "NORMAL";
                    const duration = market.regime_durations?.[cat] || 0;
                    const names = { FRUIT: "🍎 水果", MEAT: "🥩 肉類", ROOT: "🥔 根莖" };
                    const regimeNames = { NORMAL: "平穩", BOOM: "牛市 🚀", CRASH: "崩盤 📉", CHAOS: "混亂 🌪️" };
                    return (
                      <div key={cat} className="bg-zinc-800 rounded-lg p-4">
                        <div className="text-sm text-zinc-400 mb-1">{names[cat]}</div>
                        <div className={`text-lg font-bold ${getRegimeColor(regime).split(' ')[0]}`}>
                          {regimeNames[regime]}
                        </div>
                        <div className="text-xs text-zinc-500">剩餘 {duration}s</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">用戶名</th>
                    <th className="px-4 py-3 text-right">餘額</th>
                    <th className="px-4 py-3 text-right">股票市值</th>
                    <th className="px-4 py-3 text-right">淨值</th>
                    <th className="px-4 py-3 text-center">狀態</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-400">{user.id}</td>
                      <td className="px-4 py-3 font-medium">{user.username}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">${user.balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-blue-400">${user.stock_value.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-yellow-400">${user.net_worth.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {user.is_frozen ? <span className="text-red-400">🔒 凍結</span> : <span className="text-green-400">正常</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => setSelectedUser(user)} className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs">
                            詳情
                          </button>
                          <button 
                            onClick={() => {
                              const amount = prompt("輸入金額（正數=增加，負數=減少）:", "1000");
                              if (amount) adjustBalance(user.id, parseFloat(amount), "管理員調整");
                            }}
                            className="px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 rounded text-xs"
                          >
                            調錢
                          </button>
                          <button 
                            onClick={() => toggleFreeze(user.id, !user.is_frozen)}
                            className={`px-2 py-1 rounded text-xs ${user.is_frozen ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}
                          >
                            {user.is_frozen ? "解凍" : "凍結"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stocks Tab */}
        {activeTab === "stocks" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">代碼</th>
                    <th className="px-4 py-3 text-left">名稱</th>
                    <th className="px-4 py-3 text-center">類別</th>
                    <th className="px-4 py-3 text-right">現價</th>
                    <th className="px-4 py-3 text-right">漲跌</th>
                    <th className="px-4 py-3 text-right">波動度</th>
                    <th className="px-4 py-3 text-right">配息率</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {stocks.map(stock => (
                    <tr key={stock.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-mono font-bold">{stock.symbol}</td>
                      <td className="px-4 py-3">{stock.name}</td>
                      <td className="px-4 py-3 text-center">{stock.category}</td>
                      <td className="px-4 py-3 text-right font-mono">${stock.price.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right ${stock.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct}%
                      </td>
                      <td className="px-4 py-3 text-right">{(stock.volatility * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">{(stock.dividend_yield * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => {
                            const price = prompt(`設定 ${stock.symbol} 價格:`, stock.price.toString());
                            if (price) setStockPrice(stock.id, parseFloat(price));
                          }}
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs"
                        >
                          調價
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Racing Tab */}
        {activeTab === "racing" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">馬名</th>
                    <th className="px-4 py-3 text-center">速度</th>
                    <th className="px-4 py-3 text-center">耐力</th>
                    <th className="px-4 py-3 text-center">幸運</th>
                    <th className="px-4 py-3 text-center">勝率</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {horses.map(horse => (
                    <tr key={horse.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-400">{horse.id}</td>
                      <td className="px-4 py-3 font-medium">🐎 {horse.name}</td>
                      <td className="px-4 py-3 text-center">
                        <StatBar value={horse.speed} color="blue" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatBar value={horse.stamina} color="green" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatBar value={horse.luck} color="yellow" />
                      </td>
                      <td className="px-4 py-3 text-center">{horse.win_rate}%</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => setSelectedHorse(horse)}
                          className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded text-xs"
                        >
                          編輯
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-4">
            <button
              onClick={() => setShowEventModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold"
            >
              + 手動觸發事件
            </button>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">時間</th>
                    <th className="px-4 py-3 text-left">標題</th>
                    <th className="px-4 py-3 text-left">描述</th>
                    <th className="px-4 py-3 text-center">影響力</th>
                    <th className="px-4 py-3 text-center">持續</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {events.map(event => (
                    <tr key={event.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(event.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{event.title}</td>
                      <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{event.description}</td>
                      <td className={`px-4 py-3 text-center ${event.impact_multiplier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {event.impact_multiplier > 0 ? '+' : ''}{(event.impact_multiplier * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-center">{event.duration_seconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === "config" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={resetConfigs} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> 重置所有配置
              </button>
            </div>
            
            {["market", "race", "slots", "user"].map(category => (
              <div key={category} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="font-semibold mb-4 capitalize">
                  {category === "market" && "📈 市場參數"}
                  {category === "race" && "🏇 賽馬參數"}
                  {category === "slots" && "🎰 老虎機參數"}
                  {category === "user" && "👤 用戶參數"}
                </h3>
                <div className="space-y-4">
                  {Object.entries(configs)
                    .filter(([key]) => key.startsWith(category + "."))
                    .map(([key, config]) => (
                      <ConfigRow 
                        key={key}
                        configKey={key}
                        config={config}
                        onUpdate={updateConfig}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Market Tab */}
        {activeTab === "market" && market && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="font-semibold mb-4">📈 市場狀態（即時）</h3>
              <div className="grid grid-cols-3 gap-4">
                {["FRUIT", "MEAT", "ROOT"].map(cat => {
                  const regime = market.market_regimes?.[cat] || "NORMAL";
                  const duration = market.regime_durations?.[cat] || 0;
                  const names = { FRUIT: "🍎 水果", MEAT: "🥩 肉類", ROOT: "🥔 根莖" };
                  const regimeNames = { NORMAL: "平穩", BOOM: "牛市 🚀", CRASH: "崩盤 📉", CHAOS: "混亂 🌪️" };
                  const volInfo = {
                    NORMAL: { range: "±6%/分鐘", direction: "" },
                    BOOM: { range: "±9%/分鐘", direction: "↗ 向上偏移" },
                    CRASH: { range: "±12%/分鐘", direction: "↘ 向下偏移" },
                    CHAOS: { range: "±24%/分鐘", direction: "⚡ 劇烈波動" }
                  }[regime];
                  return (
                    <div key={cat} className="bg-zinc-800 rounded-lg p-4">
                      <div className="text-sm text-zinc-400 mb-2">{names[cat]}</div>
                      <div className={`text-xl font-bold mb-1 ${getRegimeColor(regime).split(' ')[0]}`}>
                        {regimeNames[regime]}
                      </div>
                      <div className="text-yellow-400 text-sm">{volInfo.range}</div>
                      {volInfo.direction && <div className="text-zinc-400 text-xs">{volInfo.direction}</div>}
                      <div className="text-xs text-zinc-500 mt-2">剩餘 {duration} 秒</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Horse Edit Modal */}
      {selectedHorse && (
        <Modal title={`編輯馬匹: ${selectedHorse.name}`} onClose={() => setSelectedHorse(null)}>
          <HorseEditForm horse={selectedHorse} onSave={(updates) => {
            updateHorse(selectedHorse.id, updates);
            setSelectedHorse(null);
          }} />
        </Modal>
      )}

      {/* Event Create Modal */}
      {showEventModal && (
        <Modal title="手動觸發事件" onClose={() => setShowEventModal(false)}>
          <EventCreateForm stocks={stocks} onCreate={createEvent} />
        </Modal>
      )}
    </div>
  );
}

// === Sub Components ===

function StatCard({ title, value, color }) {
  const colors = {
    blue: "text-blue-400",
    green: "text-emerald-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
    cyan: "text-cyan-400",
    red: "text-red-400",
    pink: "text-pink-400"
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-zinc-400 text-xs mb-1">{title}</div>
      <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}

function StatBar({ value, color }) {
  const colors = { blue: "bg-blue-500", green: "bg-green-500", yellow: "bg-yellow-500" };
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs">{value}</span>
    </div>
  );
}

function ConfigRow({ configKey, config, onUpdate }) {
  const [value, setValue] = useState(config.value);
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onUpdate(configKey, parseFloat(value));
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-4 p-3 bg-zinc-800/50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-sm">{configKey.split('.')[1]}</div>
        <div className="text-xs text-zinc-400 mt-1">{config.description}</div>
        {config.is_default === false && (
          <div className="text-xs text-emerald-400 mt-1">✓ 已自訂</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              step="0.01"
              className="w-24 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-right text-sm"
            />
            <button onClick={handleSave} className="p-1 bg-emerald-600 rounded">
              <Save className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <span className="font-mono text-emerald-400">{config.value}</span>
            <button onClick={() => setEditing(true)} className="p-1 bg-zinc-700 rounded hover:bg-zinc-600">
              ✏️
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function HorseEditForm({ horse, onSave }) {
  const [speed, setSpeed] = useState(horse.speed);
  const [stamina, setStamina] = useState(horse.stamina);
  const [luck, setLuck] = useState(horse.luck);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">速度 (0-100)</label>
        <input type="number" min="0" max="100" value={speed} onChange={e => setSpeed(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded" />
        <p className="text-xs text-zinc-500 mt-1">影響馬匹的最高速度，數值越高跑得越快</p>
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">耐力 (0-100)</label>
        <input type="number" min="0" max="100" value={stamina} onChange={e => setStamina(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded" />
        <p className="text-xs text-zinc-500 mt-1">影響馬匹的持久力，數值越高後半段越不會掉速</p>
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">幸運 (0-100)</label>
        <input type="number" min="0" max="100" value={luck} onChange={e => setLuck(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded" />
        <p className="text-xs text-zinc-500 mt-1">影響隨機爆發機率，數值越高越容易突然加速</p>
      </div>
      <button onClick={() => onSave({ speed, stamina, luck })} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold">
        儲存
      </button>
    </div>
  );
}

function EventCreateForm({ stocks, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stockId, setStockId] = useState("");
  const [impact, setImpact] = useState(0.05);
  const [duration, setDuration] = useState(60);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">標題</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="事件標題" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded" />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">描述</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="事件描述" rows="2" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded" />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">目標股票（可選）</label>
        <select value={stockId} onChange={e => setStockId(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded">
          <option value="">全市場</option>
          {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} - {s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">影響力 ({(impact * 100).toFixed(0)}%)</label>
          <input type="range" min="-0.3" max="0.3" step="0.01" value={impact} onChange={e => setImpact(parseFloat(e.target.value))}
            className="w-full" />
          <p className="text-xs text-zinc-500">正數=上漲，負數=下跌</p>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">持續時間 ({duration}秒)</label>
          <input type="range" min="10" max="300" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
            className="w-full" />
        </div>
      </div>
      <button onClick={() => onCreate({ title, description, stock_id: stockId || null, impact, duration })} 
        disabled={!title}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg font-semibold">
        觸發事件
      </button>
    </div>
  );
}
