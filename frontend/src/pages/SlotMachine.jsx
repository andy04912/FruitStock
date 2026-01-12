import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Trophy, Coins, RotateCw, AlertTriangle } from 'lucide-react';

import { API_URL } from '../config';

// Symbol configuration purely for display color/style if needed
// Backend symbols: 7️⃣, 💎, 🔔, 🍇, 🍋, 🍒, ➖
const SYMBOL_STYLES = {
  "7️⃣": "text-4xl md:text-6xl drop-shadow-lg filter",
  "💎": "text-blue-400 text-4xl md:text-6xl drop-shadow-lg filter",
  "🔔": "text-yellow-400 text-4xl md:text-6xl drop-shadow-lg",
  "🍇": "text-purple-500 text-4xl md:text-6xl",
  "🍋": "text-yellow-200 text-4xl md:text-6xl",
  "🍒": "text-red-600 text-4xl md:text-6xl",
  "➖": "text-gray-400 text-4xl md:text-6xl",
};

import { useAuth } from '../context/AuthContext';

const SlotMachine = () => {
  const { user, refreshUser, setUser } = useAuth();
  const balance = user ? user.balance : 0;
  
  const [betAmount, setBetAmount] = useState(10);
  const [reels, setReels] = useState(["7️⃣", "7️⃣", "7️⃣"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [winAnimation, setWinAnimation] = useState(false);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [winHistory, setWinHistory] = useState([]);

  useEffect(() => {
    refreshUser();
  }, []);

  // Auto Spin Logic
  useEffect(() => {
    let timeout;
    if (isAutoSpinning && !spinning && !error) {
        if (balance < betAmount) {
            setIsAutoSpinning(false);
            setError("餘額不足，自動停止");
            return;
        }
        timeout = setTimeout(() => {
            handleSpin();
        }, 500); 
    }
    return () => clearTimeout(timeout);
  }, [isAutoSpinning, spinning, balance, error, betAmount]);

  const handleSpin = async () => {
    if (spinning) return;
    if (balance < betAmount) {
        setError("餘額不足！");
        setIsAutoSpinning(false); // Stop Auto Spin
        return;
    }
    
    setError(null);
    setResult(null);
    setWinAnimation(false);
    setSpinning(true);

    // Initial rapid visual shuffle
    const shuffleInterval = setInterval(() => {
        setReels(prev => prev.map(() => {
            const keys = Object.keys(SYMBOL_STYLES);
            return keys[Math.floor(Math.random() * keys.length)];
        }));
    }, 100);

    // Optimistic Update: Deduct balance immediately
    if (user) {
        setUser({ ...user, balance: user.balance - betAmount });
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/slots/spin?bet_amount=${betAmount}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Artificial Delay for suspense (e.g. 1.5s)
      setTimeout(() => {
        clearInterval(shuffleInterval);
        const data = res.data;
        setReels(data.symbols); // Snap to result
        setResult(data);
        
        // Update user with authoritative new balance from backend
        if (user) {
            setUser({ ...user, balance: data.new_balance });
        }
        
        setSpinning(false);
        
        if (data.payout > 0) {
            setWinAnimation(true);
            setWinHistory(prev => [
                { id: Date.now(), amount: data.payout, multiplier: data.multiplier, time: new Date().toLocaleTimeString() },
                ...prev
            ].slice(0, 2)); // Keep only last 2
        }
      }, 1500);

    } catch (err) {
      clearInterval(shuffleInterval);
      setSpinning(false);
      setIsAutoSpinning(false);
      refreshUser(); // Sync balance on error
      setError(err.response?.data?.detail || "Spin failed");
    }
  };

  return (
    <div className="bg-gray-900 text-white p-4 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse">
        🎰 Cyber Slots 🎰
      </h1>

      {/* Machine Container */}
      <div className="bg-gray-800 p-4 md:p-8 rounded-3xl border-4 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)] max-w-2xl w-full relative">
        
        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl pointer-events-none"></div>

        {/* Reels */}
        <div className="flex justify-center space-x-2 md:space-x-4 mb-6 md:mb-8 bg-black p-4 md:p-6 rounded-xl border-inner shadow-inner border-2 border-gray-700">
          {reels.map((symbol, i) => (
             <div key={i} className={`w-20 h-28 md:w-24 md:h-32 bg-gray-100 rounded-lg flex items-center justify-center border-4 border-gray-300 transform transition-transform ${spinning ? 'animate-bounce' : ''}`}>
               <span className={SYMBOL_STYLES[symbol] || "text-3xl md:text-4xl"}>{symbol}</span>
             </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 w-full">
            
            {/* Bet Control */}
            <div className="flex items-center justify-between w-full md:w-auto space-x-4 bg-gray-700 p-2 md:p-3 rounded-full px-6">
                <span className="font-bold text-gray-300 mr-2">BET:</span>
                <input 
                    type="number" 
                    value={betAmount} 
                    onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
                    className="bg-gray-900 text-white text-center font-mono text-xl w-24 rounded border border-gray-500 focus:border-yellow-400 outline-none"
                    disabled={spinning || isAutoSpinning}
                />
            </div>

            {/* Buttons Row */}
            <div className="flex gap-4 w-full">
                 {/* Auto Spin Toggle */}
                 <button
                    onClick={() => setIsAutoSpinning(!isAutoSpinning)}
                    disabled={spinning && !isAutoSpinning} 
                    className={`
                        flex-1 py-3 md:py-4 rounded-xl text-lg font-bold uppercase transition-all transform border-2
                        ${isAutoSpinning 
                            ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse hover:bg-red-900' 
                            : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400'}
                    `}
                >
                    {isAutoSpinning ? 'STOP AUTO' : 'AUTO SPIN'}
                </button>

                {/* Spin Button */}
                <button
                    onClick={() => handleSpin()}
                    disabled={spinning || balance < betAmount || isAutoSpinning}
                    className={`
                        flex-[2] py-3 md:py-4 rounded-xl text-xl md:text-2xl font-black tracking-widest uppercase transition-all transform
                        ${(spinning || isAutoSpinning)
                            ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                            : 'bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 hover:scale-105 shadow-[0_0_20px_rgba(234,179,8,0.5)] text-black'}
                    `}
                >
                    {spinning ? 'SPINNING...' : 'SPIN!'}
                </button>
            </div>

            {/* Balance Display */}
            <div className="flex items-center space-x-2 text-lg md:text-xl mt-2 text-green-400">
                <Coins size={20} className="md:w-6 md:h-6" />
                <span>Balance: ${balance.toLocaleString()}</span>
            </div>
        </div>

        {/* Win History */}
        {winHistory.length > 0 && (
            <div className="mt-4 w-full">
                <div className="bg-black/40 rounded-lg p-3 border border-gray-700">
                    <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider text-center flex items-center justify-center gap-2">
                        <Trophy size={12} className="text-yellow-500" />
                        Recent Wins
                    </h3>
                    <div className="space-y-2">
                        {winHistory.map(win => (
                            <div key={win.id} className="bg-gray-800/80 p-2 rounded flex justify-between items-center border border-yellow-500/20 animate-in slide-in-from-top-2 fade-in">
                                <span className="text-xs text-gray-500 font-mono">{win.time}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-400 font-bold font-mono">+${win.amount.toLocaleString()}</span>
                                    <span className="text-[10px] bg-yellow-400/10 text-yellow-300 px-1 py-0.5 rounded border border-yellow-500/20">{win.multiplier}x</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Messages */}
        {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-2 text-red-200">
                <AlertTriangle size={20} />
                {error}
            </div>
        )}

        {/* Win Overlay */}
        {result && result.payout > 0 && (
            <div className="mt-6 text-center animate-bounce">
                <div className="text-3xl font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                    {result.win_type === 'BIG_WIN' ? '🎉 SUPER BIG WIN! 🎉' : 'WIN!'}
                </div>
                <div className="text-xl text-white">
                    You won ${result.payout.toLocaleString()}! ({result.multiplier}x)
                </div>
            </div>
        )}
      </div>

      {winAnimation && (
         <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            {/* Simple particle or flash effect placeholder */}
            <div className="absolute inset-0 bg-yellow-500/20 animate-pulse"></div>
         </div>
      )}
    </div>
  );
};

export default SlotMachine;
