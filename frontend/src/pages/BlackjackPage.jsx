import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/ui/components';
import { toast } from 'sonner';
import { Spade, Heart, Diamond, Club, RotateCw, Users, Plus, History } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// 撲克牌花色圖示
const getSuitIcon = (card) => {
    if (!card) return null;
    const suit = card.slice(-1);
    switch (suit) {
        case '♠': return <Spade className="w-3 h-3 text-gray-900" />;
        case '♥': return <Heart className="w-3 h-3 text-red-500" />;
        case '♦': return <Diamond className="w-3 h-3 text-red-500" />;
        case '♣': return <Club className="w-3 h-3 text-gray-900" />;
        default: return null;
    }
};

// 撲克牌元件
const PlayingCard = ({ card, hidden = false }) => {
    if (hidden) {
        return (
            <div className="w-16 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 flex items-center justify-center shadow-lg">
                <div className="text-2xl">🂠</div>
            </div>
        );
    }
    
    const rank = card?.slice(0, -1) || '?';
    const suit = card?.slice(-1) || '';
    const isRed = suit === '♥' || suit === '♦';
    
    return (
        <div className={`w-16 h-24 bg-white rounded-lg border-2 border-gray-300 flex flex-col items-center justify-between p-1 shadow-lg ${isRed ? 'text-red-500' : 'text-gray-900'}`}>
            <div className="self-start text-sm font-bold">{rank}</div>
            <div className="text-2xl">{suit}</div>
            <div className="self-end text-sm font-bold rotate-180">{rank}</div>
        </div>
    );
};

// 手牌區域
const HandArea = ({ cards, label, value, isDealer = false, hideSecond = false }) => {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-gray-400">{label}</div>
            <div className="flex gap-2">
                {cards.map((card, i) => (
                    <PlayingCard 
                        key={i} 
                        card={card} 
                        hidden={isDealer && hideSecond && i === 1} 
                    />
                ))}
            </div>
            {value !== undefined && (
                <Badge variant={value > 21 ? "destructive" : value === 21 ? "default" : "secondary"}>
                    {value > 21 ? '爆牌!' : value === 21 ? 'Blackjack!' : `${value} 點`}
                </Badge>
            )}
        </div>
    );
};

