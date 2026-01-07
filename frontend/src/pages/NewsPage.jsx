import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button } from "../components/ui/components";
import { useAuth } from "../context/AuthContext";
import axios from 'axios';
import { Newspaper, TrendingUp, TrendingDown, Clock, Zap } from 'lucide-react';

export default function NewsPage() {
    const navigate = useNavigate();
    const { API_URL } = useAuth();
    const [news, setNews] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [newsRes, predsRes] = await Promise.all([
                axios.get(`${API_URL}/news?limit=50`),
                axios.get(`${API_URL}/predictions`)
            ]);
            setNews(newsRes.data);
            setPredictions(predsRes.data);
        } catch (error) {
            console.error("Failed to fetch news", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, [API_URL]);

    return (
        <div className="container mx-auto p-4 max-w-screen-xl">
            <h1 className="text-3xl font-bold mb-6 flex items-center">
                <Newspaper className="mr-3 h-8 w-8 text-blue-500" />
                新聞中心
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Live News (2/3 width) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold flex items-center">
                            <Zap className="mr-2 h-5 w-5 text-yellow-500" />
                            市場快訊 (Live Wire)
                        </h2>
                        <span className="text-xs text-muted-foreground animate-pulse">● 即時更新中</span>
                    </div>

                    <div className="space-y-3">
                        {news.map((item) => (
                            <Card key={item.id} className="hover:bg-accent/50 transition-colors border-l-4 border-l-transparent hover:border-l-blue-500">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-1">
                                        <Badge 
                                            variant={Math.abs(item.impact_multiplier) < 0.03 ? "secondary" : item.impact_multiplier > 0 ? "default" : "destructive"} 
                                            className="mb-1"
                                        >
                                            {Math.abs(item.impact_multiplier) < 0.03 ? "八卦" : item.impact_multiplier > 0 ? "利多" : "利空"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                                    <p className="text-muted-foreground text-sm">{item.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                        {news.length === 0 && <p className="text-center text-muted-foreground py-10">尚無新聞資料...</p>}
                    </div>
                </div>

                {/* Right Column: Guru Predictions (1/3 width) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold flex items-center">
                            <Clock className="mr-2 h-5 w-5 text-purple-500" />
                            名嘴預言 (Guru)
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {predictions.map((pred) => (
                            <Card key={pred.id} className="border-2 border-purple-500/20 bg-purple-500/5 overflow-hidden relative transition-all hover:bg-purple-500/10">
                                <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs px-2 py-1 rounded-bl shadow-neon">
                                    ACTIVE
                                </div>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-lg shadow-inner">
                                                🧙‍♂️
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">{pred.guru_name}</CardTitle>
                                                <CardDescription className="text-xs">
                                                    {pred.guru_stats ? `勝率 ${pred.guru_stats.win_rate}% (${pred.guru_stats.wins}/${pred.guru_stats.total})` : "新晉名嘴"}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-2 space-y-3">
                                    {/* Stock & Target Row - Clickable */}
                                    <div 
                                        className="flex items-center justify-between bg-slate-800/60 p-3 rounded-lg border border-purple-500/20 cursor-pointer hover:bg-slate-700/60 transition-colors group"
                                        onClick={() => navigate(`/stocks/${pred.stock_id}`)}
                                    >
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-200 flex items-center gap-2 group-hover:text-purple-300 transition-colors">
                                                {pred.stock_name} <span className="text-sm text-slate-400 font-normal">({pred.stock_symbol})</span>
                                            </h3>
                                            <div className="text-xs text-slate-400 mt-1">
                                                Start: <span className="font-mono text-slate-300">${pred.start_price}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Target</div>
                                            <div className="text-2xl font-bold font-mono text-purple-300 drop-shadow-md">
                                                ${pred.target_price}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Badge */}
                                    <div className="flex items-center justify-between">
                                        {pred.prediction_type === "BULL" ? (
                                            <Badge className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/30 w-full justify-center h-8 text-sm gap-2">
                                                <TrendingUp className="h-4 w-4" /> 看多 BULL
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-red-600/20 text-red-400 border-red-600/50 hover:bg-red-600/30 w-full justify-center h-8 text-sm gap-2">
                                                <TrendingDown className="h-4 w-4" /> 看空 BEAR
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="text-sm italic text-slate-300 border-l-2 border-purple-500/30 pl-3 py-1">
                                        "{pred.description}"
                                    </p>
                                    
                                    {/* Footer Action */}
                                    <div className="flex items-center justify-between pt-2 border-t border-purple-500/10">
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            Expires: {new Date(pred.deadline).toLocaleTimeString()}
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="bg-purple-600 hover:bg-purple-500 text-white shadow-neon h-8 px-4 font-bold"
                                            onClick={() => navigate(`/stocks/${pred.stock_id}`)}
                                        >
                                            💰 跟單 Go!
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                         {predictions.length === 0 && (
                            <Card className="border-dashed">
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    目前沒有專家敢預測...
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
