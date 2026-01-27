import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/components";
import { Trophy, Medal, Crown, TrendingUp, User, Users, History, Star, ArrowUp, ArrowDown, Minus, Calendar } from "lucide-react";
import { formatMoney } from "../utils/format";

export default function LeaderboardPage() {
    const { API_URL, user, token } = useAuth();
    const [leaders, setLeaders] = useState([]);
    const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
    const [historicalLeaderboard, setHistoricalLeaderboard] = useState([]);
    const [hallOfFame, setHallOfFame] = useState(null);
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("global"); // global, friends, history, hall

    const headers = { Authorization: `Bearer ${token}` };

    const fetchLeaders = async () => {
        try {
            const res = await axios.get(`${API_URL}/leaderboard`);
            setLeaders(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchFriendsLeaderboard = async () => {
        try {
            const res = await axios.get(`${API_URL}/friends/leaderboard`, { headers });
            setFriendsLeaderboard(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchHistoricalLeaderboard = async (date = null) => {
        try {
            const url = date
                ? `${API_URL}/leaderboard/history?date=${date}`
                : `${API_URL}/leaderboard/history`;
            const res = await axios.get(url);
            setHistoricalLeaderboard(res.data.leaderboard || []);
            if (!selectedDate && res.data.date) {
                setSelectedDate(res.data.date);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchAvailableDates = async () => {
        try {
            const res = await axios.get(`${API_URL}/leaderboard/dates`);
            setAvailableDates(res.data.dates || []);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchHallOfFame = async () => {
        try {
            const res = await axios.get(`${API_URL}/leaderboard/hall-of-fame`);
            setHallOfFame(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchLeaders();
        fetchFriendsLeaderboard();
        fetchHistoricalLeaderboard();
        fetchAvailableDates();
        fetchHallOfFame();

        const interval = setInterval(() => {
            fetchLeaders();
            fetchFriendsLeaderboard();
        }, 5000);
        return () => clearInterval(interval);
    }, [API_URL]);

    useEffect(() => {
        if (selectedDate) {
            fetchHistoricalLeaderboard(selectedDate);
        }
    }, [selectedDate]);

    if (loading && leaders.length === 0) {
        return (
             <div className="flex h-[80vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    let currentLeaders = [];
    if (activeTab === "global") {
        currentLeaders = leaders;
    } else if (activeTab === "friends") {
        currentLeaders = friendsLeaderboard;
    } else if (activeTab === "history") {
        currentLeaders = historicalLeaderboard;
    }

    const top3 = currentLeaders.slice(0, 3);
    const rest = currentLeaders.slice(3);

    return (
        <div className="container mx-auto p-4 max-w-screen-xl min-h-[calc(100vh-80px)] space-y-8">
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
                <button
                    onClick={() => setActiveTab("global")}
                    className={`px-6 py-2 rounded-full font-bold transition-all ${
                        activeTab === "global"
                            ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                >
                    🌍 全服排行
                </button>
                <button
                    onClick={() => setActiveTab("friends")}
                    className={`px-6 py-2 rounded-full font-bold transition-all ${
                        activeTab === "friends"
                            ? "bg-gradient-to-r from-emerald-400 to-cyan-500 text-black"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                >
                    👥 好友排行
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`px-6 py-2 rounded-full font-bold transition-all ${
                        activeTab === "history"
                            ? "bg-gradient-to-r from-blue-400 to-purple-500 text-black"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                >
                    📅 歷史排行
                </button>
                <button
                    onClick={() => setActiveTab("hall")}
                    className={`px-6 py-2 rounded-full font-bold transition-all ${
                        activeTab === "hall"
                            ? "bg-gradient-to-r from-pink-400 to-rose-500 text-black"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                >
                    ⭐ 名人堂
                </button>
            </div>
            {/* Header */}
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 animate-in fade-in zoom-in duration-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    WALL OF WEALTH
                </h1>
                <p className="text-muted-foreground text-lg uppercase tracking-[0.5em]">富豪排行榜</p>
            </div>

            {/* Tabs */}
            

            {/* 歷史排行日期選擇器 */}
            {activeTab === "history" && availableDates.length > 0 && (
                <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-700 rounded-lg p-2">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        <select
                            value={selectedDate || ""}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
                        >
                            {availableDates.map(date => (
                                <option key={date} value={date} className="bg-zinc-800">
                                    {date}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Empty State for Friends */}
            {activeTab === "friends" && friendsLeaderboard.length <= 1 ? (
                <div className="text-center py-12 text-zinc-400 animate-in fade-in zoom-in duration-500">
                    <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">還沒有好友</p>
                    <p className="text-sm mt-2">到「資產分佈」頁面加好友吧！</p>
                </div>
            ) : activeTab === "hall" ? (
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* 名人堂內容 */}
                    {hallOfFame && hallOfFame.top_champions && hallOfFame.top_champions.length > 0 && (
                        <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-500/30">
                            <CardContent className="p-6">
                                <h2 className="text-2xl font-black mb-4 flex items-center gap-2 text-yellow-400">
                                    <Crown className="h-6 w-6" />
                                    登頂王 - 榮登第一次數
                                </h2>
                                <div className="space-y-2">
                                    {hallOfFame.top_champions.map((champ, idx) => (
                                        <div key={champ.user_id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">
                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                </span>
                                                <span className="font-bold text-lg">{champ.display_name}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-yellow-400 font-black text-xl">{champ.champion_days} 天</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {!hallOfFame || (hallOfFame.top_champions && hallOfFame.top_champions.length === 0) && (
                        <div className="text-center py-12 text-zinc-400">
                            <Star className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">名人堂尚未開啟</p>
                            <p className="text-sm mt-2">系統會每天記錄排名快照，請明天再來查看！</p>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Podium Section (Top 3) */}
                    {currentLeaders.length > 0 && (
                        <div className="relative flex flex-col md:flex-row justify-center items-end gap-4 md:gap-8 min-h-[300px] mb-12 px-4">
                            
                            {/* 2nd Place */}
                            {top3[1] && (
                                <div className="order-2 md:order-1 flex flex-col items-center w-full md:w-1/3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                                    <div className="relative mb-4">
                                        <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 p-1 shadow-[0_0_20px_rgba(148,163,184,0.4)]">
                                            <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-2xl font-bold text-slate-400">
                                                {(top3[1].display_name || top3[1].username).charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-900 font-bold px-3 py-1 rounded-full text-sm shadow-lg border-2 border-slate-400">
                                            #2
                                        </div>
                                    </div>
                                    <Card className="w-full bg-slate-800/50 border-slate-600/50 backdrop-blur-sm overflow-hidden">
                                        <div className="h-2 w-full bg-slate-400" />
                                        <CardContent className="p-4 text-center">
                                            <div className="font-bold text-xl truncate">
                                                {top3[1].display_name || top3[1].username}
                                                {top3[1].is_me && <span className="ml-2 text-xs text-emerald-400">(你)</span>}
                                            </div>
                                            <div className="text-slate-400 font-mono mt-1">{formatMoney(top3[1].net_worth)}</div>
                                        </CardContent>
                                    </Card>
                                    <div className="h-16 w-full md:w-3/4 bg-gradient-to-b from-slate-700/50 to-transparent mt-2 rounded-t-lg hidden md:block" />
                                </div>
                            )}

                            {/* 1st Place */}
                            {top3[0] && (
                                <div className="order-1 md:order-2 flex flex-col items-center w-full md:w-1/3 z-10 -mt-8 md:-mt-16 animate-in fade-in slide-in-from-bottom-12 duration-700">
                                    <div className="relative mb-6">
                                        <Crown className="absolute -top-12 left-1/2 -translate-x-1/2 h-12 w-12 text-yellow-500 animate-bounce drop-shadow-[0_0_10px_gold]" />
                                        <div className="h-28 w-28 md:h-32 md:w-32 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-yellow-500 p-1.5 shadow-[0_0_40px_rgba(234,179,8,0.6)]">
                                            <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-4xl font-black text-yellow-500">
                                                {(top3[0].display_name || top3[0].username).charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black px-4 py-1.5 rounded-full text-lg shadow-xl shadow-orange-500/20 border-2 border-yellow-200">
                                            #1
                                        </div>
                                    </div>
                                    <Card className="w-full bg-gradient-to-b from-yellow-900/40 to-background border-yellow-500/30 backdrop-blur-sm shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                                        <div className="h-3 w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 animate-pulse" />
                                        <CardContent className="p-6 text-center">
                                            <div className="font-black text-2xl truncate text-yellow-400 mb-1">
                                                {top3[0].display_name || top3[0].username}
                                                {top3[0].is_me && <span className="ml-2 text-xs text-emerald-400">(你)</span>}
                                            </div>
                                            <div className="text-foreground font-mono text-xl font-bold">{formatMoney(top3[0].net_worth)}</div>
                                            <div className="mt-2 inline-flex items-center text-xs font-mono text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded">
                                                <TrendingUp className="h-3 w-3 mr-1" /> {activeTab === "global" ? "ALL TIME HIGH" : "FRIEND CHAMPION"}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="h-24 w-full md:w-3/4 bg-gradient-to-b from-yellow-600/20 to-transparent mt-2 rounded-t-lg hidden md:block" />
                                </div>
                            )}

                            {/* 3rd Place */}
                            {top3[2] && (
                                <div className="order-3 md:order-3 flex flex-col items-center w-full md:w-1/3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                                    <div className="relative mb-4">
                                        <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-gradient-to-br from-orange-700 to-amber-900 p-1 shadow-[0_0_20px_rgba(180,83,9,0.4)]">
                                            <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-2xl font-bold text-amber-700">
                                                {(top3[2].display_name || top3[2].username).charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-800 text-amber-100 font-bold px-3 py-1 rounded-full text-sm shadow-lg border-2 border-amber-900">
                                            #3
                                        </div>
                                    </div>
                                    <Card className="w-full bg-amber-950/30 border-amber-900/50 backdrop-blur-sm overflow-hidden">
                                        <div className="h-2 w-full bg-amber-700" />
                                        <CardContent className="p-4 text-center">
                                            <div className="font-bold text-xl truncate text-amber-500">
                                                {top3[2].display_name || top3[2].username}
                                                {top3[2].is_me && <span className="ml-2 text-xs text-emerald-400">(你)</span>}
                                            </div>
                                            <div className="text-amber-700 font-mono mt-1">{formatMoney(top3[2].net_worth)}</div>
                                        </CardContent>
                                    </Card>
                                    <div className="h-12 w-full md:w-3/4 bg-gradient-to-b from-amber-900/30 to-transparent mt-2 rounded-t-lg hidden md:block" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* List Section (4 - 10+) */}
                    {rest.length > 0 && (
                        <div className="max-w-4xl mx-auto space-y-2 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                            {activeTab === "global" && (
                                <div className="flex items-center gap-2 text-muted-foreground mb-4 px-2">
                                    <Users className="h-5 w-5" />
                                    <span className="text-sm font-bold uppercase tracking-wider">
                                        Challengers
                                    </span>
                                </div>
                            )}
                    
                    {rest.map((player, index) => {
                        const rankChange = player.rank_change;
                        return (
                            <div
                                key={player.id || player.user_id || player.username}
                                className={`group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:scale-[1.01] hover:shadow-lg ${
                                    player.is_me || player.username === user?.username
                                        ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                        : ""
                                }`}
                            >
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono text-muted-foreground w-8 text-center text-lg">
                                            #{player.rank || index + 4}
                                        </div>
                                        {/* 排名變化指示器 */}
                                        {activeTab === "history" && rankChange !== null && rankChange !== undefined && (
                                            <div className="flex flex-col items-center">
                                                {rankChange > 0 ? (
                                                    <div className="flex items-center text-red-400 text-xs">
                                                        <ArrowUp className="h-3 w-3" />
                                                        <span>{rankChange}</span>
                                                    </div>
                                                ) : rankChange < 0 ? (
                                                    <div className="flex items-center text-green-400 text-xs">
                                                        <ArrowDown className="h-3 w-3" />
                                                        <span>{Math.abs(rankChange)}</span>
                                                    </div>
                                                ) : (
                                                    <Minus className="h-3 w-3 text-zinc-600" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-muted-foreground font-bold">
                                            {(player.display_name || player.username).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-bold text-lg ${
                                                player.is_me || player.username === user?.username
                                                    ? "text-primary"
                                                    : "text-slate-200"
                                            }`}>
                                                {player.display_name || player.username}
                                            </span>
                                            {(player.is_me || player.username === user?.username) && (
                                                <span className="text-[10px] uppercase tracking-widest text-primary font-bold">YOU</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="font-mono text-lg text-slate-300 group-hover:text-white transition-colors">
                                    {formatMoney(player.net_worth)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </>
            )}
        </div>
    );
}
