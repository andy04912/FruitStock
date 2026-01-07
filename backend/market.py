import random
import math
from datetime import datetime, timedelta
from sqlmodel import Session, select, delete
from models import Stock, EventLog, StockPriceHistory, Portfolio, Prediction, Guru
import ai_service

INITIAL_STOCKS = [
    {"symbol": "AAPL", "name": "Apple", "price": 150.0},
    {"symbol": "BANA", "name": "Banana", "price": 50.0},
    {"symbol": "ORNG", "name": "Orange", "price": 80.0},
    {"symbol": "MANG", "name": "Mango", "price": 200.0},
    {"symbol": "PINE", "name": "Pineapple", "price": 120.0},
    {"symbol": "DURI", "name": "Durian", "price": 500.0},
    {"symbol": "WTML", "name": "Watermelon", "price": 30.0},
    {"symbol": "GRAP", "name": "Grape", "price": 15.0},
]

INITIAL_GURUS = [
    {"name": "華爾街之狼", "bio": "激進的趨勢交易者，喜歡做多高風險股票。"},
    {"name": "水晶球婆婆", "bio": "神秘的占卜師，透過星象預測市場崩盤。"},
    {"name": "區塊鏈信仰者", "bio": "堅信去中心化，對科技股情有獨鍾。"},
    {"name": "穩健老王", "bio": "退休公務員，只看基本面，厭惡投機。"},
    {"name": "AI 量化機器人", "bio": "冷血的演算法，毫無感情的交易機器。"},
]


