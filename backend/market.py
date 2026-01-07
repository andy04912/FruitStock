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

    def initialize_market(self):
        with self.session_factory() as session:
            # --- SCHEMA MIGRATION: Add columns if missing ---
            from sqlmodel import text
            try:
                session.exec(text("SELECT category FROM stock LIMIT 1"))
            except Exception:
                session.rollback()
                print("Migrating: Adding 'category' column to Stock...")
                session.exec(text("ALTER TABLE stock ADD COLUMN category VARCHAR DEFAULT 'FRUIT'"))
                session.commit()
            
            try:
                session.exec(text("SELECT dividend_yield FROM stock LIMIT 1"))
            except Exception:
                session.rollback()
                print("Migrating: Adding 'dividend_yield' column to Stock...")
                session.exec(text("ALTER TABLE stock ADD COLUMN dividend_yield FLOAT DEFAULT 0.0"))
                session.commit()

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
                        volatility=0.02,
                        category="FRUIT"
                    )
                    session.add(stock)
                session.commit()
            
            # --- Initialize Meat Market ---
            meat_check = session.exec(select(Stock).where(Stock.category == "MEAT")).first()
            if not meat_check:
                print("Initializing Meat Market...")
                for item in INITIAL_MEATS:
                    # Check if symbol exists (legacy check)
                    existing = session.exec(select(Stock).where(Stock.symbol == item["symbol"])).first()
                    if not existing:
                        stock = Stock(
                            symbol=item["symbol"],
                            name=item["name"],
                            price=item["price"],
                            day_open=item["price"],
                            volatility=0.04, # Higher base volatility
                            category="MEAT"
                        )
                        session.add(stock)
                session.commit()

            # --- Initialize Root Market (Staple/Stable) ---
            print("Initializing Root Market...")
            for item in INITIAL_ROOTS:
                existing = session.exec(select(Stock).where(Stock.symbol == item["symbol"])).first()
                if not existing:
                    stock = Stock(
                        symbol=item["symbol"],
                        name=item["name"],
                        price=item["price"],
                        day_open=item["price"],
                        volatility=0.005, # Very low volatility
                        category="ROOT",
                        dividend_yield=random.uniform(0.01, 0.05) # Init 1-5%
                    )
                    session.add(stock)
                else:
                    # Fix name/category/yield
                    changed = False
                    if existing.name != item["name"]:
                        print(f"Updating stock name for {existing.symbol}: {existing.name} -> {item['name']}")
                        existing.name = item["name"]
                        changed = True
                    if existing.category != "ROOT":
                        print(f"Updating stock category for {existing.symbol}: {existing.category} -> ROOT")
                        existing.category = "ROOT" # Ensure category key
                        changed = True
                    if getattr(existing, 'dividend_yield', 0) == 0:
                        print(f"Initializing dividend_yield for {existing.symbol}")
                        existing.dividend_yield = random.uniform(0.01, 0.05)
                        changed = True
                    
                    if changed:
                        session.add(existing)
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
        for s in INITIAL_MEATS:
            if s["symbol"] == symbol:
                return s["price"]
        for s in INITIAL_ROOTS:
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

                # --- VOLATILITY LOGIC ---
                category = getattr(stock, 'category', 'FRUIT')
                
                # 1. Base Volatility
                volatility_multiplier = 1.0
                if category == 'MEAT':
                     volatility_multiplier = 1.2 # High Volatility
                elif category == 'ROOT':
                     volatility_multiplier = 0.3 # Very Stable
                
                # 2. Event Impact
                statement = select(EventLog).where(
                    EventLog.target_stock_id == stock.id,
                    EventLog.created_at >= now - timedelta(seconds=60)
                )
                active_events = session.exec(statement).all()
                total_impact = sum(e.impact_multiplier for e in active_events)
                
                # Roots are resistant to hype/panic
                if category == 'ROOT':
                    total_impact *= 0.5 

                # If there are events, Market is CHAOTIC
                if abs(total_impact) > 0.15:
                    volatility_multiplier *= 3.0 
                elif abs(total_impact) > 0.05:
                    volatility_multiplier *= 1.5 
                
                # Random Noise
                noise = random.gauss(0, 0.0005 * volatility_multiplier)
                
                # 3. Directional Force (The "Trend")
                trend_force = (total_impact / 45.0) 

                # --- GURU DRIFT ---
                guru_drift = 0.0
                # Roots ignore gurus mostly
                if category != 'ROOT':
                    active_preds = session.exec(select(Prediction).where(Prediction.stock_id == stock.id, Prediction.status == "ACTIVE")).all()
                    for pred in active_preds:
                        if pred.prediction_type == "BULL":
                            guru_drift += 0.00005 
                        elif pred.prediction_type == "BEAR":
                            guru_drift -= 0.00005 
                
                # 4. Dynamic Physics
                base_price = self.get_base_price(stock.symbol)
                ratio = stock.price / base_price
                gravity_pct = 0.0
                
                # ROOT stocks have very strong gravity to keep them stable
                if category == 'ROOT':
                    gravity_pct = (1.0 - ratio) * 0.0005 # Strong pull back to base
                else:
                    # Normal Logic
                    if ratio > 1.5:
                        pull_force = -0.001 * (ratio - 1.0)
                        if random.random() < 0.005:
                            gravity_pct = random.uniform(0.0, 0.005) 
                        else:
                            gravity_pct = random.gauss(pull_force, 0.002)
                    elif ratio < 0.7:
                        push_force = 0.001 * (1.0 - ratio) 
                        if random.random() < 0.005:
                            gravity_pct = random.uniform(-0.005, 0.0) 
                        else:
                            gravity_pct = random.gauss(push_force, 0.002)
                    else:
                         gravity_pct = (1.0 - ratio) * 0.0001 
                
                # 5. Sniper Move (Rare spike) - Disable for ROOT
                sniper_move = 0
                if category != 'ROOT' and random.random() < 0.0002:
                    sniper_move = random.choice([-0.02, 0.02])
                
                # Aggregate
                pct_change = noise + trend_force + sniper_move + guru_drift + gravity_pct
                
                # Apply Change
                new_price = stock.price * (1 + pct_change)
                stock.price = max(0.01, round(new_price, 2))
                
                # --- BANKRUPTCY CHECK (Roots rarely go bankrupt) ---
                threshold = 0.05
                if stock.price < threshold:
                     # ... same bankruptcy logic ...
                     old_name = stock.name
                     print(f"[Market] {old_name} is BANKRUPT (Price: {stock.price})! Initiating liquidation...")
                     
                     session.exec(delete(Portfolio).where(Portfolio.stock_id == stock.id))
                     
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
                     
                     bankruptcy_event = EventLog(
                         title="下市公告 ⚠️",
                         description=f"{old_name} 宣告破產，投資人血本無歸！{stock.name} ({stock.symbol}) 正式掛牌上市。",
                         target_stock_id=stock.id,
                         impact_multiplier=0.0, 
                         duration_seconds=60
                     )
                     session.add(bankruptcy_event)
                
                # ... Guru Logic ...
                # Skip guru check details for brevity, assume similar logic or copy it
                # For `replace_file_content`, I need to provide COMPLETE content for the chunk.
                # Since the chunk is huge, I will retain original guru logic but add the ROOT exclusion above.
                
                # Re-implementing Guru Check logic to ensure it's in the replacement context
                # Note: I put `active_preds` fetch inside `if category != 'ROOT'`. 
                # If I want guru predictions to valid for ROOT, I should allow it, but maybe with less impact.
                # Let's simple re-fetch if needed or just skip logic for ROOT.
                # Actually, let's allow Guru/Predictions for ROOT but they just likely won't hit often due to stability.
                
                active_preds = session.exec(select(Prediction).where(Prediction.stock_id == stock.id, Prediction.status == "ACTIVE")).all()
                for pred in active_preds:
                    hit = False
                    if now > pred.deadline:
                        pred.status = "FAILED"
                        if pred.guru:
                            pred.guru.total_predictions += 1
                            session.add(pred.guru)
                        session.add(pred)
                        continue 

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
                        
                        news_data = ai_service.generate_fulfillment_news(pred.guru_name, stock.name, "hit target price")
                        if news_data:
                           guru_event = EventLog(
                               title=news_data['title'],
                               description=news_data['desc'],
                               target_stock_id=stock.id,
                               impact_multiplier=0.15 if pred.prediction_type == "BULL" else -0.15,
                               duration_seconds=60
                           )
                           session.add(guru_event)

                # B. Generate New Prediction (Rarely)
                if len(active_preds) < 1 and random.random() < 0.0005:
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

                session.add(stock)
                
                # OHLC Aggregation
                self._update_candle(session, stock, now)
                
            session.commit() 
            
    def _update_candle(self, session, stock, now):
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
                    new_info = ai_service.generate_new_company(category=category)
                    
                    if not session.exec(select(Stock).where(Stock.symbol == new_info['symbol'])).first():
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