const BlackjackPage = () => {
    const { user, refreshUser } = useAuth();
    const [betAmount, setBetAmount] = useState(1000);
    const [gameState, setGameState] = useState(null); // null = 未開始
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    
    // 載入歷史紀錄
    useEffect(() => {
        loadHistory();
    }, []);
    
    const loadHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}api/blackjack/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
        } catch (e) {
            console.error('Failed to load history', e);
        }
    };
    
    // 開始遊戲
    const startGame = async () => {
        if (betAmount < 1000) {
            toast.error('最低下注 $1,000');
            return;
        }
        if (user.balance < betAmount) {
            toast.error('餘額不足');
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/start?bet_amount=${betAmount}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.status === 'error') {
                toast.error(res.data.message);
            } else if (res.data.status === 'finished') {
                // Blackjack 直接結算
                setGameState(res.data);
                refreshUser();
                loadHistory();
                if (res.data.result === 'BLACKJACK') {
                    toast.success(`Blackjack! 贏得 $${res.data.payout.toLocaleString()}`);
                }
            } else {
                setGameState(res.data);
                refreshUser();
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || '遊戲開始失敗');
        } finally {
            setLoading(false);
        }
    };
    
    // 要牌
    const hit = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/hit/${gameState.hand_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.status === 'finished') {
                setGameState(res.data);
                refreshUser();
                loadHistory();
                handleResult(res.data);
            } else {
                setGameState(prev => ({
                    ...prev,
                    player_cards: res.data.player_cards,
                    player_value: res.data.player_value,
                    can_double: res.data.can_double,
                    can_split: res.data.can_split
                }));
            }
        } catch (e) {
            toast.error('操作失敗');
        } finally {
            setLoading(false);
        }
    };
    
    // 停牌
    const stand = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/stand/${gameState.hand_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setGameState(res.data);
            refreshUser();
            loadHistory();
            handleResult(res.data);
        } catch (e) {
            toast.error('操作失敗');
        } finally {
            setLoading(false);
        }
    };
    
    // 雙倍
    const doubleDown = async () => {
        if (user.balance < gameState.bet_amount) {
            toast.error('餘額不足以雙倍');
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}api/blackjack/double/${gameState.hand_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.status === 'error') {
                toast.error(res.data.message);
            } else {
                setGameState(res.data);
                refreshUser();
                loadHistory();
                handleResult(res.data);
            }
        } catch (e) {
            toast.error('操作失敗');
        } finally {
            setLoading(false);
        }
    };
    
    // 處理結果
    const handleResult = (data) => {
        if (data.result === 'WIN' || data.result === 'BLACKJACK') {
            toast.success(`贏了! +$${data.payout.toLocaleString()}`);
        } else if (data.result === 'PUSH') {
            toast.info('平局，莊家贏');
        } else if (data.result === 'BUST') {
            toast.error('爆牌! 輸了');
        } else {
            toast.error('輸了');
        }
    };
    
    // 重新開始
    const resetGame = () => {
        setGameState(null);
    };
    
    const isGameOver = gameState?.status === 'finished';

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <Card className="bg-gradient-to-br from-emerald-900 to-emerald-950 border-emerald-700">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="text-2xl">🃏 21 點</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">餘額:</span>
                            <span className="text-lg font-mono text-yellow-400">
                                ${user?.balance?.toLocaleString() || 0}
                            </span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    {/* 遊戲區域 */}
                    {!gameState ? (
                        // 下注畫面
                        <div className="flex flex-col items-center gap-6 py-8">
                            <div className="text-6xl">🃏</div>
                            <div className="text-xl text-gray-300">準備好了嗎？</div>
                            
                            <div className="flex items-center gap-4">
                                <span className="text-gray-400">下注金額(可自訂):</span>
                                <Input
                                    type="number"
                                    value={betAmount}
                                    onChange={(e) => setBetAmount(Math.max(1000, parseInt(e.target.value) || 0))}
                                    className="w-32 text-center font-mono"
                                    min={1000}
                                />
                            </div>
                            
                            <div className="flex gap-2">
                                {[1000, 5000, 10000, 50000, 100000].map(amt => (
                                    <Button
                                        key={amt}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setBetAmount(amt)}
                                        className={betAmount === amt ? 'border-yellow-500 text-yellow-500' : ''}
                                    >
                                        ${amt >= 1000 ? `${amt/1000}K` : amt}
                                    </Button>
                                ))}
                            </div>
                            
                            <Button
                                size="lg"
                                onClick={startGame}
                                disabled={loading || betAmount < 1000 || user?.balance < betAmount}
                                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8"
                            >
                                {loading ? '發牌中...' : '開始遊戲'}
                            </Button>
                        </div>
                    ) : (
                        // 遊戲進行中
                        <div className="space-y-8">
                            {/* 莊家區域 */}
                            <div className="flex justify-center">
                                <HandArea
                                    cards={isGameOver ? gameState.dealer_cards : [gameState.dealer_show, '?']}
                                    label="莊家"
                                    value={isGameOver ? gameState.dealer_value : undefined}
                                    isDealer={true}
                                    hideSecond={!isGameOver}
                                />
                            </div>
                            
                            {/* 分隔線 */}
                            <div className="border-t border-emerald-700/50" />
                            
                            {/* 玩家區域 */}
                            <div className="flex justify-center">
                                <HandArea
                                    cards={gameState.player_cards}
                                    label="你的手牌"
                                    value={gameState.player_value}
                                />
                            </div>
                            
                            {/* 下注資訊 */}
                            <div className="text-center text-gray-400">
                                下注: <span className="text-yellow-400 font-mono">${gameState.bet_amount?.toLocaleString()}</span>
                            </div>
                            
                            {/* 操作按鈕 */}
                            {!isGameOver ? (
                                <div className="flex justify-center gap-4">
                                    <Button
                                        onClick={hit}
                                        disabled={loading}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        要牌 (Hit)
                                    </Button>
                                    <Button
                                        onClick={stand}
                                        disabled={loading}
                                        className="bg-gray-600 hover:bg-gray-700"
                                    >
                                        停牌 (Stand)
                                    </Button>
                                    {gameState.can_double && (
                                        <Button
                                            onClick={doubleDown}
                                            disabled={loading || user?.balance < gameState.bet_amount}
                                            className="bg-purple-600 hover:bg-purple-700"
                                        >
                                            雙倍 (Double)
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                // 結算畫面
                                <div className="flex flex-col items-center gap-4">
                                    <div className={`text-3xl font-bold ${
                                        gameState.result === 'WIN' || gameState.result === 'BLACKJACK' 
                                            ? 'text-yellow-400' 
                                            : 'text-red-400'
                                    }`}>
                                        {gameState.result === 'BLACKJACK' && '🎉 Blackjack! 🎉'}
                                        {gameState.result === 'WIN' && '你贏了!'}
                                        {gameState.result === 'LOSE' && '你輸了'}
                                        {gameState.result === 'BUST' && '爆牌!'}
                                        {gameState.result === 'PUSH' && '平局 (莊家贏)'}
                                    </div>
                                    
                                    {gameState.payout > 0 && (
                                        <div className="text-xl text-yellow-300">
                                            獲得 ${gameState.payout.toLocaleString()}
                                        </div>
                                    )}
                                    
                                    <Button
                                        onClick={resetGame}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <RotateCw className="w-4 h-4 mr-2" />
                                        再來一局
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {/* 歷史紀錄 */}
            <Card className="mt-4">
                <CardHeader 
                    className="cursor-pointer"
                    onClick={() => setShowHistory(!showHistory)}
                >
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                            <History className="w-4 h-4" />
                            歷史紀錄
                        </span>
                        <span className="text-sm text-gray-400">
                            {showHistory ? '收起' : '展開'}
                        </span>
                    </CardTitle>
                </CardHeader>
                {showHistory && (
                    <CardContent>
                        {history.length === 0 ? (
                            <div className="text-center text-gray-400 py-4">暫無紀錄</div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {history.map(h => (
                                    <div 
                                        key={h.id} 
                                        className="flex justify-between items-center p-2 bg-gray-800/50 rounded"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Badge variant={
                                                h.result === 'WIN' || h.result === 'BLACKJACK' 
                                                    ? 'default' 
                                                    : 'destructive'
                                            }>
                                                {h.result}
                                            </Badge>
                                            <span className="text-sm text-gray-400">
                                                下注 ${h.bet_amount.toLocaleString()}
                                            </span>
                                        </div>
                                        <span className={`font-mono ${h.payout > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {h.payout > 0 ? '+' : ''}{h.payout > 0 ? h.payout.toLocaleString() : `-${h.bet_amount.toLocaleString()}`}
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
