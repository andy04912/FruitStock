import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { sounds } from "../../utils/sound";
import { Card, CardContent, CardHeader, CardTitle, Button } from "../ui/components";

export default function BonusWidget({ apiUrl, onClaim }) {
    const [loading, setLoading] = useState(false);
    
    const claim = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${apiUrl}/bonus/claim`);
            
            if (res.data.status === 'claimed') {
                toast.info("今日已領取過囉！明天再來吧 🌙");
            } else {
                if (onClaim) onClaim(res.data.amount);
                toast.success(`領取成功！獲得 $${res.data.amount}`);
                sounds.playBuy(); 
            }
            // window.location.reload(); // Handled by parent or context refresh
        } catch (e) {
            toast.error(e.response?.data?.detail || "領取失敗");
            sounds.playError();
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Card className="bg-card/40 backdrop-blur border border-accent/20">
            <CardHeader className="pb-2 border-b border-accent/10">
                <CardTitle className="text-sm font-medium text-accent tracking-wider uppercase">🎁 每日補給</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-3 font-mono">可用額度: $500.00</div>
                <Button 
                    size="sm" 
                    className="w-full bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/50 hover:shadow-[0_0_15px_rgba(217,70,239,0.5)] transition-all font-mono tracking-widest" 
                    onClick={claim} 
                    disabled={loading}
                >
                    {loading ? "處理中..." : "領取資金"}
                </Button>
            </CardContent>
        </Card>
    );
}
