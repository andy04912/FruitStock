import random
import math
from datetime import datetime, timedelta
from sqlmodel import Session, select, delete
from models import Stock, EventLog, StockPriceHistory, Portfolio, Prediction, Guru
import ai_service

INITIAL_FRUITS = [
    {"symbol": "AAPL", "name": "Apple", "price": 150.0},
    {"symbol": "BANA", "name": "Banana", "price": 50.0},
    {"symbol": "ORNG", "name": "Orange", "price": 80.0},
    {"symbol": "MANG", "name": "Mango", "price": 200.0},
    {"symbol": "PINE", "name": "Pineapple", "price": 120.0},
    {"symbol": "DURI", "name": "Durian", "price": 500.0},
    {"symbol": "WTML", "name": "Watermelon", "price": 30.0},
    {"symbol": "GRAP", "name": "Grape", "price": 15.0},
]

INITIAL_MEATS = [
    {"symbol": "BEEF", "name": "Wagyu A5", "price": 1000.0},
    {"symbol": "PORK", "name": "Black Pork", "price": 300.0},
    {"symbol": "CKEN", "name": "Fried Chicken", "price": 100.0},
    {"symbol": "LAMB", "name": "Rack of Lamb", "price": 800.0},
    {"symbol": "DUCK", "name": "Roasted Duck", "price": 400.0},
]

