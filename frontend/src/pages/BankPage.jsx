import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '../components/ui/components';
import { Building2, Gavel, HandCoins, Skull, Briefcase, Lock, UserPlus, AlertTriangle, TrendingUp } from 'lucide-react';

export default function BankPage() {
    const { user, API_URL, refreshUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("borrow"); // borrow, repay, bail
    const [workHours, setWorkHours] = useState(2);
    const [repayAmount, setRepayAmount] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null); // 'NORMAL', 'BUDDHA', 'BLACK'

    const JOB_TYPES = {
        'NORMAL': { label: '一般打工', emoji: '😐', desc: '穩定的收入，無風險。', risk: '低', multiplier: '1.0x - 1.5x' },
        'BUDDHA': { label: '佛系打工', emoji: '🧘', desc: '輕鬆自在，偶爾會有意外之財。', risk: '中', multiplier: '0.8x - 2.0x' },
        'BLACK': { label: '黑心打工', emoji: '💀', desc: '高風險高報酬，賺翻或做白工。', risk: '極高', multiplier: '0.1x - 10.0x' }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/bank/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            console.error("Failed to fetch bank status", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (endpoint, body = {}) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "操作失敗");
            } else {
                toast.success(data.message);
                fetchStatus();
                refreshUser();
            }
        } catch (error) {
            toast.error("網路錯誤");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">正在載入銀行系統...</div>;
    if (!status) return <div className="p-8 text-center text-red-500">銀行系統離線</div>;

    const { rates, loans, total_debt, is_frozen, frozen_reason, labor, jail_roster, karma } = status;

    return (
        <div className="container mx-auto p-4 space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/20 rounded-full">
                        <Building2 className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">中央銀行</h1>
                        <p className="text-muted-foreground">貸款、清算與贖回</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-muted-foreground">目前首富資產基準</div>
                    <div className="text-xl font-mono text-primary">${rates.top_wealth?.toLocaleString()}</div>
                    {karma > 0 && (
                         <div className="flex items-center justify-end gap-1 text-yellow-500 mt-1">
                             <div className="animate-pulse">😇</div>
                             <span className="font-bold">功德等級 {karma}</span>
                             <span className="text-xs text-muted-foreground">(${Math.floor(karma * rates.passive_income_rate)}/hr)</span>
                         </div>
                    )}
                </div>
            </div>

            {/* Frozen / Active Status */}
            {is_frozen && (
                <Card className="border-red-500 bg-red-500/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-500">
                            <Lock className="w-6 h-6" />
                            帳戶已凍結
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold mb-2">原因: {frozen_reason}</p>
                        <p className="mb-4">您的交易權限已被暫停。必須還清債務才能恢自由。</p>
                        
                        {labor ? (
                            <div className="bg-background p-4 rounded-lg border border-primary/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold flex items-center gap-2">
                                        {labor.type === "JAIL" ? <GridIcon /> : <Briefcase />}
                                        目前狀態: {labor.type === "JAIL" ? "服刑中" : "打工中"}
                                    </span>
                                    <Badge variant="outline" className="animate-pulse">進行中</Badge>
                                </div>
                                <p>結束時間: {new Date(labor.end_time).toLocaleTimeString()}</p>
                                <p className="text-sm text-muted-foreground mt-2">請等待任務完成。</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Step 1: Liquidation */}
                                <div className="p-4 border rounded-lg bg-background">
                                    <h3 className="font-bold mb-2 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> 選項 1: 清算資產
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-3">變賣所有股票以立即償還債務。</p>
                                    <Button 
                                        variant="destructive" 
                                        className="w-full"
                                        onClick={() => {
                                            toast("警告：這將會賣出您所有的股票。", {
                                                description: "確定要執行清算嗎？",
                                                action: {
                                                    label: "確定清算",
                                                    onClick: () => handleAction('/bank/liquidate')
                                                },
                                                cancel: {
                                                    label: "取消",
                                                }
                                            })
                                        }}
                                        disabled={actionLoading}
                                    >
                                        清算並還債
                                    </Button>
                                </div>

                                {/* Step 2: Work/Jail */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <Card>
                                         <CardHeader><CardTitle className="text-base">選項 2: 打工還債</CardTitle></CardHeader>
                                         <CardContent className="space-y-3">
                                             {!selectedJob ? (
                                                 <div className="space-y-2">
                                                     <label className="text-sm text-muted-foreground">請選擇工作場所:</label>
                                                     <div className="grid grid-cols-1 gap-2">
                                                         {Object.entries(JOB_TYPES).map(([type, info]) => (
                                                             <Button 
                                                                key={type} 
                                                                variant="outline" 
                                                                className="h-auto py-3 px-4 justify-start"
                                                                onClick={() => setSelectedJob(type)}
                                                             >
                                                                 <span className="text-2xl mr-3">{info.emoji}</span>
                                                                 <div className="text-left">
                                                                     <div className="font-bold">{info.label}</div>
                                                                     <div className="text-xs text-muted-foreground">{info.desc}</div>
                                                                 </div>
                                                             </Button>
                                                         ))}
                                                     </div>
                                                 </div>
                                             ) : (
                                                 <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                                     <div className="flex items-center justify-between border-b pb-2">
                                                         <div className="flex items-center gap-2">
                                                             <span className="text-2xl">{JOB_TYPES[selectedJob].emoji}</span>
                                                             <div>
                                                                 <div className="font-bold">{JOB_TYPES[selectedJob].label}</div>
                                                                 <Badge variant="secondary" className="text-xs">
                                                                     風險: {JOB_TYPES[selectedJob].risk}
                                                                 </Badge>
                                                             </div>
                                                         </div>
                                                         <Button variant="ghost" size="sm" onClick={() => setSelectedJob(null)}>重選</Button>
                                                     </div>
                                                     
                                                     <div className="space-y-2">
                                                         <div className="flex justify-between text-sm">
                                                             <span>工作時數:</span>
                                                             <span className="font-bold">{workHours} 小時</span>
                                                         </div>
                                                         <input 
                                                            type="range" min="2" max="12" step="1" 
                                                            value={workHours} 
                                                            onChange={(e) => setWorkHours(parseInt(e.target.value))}
                                                            className="w-full cursor-pointer accent-primary"
                                                         />
                                                         <div className="flex justify-between text-xs text-muted-foreground">
                                                             <span>2h</span>
                                                             <span>12h</span>
                                                         </div>
                                                     </div>

                                                     <div className="bg-muted/30 p-3 rounded text-xs space-y-1">
                                                         <div className="flex justify-between">
                                                             <span>基本時薪:</span>
                                                             <span>${Math.floor(rates.base_wage).toLocaleString()}/hr</span>
                                                         </div>
                                                         <div className="flex justify-between">
                                                             <span>預估倍率:</span>
                                                             <span>{JOB_TYPES[selectedJob].multiplier}</span>
                                                         </div>
                                                         <div className="border-t my-1 pt-1 text-muted-foreground">
                                                             注意：工作結束後，系統會自動結算收入並<span className="text-primary font-bold">直接償還債務</span>。
                                                             若債務還清，帳戶將自動解凍。
                                                         </div>
                                                     </div>

                                                     <Button 
                                                        className="w-full"
                                                        onClick={() => handleAction('/bank/work', { type: selectedJob, hours: workHours })}
                                                        disabled={actionLoading}
                                                     >
                                                         開始工作 ({workHours}hr)
                                                     </Button>
                                                 </div>
                                             )}
                                         </CardContent>
                                     </Card>

                                     <Card>
                                         <CardHeader><CardTitle className="text-base">選項 3: 入獄服刑</CardTitle></CardHeader>
                                         <CardContent className="space-y-3">
                                             <p className="text-sm">服刑以抵銷所有債務。</p>
                                             <div className="flex items-center justify-center p-4">
                                                 <GridIcon className="w-12 h-12 text-muted-foreground opacity-50" />
                                             </div>
                                             <Button 
                                                variant="secondary" 
                                                className="w-full"
                                                onClick={() => handleAction('/bank/jail')}
                                                disabled={actionLoading}
                                             >
                                                 入獄服刑 (抵銷債務)
                                             </Button>
                                         </CardContent>
                                     </Card>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Main Bank Interface (If not frozen or viewing generally) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: Debt & Stats */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>我的債務</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-red-500 mb-2">
                                ${total_debt.toLocaleString()}
                            </div>
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                                <span>借貸筆數:</span>
                                <span>{loans.length}</span>
                            </div>

                            {/* Active Loans List */}
                            {loans.length > 0 && (
                                <div className="mb-6 space-y-3">
                                    <h4 className="text-sm font-bold border-b pb-1">未結清貸款明細</h4>
                                    <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {loans.map((loan, idx) => (
                                            <div key={idx} className="text-xs p-2 bg-muted/30 rounded border flex flex-col gap-1">
                                                <div className="flex justify-between">
                                                    <span>本金: ${loan.principal.toLocaleString()}</span>
                                                    <span className="text-red-400">總計: ${Math.floor(loan.total_due).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground">
                                                    <span>利息: ${Math.floor(loan.surcharge).toLocaleString()}</span>
                                                    <span>期限: {new Date(loan.due_date).toLocaleTimeString()}</span>
                                                </div>
                                                {new Date(loan.due_date) < new Date() && (
                                                    <div className="text-red-500 font-bold text-center mt-1">已過期 (違約)</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {loans.length > 0 && !is_frozen && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">還款操作</label>
                                    <Input 
                                        type="number" placeholder="輸入還款金額" 
                                        value={repayAmount} onChange={e => setRepayAmount(e.target.value)}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button 
                                            variant="outline"
                                            onClick={() => handleAction('/bank/repay', { amount: parseFloat(repayAmount) })}
                                            disabled={!repayAmount || actionLoading}
                                        >
                                            部分還款
                                        </Button>
                                        <Button 
                                            variant="default"
                                            onClick={() => handleAction('/bank/repay')}
                                            disabled={actionLoading}
                                        >
                                            全部還清
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HandCoins className="w-5 h-5 text-yellow-500" /> 贖罪中心
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {jail_roster.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-4">目前沒有罪人在獄中。</div>
                                ) : (
                                    jail_roster.map(inmate => (
                                        <div key={inmate.user_id} className="flex flex-col gap-2 p-3 border rounded bg-muted/30">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold">{inmate.username}</span>
                                                <Badge variant="outline">負債 ${inmate.debt.toLocaleString()}</Badge>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">保釋金:</span>
                                                <span className="font-mono text-red-400">${inmate.bail_cost.toLocaleString()}</span>
                                            </div>
                                            {inmate.user_id !== user.id && (
                                                <Button 
                                                    size="sm" 
                                                    className="w-full mt-1"
                                                    onClick={() => handleAction('/bank/bail', { target_user_id: inmate.user_id })}
                                                    disabled={actionLoading || user.balance < inmate.bail_cost}
                                                >
                                                    😇 保釋 (積功德)
                                                </Button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: Loan Offers */}
                {!is_frozen && (
                    <div className="lg:col-span-2">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>貸款方案</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* MICRO */}
                                    <LoanCard 
                                        title="小額貸款" 
                                        limit={rates.loan_limit_micro} 
                                        rate={0.05} 
                                        desc="快速周轉的小額資金。"
                                        onBorrow={() => handleAction('/bank/borrow', { amount: rates.loan_limit_micro })}
                                        loading={actionLoading}
                                    />
                                    {/* STANDARD */}
                                    <LoanCard 
                                        title="標準貸款" 
                                        limit={rates.loan_limit_standard} 
                                        rate={0.10} 
                                        desc="適合成長的標準槓桿。"
                                        onBorrow={() => handleAction('/bank/borrow', { amount: rates.loan_limit_standard })}
                                        loading={actionLoading}
                                        featured
                                    />
                                    {/* JUMBO */}
                                    <LoanCard 
                                        title="鉅額貸款" 
                                        limit={rates.loan_limit_jumbo} 
                                        rate={0.20} 
                                        desc="高風險、高槓桿的選擇。"
                                        onBorrow={() => handleAction('/bank/borrow', { amount: rates.loan_limit_jumbo })}
                                        loading={actionLoading}
                                    />
                                </div>
                                <div className="mt-8 p-4 bg-muted/20 rounded border">
                                    <h4 className="font-bold mb-2">條款與細則</h4>
                                    <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                                        <li>所標示為<span className="text-primary font-bold">日利率</span>，系統每 2 小時計算並累計一次利息（日利率 ÷ 12）。</li>
                                        <li>必須在 24 小時內還清本金加利息。</li>
                                        <li>違約將立即<span className="text-red-500 font-bold">凍結</span>您的交易帳戶。</li>
                                        <li>只有當您無力償還（違約凍結）時，才能選擇清算、打工或坐牢抵債。</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

function LoanCard({ title, limit, rate, desc, onBorrow, loading, featured }) {
    return (
        <div className={`p-4 border rounded-xl flex flex-col justify-between h-full ${featured ? 'border-primary bg-primary/5 shadow-lg scale-105' : 'bg-card'}`}>
            <div>
                <h3 className="font-bold text-lg mb-1">{title}</h3>
                <div className="text-2xl font-mono mb-2">${Math.floor(limit).toLocaleString()}</div>
                <Badge variant={featured ? "default" : "secondary"} className="mb-4">{(rate * 100).toFixed(0)}% 日利率</Badge>
                <p className="text-sm text-muted-foreground mb-4">{desc}</p>
            </div>
            <Button 
                onClick={onBorrow} 
                disabled={loading}
                variant={featured ? "default" : "outline"}
                className="w-full"
            >
                借款
            </Button>
        </div>
    );
}

function GridIcon({ className }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 3v18" /><path d="M11 3v18" /><path d="M17 3v18" /><path d="M3 7h18" /><path d="M3 11h18" /><path d="M3 17h18" />
        </svg>
    )
}
