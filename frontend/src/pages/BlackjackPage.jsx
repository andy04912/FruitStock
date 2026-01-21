import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/ui/components';
import { toast } from 'sonner';
import { RotateCw, Users, Plus, History, Play, LogOut, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// 撲克牌元件
const PlayingCard = ({ card, hidden = false, small = false }) => {
    const sizeClass = small ? 'w-12 h-16' : 'w-16 h-24';
    const textSize = small ? 'text-[10px]' : 'text-sm';
    const suitSize = small ? 'text-base' : 'text-2xl';
    
    if (hidden) {
        return (
            <div className={`${sizeClass} bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 flex items-center justify-center shadow-lg`}>
                <div className={suitSize}>🂠</div>
            </div>
        );
    }
    
    const rank = card?.slice(0, -1) || '?';
    const suit = card?.slice(-1) || '';
    const isRed = suit === '♥' || suit === '♦';
    
    return (
        <div className={`${sizeClass} bg-white rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg overflow-hidden ${isRed ? 'text-red-500' : 'text-gray-900'}`}>
            <div className={`${textSize} font-bold leading-none`}>{rank}</div>
            <div className={suitSize}>{suit}</div>
        </div>
    );
};

// 手牌區域
const HandArea = ({ cards, label, value, isDealer = false, hideSecond = false, small = false }) => {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-gray-400">{label}</div>
            <div className="flex gap-1">
                {cards.map((card, i) => (
                    <PlayingCard 
                        key={i} 
                        card={card} 
                        hidden={isDealer && hideSecond && i === 1}
                        small={small}
                    />
                ))}
            </div>
            {value !== undefined && (
                <Badge variant={value > 21 ? "destructive" : value === 21 ? "default" : "secondary"}>
                    {value > 21 ? '爆牌!' : value === 21 ? '21!' : `${value} 點`}
                </Badge>
            )}
        </div>
    );
};

