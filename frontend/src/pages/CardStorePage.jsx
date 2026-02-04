import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "../components/ui/components";
import { toast } from "sonner";
import { sounds } from "../utils/sound";
import { formatMoney } from "../utils/format";
import { Sparkles, Gift, Coins } from "lucide-react";

// ==================== 可調整參數 ====================
const GACHA_PRICE_SINGLE = 1000;    // 單抽價格
const GACHA_PRICE_TEN = 9000;       // 十連抽價格（9折優惠）
// ====================================================

// 稀有度配置
const RARITY_CONFIG = {
    N: { name: "N", color: "bg-zinc-500", textColor: "text-zinc-400", glow: false, probability: 0.60 },
    R: { name: "R", color: "bg-blue-500", textColor: "text-blue-400", glow: false, probability: 0.25 },
    SR: { name: "SR", color: "bg-purple-500", textColor: "text-purple-400", glow: false, probability: 0.12 },
    SSR: { name: "SSR", color: "bg-amber-500", textColor: "text-amber-400", glow: true, probability: 0.03 },
};

// 卡牌範本（之後可從後端取得）
const CARD_TEMPLATES = {
    N: [
        { name: "小額現金", description: "獲得 $500", reward: 500 },
        { name: "零錢袋", description: "獲得 $300", reward: 300 },
        { name: "硬幣堆", description: "獲得 $200", reward: 200 },
    ],
    R: [
        { name: "現金獎勵", description: "獲得 $2,000", reward: 2000 },
        { name: "投資基金", description: "獲得 $1,500", reward: 1500 },
    ],
    SR: [
        { name: "金庫密碼", description: "獲得 $10,000", reward: 10000 },
        { name: "股票紅利", description: "獲得 $8,000", reward: 8000 },
    ],
    SSR: [
        { name: "💎 鑽石寶箱", description: "獲得 $50,000", reward: 50000 },
        { name: "🏆 傳說獎金", description: "獲得 $100,000", reward: 100000 },
    ],
};

// 根據機率抽取稀有度
const drawRarity = () => {
    const rand = Math.random();
    let cumulative = 0;
    for (const [rarity, config] of Object.entries(RARITY_CONFIG)) {
        cumulative += config.probability;
        if (rand < cumulative) return rarity;
    }
    return "N";
};

// 抽取卡牌
const drawCard = () => {
    const rarity = drawRarity();
    const templates = CARD_TEMPLATES[rarity];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return {
        id: Date.now() + Math.random(),
        rarity,
        ...template,
        config: RARITY_CONFIG[rarity],
    };
};

