import random
from datetime import datetime, timedelta
from sqlmodel import Session, select
from models import Stock, EventLog
import ai_service

# --- Event Templates by Tier ---

# Tier 0: Rumor (15%) - Impact: ±5% ~ 15% (Fake News)
TIER_0_RUMOR = [
    {"title": "市場傳聞", "desc": "網路上流傳關於 {name} 的奇怪謠言，未經證實。"},
    {"title": "路邊社消息", "desc": "據傳 {name} 即將跨足外星科技產業？"},
    {"title": "神祕買盤", "desc": "神祕資金進駐 {name}？可能只是散戶手滑。"},
]

# Tier 1: Normal (60%) - Impact: ±3% ~ 10%
TIER_1_NORMAL = [
    {"title": "豐收", "desc": "{name} 今年產量大增，供應充足。"},
    {"title": "需求平穩", "desc": "{name} 市場需求維持穩定成長。"},
    {"title": "季節性調整", "desc": "{name} 進入傳統淡季，需求微幅下修。"},
    {"title": "分析師報告", "desc": "分析師給予 {name} 「持有」評級。"},
    {"title": "新產品發布", "desc": "{name} 發布改款產品，市場反應溫和。"},
    {"title": "供應鏈受阻", "desc": "{name} 部分零件缺貨，出貨延遲。"},
    {"title": "消費疲軟", "desc": "受通膨影響，{name} 終端買氣轉弱。"},
]

# Tier 2: Significant (23.9%) - Impact: ±10% ~ 25%
TIER_2_SIGNIFICANT = [
    {"title": "營收超預期", "desc": "{name} 季度營收優於預期，投資人信心大增！"},
    {"title": "原料大漲", "desc": "{name} 主要原料價格飆升，獲利受壓。"},
    {"title": "同業競爭", "desc": "競爭對手發動價格戰，{name} 市佔率下滑。"},
    {"title": "新技術突破", "desc": "{name} 研發取得重要進展，即將量產。"},
    {"title": "政策利多", "desc": "政府宣布補助 {name} 相關產業。"},
    {"title": "大股東拋售", "desc": "{name} 傳出大股東大量申報轉讓持股。"},
    {"title": "品管瑕疵", "desc": "{name} 產品驚傳瑕疵召回，商譽受損。"},
]

# Tier 3: Shock / Sniper (1%) - Impact: ±25% ~ 50%
TIER_3_SHOCK = [
    {"title": "胖手指", "desc": "交易員操作失誤，{name} 出現異常天量錯單！"},
    {"title": "軋空行情", "desc": "{name} 空單回補，股價報復性反彈！"},
    {"title": "機構倒貨", "desc": "避險基金大舉拋售 {name}，引發恐慌性賣壓。"},
    {"title": "系統異常", "desc": "交易所撮合系統短暫異常，{name} 價格劇烈震盪。"},
]

# Tier 4: Black Swan (0.1%) - Impact: ±80% ~ 100% (Can go up to 200% with boost)
TIER_4_BLACK_SWAN = [
    {"title": "惡性倒閉", "desc": "{name} 爆發嚴重財務危機，面臨下市風險！"},
    {"title": "被收購", "desc": "科技巨頭宣布溢價收購 {name}，股價直線噴出！"},
    {"title": "造光", "desc": "{name} 核心技術造假，市值瞬間蒸發。"},
    {"title": "發現新礦脈", "desc": "{name} 掌握關鍵戰略資源，未來獲利爆發。"},
]