INITIAL_ROOTS = [
    {"symbol": "POTA", "name": "Potato", "price": 40.0},
    {"symbol": "CARR", "name": "Carrot", "price": 35.0},
    {"symbol": "ONIO", "name": "Onion", "price": 45.0},
    {"symbol": "YAM", "name": "Yam", "price": 120.0},
    {"symbol": "GING", "name": "Ginger", "price": 80.0},
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
        
        # In-Memory State
        self.active_stocks = [] # List of Stock objects (detached or dicts)
        self.history_buffer = [] # List of StockPriceHistory objects to bulk insert
        
        # New Chaos Elements
        self.market_regime = "NORMAL" # NORMAL, BOOM, CRASH, CHAOS
        self.regime_duration = 0
        self.base_prices = {} # {symbol: price} - Dynamic center of gravity
        
    def initialize_market(self):
        print("[Market] Initializing market...")
        with self.session_factory() as session:
            # 1. Initialize Fruits
            for item in INITIAL_FRUITS:
                stock = session.exec(select(Stock).where(Stock.symbol == item["symbol"])).first()
                if not stock:
                    new_stock = Stock(
                        symbol=item["symbol"],
                        name=item["name"],
                        price=item["price"],
                        day_open=item["price"],
                        category="FRUIT",
                        volatility=0.02
                    )
                    session.add(new_stock)
                    print(f"[Market] Added new stock: {new_stock.name}")

            # 2. Initialize Meats
            for item in INITIAL_MEATS:
                stock = session.exec(select(Stock).where(Stock.symbol == item["symbol"])).first()
                if not stock:
                    new_stock = Stock(
                        symbol=item["symbol"],
                        name=item["name"],
                        price=item["price"],
                        day_open=item["price"],
                        category="MEAT",
                        volatility=0.04
                    )
                    session.add(new_stock)
                    print(f"[Market] Added new stock: {new_stock.name}")

            # 3. Initialize Roots (Dividend Stocks)
            for item in INITIAL_ROOTS:
                stock = session.exec(select(Stock).where(Stock.symbol == item["symbol"])).first()
                if not stock:
                    new_stock = Stock(
                        symbol=item["symbol"],
                        name=item["name"],
                        price=item["price"],
                        day_open=item["price"],
                        category="ROOT",
                        volatility=0.005,
                        dividend_yield=random.uniform(0.01, 0.05)
                    )
                    session.add(new_stock)
                    print(f"[Market] Added new stock: {new_stock.name} (Yield: {new_stock.dividend_yield:.2%})")
            
            # 4. Initialize Gurus
            for item in INITIAL_GURUS:
                 guru = session.exec(select(Guru).where(Guru.name == item["name"])).first()
                 if not guru:
                     new_guru = Guru(
                         name=item["name"],
                         bio=item["bio"]
                     )
                     session.add(new_guru)
                     print(f"[Market] Added new guru: {new_guru.name}")

            session.commit()
        
        self.load_cache()

    def load_cache(self):
        """Loads DB state into memory"""
        with self.session_factory() as session:
            # Load stocks detatched
            stocks = session.exec(select(Stock)).all()
            self.active_stocks = []
            for s in stocks:
                # We need fresh objects or just dicts? 
                # SQLModel objects bound to a closed session expire.
                # data = s.model_dump() -> Dict.
                # But we want to modify them.
                # Let's keep them as objects but we need to merge them back later.
                # Or just use them as data containers.
                session.refresh(s)
                self.active_stocks.append(s)
            
            # Detach from session so we can use them after session closes?
            # Actually, `session.exec` returns objects. If session closes, accessing attributes might trigger Lazy Load (fail) or if eager loaded it's fine.
            # Stock has no relationships? accessing fields is fine.
            print(f"[Market] Loaded {len(self.active_stocks)} stocks into memory cache.")

    def load_from_dict(self, stocks_data: list):
        """Restores state from Redis JSON list"""
        self.active_stocks = []
        with self.session_factory() as session:
             # We need to map dict data back to Objects to maintain compatibility
             # Or we can use objects.
             # Strategy: Load DB objects, then UPDATE them with Redis data (Price).
             db_stocks = session.exec(select(Stock)).all()
             stock_map = {s.id: s for s in db_stocks}
             
             for d in stocks_data:
                 sid = d.get("id")
                 if sid in stock_map:
                     s = stock_map[sid]
                     s.price = float(d.get("price", s.price))
                     # We can update other fields if needed
                     self.active_stocks.append(s)
             
             # If Redis has fewer stocks than DB (e.g. new IPOs), add missing from DB
             loaded_ids = set(s.id for s in self.active_stocks)
             for s in db_stocks:
                 if s.id not in loaded_ids:
                     self.active_stocks.append(s)
                     
        print(f"[Market] Restored {len(self.active_stocks)} stocks from Redis Persistence.")

    def persist_state(self):
        """Flushes in-memory state to DB (Run every 60s)"""
        start_time = datetime.now()
        with self.session_factory() as session:
            # 1. Update Stocks
            for mem_stock in self.active_stocks:
                # merge() puts the state of mem_stock into the session
                # If mem_stock is detached, it updates the DB row with same ID
                session.merge(mem_stock)
            
            # 2. Bulk Insert History
            if self.history_buffer:
                session.add_all(self.history_buffer)
                print(f"[Market] Persisting {len(self.history_buffer)} history records...")
                self.history_buffer = [] # Clear buffer
                
            session.commit()
        
        duration = (datetime.now() - start_time).total_seconds()
        print(f"[Market] Persistence completed in {duration:.2f}s")

    def get_base_price(self, symbol):
        """Returns dynamic base price for gravity calculation"""
        if symbol not in self.base_prices:
             # Find initial
             for lst in [INITIAL_FRUITS, INITIAL_MEATS, INITIAL_ROOTS]:
                 for item in lst:
                     if item["symbol"] == symbol:
                         self.base_prices[symbol] = item["price"]
                         return item["price"]
             # If new IPO, return current if not found?
             # We should try to find from active stocks
             for s in self.active_stocks:
                 if s.symbol == symbol:
                      self.base_prices[symbol] = s.price
                      return s.price
             return 100.0 # Fallback
        return self.base_prices[symbol]

    def update_regime(self):
        """Updates global market mood"""
        self.regime_duration -= 1
        if self.regime_duration <= 0:
            # Switch Regime
            roll = random.random()
            if roll < 0.7:
                self.market_regime = "NORMAL"
                self.regime_duration = random.randint(300, 600) # 5-10 mins
            elif roll < 0.85:
                self.market_regime = "BOOM" # Bull Run
                self.regime_duration = random.randint(60, 180)
            elif roll < 0.95:
                self.market_regime = "CRASH" # Bear functionality
                self.regime_duration = random.randint(60, 120)
            else:
                self.market_regime = "CHAOS" # High Volatility
                self.regime_duration = random.randint(30, 90)
            print(f"[Market] Regime Switched to: {self.market_regime} (for {self.regime_duration}s)")

    def update_prices(self):
        # Operates purely on self.active_stocks (Memory)
        if not self.active_stocks:
            self.load_cache()

        now = datetime.now()
        current_date = now.date()
        
        # Check for day change
        day_changed = False
        if current_date > self.last_date:
            day_changed = True
            self.last_date = current_date
            print(f"Day changed to {current_date}. Resetting day_open.")
        
        self.update_regime()

        # We need a session mainly for reading Events/Predictions?
        with self.session_factory() as session:
            
            for stock in self.active_stocks:
                if day_changed:
                    stock.day_open = stock.price
                if stock.day_open == 0:
                    stock.day_open = stock.price

                # --- NEW CHAOS MATH ---
                category = getattr(stock, 'category', 'FRUIT')
                base_price = self.get_base_price(stock.symbol)
                
                # 1. Base Volatility & Regime Modifiers
                volatility = stock.volatility if hasattr(stock, 'volatility') else 0.02
                
                # Regime Multipliers
                regime_bias = 0.0
                regime_vol_mult = 1.0
                
                if self.market_regime == "BOOM":
                    regime_bias = 0.0005 # Slight drift up
                    regime_vol_mult = 1.5
                elif self.market_regime == "CRASH":
                    regime_bias = -0.001 # Stronger drift down
                    regime_vol_mult = 2.0
                elif self.market_regime == "CHAOS":
                    regime_vol_mult = 4.0 # Pure volatility, no bias
                
                # Category Modifiers
                if category == 'MEAT': regime_vol_mult *= 1.2
                if category == 'ROOT': regime_vol_mult *= 0.3 # Roots are stable
                
                # 2. Random Walk (Brownian Motion)
                # Box-Muller transform usually, but random.gauss is fine.
                # Standard Deviation = volatility / sqrt(time updates per day?) -> simplified here
                noise = random.gauss(regime_bias, 0.001 * regime_vol_mult)
                
                # 3. Dynamic Gravity (Mean Reversion)
                # Instead of fixed pull, we move the base_price towards current price slowly (Drift)
                # And pull current price towards base_price weakly.
                
                # Drift the Base (Center of Gravity moves!)
                # If price stays high, base price follows it slowly.
                if self.market_regime == "NORMAL":
                     target_bias = (stock.price - base_price) * 0.0001
                     self.base_prices[stock.symbol] += target_bias
                
                # Gravity Force (Non-linear)
                # Only pull if deviation is huge > 20%
                deviation = (stock.price - base_price) / base_price
                gravity = 0.0
                
                if abs(deviation) > 0.2:
                    # Pull back
                    gravity = -deviation * 0.005 # Stronger pull at extremes
                elif abs(deviation) > 0.5:
                     gravity = -deviation * 0.01 # Very strong pull to prevent explosion
                
                if category == 'ROOT':
                    # Roots hug the line tighter for dividends
                    gravity = -deviation * 0.02

                # 4. Event Impact (Read-Only)
                # Reducing frequency of DB checks to optimize (check 1/10 times or just simple cache?)
                # For safety, we keep checking but maybe simpler query?
                # Keeping original logic for compatibility but tuning down effect
                statement = select(EventLog).where(
                    EventLog.target_stock_id == stock.id,
                    EventLog.created_at >= now - timedelta(seconds=60)
                )
                active_events = session.exec(statement).all()
                total_impact = sum(e.impact_multiplier for e in active_events)
                
                trend_force = (total_impact / 60.0) # Spread impact over minute
                
                # 5. Guru/Sniper (Simplified Probability)
                sniper_effect = 0
                if random.random() < 0.0002: # 0.02%
                     sniper_effect = random.choice([0.02, -0.02, 0.01, -0.01])
                     print(f"[Market] Sniper hit {stock.name}: {sniper_effect*100}%")

                # FINAL CALCULATION
                change_percent = noise + gravity + trend_force + sniper_effect
                
                # Apply
                stock.price *= (1 + change_percent)
                stock.price = max(0.01, round(stock.price, 2)) 

                # B. Generate New Prediction (Rarely)
                if random.random() < 0.0005:
                    # Only check DB if we hit the probability (Save IO)
                    active_preds = session.exec(select(Prediction).where(Prediction.stock_id == stock.id, Prediction.status == "ACTIVE")).all()
                    
                    if len(active_preds) < 1:
                        try:
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
                                        deadline=datetime.now() + timedelta(minutes=60) 
                                    )
                                    session.add(new_pred)
                        except Exception as e:
                            print(f"Error generating guru pred: {e}")

                # [OPTIMIZATION] Do NOT add stock to session here. 
                # Stock updates are In-Memory only until persist_state is called.
                
                # OHLC Aggregation (Buffer)
                self._update_candle(stock, now)
                
            # Only commit if we actually changed Predictions/Events/Gurus
            if session.new or session.dirty:
                 session.commit()
                
    def _update_candle(self, stock, now):
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
        
        if current_minute > candle["start_time"]:
            # Finalize old candle -> Buffer it
            history = StockPriceHistory(
                stock_id=stock.id,
                timestamp=candle["start_time"],
                open=candle["open"],
                high=candle["high"],
                low=candle["low"],
                close=candle["close"],
                volume=candle["volume"]
            )
            self.history_buffer.append(history) # Add to buffer instead of session
            
            # Start new candle
            self.candles[stock.id] = {
                "start_time": current_minute,
                "open": stock.price,
                "high": stock.price,
                "low": stock.price,
                "close": stock.price,
                "volume": 0
            }
            candle = self.candles[stock.id]
            
        candle["high"] = max(candle["high"], stock.price)
        candle["low"] = min(candle["low"], stock.price)
        candle["close"] = stock.price
        candle["volume"] += random.randint(10, 100) 



    def attempt_weekly_ipo(self):
        """Called by scheduler once a week. Checks IPO for each market independently."""
        print("[Market] Running Weekly IPO Check...")
        
        # Probabilities
        PROBS = {
            "FRUIT": 0.30, # 30%
            "MEAT": 0.15,  # 15%
            "ROOT": 0.10   # 10%
        }
        
        with self.session_factory() as session:
            for category, prob in PROBS.items():
                if random.random() > prob:
                    print(f"[Market] {category} IPO: Skipped (Roll > {prob})")
                    continue
                
                try:
                    print(f"[Market] {category} IPO Triggered! Generating new company...")
                    
                    # Retry logic to avoid duplicates
                    new_info = None
                    for attempt in range(5):
                        candidate = ai_service.generate_new_company(category=category)
                        # Check exist
                        if not session.exec(select(Stock).where(Stock.symbol == candidate['symbol'])).first():
                            new_info = candidate
                            break
                        print(f"[Market] IPO Duplicate Symbol {candidate['symbol']}, retrying ({attempt+1}/5)...")
                    
                    if not new_info:
                        print(f"[Market] IPO Failed ({category}): Could not find unique symbol after 5 tries.")
                        continue # Skip this category

                    # Set attributes based on category
                    volatility = 0.02
                    price_min, price_max = 20, 100
                    dividend_yield = 0.0
                    
                    if category == 'MEAT':
                        volatility = 0.04
                        price_min, price_max = 50, 200
                    elif category == 'ROOT':
                        volatility = 0.005
                        price_min, price_max = 30, 80
                        dividend_yield = random.uniform(0.01, 0.05)
                    
                    new_stock = Stock(
                        symbol=new_info['symbol'],
                        name=new_info['name'],
                        price=round(random.uniform(price_min, price_max), 2),
                        day_open=0, # Set below
                        volatility=volatility,
                        category=category,
                        dividend_yield=dividend_yield
                    )
                    new_stock.day_open = new_stock.price
                    session.add(new_stock)
                    session.flush()
                    
                    market_name_map = {"FRUIT": "水果市場", "MEAT": "肉類市場", "ROOT": "根莖市場"}
                    market_label = market_name_map.get(category, "新興市場")
                    
                    ipo_event = EventLog(
                        title=f"🎉 {market_label} 新股上市",
                        description=f"【IPO快訊】{new_stock.name} ({new_stock.symbol}) 正式掛牌！投資人目光聚焦{market_label}。",
                        target_stock_id=new_stock.id,
                        impact_multiplier=0.3, 
                        duration_seconds=7200 
                    )
                    session.add(ipo_event)
                    session.commit()
                    print(f"[Market] IPO Successful: {new_stock.name} ({category})")
                        
                except Exception as e:
                    print(f"IPO Failed ({category}): {e}")

    def payout_dividends(self):
        """Pays dividends and Rerolls Yield"""
        print("[Market] Processing dividend payouts for ROOT stocks...")
        from models import Transaction, TransactionType, BonusLog, User # Late import
        
        with self.session_factory() as session:
            # 1. Find all ROOT stocks
            root_stocks = session.exec(select(Stock).where(Stock.category == "ROOT")).all()
            if not root_stocks:
                return
            
            payout_count = 0
            
            for stock in root_stocks:
                # Use Stored Yield (or default 1%)
                current_yield = getattr(stock, 'dividend_yield', 0.01)
                if current_yield <= 0: current_yield = 0.01
                
                # Pay Holders
                portfolios = session.exec(select(Portfolio).where(Portfolio.stock_id == stock.id, Portfolio.quantity > 0)).all()
                for port in portfolios:
                    dividend_amount = round(stock.price * port.quantity * current_yield, 2)
                    
                    if dividend_amount > 0:
                        user = session.get(User, port.user_id)
                        if user:
                            user.balance += dividend_amount
                            session.add(user)
                            
                            trans = Transaction(
                                user_id=user.id,
                                stock_id=stock.id,
                                type=TransactionType.DIVIDEND,
                                price=stock.price,
                                quantity=port.quantity,
                                profit=dividend_amount # Profit field used for Amount
                            )
                            session.add(trans)
                            payout_count += 1
                
                # ROTATE YIELD FOR NEXT 2 HOURS (1% to 5%)
                next_yield = round(random.uniform(0.01, 0.05), 4)
                stock.dividend_yield = next_yield
                session.add(stock)
                print(f"[Div] {stock.symbol}: Paid {(current_yield*100):.2f}%. Next Payout Rate: {(next_yield*100):.2f}%")
            
            session.commit()
            if payout_count > 0:
                print(f"[Market] Dividends paid to {payout_count} holders.")
