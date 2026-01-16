import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from "../components/ui/components";
import { toast } from "sonner";
import { Timer, Trophy, DollarSign, History, Users, ClipboardCheck } from "lucide-react";
import { sounds } from "../utils/sound";

export default function RacePage() {
    const { user, API_URL, refreshUser } = useAuth();
    const [race, setRace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [betAmount, setBetAmount] = useState(100);
    const [selectedHorse, setSelectedHorse] = useState(null);
    const [betting, setBetting] = useState(false);
    const [history, setHistory] = useState([]);
    const [friendsBets, setFriendsBets] = useState([]);
    
    // Animation State
    const [positions, setPositions] = useState({}); // { horse_id: percentage }
    const requestRef = useRef();
    
    // Polling Race Info
    useEffect(() => {
        const fetchRace = async () => {
            try {
                const res = await axios.get(`${API_URL}/race/next`);
                if (res.data.status !== "NO_RACE") {
                    setRace(prev => {
                        // Detect transition to FINISHED to refresh user balance
                        if (prev && prev.status !== "FINISHED" && res.data.status === "FINISHED") {
                            refreshUser(); // Sync balance
                            toast.success("比賽結束！請查看下注結果 🏆");
                            
                            // Play sound if won
                            if (prev.winner_id && prev.winner_id === res.data.winner_id) {
                                // Logic handled in backend response usually but here we can check if user bet on winner
                                const myWin = res.data.user_bets.some(b => b.horse_id === res.data.winner_id);
                                if (myWin) sounds.playBuy();
                            }
                        }
                        return res.data;
                    });
                }
            } catch (e) {
                console.error("Race fetch error", e);
            } finally {
                setLoading(false);
            }
        };
        
        const fetchHistory = async () => {
             try {
                const res = await axios.get(`${API_URL}/race/history`);
                setHistory(res.data);
            } catch (e) {}
        };
        
        fetchRace();
        fetchHistory();
        
        const interval = setInterval(fetchRace, 2000); // 2s polling
        return () => clearInterval(interval);
    }, [API_URL]);

    // 取得好友投注
    useEffect(() => {
        const fetchFriendsBets = async () => {
            if (!race?.id) return;
            try {
                const res = await axios.get(`${API_URL}/race/friends-bets/${race.id}`);
                setFriendsBets(res.data);
            } catch (e) {
                console.error("Friends bets fetch error", e);
            }
        };
        fetchFriendsBets();
    }, [race?.id, API_URL]);

    const handleBet = async () => {
        if (!selectedHorse || betAmount <= 0) return;
        setBetting(true);
        try {
            const res = await axios.post(`${API_URL}/race/bet`, {
                race_id: race.id,
                horse_id: selectedHorse,
                amount: betAmount
            });
            
            if (res.data.status === 'success') {
                toast.success("下注成功！祝你好運！");
                sounds.playBuy();
                refreshUser();
                setRace(prev => ({
                    ...prev,
                    user_bets: [...prev.user_bets, { 
                        horse_id: selectedHorse, 
                        amount: betAmount, 
                        odds: race.participants.find(p => p.horse_id === selectedHorse)?.odds 
                    }]
                }));
            } else {
                toast.error(res.data.message);
                sounds.playError();
            }
        } catch (e) {
            toast.error("下注失敗");
            sounds.playError();
        } finally {
            setBetting(false);
        }
    };

    // Calculate Countdown
    const getCountdown = () => {
        if (!race) return "Loading...";
        const start = new Date(race.start_time).getTime();
        const now = new Date().getTime(); 
        const diff = Math.max(0, Math.floor((start - now) / 1000));
        
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // --- ANIMATION LOOP ---
    const animate = () => {
        if (!race || race.status !== "RUNNING" || !race.start_time) {
            // If finished, set final positions
            if (race?.status === "FINISHED" && race.winner_id) {
                const finalPos = {};
                race.participants.forEach(p => {
                     // Use deterministic position based on ID to avoid jittering every frame
                     // 70% + (id % 20)% -> range 70-90%
                     finalPos[p.horse_id] = p.horse_id === race.winner_id ? 100 : 70 + (p.horse_id * 7 % 20);
                });
                setPositions(finalPos);
            }
            requestRef.current = requestAnimationFrame(animate);
            return;
        }

        const now = Date.now();
        const start = new Date(race.start_time).getTime();
        const duration = 30 * 1000; // 30 seconds race
        const elapsed = now - start;
        const progress = Math.min(1, Math.max(0, elapsed / duration));

        const newPositions = {};
        
        race.participants.forEach((p, idx) => {
             // Seed random based on horse_id for consistency across renders if needed, 
             // but here we just want cool visual.
             // We know the winner: race.winner_id (Available in RUNNING now)
             const isWinner = p.horse_id === race.winner_id;
             
             // Organic movement using easing
             // Simple EaseOut formulation for natural start-fast-end-slow feel
             const easedProgress = 1 - Math.pow(1 - progress, 1.5); 
             
             let pos = easedProgress * 85; 
             
             // Multi-layer organic noise (Simulate jockey movement & stamina variance)
             // Low freq + High freq waves
             const noise = (Math.sin(elapsed * 0.002 + idx * 10) * 0.4) + 
                           (Math.cos(elapsed * 0.005 + idx * 20) * 0.2);

             if (isWinner) {
                 // Winner Logic: 
                 // Stays in pack until 60%, then smoothly accelerates past others
                 if (progress > 0.6) {
                     // Quadratic boost for smooth overtake
                     const boostPhase = (progress - 0.6) / 0.4; // 0 to 1
                     const boost = boostPhase * boostPhase * 25; 
                     pos += boost;
                 }
                 pos += noise * 0.5; // Winner is more stable
             } else {
                 // Loser Logic:
                 pos += noise;
                 
                 // Fatigue/Giving up effect at the very end
                 if (progress > 0.85) {
                      pos -= (progress - 0.85) * 5; 
                 }
                 
                 // Cap losers
                 pos = Math.min(92, pos); 
             }
             
             // Clamp 0-105 (Winner goes off screen)
             newPositions[p.horse_id] = Math.max(5, pos);
        });

        setPositions(newPositions);
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [race]);


    if (loading && !race) return <div className="p-8 text-center animate-pulse">正在前往馬場...</div>;

    const isBettingOpen = race?.status === "OPEN";
    const isRunning = race?.status === "RUNNING";
    const isFinished = race?.status === "FINISHED";

    return (
        <div className="container mx-auto p-4 max-w-screen-xl">
             <div className="flex flex-col gap-6">
                {/* Header */}
                <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-yellow-500/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex md:flex-row justify-between items-center gap-3 text-yellow-500">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 md:h-6 md:w-6" />
                                <span className="text-base md:text-lg">皇家賽馬場</span>
                            </div>
                            <div className="flex items-center gap-3 bg-black/30 px-3  rounded-full border border-yellow-500/30 text-sm">
                                <span className={isBettingOpen ? "text-green-400 animate-pulse" : "text-red-400"}>
                                    {isBettingOpen ? "開放下注" : isRunning ? "比賽中" : isFinished ? "已結束" : "準備中"}
                                </span>
                                {isBettingOpen && (
                                    <span className="font-mono text-lg text-white">
                                        ⏱ {getCountdown()}
                                    </span>
                                )}
                            </div>
                        </CardTitle>
                        <div className="flex justify-between items-center">
                                    <span className="text-slate-400">錢包餘額</span>
                                    <span className="font-bold text-emerald-400 font-mono text-xl">${user?.balance?.toFixed(2)}</span>
                                </div>
                    </CardHeader>
                    
                </Card>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Track & Horses */}
                    <div className="flex-1 space-y-6">
                        {/* Race Track Animation Area */}
                        {(isRunning || isFinished) && (
                             <Card className="overflow-hidden bg-slate-950 border-green-500/30 relative h-[400px]">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dirt.png')] opacity-20"></div>
                                {/* Track Lines */}
                                <div className="absolute inset-0 flex flex-col justify-around py-4">
                                    {race.participants.map((p, idx) => (
                                        <div key={p.horse_id} className="relative h-8 border-b border-white/5 mx-4 group">
                                             {/* Lane Number */}
                                             <div className="absolute left-[-10px] top-1 text-[10px] text-white/30 font-mono">{idx + 1}</div>
                                             
                                             {/* Horse Avatar Moving */}
                                             <div 
                                                className="absolute top-[-24px] flex flex-col items-center z-10"
                                                style={{ 
                                                    left: `${positions[p.horse_id] || 5}%`, 
                                                    // No transition here because we are using requestAnimationFrame for smooth 60fps
                                                }}
                                             >
                                                {/* Tooltip / Name */}
                                                <div className="mb-1 pointer-events-none opacity-80 whitespace-nowrap">
                                                    <span className="text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-bold border border-white/10 shadow-sm">
                                                        {p.name}
                                                    </span>
                                                </div>

                                                {/* Horse Icon */}
                                                <div className="transform scale-x-[-1] text-3xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                                    🐎
                                                </div>
                                                
                                                {/* Dust Effect (Simple Dot) for Leader */}
                                                {race.winner_id === p.horse_id && isRunning && (
                                                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-yellow-500/50 rounded-full blur-sm animate-ping" />
                                                )}
                                             </div>
                                        </div>
                                    ))}
                                    {/* Finish Line */}
                                    <div className="absolute right-[5%] top-0 bottom-0 w-2 bg-white/10 border-x border-dashed border-red-500/50 flex flex-col items-center justify-center">
                                        <div className="h-full w-px bg-red-500/50"></div>
                                        <div className="absolute top-2 text-[10px] text-red-500 font-bold tracking-widest uppercase writing-mode-vertical">Finish</div>
                                    </div>
                                </div>
                                
                                {isRunning && (
                                    <div className="absolute top-4 right-4 bg-red-600/90 text-white px-3 py-1 rounded animate-pulse font-bold text-sm tracking-wider shadow-lg">
                                        🔴 LIVE
                                    </div>
                                )}
                             </Card>
                        )}
                        
                        {isFinished && race.winner_id && (
                             <Card className="bg-gradient-to-br from-yellow-900/40 to-black border-yellow-500/50 animate-in zoom-in-95 duration-500">
                                <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
                                        <Trophy className="h-20 w-20 text-yellow-400 relative z-10 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                                    </div>
                                    
                                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm">
                                        {race.participants.find(p => p.horse_id === race.winner_id)?.name}
                                    </h2>
                                    
                                    {race.winner_announcement && (
                                        <div className="bg-yellow-950/40 p-6 rounded-xl border border-yellow-500/20 max-w-lg mx-auto backdrop-blur-sm">
                                            <p className="text-yellow-100 text-base leading-relaxed font-medium">
                                                {race.winner_announcement}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                             </Card>
                        )}

                        {/* Participants List (Betting Table) */}
                        <Card>
                             <CardHeader>
                                <CardTitle>參賽馬匹一覽</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {race?.participants?.map((horse) => {
                                        const isExpanded = selectedHorse === horse.horse_id;
                                        const myBets = race.user_bets?.filter(b => b.horse_id === horse.horse_id);
                                        const totalBet = myBets?.reduce((sum, b) => sum + b.amount, 0) || 0;
                                        
                                        // 該馬的好友投注 - 合併同一位好友的投注
                                        const horseFriendsBets = friendsBets.filter(b => b.horse_id === horse.horse_id);
                                        const mergedFriendsBets = Object.values(
                                            horseFriendsBets.reduce((acc, bet) => {
                                                if (acc[bet.username]) {
                                                    acc[bet.username].amount += bet.amount;
                                                } else {
                                                    acc[bet.username] = { ...bet };
                                                }
                                                return acc;
                                            }, {})
                                        );
                                        const displayFriends = mergedFriendsBets.slice(0, 5);
                                        const extraFriendsCount = mergedFriendsBets.length - 5;
                                        
                                        return (
                                            <div 
                                                key={horse.horse_id}
                                                className={`border rounded-lg transition-all duration-300 ${isExpanded ? 'border-yellow-500 bg-yellow-900/10 ring-1 ring-yellow-500/50' : 'border-slate-700 hover:border-slate-600'}`}
                                            >
                                                {/* 馬匹主資訊 - 可點擊 */}
                                                <div 
                                                    className="p-3 cursor-pointer"
                                                    onClick={() => isBettingOpen && setSelectedHorse(isExpanded ? null : horse.horse_id)}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="h-6 w-6 flex items-center justify-center rounded-full p-0 bg-slate-800 text-xs font-mono text-slate-400">
                                                                {horse.lane}
                                                            </Badge>
                                                            <span className="font-bold text-sm truncate max-w-[100px] text-ellipsis text-slate-200" title={horse.name}>{horse.name}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xl font-mono text-yellow-400 font-bold">x{horse.odds}</div>
                                                            <div className="text-xs text-slate-500">賠率</div>
                                                        </div>
                                                    </div>
                                                    
                                                     <div className="space-y-1 mt-1">
                                                        <div className="flex justify-between text-xs text-slate-400">
                                                            <span>綜合素質</span>
                                                            <span className="font-mono text-slate-500">{Math.round(horse.score)}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${isExpanded ? "bg-yellow-500" : "bg-blue-500"}`} 
                                                                style={{ width: `${Math.min(100, horse.score / 2.5)}%` }} 
                                                            ></div>
                                                        </div>
                                                     </div>

                                                     {totalBet > 0 && (
                                                         <div className="mt-2 bg-green-900/20 text-green-400 px-2 py-1 rounded text-[10px] flex items-center justify-center gap-1 border border-green-500/20 font-bold">
                                                             <DollarSign className="w-3 h-3" />
                                                             已下注: ${totalBet}
                                                         </div>
                                                     )}
                                                     
                                                     {/* 好友投注摘要（收合時也顯示詳情） */}
                                                     {!isExpanded && horseFriendsBets.length > 0 && (
                                                         <div className="mt-2 bg-purple-950/30 rounded p-2 border border-purple-500/20">
                                                             <div className="text-[10px] text-purple-400 font-bold mb-1 flex items-center gap-1">
                                                                 <Users className="w-3 h-3" />
                                                                 好友投注
                                                             </div>
                                                             <div className="space-y-0.5">
                                                                 {displayFriends.map((bet, idx) => (
                                                                     <div key={idx} className="flex justify-between text-[10px]">
                                                                         <span className="text-slate-400 truncate max-w-[80px]">{bet.username}</span>
                                                                         <span className="font-mono text-yellow-400">${bet.amount}</span>
                                                                     </div>
                                                                 ))}
                                                                 {extraFriendsCount > 0 && (
                                                                     <div className="text-[10px] text-purple-400/70 text-center pt-0.5">
                                                                         +{extraFriendsCount} 位好友
                                                                     </div>
                                                                 )}
                                                             </div>
                                                         </div>
                                                     )}
                                                </div>
                                                
                                                {/* 展開區域 - 下注 + 好友投注 */}
                                                <div 
                                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}
                                                >
                                                    <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
                                                        {/* 下注區域 */}
                                                        <div className="space-y-2">
                                                            <div className="flex gap-2">
                                                                {[100, 500, 1000].map(amt => (
                                                                    <Button 
                                                                        key={amt} 
                                                                        variant="outline" 
                                                                        size="sm"
                                                                        onClick={(e) => { e.stopPropagation(); setBetAmount(amt); }}
                                                                        className={`flex-1 text-xs transition-all ${betAmount === amt ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "hover:border-slate-500"}`}
                                                                    >
                                                                        ${amt}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                                                    <Input 
                                                                        type="number" 
                                                                        value={betAmount}
                                                                        onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="font-mono text-sm pl-5 h-9"
                                                                    />
                                                                </div>
                                                                <Button 
                                                                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold h-9 px-4"
                                                                    disabled={betting || betAmount > user?.balance || betAmount <= 0}
                                                                    onClick={(e) => { e.stopPropagation(); handleBet(); }}
                                                                >
                                                                    {betting ? "..." : "下注"}
                                                                </Button>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 text-center">
                                                                可贏: <span className="text-yellow-400 font-mono">${(betAmount * horse.odds).toFixed(0)}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* 好友投注詳情 */}
                                                        {horseFriendsBets.length > 0 && (
                                                            <div className="bg-purple-950/30 rounded-lg p-2 border border-purple-500/20">
                                                                <div className="text-[10px] text-purple-400 font-bold mb-2 flex items-center gap-1">
                                                                    <Users className="w-3 h-3" />
                                                                    好友投注
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {displayFriends.map((bet, idx) => (
                                                                        <div key={idx} className="flex justify-between text-xs">
                                                                            <span className="text-slate-300 truncate max-w-[100px]">{bet.username}</span>
                                                                            <span className="font-mono text-yellow-400">${bet.amount}</span>
                                                                        </div>
                                                                    ))}
                                                                    {extraFriendsCount > 0 && (
                                                                        <div className="text-[10px] text-purple-400/70 text-center pt-1">
                                                                            還有 {extraFriendsCount} 位好友投注
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Panel: Balance & History */}
                    <div className="w-full lg:w-[350px] space-y-6">
                        
                        

                        {/* 當輪統計 */}
                        {race?.user_bets?.length > 0 && (
                            <Card className="border-cyan-500/20 bg-cyan-950/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        📊 本輪統計
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const totalBet = race.user_bets.reduce((sum, b) => sum + b.amount, 0);
                                        const totalPayout = race.user_bets.reduce((sum, b) => sum + (b.payout || 0), 0);
                                        const profit = race.status === "FINISHED" ? totalPayout - totalBet : 0;
                                        const profitPercent = totalBet > 0 ? (profit / totalBet * 100) : 0;
                                        
                                        return (
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <div className="text-[10px] text-slate-400">下注總額</div>
                                                    <div className="font-mono font-bold text-yellow-400">${totalBet}</div>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <div className="text-[10px] text-slate-400">回收金額</div>
                                                    <div className="font-mono font-bold text-emerald-400">${totalPayout}</div>
                                                </div>
                                                <div className="p-2 bg-slate-900/50 rounded">
                                                    <div className="text-[10px] text-slate-400">損益</div>
                                                    <div className={`font-mono font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {race.status === "FINISHED" ? (
                                                            <>
                                                                {profit >= 0 ? '+' : ''}{profit.toFixed(0)}
                                                                <span className="text-[10px] block">({profitPercent.toFixed(1)}%)</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-500">--</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        )}

                        {/* Recent History */}

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center">
                                    <History className="mr-2 h-4 w-4" />
                                    下注紀錄
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {history.slice(0, 10).map(h => ( // Show last 10
                                        <div key={h.id} className="text-sm border-b border-white/5 last:border-0 pb-2 hover:bg-white/5 p-2 rounded transition-colors">
                                             <div className="flex justify-between items-center mb-1">
                                                 <span className="text-xs text-slate-500 font-mono">{new Date(h.created_at).toLocaleTimeString()}</span>
                                                 <Badge variant={h.result === 'WON' ? 'default' : h.result === 'LOST' ? 'destructive' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                                                     {h.result === 'WON' ? '獲勝' : h.result === 'LOST' ? '未中' : '進行中'}
                                                 </Badge>
                                             </div>
                                             <div className="flex justify-between items-center">
                                                 <span className="font-bold">{h.horse_name}</span>
                                                 <span className="font-mono text-slate-300 bg-slate-800 px-1.5 rounded text-xs py-0.5">${h.amount}</span>
                                             </div>
                                             {h.result === 'WON' && (
                                                 <div className="text-right text-green-400 text-xs font-bold mt-1">
                                                     +${h.payout}
                                                 </div>
                                             )}
                                        </div>
                                    ))}
                                    {history.length === 0 && <div className="text-center text-slate-500 py-4">無紀錄</div>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
             </div>
        </div>
    );
}
