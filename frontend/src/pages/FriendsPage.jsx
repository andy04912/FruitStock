import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function FriendsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("leaderboard"); // leaderboard, search, pending
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // 取得好友排行榜
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/friends/leaderboard`, { headers });
      if (res.ok) setLeaderboard(await res.json());
    } catch (err) {}
  };

  // 取得待處理請求
  const fetchPending = async () => {
    try {
      const res = await fetch(`${API_URL}/api/friends/pending`, { headers });
      if (res.ok) setPendingRequests(await res.json());
    } catch (err) {}
  };

  // 搜尋用戶
  const searchUsers = async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/friends/search?q=${encodeURIComponent(searchQuery)}`, { headers });
      if (res.ok) setSearchResults(await res.json());
    } catch (err) {}
  };

  // 發送好友請求
  const sendRequest = async (userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/friends/request/${userId}`, { 
        method: "POST", 
        headers 
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success(data.message);
        searchUsers(); // 刷新搜尋結果
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("發送失敗");
    }
    setLoading(false);
  };

  // 接受好友請求
  const acceptRequest = async (requestId) => {
    try {
      const res = await fetch(`${API_URL}/api/friends/accept/${requestId}`, { 
        method: "POST", 
        headers 
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success(data.message);
        fetchPending();
        fetchLeaderboard();
      } else {
        toast.error(data.message);
      }
    } catch (err) {}
  };

  // 拒絕好友請求
  const rejectRequest = async (requestId) => {
    try {
      const res = await fetch(`${API_URL}/api/friends/reject/${requestId}`, { 
        method: "POST", 
        headers 
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("已拒絕");
        fetchPending();
      }
    } catch (err) {}
  };

  // 刪除好友
  const removeFriend = async (friendId, username) => {
    if (!confirm(`確定要刪除好友 ${username} 嗎？`)) return;
    try {
      const res = await fetch(`${API_URL}/api/friends/${friendId}`, { 
        method: "DELETE", 
        headers 
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("已刪除好友");
        fetchLeaderboard();
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchPending();
  }, []);

  useEffect(() => {
    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">👥 好友系統</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "leaderboard", label: "🏆 排行榜", badge: null },
          { key: "search", label: "🔍 加好友", badge: null },
          { key: "pending", label: "📩 待處理", badge: pendingRequests.length || null }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg transition-colors relative ${
              activeTab === tab.key 
                ? "bg-emerald-600 text-white" 
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 好友排行榜 */}
      {activeTab === "leaderboard" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold">好友排行榜</h2>
          </div>
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              還沒有好友，去加一些吧！
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">排名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">玩家</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">餘額</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">股票</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">淨值</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leaderboard.map(user => (
                  <tr 
                    key={user.id} 
                    className={`transition-colors ${user.is_me ? "bg-emerald-500/10" : "hover:bg-zinc-800/30"}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        user.rank === 1 ? "text-yellow-400" :
                        user.rank === 2 ? "text-zinc-300" :
                        user.rank === 3 ? "text-amber-600" :
                        "text-zinc-500"
                      }`}>
                        {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : `#${user.rank}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {user.username}
                      {user.is_me && <span className="ml-2 text-xs text-emerald-400">(你)</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">${user.balance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-blue-400">${user.stock_value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-yellow-400">${user.net_worth.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {!user.is_me && (
                        <button
                          onClick={() => removeFriend(user.id, user.username)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          刪除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 搜尋加好友 */}
      {activeTab === "search" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <input
            type="text"
            placeholder="輸入用戶名搜尋（至少 2 個字）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
          />
          
          {searchResults.length === 0 && searchQuery.length >= 2 && (
            <div className="text-center text-zinc-500 py-4">找不到用戶</div>
          )}
          
          <div className="space-y-2">
            {searchResults.map(user => (
              <div key={user.id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
                <span className="font-medium">{user.username}</span>
                {user.status === "friend" ? (
                  <span className="text-emerald-400 text-sm">✓ 已是好友</span>
                ) : user.status === "pending_sent" ? (
                  <span className="text-yellow-400 text-sm">⏳ 已發送請求</span>
                ) : user.status === "pending_received" ? (
                  <span className="text-blue-400 text-sm">📩 待你接受</span>
                ) : (
                  <button
                    onClick={() => sendRequest(user.id)}
                    disabled={loading}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm transition-colors"
                  >
                    加好友
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 待處理請求 */}
      {activeTab === "pending" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          {pendingRequests.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">沒有待處理的好友請求</div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <div key={req.request_id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
                  <div>
                    <span className="font-medium">{req.username}</span>
                    <span className="text-zinc-500 text-sm ml-2">想加你為好友</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(req.request_id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm transition-colors"
                    >
                      接受
                    </button>
                    <button
                      onClick={() => rejectRequest(req.request_id)}
                      className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm transition-colors"
                    >
                      拒絕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
