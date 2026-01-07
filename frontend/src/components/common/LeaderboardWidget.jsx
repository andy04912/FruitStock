import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components";

export default function LeaderboardWidget({ apiUrl }) {
    const [leaders, setLeaders] = useState([]);
    
    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                const res = await axios.get(`${apiUrl}/leaderboard`);
                setLeaders(res.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchLeaders();
        const interval = setInterval(fetchLeaders, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [apiUrl]);

    return (
        <Card className="bg-card/95 backdrop-blur border border-primary/20 h-full">
            <CardHeader className="pb-2 border-b border-primary/10">
                <CardTitle className="text-sm font-medium text-primary tracking-wider uppercase">🏆 富豪排行榜</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                    {leaders.map((l, i) => (
                        <div key={i} className="flex justify-between text-sm items-center">
                            <span className={`font-mono ${i===0 ? "text-yellow-400 font-bold" : "text-muted-foreground"}`}>
                                #{i+1} <span className="text-foreground ml-2">{l.username}</span>
                            </span>
                            <span className="font-mono text-primary/80">${l.net_worth.toFixed(0)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