class EventSystem:
    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.window_start = None
        self.scheduled_times = [] # List of datetimes
        self.WINDOW_MINUTES = 60 
        self.current_event = None
        self.event_end_time = None

    def _start_new_window(self, now):
        self.window_start = now
        window_end = now + timedelta(minutes=self.WINDOW_MINUTES)
        
        # Decide how many events (Reduced for API Limits)
        # Avg ~4.5 events per hour -> 1 event every ~13 mins
        num_events = random.randint(3, 6)
        
        self.scheduled_times = []
        for _ in range(num_events):
            # Random second within the window
            offset = random.randint(5, (self.WINDOW_MINUTES * 60) - 5)
            trigger_time = now + timedelta(seconds=offset)
            self.scheduled_times.append(trigger_time.replace(microsecond=0))
        
        self.scheduled_times.sort()
        print(f"[EventSystem] New Window Started: {now} to {window_end}. Scheduled {num_events} events at: {[t.strftime('%H:%M:%S') for t in self.scheduled_times]}")

    def get_active_event(self):
        # Check if current event is expired
        if self.current_event and self.event_end_time:
            if datetime.now() > self.event_end_time:
                self.current_event = None
                self.event_end_time = None
        return self.current_event

    def generate_random_event(self):
        now = datetime.now().replace(microsecond=0)
        
        # Initialize or rotate window
        if self.window_start is None or now >= self.window_start + timedelta(minutes=self.WINDOW_MINUTES):
            self._start_new_window(now)
            
        # Check if any scheduled event is due (or past due within reasonable margin)
        # We pop from list to execute once
        if self.scheduled_times and now >= self.scheduled_times[0]:
            # Trigger event!
            trigger_time = self.scheduled_times.pop(0)
            
            with self.session_factory() as session:
                stocks = session.exec(select(Stock)).all()
                if not stocks: return None
                
                target = random.choice(stocks)
                
                # --- 1. Tier Selection (Weighted + Rumor) ---
                # Adjusted for Realism: Surges (Tier 2+) should be rare.
                tier_choice = random.choices(
                    ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'],
                    weights=[0.15, 0.82, 0.025, 0.0049, 0.0001], # 82% Normal, 2.5% Significant
                    k=1
                )[0]
                
                # --- 2. Template & Base Impact ---
                tier_k = 'NORMAL' # For AI
                tier_display = 'NORMAL' # For Log
                
                if tier_choice == 'TIER_0':
                    template = random.choice(TIER_0_RUMOR)
                    impact = random.uniform(0.05, 0.15) # Chaotic impact
                    tier_k = 'RUMOR'
                    tier_display = 'RUMOR 🤫'
                elif tier_choice == 'TIER_1':
                    template = random.choice(TIER_1_NORMAL)
                    impact = random.uniform(0.03, 0.10)
                    tier_k = 'NORMAL'
                elif tier_choice == 'TIER_2':
                    template = random.choice(TIER_2_SIGNIFICANT)
                    impact = random.uniform(0.10, 0.25)
                    tier_k = 'SIGNIFICANT'
                    tier_display = 'SIGNIFICANT'
                elif tier_choice == 'TIER_3':
                    template = random.choice(TIER_3_SHOCK)
                    impact = random.uniform(0.25, 0.50)
                    tier_k = 'SHOCK'
                    tier_display = 'SHOCK ⚡'
                else: # TIER_4
                    template = random.choice(TIER_4_BLACK_SWAN)
                    impact = random.uniform(0.80, 1.00)
                    tier_k = 'BLACK_SWAN'
                    tier_display = 'BLACK SWAN 💀'
                
                # --- 3. Critical Boost ---
                is_critical = False
                # Rumors cannot critically boost
                if tier_choice != 'TIER_0' and random.random() < 0.05:
                    boost_factor = random.uniform(1.5, 2.5)
                    impact *= boost_factor
                    is_critical = True
                
                # --- 4. Direction ---
                if random.random() < 0.5:
                    impact = -impact
                
                direction_str = 'UP' if impact > 0 else 'DOWN'

                # --- 5. Content Generation (AI vs Fallback) ---
                title = template["title"]
                description = template["desc"].format(name=target.name)
                
                # Try AI first
                try:
                    ai_data = None
                    if tier_choice == 'TIER_0':
                        ai_data = ai_service.generate_fake_news(target.name)
                    else:
                        ai_data = ai_service.generate_market_event(target.name, tier_k, direction_str)
                    
                    if ai_data:
                        title = ai_data['title']
                        description = ai_data['desc']
                except Exception as e:
                    print(f"AI Event gen failed, using fallback: {e}")

                if is_critical:
                    description += " (市場反應極度劇烈！)"
                if tier_choice == 'TIER_0':
                    title = f"[八卦] {title}"
                
                duration = random.randint(30, 90)
                
                event = EventLog(
                    title=title,
                    description=description,
                    target_stock_id=target.id,
                    impact_multiplier=impact,
                    duration_seconds=duration
                )
                session.add(event)
                session.commit()
                
                # Log
                crit_tag = "CRITICAL HIT! 🔥" if is_critical else ""
                print(f"[EventSystem] [{tier_display}] {crit_tag} Impact: {impact*100:.1f}% | {event.title} - {target.name}")
                
                # Set active event
                self.current_event = event
                self.event_end_time = now + timedelta(seconds=duration)
                
                return event
        
        return self.get_active_event()