// 單人遊戲元件
const SoloGame = ({ user, refreshUser }) => {
    const [betAmount, setBetAmount] = useState(1000);
    const [gameState, setGameState] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const startGame = async () => {
        if (betAmount < 1000) { toast.error('最低下注 $1,000'); return; }
        if (user.balance < betAmount) { toast.error('餘額不足'); return; }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/start?bet_amount=${betAmount}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.status === 'error') { toast.error(res.data.message); }
            else { setGameState(res.data); refreshUser(); }
        } catch (e) { toast.error('遊戲開始失敗'); }
        finally { setLoading(false); }
    };
    
    const hit = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/hit/${gameState.hand_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGameState(res.data.status === 'finished' ? res.data : prev => ({
                ...prev, player_cards: res.data.player_cards, player_value: res.data.player_value,
                can_double: res.data.can_double
            }));
            if (res.data.status === 'finished') refreshUser();
        } catch (e) { toast.error('操作失敗'); }
        finally { setLoading(false); }
    };
    
    const stand = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/stand/${gameState.hand_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGameState(res.data);
            refreshUser();
        } catch (e) { toast.error('操作失敗'); }
        finally { setLoading(false); }
    };
    
    const doubleDown = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/double/${gameState.hand_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.status === 'error') toast.error(res.data.message);
            else { setGameState(res.data); refreshUser(); }
        } catch (e) { toast.error('操作失敗'); }
        finally { setLoading(false); }
    };
    
    const isGameOver = gameState?.status === 'finished';

    if (!gameState) {
        return (
            <div className="flex flex-col items-center gap-6 py-8">
                <div className="text-6xl">🃏</div>
                <div className="text-xl text-gray-300">單人模式</div>
                <div className="flex items-center gap-4">
                    <span className="text-gray-400">下注:</span>
                    <Input type="number" value={betAmount} onChange={(e) => setBetAmount(Math.max(1000, parseInt(e.target.value) || 0))} className="w-32 text-center font-mono" min={1000} />
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                    {[1000, 5000, 10000, 50000, 100000].map(amt => (
                        <Button key={amt} variant="outline" size="sm" onClick={() => setBetAmount(amt)} className={betAmount === amt ? 'border-yellow-500 text-yellow-500' : ''}>
                            ${amt >= 1000 ? `${amt/1000}K` : amt}
                        </Button>
                    ))}
                </div>
                <Button size="lg" onClick={startGame} disabled={loading || user?.balance < betAmount} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8">
                    {loading ? '發牌中...' : '開始遊戲'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <HandArea cards={isGameOver ? gameState.dealer_cards : [gameState.dealer_show, '?']} label="莊家" value={isGameOver ? gameState.dealer_value : undefined} isDealer={true} hideSecond={!isGameOver} />
            <div className="border-t border-emerald-700/50" />
            <HandArea cards={gameState.player_cards} label="你的手牌" value={gameState.player_value} />
            <div className="text-center text-gray-400">下注: <span className="text-yellow-400 font-mono">${gameState.bet_amount?.toLocaleString()}</span></div>
            
            {!isGameOver ? (
                <div className="flex justify-center gap-4 flex-wrap">
                    <Button onClick={hit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">要牌</Button>
                    <Button onClick={stand} disabled={loading} className="bg-gray-600 hover:bg-gray-700">停牌</Button>
                    {gameState.can_double && <Button onClick={doubleDown} disabled={loading} className="bg-purple-600 hover:bg-purple-700">雙倍</Button>}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <div className={`text-3xl font-bold ${gameState.result === 'WIN' || gameState.result === 'BLACKJACK' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {gameState.result === 'BLACKJACK' && '🎉 Blackjack! 🎉'}
                        {gameState.result === 'WIN' && '你贏了!'}
                        {gameState.result === 'LOSE' && '你輸了'}
                        {gameState.result === 'BUST' && '爆牌!'}
                        {gameState.result === 'PUSH' && '平局'}
                    </div>
                    {gameState.payout > 0 && <div className="text-xl text-yellow-300">獲得 ${gameState.payout.toLocaleString()}</div>}
                    <Button onClick={() => setGameState(null)} className="bg-emerald-600 hover:bg-emerald-700">
                        <RotateCw className="w-4 h-4 mr-2" />再來一局
                    </Button>
                </div>
            )}
        </div>
    );
};

// 多人遊戲元件
const MultiGame = ({ user, refreshUser }) => {
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomState, setRoomState] = useState(null);
    const [betAmount, setBetAmount] = useState(1000);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newRoom, setNewRoom] = useState({ name: '', minBet: 1000, maxBet: '', maxSeats: 6, playerDealer: false });
    
    const loadRooms = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}api/blackjack/rooms`);
            setRooms(res.data);
        } catch (e) { console.error(e); }
    }, []);
    
    const loadRoomState = useCallback(async (roomId) => {
        try {
            const res = await axios.get(`${API_URL}api/blackjack/room/${roomId}`);
            if (res.data.status === 'success') setRoomState(res.data);
        } catch (e) { console.error(e); }
    }, []);
    
    useEffect(() => { loadRooms(); }, [loadRooms]);
    
    // 檢查是否已在房間中（重新整理後恢復）
    useEffect(() => {
        const checkMyRoom = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}api/blackjack/my-room`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.status === 'success' && res.data.room_id) {
                    setCurrentRoom(res.data.room_id);
                }
            } catch (e) { console.error(e); }
        };
        checkMyRoom();
    }, []);
    
    // WebSocket 連線
    useEffect(() => {
        if (!currentRoom) return;

        // 建立 WebSocket 連線
        const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
        const ws = new WebSocket(`${wsUrl}api/ws/blackjack/${currentRoom}`);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'success') {
                    setRoomState(data);
                }
            } catch (e) {
                console.error('WebSocket parse error:', e);
            }
        };

        ws.onerror = (e) => console.error('WebSocket error:', e);
        ws.onclose = () => console.log('WebSocket closed');

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [currentRoom]);

    // 監聽遊戲狀態，當結束時刷新用戶餘額
    useEffect(() => {
        if (roomState?.room?.status === 'FINISHED') {
            // 延遲一點點確保後端已完成結算
            const timer = setTimeout(() => {
                refreshUser();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [roomState?.room?.status, refreshUser]);
    
    const createRoom = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/create-room?name=${encodeURIComponent(newRoom.name || '新房間')}&min_bet=${newRoom.minBet}&max_bet=${newRoom.maxBet || 0}&max_seats=${newRoom.maxSeats}&player_dealer=${newRoom.playerDealer}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === 'success') { toast.success('房間已建立'); setShowCreate(false); loadRooms(); setCurrentRoom(res.data.room_id); }
            else toast.error(res.data.message);
        } catch (e) { toast.error('建立失敗'); }
        finally { setLoading(false); }
    };
    
    const joinRoom = async (roomId) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/join/${roomId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === 'success') { setCurrentRoom(roomId); toast.success('已加入房間'); }
            else toast.error(res.data.message);
        } catch (e) { toast.error('加入失敗'); }
        finally { setLoading(false); }
    };
    
    const leaveRoom = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}api/blackjack/leave/${currentRoom}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setCurrentRoom(null); setRoomState(null); loadRooms();
        } catch (e) { console.error(e); }
    };
    
    const placeBet = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/bet/${currentRoom}?bet_amount=${betAmount}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === 'success') { toast.success('已下注'); refreshUser(); loadRoomState(currentRoom); }
            else toast.error(res.data.message);
        } catch (e) { toast.error('下注失敗'); }
        finally { setLoading(false); }
    };
    
    const startRound = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/start-round/${currentRoom}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === 'success') { loadRoomState(currentRoom); }
            else toast.error(res.data.message);
        } catch (e) { toast.error('開始失敗'); }
        finally { setLoading(false); }
    };
    
    const multiHit = async (handId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}api/blackjack/multi/hit/${handId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            loadRoomState(currentRoom); refreshUser();
        } catch (e) { toast.error('操作失敗'); }
    };
    
    const multiStand = async (handId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}api/blackjack/multi/stand/${handId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            loadRoomState(currentRoom); refreshUser();
        } catch (e) { toast.error('操作失敗'); }
    };
    
    const multiDouble = async (handId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/multi/double/${handId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === 'error') toast.error(res.data.message);
            else { loadRoomState(currentRoom); refreshUser(); }
        } catch (e) { toast.error('操作失敗'); }
    };
    
    const resetRoom = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/reset/${currentRoom}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.status === 'success') {
                toast.success('新一局開始！');
                loadRoomState(currentRoom);
                refreshUser(); // 重置時刷新用戶餘額
            }
            else toast.error(res.data.message);
        } catch (e) { toast.error('重置失敗'); }
    };
    
    // 在房間內
    if (currentRoom && roomState) {
        const myHand = roomState.players.find(p => p.user_id === user.id);
        const isOwner = roomState.room.owner_id === user.id;
        // 使用 dealer_seat 判斷是否為莊家（更可靠）
        const isDealer = roomState.room.dealer_seat > 0 && myHand && myHand.seat === roomState.room.dealer_seat;
        const isMyTurn = myHand && roomState.room.current_seat === myHand.seat && myHand.status === 'PLAYING';
        
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">{roomState.room.name}</h3>
                    <Button variant="ghost" size="sm" onClick={leaveRoom}><LogOut className="w-4 h-4 mr-1" />離開</Button>
                </div>
                
                {/* 莊家區 */}
                <div className="bg-emerald-800/50 p-4 rounded-lg">
                    {(() => {
                        const dealerSeat = roomState.room.dealer_seat;
                        const playerDealer = dealerSeat > 0 ? roomState.players.find(p => p.seat === dealerSeat) : null;
                        
                        if (roomState.room.status === 'WAITING' || roomState.room.status === 'BETTING') {
                            const nonDealerPlayers = roomState.players.filter(p => p.seat !== dealerSeat);
                            const totalBet = nonDealerPlayers.reduce((sum, p) => sum + (p.bet_amount || 0), 0);
                            
                            return (
                                <div className="text-center py-4">
                                    <div className="text-4xl mb-2">🃏</div>
                                    {playerDealer ? (
                                        <div>
                                            <div className="text-white font-bold">{playerDealer.username} (莊家)</div>
                                            <div className="text-sm text-gray-400 mt-1">等待玩家下注...</div>
                                            {totalBet > 0 && (
                                                <div className="text-yellow-400 mt-2">
                                                    總下注: ${totalBet.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-gray-400">等待所有玩家下注...</div>
                                    )}
                                </div>
                            );
                        }
                        
                        // 判斷是否輪到莊家操作
                        const isDealerTurn = playerDealer && roomState.room.current_seat === dealerSeat && playerDealer.status === 'PLAYING';
                        // 玩家當莊時，顯示莊家玩家的手牌；系統當莊時，顯示 dealer_cards
                        const dealerDisplayCards = playerDealer && playerDealer.cards && playerDealer.cards.length > 0
                            ? playerDealer.cards
                            : (roomState.room.dealer_cards.length > 0 ? roomState.room.dealer_cards : ['?', '?']);
                        const dealerValue = playerDealer && playerDealer.cards && playerDealer.cards.length > 0
                            ? playerDealer.value
                            : roomState.room.dealer_value;
                        // 是否顯示所有牌（輪到莊家或已結束）
                        const showAllCards = isDealerTurn || roomState.room.status === 'FINISHED';

                        return (
                            <div>
                                {playerDealer && (
                                    <div className="text-center text-yellow-400 font-bold mb-2">
                                        {playerDealer.username} (莊家)
                                        {isDealerTurn && ' - 輪到你了！'}
                                    </div>
                                )}
                                <HandArea
                                    cards={dealerDisplayCards}
                                    label={playerDealer ? "" : "莊家"}
                                    value={showAllCards ? dealerValue : undefined}
                                    isDealer={true}
                                    hideSecond={!showAllCards}
                                />
                            </div>
                        );
                    })()}
                </div>
                
                {/* 玩家區（排除莊家座位） */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {roomState.players.filter(p => p.seat !== roomState.room.dealer_seat).map(p => (
                        <div key={p.seat} className={`bg-gray-800/50 p-3 rounded-lg ${p.user_id === user.id ? 'ring-2 ring-yellow-500' : ''} ${roomState.room.current_seat === p.seat ? 'ring-2 ring-green-400' : ''}`}>
                            <div className="text-sm mb-2 flex justify-between">
                                <span>{p.username}</span>
                                <Badge>{p.status}</Badge>
                            </div>
                            {Array.isArray(p.cards) && p.cards.length > 0 && (
                                <div className="flex gap-1 justify-center mb-2">
                                    {p.cards.map((c, i) => <PlayingCard key={i} card={c} small />)}
                                </div>
                            )}
                            <div className="text-xs text-center text-gray-400">
                                {p.bet_amount > 0 ? `$${p.bet_amount.toLocaleString()}` : '未下注'}
                                {p.value > 0 && ` | ${p.value}點`}
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* 操作區 */}
                <div className="bg-gray-800/50 p-4 rounded-lg space-y-4">
                    {roomState.room.status === 'WAITING' && !myHand && (
                        <div className="text-center text-gray-400">你已在房間外，請重新加入</div>
                    )}
                    
                    {/* 莊家等待玩家下注 */}
                    {(roomState.room.status === 'WAITING' || roomState.room.status === 'BETTING') && isDealer && (
                        <div className="text-center text-yellow-400">
                            你是莊家，等待其他玩家下注...
                        </div>
                    )}
                    
                    {/* 玩家下注區 */}
                    {(roomState.room.status === 'WAITING' || roomState.room.status === 'BETTING') && myHand && !isDealer && myHand.status !== 'BETTING' && (
                        <div className="flex items-center justify-center gap-4">
                            <Input type="number" value={betAmount} onChange={e => setBetAmount(parseInt(e.target.value) || 0)} className="w-32" />
                            <Button onClick={placeBet} disabled={loading} className="bg-yellow-500 text-black">下注</Button>
                        </div>
                    )}
                    
                    {/* 房主/莊家開始發牌按鈕 */}
                    {roomState.room.status === 'BETTING' && (isOwner || isDealer) && (
                        <div className="text-center">
                            <Button onClick={startRound} className="bg-green-600">
                                <Play className="w-4 h-4 mr-1" />開始發牌
                            </Button>
                        </div>
                    )}
                    
                    {roomState.room.status === 'PLAYING' && isMyTurn && (
                        <div className="flex justify-center gap-4">
                            <Button onClick={() => multiHit(myHand.hand_id)} className="bg-blue-600">要牌</Button>
                            <Button onClick={() => multiStand(myHand.hand_id)} className="bg-gray-600">停牌</Button>
                            {/* 莊家不能雙倍 */}
                            {!isDealer && myHand.cards.length === 2 && (
                                <Button onClick={() => multiDouble(myHand.hand_id)} className="bg-purple-600">雙倍</Button>
                            )}
                        </div>
                    )}
                    
                    {roomState.room.status === 'PLAYING' && !isMyTurn && myHand && (
                        <div className="text-center text-gray-400">
                            {roomState.room.current_seat === roomState.room.dealer_seat
                                ? '等待莊家操作...'
                                : '等待其他玩家...'}
                        </div>
                    )}
                    
                    {roomState.room.status === 'FINISHED' && (
                        <div className="text-center space-y-3">
                            <div className="text-xl font-bold">本局結束</div>
                            {myHand && (() => {
                                // 莊家看總輸贏
                                if (isDealer) {
                                    const nonDealerPlayers = roomState.players.filter(p => p.seat !== roomState.room.dealer_seat);
                                    const totalPayout = nonDealerPlayers.reduce((sum, p) => sum + (p.payout || 0), 0);
                                    const totalBet = nonDealerPlayers.reduce((sum, p) => sum + (p.bet_amount || 0), 0);
                                    const dealerProfit = totalBet - totalPayout;
                                    return (
                                        <div className={dealerProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            莊家{dealerProfit >= 0 ? '贏' : '輸'}: ${Math.abs(dealerProfit).toLocaleString()}
                                        </div>
                                    );
                                }
                                
                                const payout = myHand.payout || 0;
                                const betAmount = myHand.bet_amount || 0;
                                const isWin = ['WIN', 'BLACKJACK'].includes(myHand.status);
                                const isPush = myHand.status === 'PUSH';
                                const netProfit = payout - betAmount;
                                
                                if (isPush) {
                                    return <div className="text-gray-400">平局 (退還 ${betAmount.toLocaleString()})</div>;
                                }
                                if (betAmount === 0) {
                                    return <div className="text-gray-400">未下注</div>;
                                }
                                return (
                                    <div className={isWin ? 'text-green-400' : 'text-red-400'}>
                                        {isWin ? `+$${netProfit.toLocaleString()}` : `-$${betAmount.toLocaleString()}`}
                                    </div>
                                );
                            })()}
                            {(isOwner || isDealer) && (
                                <Button onClick={resetRoom} className="bg-emerald-600">
                                    <RotateCw className="w-4 h-4 mr-2" />繼續下一局
                                </Button>
                            )}
                            {!isOwner && !isDealer && <div className="text-gray-400 text-sm">等待房主開始下一局...</div>}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    // 房間列表
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold">多人房間</h3>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={loadRooms}><RefreshCw className="w-4 h-4" /></Button>
                    <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />開房</Button>
                </div>
            </div>
            
            {showCreate && (
                <Card className="bg-gray-800/50">
                    <CardContent className="p-4 space-y-3">
                        <Input placeholder="房間名稱" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} />
                        <div className="flex gap-2">
                            <Input type="number" placeholder="最低下注" value={newRoom.minBet} onChange={e => setNewRoom({...newRoom, minBet: parseInt(e.target.value) || 1000})} />
                            <Input type="number" placeholder="最高下注(0=無限)" value={newRoom.maxBet} onChange={e => setNewRoom({...newRoom, maxBet: e.target.value})} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={newRoom.playerDealer} 
                                onChange={e => setNewRoom({...newRoom, playerDealer: e.target.checked})}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700"
                            />
                            <span className="text-sm text-gray-300">我要當莊（其他玩家向你下注）</span>
                        </label>
                        <div className="flex gap-2">
                            <Button onClick={createRoom} disabled={loading} className="flex-1 bg-emerald-600">建立</Button>
                            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {rooms.length === 0 ? (
                <div className="text-center text-gray-400 py-8">目前沒有房間，開設一個吧！</div>
            ) : (
                <div className="space-y-2">
                    {rooms.map(r => (
                        <div key={r.id} className="bg-gray-800/50 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <div className="font-bold">{r.name}</div>
                                <div className="text-sm text-gray-400">
                                    {r.owner} | ${r.min_bet.toLocaleString()}+ | {r.seats}/{r.max_seats}人
                                </div>
                            </div>
                            <Button onClick={() => joinRoom(r.id)} disabled={r.seats >= r.max_seats}>加入</Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// 主頁面
const BlackjackPage = () => {
    const { user, refreshUser } = useAuth();
    const [mode, setMode] = useState('solo'); // solo / multi
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}api/blackjack/history`, { headers: { Authorization: `Bearer ${token}` } });
                setHistory(res.data);
            } catch (e) { console.error(e); }
        };
        loadHistory();
    }, []);

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <Card className="bg-gradient-to-br from-emerald-900 to-emerald-950 border-emerald-700">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="text-2xl">🃏 21 點</span>
                        <span className="text-lg font-mono text-yellow-400">${user?.balance?.toLocaleString() || 0}</span>
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant={mode === 'solo' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('solo')}>單人</Button>
                        <Button variant={mode === 'multi' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('multi')}><Users className="w-4 h-4 mr-1" />多人</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {mode === 'solo' ? <SoloGame user={user} refreshUser={refreshUser} /> : <MultiGame user={user} refreshUser={refreshUser} />}
                </CardContent>
            </Card>
            
            <Card className="mt-4">
                <CardHeader className="cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2"><History className="w-4 h-4" />歷史紀錄</span>
                        <span className="text-sm text-gray-400">{showHistory ? '收起' : '展開'}</span>
                    </CardTitle>
                </CardHeader>
                {showHistory && (
                    <CardContent>
                        {history.length === 0 ? <div className="text-center text-gray-400 py-4">暫無紀錄</div> : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {history.map(h => (
                                    <div key={h.id} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={h.result === 'WIN' || h.result === 'BLACKJACK' ? 'default' : 'destructive'}>{h.result}</Badge>
                                            <span className="text-sm text-gray-400">${h.bet_amount.toLocaleString()}</span>
                                        </div>
                                        <span className={`font-mono ${h.payout > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {h.payout > 0 ? `+${h.payout.toLocaleString()}` : `-${h.bet_amount.toLocaleString()}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
};

export default BlackjackPage;