// ==================== 卡牌元件 ====================
const GachaCard = ({ card, isRevealed, onClick, index = 0 }) => {
    const { config, name, description, rarity } = card;
    
    return (
        <div
            className="relative w-32 h-44 md:w-40 md:h-56 cursor-pointer perspective-1000"
            onClick={onClick}
            style={{ 
                animationDelay: `${index * 0.1}s`,
            }}
        >
            <div
                className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
                    isRevealed ? "rotate-y-180" : ""
                }`}
            >
                {/* 卡背 */}
                <div
                    className={`absolute inset-0 backface-hidden rounded-xl border-2 ${
                        config.glow ? "border-amber-400 shadow-lg shadow-amber-500/50 animate-pulse" : "border-zinc-600"
                    } bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center`}
                >
                    {/* 公事包圖案 */}
                    <div className="relative">
                        <svg viewBox="0 0 100 100" className="w-20 h-20 md:w-24 md:h-24">
                            {/* 公事包主體 */}
                            <rect x="15" y="35" width="70" height="45" rx="6" fill="#3f3f46" />
                            <rect x="20" y="28" width="60" height="12" rx="3" fill="#52525b" />
                            
                            {/* 金屬扣環 */}
                            <rect x="40" y="50" width="20" height="12" rx="3" fill="#a1a1aa" />
                            <rect x="45" y="53" width="10" height="6" rx="2" fill="#71717a" />
                            
                            {/* 把手 */}
                            <rect x="38" y="20" width="24" height="12" rx="4" fill="#52525b" />
                            <rect x="42" y="24" width="16" height="4" rx="2" fill="#3f3f46" />
                        </svg>
                        
                        {/* SSR 發光特效 */}
                        {config.glow && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="absolute w-16 h-16 bg-amber-400/30 rounded-full animate-ping" />
                                <Sparkles className="w-8 h-8 text-amber-400 animate-bounce" />
                            </div>
                        )}
                    </div>
                    
                    {/* 點擊提示 */}
                    <div className="absolute bottom-3 text-xs text-zinc-500 animate-pulse">
                        點擊翻開
                    </div>
                </div>
                
                {/* 卡面 */}
                <div
                    className={`absolute inset-0 backface-hidden rotate-y-180 rounded-xl border-2 ${
                        config.glow ? "border-amber-400 shadow-lg shadow-amber-500/50" : `border-zinc-600`
                    } bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center p-3`}
                >
                    {/* 稀有度徽章 */}
                    <Badge className={`${config.color} text-white text-xs mb-2`}>
                        {rarity}
                    </Badge>
                    
                    {/* 卡牌名稱 */}
                    <div className={`text-center font-bold ${config.textColor} text-sm md:text-base mb-2`}>
                        {name}
                    </div>
                    
                    {/* 獎勵圖示 */}
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-700/50 rounded-full flex items-center justify-center mb-2">
                        <Coins className={`w-6 h-6 md:w-8 md:h-8 ${config.textColor}`} />
                    </div>
                    
                    {/* 描述 */}
                    <div className="text-xs text-zinc-400 text-center">
                        {description}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==================== 主頁面 ====================
export default function CardStorePage() {
    const { user, refreshUser } = useAuth();
    const [cards, setCards] = useState([]);
    const [revealedCards, setRevealedCards] = useState(new Set());
    const [isPulling, setIsPulling] = useState(false);
    const [showResults, setShowResults] = useState(false);
    
    // 抽卡邏輯
    const handlePull = async (count) => {
        const price = count === 1 ? GACHA_PRICE_SINGLE : GACHA_PRICE_TEN;
        
        if (user.balance < price) {
            toast.error(`餘額不足！需要 ${formatMoney(price)}`);
            sounds.playError();
            return;
        }
        
        setIsPulling(true);
        setShowResults(false);
        setCards([]);
        setRevealedCards(new Set());
        
        // 模擬抽卡延遲
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 抽取卡牌
        const newCards = [];
        for (let i = 0; i < count; i++) {
            newCards.push(drawCard());
        }
        
        // 檢查是否有 SSR
        const hasSSR = newCards.some(c => c.rarity === "SSR");
        if (hasSSR) {
            sounds.playWin?.();
        } else {
            sounds.playBuy?.();
        }
        
        setCards(newCards);
        setShowResults(true);
        setIsPulling(false);
        
        // TODO: 呼叫後端 API 扣款並記錄
        // await axios.post(`${API_URL}/gacha/pull`, { count });
        // refreshUser();
    };
    
    // 翻開單張卡牌
    const handleReveal = (cardId) => {
        setRevealedCards(prev => new Set([...prev, cardId]));
    };
    
    // 一鍵翻開所有卡牌
    const handleRevealAll = () => {
        const allIds = new Set(cards.map(c => c.id));
        setRevealedCards(allIds);
    };
    
    // 計算總獎勵
    const totalReward = cards.reduce((sum, card) => {
        return revealedCards.has(card.id) ? sum + card.reward : sum;
    }, 0);
    
    // 所有卡牌都翻開了嗎
    const allRevealed = cards.length > 0 && revealedCards.size === cards.length;
    
    return (
        <div className="container mx-auto p-4 max-w-screen-xl">
            {/* 標題區 */}
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                    ✨ 卡牌商店 ✨
                </h1>
                <p className="text-zinc-400">試試你的運氣！抽取珍貴卡牌獲得豐厚獎勵</p>
            </div>
            
            {/* 餘額與抽卡按鈕 */}
            <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* 餘額顯示 */}
                        <div className="flex items-center gap-3">
                            <Coins className="w-8 h-8 text-amber-400" />
                            <div>
                                <div className="text-sm text-zinc-400">當前餘額</div>
                                <div className="text-2xl font-bold text-amber-400">
                                    {formatMoney(user?.balance || 0)}
                                </div>
                            </div>
                        </div>
                        
                        {/* 抽卡按鈕 */}
                        <div className="flex gap-3">
                            <Button
                                onClick={() => handlePull(1)}
                                disabled={isPulling || (user?.balance || 0) < GACHA_PRICE_SINGLE}
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-6 py-6 text-lg"
                            >
                                <Gift className="w-5 h-5 mr-2" />
                                單抽 {formatMoney(GACHA_PRICE_SINGLE)}
                            </Button>
                            <Button
                                onClick={() => handlePull(10)}
                                disabled={isPulling || (user?.balance || 0) < GACHA_PRICE_TEN}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-6 text-lg relative"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                十連抽 {formatMoney(GACHA_PRICE_TEN)}
                                <Badge className="absolute -top-2 -right-2 bg-amber-500 text-xs">
                                    9折
                                </Badge>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* 機率說明 */}
            <div className="flex justify-center gap-4 mb-6 text-xs">
                {Object.entries(RARITY_CONFIG).map(([rarity, config]) => (
                    <div key={rarity} className="flex items-center gap-1">
                        <Badge className={`${config.color} text-white text-xs`}>{rarity}</Badge>
                        <span className="text-zinc-500">{(config.probability * 100).toFixed(0)}%</span>
                    </div>
                ))}
            </div>
            
            {/* 抽卡動畫區 */}
            {isPulling && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-purple-400" />
                    </div>
                    <p className="mt-4 text-zinc-400 animate-pulse">正在抽取卡牌...</p>
                </div>
            )}
            
            {/* 抽卡結果 */}
            {showResults && cards.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>抽卡結果</span>
                            {!allRevealed && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRevealAll}
                                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                >
                                    <Sparkles className="w-4 h-4 mr-1" />
                                    一鍵翻開
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* 卡牌展示區 */}
                        <div className="flex flex-wrap justify-center gap-4 mb-6">
                            {cards.map((card, index) => (
                                <GachaCard
                                    key={card.id}
                                    card={card}
                                    index={index}
                                    isRevealed={revealedCards.has(card.id)}
                                    onClick={() => handleReveal(card.id)}
                                />
                            ))}
                        </div>
                        
                        {/* 總獎勵顯示 */}
                        {allRevealed && (
                            <div className="text-center py-4 border-t border-zinc-800">
                                <div className="text-zinc-400 mb-2">恭喜獲得總獎勵</div>
                                <div className="text-3xl font-bold text-amber-400 animate-pulse">
                                    +{formatMoney(totalReward)}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
            
            {/* 空狀態 */}
            {!isPulling && !showResults && (
                <div className="text-center py-20 text-zinc-500">
                    <Gift className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>點擊上方按鈕開始抽卡</p>
                    <p className="text-sm mt-2">SSR 卡牌的卡背會發出金色光芒！</p>
                </div>
            )}
        </div>
    );
}