class MarketEngine:
    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.candles = {} # {stock_id: {open, high, low, close, volume, start_time}}
        self.last_date = datetime.now().date()

    def initialize_market(self):
        with self.session_factory() as session:
            statement = select(Stock)
            results = session.exec(statement).all()
            if not results:
                print("Initializing market with default stocks...")
                for item in INITIAL_STOCKS:
                    stock = Stock(
                        symbol=item["symbol"],
                        name=item["name"],
                        price=item["price"],
                        day_open=item["price"], # Initialize day_open
                        volatility=0.02
                    )
                    session.add(stock)
                session.commit()
            
            # Initialize Gurus
            gurus = session.exec(select(Guru)).all()
            if not gurus:
                print("Initializing Gurus...")
                for g in INITIAL_GURUS:
                    guru = Guru(name=g["name"], bio=g["bio"])
                    session.add(guru)
                session.commit()
            else:
                # Ensure day_open is set for existing stocks (if migrated manually, or handled by reset)
                pass


    
    def get_base_price(self, symbol):
        # Helper to find base price from initial config
        for s in INITIAL_STOCKS:
            if s["symbol"] == symbol:
                return s["price"]
        return 100.0 # Default fallback

    def update_prices(self):
        now = datetime.now()
        current_date = now.date()
        
        # Check for day change
        day_changed = False
        if current_date > self.last_date:
            day_changed = True
            self.last_date = current_date
            print(f"Day changed to {current_date}. Resetting day_open.")

        with self.session_factory() as session:
            stocks = session.exec(select(Stock)).all()
            for stock in stocks:
                if day_changed:
                    stock.day_open = stock.price
                if stock.day_open == 0:
                    stock.day_open = stock.price

                # --- NEW HIGH VOLATILITY LOGIC ---
                
                # 1. Base Volatility (Increased)
                # Normal stocks allow 1-2% daily swing, we want crypto-like moves.
                # Base random walk noise.
                volatility_multiplier = 1.0
                
                # 2. Event Impact
                statement = select(EventLog).where(
                    EventLog.target_stock_id == stock.id,
                    EventLog.created_at >= now - timedelta(seconds=60)
                )
                active_events = session.exec(statement).all()
                total_impact = sum(e.impact_multiplier for e in active_events)
                
                # If there are events, Market is CHAOTIC
                # If there are events, Market is CHAOTIC
                if abs(total_impact) > 0.15:
                    volatility_multiplier = 5.0 # Significant news causes high volatility
                elif abs(total_impact) > 0.05:
                    volatility_multiplier = 2.0 # Normal news adds mild noise
                else:
                    volatility_multiplier = 1.0 # Calm market
                
                # Random Noise (The "Wiggle")
                # Gauss(0, 0.002) -> +/- 0.6% standard deviation per TICK is HUGE.
                # Let's make it standard 0.0005 per tick (0.05%), scaled by multiplier.
                noise = random.gauss(0, 0.0005 * volatility_multiplier)
                
                # 3. Directional Force (The "Trend")
                # 3. Directional Force (The "Trend")
                # Events drive price over time (60s duration approx for full impact)
                # We accelerate the impact.
                trend_force = (total_impact / 45.0) 

                # --- GURU DRIFT (Self-Fulfilling Prophecy) ---
                # Reduced drift to prevent hyper-inflation
                guru_drift = 0.0
                active_preds = session.exec(select(Prediction).where(Prediction.stock_id == stock.id, Prediction.status == "ACTIVE")).all()
                for pred in active_preds:
                    if pred.prediction_type == "BULL":
                        guru_drift += 0.00005 # +0.005% per tick (Reduced 10x)
                    elif pred.prediction_type == "BEAR":
                        guru_drift -= 0.00005 # -0.005% per tick
                
                # 4. Dynamic Physics (Gravity + Momentum + Mania)
                base_price = self.get_base_price(stock.symbol)
                ratio = stock.price / base_price
                gravity_pct = 0.0
                
                # A. OVERVALUED (> 1.5x)
                if ratio > 1.5:
                    # Base Pull: Stronger as it goes higher.
                    # e.g. at 2.0x, pull is -0.1% per tick. At 3.0x, -0.2%.
                    pull_force = -0.001 * (ratio - 1.0)
                    
                    # MANIA MECHANIC: 0.5% chance per tick (FOMO)
                    # Realism: Happens occasionally (once every few mins), not constantly.
                    if random.random() < 0.005:
                        gravity_pct = random.uniform(0.0, 0.005) # +0% to +0.5% 
                    else:
                        # Volatile Correction
                        gravity_pct = random.gauss(pull_force, 0.002)

                # B. UNDERVALUED (< 0.7x)
                elif ratio < 0.7:
                    push_force = 0.001 * (1.0 - ratio) # Value investing pull
                    
                    # OVERSOLD BOUND: 0.5% chance per tick (Fear)
                    if random.random() < 0.005:
                        gravity_pct = random.uniform(-0.005, 0.0) # Panic Sell
                    else:
                         # Volatile Recovery (Dead Cat Bounces included)
                         gravity_pct = random.gauss(push_force, 0.002)
                
                # C. NORMAL RANGE (0.7x - 1.5x)
                else:
                     # Mild Elasticity: Keeps it tethered but loose
                     # If Ratio 1.1 -> -0.00001 (Tiny)
                     gravity_pct = (1.0 - ratio) * 0.0001 
                
                # 5. "Main Force" / "Sniper" Random Spike
                # 0.02% chance per tick -> ~1 in 5000 ticks (Very Rare, once per hourish)
                sniper_move = 0
                if random.random() < 0.0002:
                    sniper_move = random.choice([-0.02, 0.02])
                
                # Aggregate
                pct_change = noise + trend_force + sniper_move + guru_drift + gravity_pct
                
                # Apply Change
                new_price = stock.price * (1 + pct_change)
                stock.price = max(0.01, round(new_price, 2))
                
                # --- BANKRUPTCY CHECK ---
                if stock.price < 0.05:
                    old_name = stock.name
                    print(f"[Market] {old_name} is BANKRUPT (Price: {stock.price})! Initiating liquidation...")
                    
                    # 1. Wipe Equity (Delete all holdings)
                    # Note: We need to import 'delete' and 'Portfolio'
                    session.exec(delete(Portfolio).where(Portfolio.stock_id == stock.id))
                    
                    # 2. AI Rebrand / IPO
                    try:
                        new_info = ai_service.generate_new_company()
                        stock.name = new_info['name']
                        stock.symbol = new_info['symbol']
                        stock.price = round(random.uniform(10, 50), 2)
                        stock.day_open = stock.price
                    except Exception as e:
                        print(f"Error in rebrand: {e}")
                        stock.name = f"NewCo-{random.randint(100,999)}"
                        stock.price = 10.0
                    
                    # 3. Announce
                    bankruptcy_event = EventLog(
                        title="下市公告 ⚠️",
                        description=f"{old_name} 宣告破產，投資人血本無歸！{stock.name} ({stock.symbol}) 正式掛牌上市。",
                        target_stock_id=stock.id,
                        impact_multiplier=0.0, # Neutral start
                        duration_seconds=60
                    )
                    session.add(bankruptcy_event)
                
                # --- GURU PREDICTION CHECK (Post-Update) ---
                # Check fulfillment using the SAME active_preds list
                # Note: We query predictions again or use existing list. 
                # Since we modified prices, we should re-check active predictions or check existing list against new price.
                # Let's iterate the active_preds valid for this stock
                
                # Careful: 'active_preds' from above might be stale if we used it for drift?
                # Actually, drift used `active_preds` variable. We can reuse it, but we need to check if status is still active in DB if concurrent?
                # For simplicity in this loop, we just use the objects.
                
                for pred in active_preds:
                    hit = False
                    # Check Deadline first
                    if now > pred.deadline:
                        # EXPIRED / FAILED
                        pred.status = "FAILED"
                        if pred.guru:
                            pred.guru.total_predictions += 1
                            session.add(pred.guru)
                        session.add(pred)
                        print(f"[Guru] Prediction FAILED (Expired): {pred.guru_name} on {stock.name}")
                        continue # Skip hit check if expired

                    if pred.prediction_type == "BULL" and stock.price >= pred.target_price:
                        hit = True
                    elif pred.prediction_type == "BEAR" and stock.price <= pred.target_price:
                        hit = True
                    
                    if hit:
                        pred.status = "FULFILLED"
                        if pred.guru:
                            pred.guru.wins += 1
                            pred.guru.total_predictions += 1
                            session.add(pred.guru)
                        session.add(pred)
                        
                        # Guru News Event
                        news_data = ai_service.generate_fulfillment_news(pred.guru_name, stock.name, "hit target price")
                        if news_data:
                           guru_event = EventLog(
                               title=news_data['title'],
                               description=news_data['desc'],
                               target_stock_id=stock.id,
                               impact_multiplier=0.15 if pred.prediction_type == "BULL" else -0.15, # Self-fulfilling prophecy
                               duration_seconds=60
                           )
                           session.add(guru_event)
                           print(f"[Guru] {pred.guru_name} WAS RIGHT! {stock.name} hit {pred.target_price}")

                # B. Generate New Prediction (Rarely)
                # Cap active predictions to avoid spam & Save API
                if len(active_preds) < 1 and random.random() < 0.0005: # 0.05% change per tick (~1 per 33 mins per stock)
                    try:
                        # 1. Pick a Guru
                        gurus = session.exec(select(Guru)).all()
                        if gurus:
                            selected_guru = random.choice(gurus)
                            persona = {"name": selected_guru.name, "bio": selected_guru.bio}
                            
                            base_p = self.get_base_price(stock.symbol)
                            guru_data = ai_service.generate_guru_forecast(stock.name, stock.price, base_price=base_p, guru_persona=persona)
                            
                            if guru_data:
                                new_pred = Prediction(
                                    guru_id=selected_guru.id,
                                    guru_name=guru_data['guru_name'],
                                    stock_id=stock.id,
                                    target_price=guru_data['target_price'],
                                    start_price=stock.price,
                                    prediction_type=guru_data['prediction_type'],
                                    description=guru_data['rationale'],
                                    deadline=datetime.now() + timedelta(minutes=60) # 60 mins for Influence to work
                                )
                                session.add(new_pred)
                                print(f"[Guru] New Prediction: {new_pred.guru_name} says {new_pred.prediction_type} on {stock.name}")
                    except Exception as e:
                        print(f"Error generating guru pred: {e}")

                session.add(stock)
                
                # OHLC Aggregation
                self._update_candle(session, stock, now)
                
            session.commit() 
            
    def _update_candle(self, session, stock, now):
        # Determine current minute bucket
        # Determine current 5-second bucket for smoother chart in dev
        # math.floor(second / 5) * 5
        sec_bucket = (now.second // 5) * 5
        current_minute = now.replace(second=sec_bucket, microsecond=0)
        
        if stock.id not in self.candles:
            self.candles[stock.id] = {
                "start_time": current_minute,
                "open": stock.price,
                "high": stock.price,
                "low": stock.price,
                "close": stock.price,
                "volume": 0
            }
        
        candle = self.candles[stock.id]
        
        # If new minute started, save old candle and reset
        if current_minute > candle["start_time"]:
            # Save to DB
            history = StockPriceHistory(
                stock_id=stock.id,
                timestamp=candle["start_time"],
                open=candle["open"],
                high=candle["high"],
                low=candle["low"],
                close=candle["close"],
                volume=candle["volume"]
            )
            session.add(history)
            
            # Reset
            self.candles[stock.id] = {
                "start_time": current_minute,
                "open": stock.price,
                "high": stock.price,
                "low": stock.price,
                "close": stock.price,
                "volume": 0
            }
            candle = self.candles[stock.id]
            
        # Update current candle
        candle["high"] = max(candle["high"], stock.price)
        candle["low"] = min(candle["low"], stock.price)
        candle["close"] = stock.price
        candle["volume"] += random.randint(10, 100) # Simulated volume

    def attempt_weekly_ipo(self, probability: float = 0.5):
        """Called by scheduler once a week (e.g. Monday morning)"""
        # Weekly Chance!
        if random.random() > probability:
            print(f"[Market] Weekly IPO check: No IPO this week (Roll > {probability})")
            return

        with self.session_factory() as session:
           try:
               print("[Market] Weekly IPO Triggered! Generating new company...")
               new_info = ai_service.generate_new_company()
               
               # Check symbol uniqueness
               if not session.exec(select(Stock).where(Stock.symbol == new_info['symbol'])).first():
                   new_stock = Stock(
                       symbol=new_info['symbol'],
                       name=new_info['name'],
                       price=round(random.uniform(20, 100), 2),
                       day_open=round(random.uniform(20, 100), 2),
                       volatility=0.08 # IPOs are VERY volatile
                   )
                   new_stock.day_open = new_stock.price
                   session.add(new_stock)
                   session.flush()
                   
                   ipo_event = EventLog(
                       title="🎉 新股上市 (IPO) 公告",
                       description=f"【週一新股】市場迎來新成員：{new_stock.name} ({new_stock.symbol}) 正式掛牌上市！本週幸運中籤！",
                       target_stock_id=new_stock.id,
                       impact_multiplier=0.3, # Strong Hype
                       duration_seconds=7200 # Lasts 2 hours
                   )
                   session.add(ipo_event)
                   session.commit()
                   print(f"[Market] IPO Successful: {new_stock.name}")
           except Exception as e:
               print(f"IPO Failed: {e}")
