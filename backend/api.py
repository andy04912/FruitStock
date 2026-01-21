from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from datetime import timedelta, datetime
from typing import List
import json
import random

from database import get_session, engine
from models import User, Portfolio, Stock, BonusLog, StockPriceHistory, Transaction, Watchlist, Horse, Race, Bet, Friendship, UserDailySnapshot, SlotSpin
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_password_hash,
    verify_password,
    get_current_user,
)
from trader import Trader
from events import EventSystem
from race_engine import RaceEngine
from slots_engine import SlotsEngine
from redis_utils import get_redis

router = APIRouter()

slots_engine = SlotsEngine(lambda: Session(engine))

@router.post("/register", response_model=dict)
def register(user: User, session: Session = Depends(get_session)):
    try:
        statement = select(User).where(User.username == user.username)
        if session.exec(statement).first():
            # RETURN 200 OK with status='exists' per user request
            return {"message": "Username already registered", "user_id": -1, "status": "exists"}
        
        user.hashed_password = get_password_hash(user.hashed_password)
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"message": "User created successfully", "user_id": user.id, "status": "created"}
    except Exception as e:
        import traceback
        print("!!!!!!!! REGISTER ERROR TRACEBACK START !!!!!!!!")
        traceback.print_exc()
        print("!!!!!!!! REGISTER ERROR TRACEBACK END !!!!!!!!")
        raise HTTPException(status_code=500, detail=f"Register Failed: {str(e)}")

@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    try:
        statement = select(User).where(User.username == form_data.username)
        user = session.exec(statement).first()
        
        if not user:
             # RETURN 200 with status='unregistered' per user request
             return {"status": "unregistered", "message": "Account not found. Please register."}

        if not verify_password(form_data.password, user.hashed_password):
            # RETURN 200 with status='failed' per user request
            return {"status": "failed", "message": "Incorrect username or password"}
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer", "status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print("!!!!!!!! LOGIN ERROR TRACEBACK START !!!!!!!!")
        traceback.print_exc()
        print("!!!!!!!! LOGIN ERROR TRACEBACK END !!!!!!!!")
        raise HTTPException(status_code=500, detail=f"Login Failed: {str(e)}")

@router.get("/users/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/portfolio", response_model=List[Portfolio])
def get_portfolio(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Portfolio).where(Portfolio.user_id == current_user.id)
    portfolios = session.exec(statement).all()
    return portfolios

@router.post("/trade/buy")
async def buy_stock(stock_id: int, quantity: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # 直接從 MarketEngine 內存取得最新價格（避免 Redis 延遲或 DB 舊數據）
    from main import market_engine
    live_price = None
    for stock in market_engine.active_stocks:
        if stock.id == stock_id:
            live_price = stock.price
            break

    trader = Trader(session)
    return trader.buy_stock(current_user, stock_id, quantity, live_price=live_price)

@router.post("/trade/sell")
async def sell_stock(stock_id: int, quantity: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # 直接從 MarketEngine 內存取得最新價格
    from main import market_engine
    live_price = None
    for stock in market_engine.active_stocks:
        if stock.id == stock_id:
            live_price = stock.price
            break

    trader = Trader(session)
    return trader.sell_stock(current_user, stock_id, quantity, live_price=live_price)

@router.post("/trade/short")
async def short_stock(stock_id: int, quantity: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """做空股票 API"""
    # 直接從 MarketEngine 內存取得最新價格
    from main import market_engine
    live_price = None
    for stock in market_engine.active_stocks:
        if stock.id == stock_id:
            live_price = stock.price
            break

    trader = Trader(session)
    return trader.short_stock(current_user, stock_id, quantity, live_price=live_price)

@router.post("/trade/cover")
async def cover_short(stock_id: int, quantity: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """回補空單 API"""
    # 直接從 MarketEngine 內存取得最新價格
    from main import market_engine
    live_price = None
    for stock in market_engine.active_stocks:
        if stock.id == stock_id:
            live_price = stock.price
            break

    trader = Trader(session)
    return trader.cover_short(current_user, stock_id, quantity, live_price=live_price)

@router.post("/bonus/claim")
def claim_daily_bonus(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    today = datetime.now().strftime("%Y-%m-%d")
    statement = select(BonusLog).where(
        BonusLog.user_id == current_user.id,
        BonusLog.date == today
    )
    if session.exec(statement).first():
        # RETURN 200 OK with status='claimed' per user request
        return {
            "message": "Already claimed bonus today", 
            "status": "claimed",
            "amount": 0,
            "new_balance": current_user.balance
        }
        
    bonus_amount = 500.0 # Fixed amount for now
    current_user.balance += bonus_amount
    
    log = BonusLog(user_id=current_user.id, date=today, amount=bonus_amount)
    session.add(log)
    session.add(current_user)
    session.commit()
    return {"message": "Bonus claimed", "amount": bonus_amount, "new_balance": current_user.balance}

@router.get("/leaderboard")
def get_leaderboard(session: Session = Depends(get_session)):
    # Calculate net worth (Balance + Stock Value)
    # This is heavy for many users, but fine for small scale
    users = session.exec(select(User)).all()
    stocks = session.exec(select(Stock)).all()
    stock_map = {s.id: s.price for s in stocks}
    
    leaderboard = []
    for user in users:
        portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == user.id)).all()
        stock_value = 0.0
        for p in portfolios:
            stock_value += p.quantity * stock_map.get(p.stock_id, 0)
        
        net_worth = user.balance + stock_value
        leaderboard.append({
            "id": user.id,
            "username": user.username,  # 真實帳號
            "nickname": user.nickname,  # 暱稱
            "display_name": user.nickname or user.username,  # 優先顯示暱稱
            "balance": user.balance,
            "net_worth": net_worth
        })

    leaderboard.sort(key=lambda x: x["net_worth"], reverse=True)
    return leaderboard[:10]


@router.get("/stocks")
@router.get("/stocks")
async def get_stocks(session: Session = Depends(get_session)):
    # Try Redis first (Real-time state)
    from redis_utils import get_redis
    redis = await get_redis()
    if redis:
        try:
            cached = await redis.get("market_stocks")
            if cached:
                return json.loads(cached)
        except Exception:
            pass
            
    # Fallback to DB (might be 60s old)
    return session.exec(select(Stock)).all()

def resample_candles(candles: List[StockPriceHistory], interval_minutes: int) -> List[dict]:
    if not candles:
        return []
    
    # Sort by time just in case
    candles.sort(key=lambda c: c.timestamp)
    
    resampled = []
    current_bucket_start = None
    current_bucket_data = {
        "open": 0, "high": -float('inf'), "low": float('inf'), "close": 0, "volume": 0
    }
    
    # 5-second buckets to N-minute buckets
    for candle in candles:
        # Calculate bucket start time
        # truncate timestamp to interval
        ts = candle.timestamp
        # total minutes from epoch often easier, or just simple truncation if aligned
        # For simplicity, we align to minute boundaries 00:00
        # If interval is 5m, we want 00, 05, 10
        minute_bucket = (ts.minute // interval_minutes) * interval_minutes
        bucket_time = ts.replace(minute=minute_bucket, second=0, microsecond=0)
        
        if interval_minutes >= 60:
             # Handle Hour logic roughly if needed, but for now specific minutes
             # If interval is 60 (1h), truncated to hour
            hour_bucket = (ts.hour // (interval_minutes // 60)) * (interval_minutes // 60)
            bucket_time = ts.replace(hour=hour_bucket, minute=0, second=0, microsecond=0)

        if current_bucket_start is None:
            current_bucket_start = bucket_time
            current_bucket_data["open"] = candle.open
        
        if bucket_time != current_bucket_start:
            # Commit previous bucket
            resampled.append({
                "time": current_bucket_start, # Frontend will handle timezone or keep as is
                "open": current_bucket_data["open"],
                "high": current_bucket_data["high"],
                "low": current_bucket_data["low"],
                "close": current_bucket_data["close"],
                "volume": current_bucket_data["volume"]
            })
            # Start new
            current_bucket_start = bucket_time
            current_bucket_data = {
                "open": candle.open, 
                "high": -float('inf'), 
                "low": float('inf'), 
                "close": 0, 
                "volume": 0
            }
        
        # Aggregate
        current_bucket_data["high"] = max(current_bucket_data["high"], candle.high)
        current_bucket_data["low"] = min(current_bucket_data["low"], candle.low)
        current_bucket_data["close"] = candle.close
        current_bucket_data["volume"] += candle.volume

    # Commit last bucket
    if current_bucket_start:
        resampled.append({
            "time": current_bucket_start,
            "open": current_bucket_data["open"],
            "high": current_bucket_data["high"],
            "low": current_bucket_data["low"],
            "close": current_bucket_data["close"],
            "volume": current_bucket_data["volume"]
        })

    return resampled

@router.get("/stocks/{stock_id}/history")
def get_stock_history(stock_id: int, interval: str = "1m", limit: int = 5000, before: int = None, session: Session = Depends(get_session)):
    # interval: 1m, 5m, 15m, 1h, 1d
    # before: unix timestamp (optional) for pagination
    
    # Determine how much data to fetch
    # Limit to last N records (Optimized for speed)
    query = select(StockPriceHistory).where(StockPriceHistory.stock_id == stock_id)
    
    if before:
        # Client sends unix timestamp which INCLUDES the +28800 offset we added for display.
        # We must subtract it to match the DB's Naive timestamp (which acts as UTC locally).
        adjusted_before = before - 28800
        before_dt = datetime.fromtimestamp(adjusted_before)
        query = query.where(StockPriceHistory.timestamp < before_dt)
        
    statement = query.order_by(StockPriceHistory.timestamp.desc()).limit(limit) 
    
    # Fetch descending (latest first), then reverse for processing
    raw_history = session.exec(statement).all()
    raw_history = list(reversed(raw_history))
    
    if not raw_history:
        return []

    interval_map = {
        "1m": 1,
        "5m": 5,
        "15m": 15,
        "1h": 60,
        "4h": 240,
        "1d": 1440
    }
    
    minutes = interval_map.get(interval, 1)
    
    if minutes == 1:
        # If 1m, maybe we just return raw 5-sec candles or actually 1m?
        # User asked for timeframes. Since our raw data is 5-sec (per task change previously)
        # We should aggregate 5-sec to 1-min for "1m" view.
        # Or if "raw" is requested, return 5sec.
        # Let's default "1m" to aggregating 5sec -> 1min
        pass
    
    data = resample_candles(raw_history, minutes)
    
    # Format for lightweight-charts: time (unix timestamp), open, high, low, close
    # Lightweight charts expects seconds timestamp
    return [
        {
            "time": int(d["time"].timestamp()) + 28800, # Shift for Visual Display (UTC axis -> Local Time)
            "open": d["open"],
            "high": d["high"],
            "low": d["low"],
            "close": d["close"],
            "volume": d["volume"]
        }
        for d in data
    ]

@router.get("/transactions", response_model=List[dict])
def get_transactions(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Join with Stock to get symbol/name
    statement = select(Transaction, Stock).where(
        Transaction.user_id == current_user.id,
        Transaction.stock_id == Stock.id
    ).order_by(Transaction.timestamp.desc())
    
    results = session.exec(statement).all()
    
    # Flatten structure for frontend
    history = []
    for txn, stock in results:
        history.append({
            "id": txn.id,
            "stock_id": stock.id,
            "symbol": stock.symbol,
            "name": stock.name,
            "type": txn.type,
            "price": txn.price,
            "quantity": txn.quantity,
            "profit": txn.profit,
            "timestamp": txn.timestamp,  # Local Time (Naive) - Browser interprets as Local
            "total": txn.profit if txn.type == "dividend" else txn.price * txn.quantity
        })
    return history

@router.get("/watchlist", response_model=List[Stock])
def get_watchlist(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Stock).join(Watchlist).where(Watchlist.user_id == current_user.id)
    return session.exec(statement).all()

@router.post("/watchlist/{stock_id}")
def add_watchlist(stock_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Check if exists
    statement = select(Watchlist).where(
        Watchlist.user_id == current_user.id,
        Watchlist.stock_id == stock_id
    )
    if session.exec(statement).first():
        return {"message": "Already in watchlist"}
    
    item = Watchlist(user_id=current_user.id, stock_id=stock_id)
    session.add(item)
    session.commit()
    return {"message": "Added to watchlist"}

@router.delete("/watchlist/{stock_id}")
def remove_watchlist(stock_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Watchlist).where(
        Watchlist.user_id == current_user.id,
        Watchlist.stock_id == stock_id
    )
    results = session.exec(statement).all()
    for item in results:
        session.delete(item)
    session.commit()
    return {"message": "Removed from watchlist"}

# --- Race Betting Endpoints ---

@router.get("/race/next")
@router.get("/race/next")
def get_next_race(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Strategy:
    # 1. Look for a recently finished race (e.g. started within last 3 minutes) to show results
    # 2. Else return the next scheduled/open race
    
    # Get last 2 races ordered by start time descending
    # Usually: [New Upcoming Race, Just Finished Race]
    statement = select(Race).order_by(Race.start_time.desc()).limit(2)
    races = session.exec(statement).all()
    
    target_race = None
    
    if not races:
        return {"status": "NO_RACE", "message": "No race scheduled"}
        
    # Check if we should show a finished race
    # Logic: If a race finished recently (e.g., < 2 minutes ago), show "FINISHED" state.
    # Note: RaceEngine starts race at start_time, runs for ~30s. 
    # So if we want to show results for 60s after start (30s after finish):
    # We check if start_time > now - 60s.
    
    now = datetime.now()
    cutoff_time = now - timedelta(minutes=1)
    
    # Try to find a recent finished race in the last 2 records
    for r in races:
        if r.status == "FINISHED" and r.start_time > cutoff_time:
            target_race = r
            break
            
    # If no recent finished race, fallback to active race
    if not target_race:
        # Find first non-finished race (SCHEDULED, OPEN, RUNNING)
        # We can just query again or filter memory
        active_races = [r for r in races if r.status != "FINISHED"]
        if active_races:
            target_race = active_races[0] # The latest one usually
        else:
            # Maybe query explicitly for next active if not in top 2?
            # Unlikely if loop is consistent, but to be safe:
            fallback = session.exec(
                select(Race).where(
                    Race.status.in_(["SCHEDULED", "OPEN", "CLOSED", "RUNNING"])
                ).order_by(Race.start_time.asc())
            ).first()
            target_race = fallback

    if not target_race:
         return {"status": "NO_RACE", "message": "No race scheduled"}

    race = target_race
        
    participants = []
    if race.participants_snapshot:
        try:
            participants = json.loads(race.participants_snapshot)
        except:
            pass
            
    # Check if user has bet on this race
    user_bets = session.exec(select(Bet).where(
        Bet.user_id == current_user.id,
        Bet.race_id == race.id
    )).all()
    
    # Generate Winner Announcement if finished
    winner_announcement = ""
    if race.status == "FINISHED" and race.winner_horse_id:
        # Fetch winning bets for this race
        winning_bets = session.exec(select(Bet).where(
            Bet.race_id == race.id,
            Bet.horse_id == race.winner_horse_id
        )).all()
        
        winner_names = []
        for wb in winning_bets:
             u = session.get(User, wb.user_id)
             if u: winner_names.append(u.username)
        
        # Max length logic (approx 30 chars of names)
        # Randomize order
        random.shuffle(winner_names)
        
        final_names = []
        current_len = 0
        displayed_count = 0
        
        for name in winner_names:
            if current_len + len(name) > 30:
                break
            final_names.append(name)
            current_len += len(name) + 2 
            displayed_count += 1
            
        if final_names:
            winner_announcement = "恭喜 " + ", ".join(final_names)
            remaining = len(winner_names) - displayed_count
            if remaining > 0:
                winner_announcement += f" 以及其他 {remaining} 位贏家"
            winner_announcement += " 獲勝！"
        elif not winner_names:
            winner_announcement = "本場無人中獎，下次好運！"

    return {
        "id": race.id,
        "start_time": race.start_time,
        "status": race.status,
        "participants": participants,
        "winner_id": race.winner_horse_id,
        "winner_announcement": winner_announcement,
        "user_bets": [b.model_dump() for b in user_bets]
    }

@router.post("/race/bet")
def place_bet(bet_data: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # bet_data: { "race_id": int, "horse_id": int, "amount": float, "odds": float }
    # Odds are passed from frontend snapshot, but we should verify ideally. For sim, trust frontend/snapshot match.
    
    race_id = bet_data.get("race_id")
    horse_id = bet_data.get("horse_id")
    amount = float(bet_data.get("amount", 0))
    
    if amount <= 0:
        return {"status": "error", "message": "Invalid amount"}
        
    race = session.get(Race, race_id)
    if not race:
        return {"status": "error", "message": "Race not found"}
        
    if race.status != "OPEN":
        return {"status": "error", "message": "Betting is closed for this race"}
        
    if current_user.balance < amount:
        return {"status": "error", "message": "Insufficient funds"}
        
    # Get odds from snapshot to be safe
    participants = json.loads(race.participants_snapshot)
    target_odds = 1.0
    found = False
    for p in participants:
        if p["horse_id"] == horse_id:
            target_odds = p["odds"]
            found = True
            break
            
    if not found:
        return {"status": "error", "message": "Horse not found in this race"}
        
    # Deduct Balance
    current_user.balance -= amount
    
    # Create Bet
    bet = Bet(
        user_id=current_user.id,
        race_id=race.id,
        horse_id=horse_id,
        amount=amount,
        odds=target_odds
    )
    
    session.add(current_user)
    session.add(bet)
    session.commit()
    
    return {"status": "success", "message": "Bet placed successfully", "new_balance": current_user.balance, "bet_id": bet.id}

@router.get("/race/history")
def get_bet_history(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Get last 20 bets
    bets = session.exec(select(Bet).where(Bet.user_id == current_user.id).order_by(Bet.created_at.desc()).limit(20)).all()
    
    # Enrich with Horse Name? 
    # Front end can just show ID or we can fetch names if needed.
    # For now return raw bets, maybe join Horse if crucial.
    
    results = []
    for bet in bets:
        horse = session.get(Horse, bet.horse_id)
        horse_name = horse.name if horse else "Unknown"
        results.append({
            "id": bet.id,
            "race_id": bet.race_id,
            "horse_name": horse_name,
            "amount": bet.amount,
            "odds": bet.odds,
            "result": bet.result, # PENDING, WON, LOST
            "payout": bet.payout,
            "created_at": bet.created_at
        })
    return results

# --- Slot Machine Endpoints ---
@router.post("/slots/spin")
def spin_slots(bet_amount: float, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    try:
        return slots_engine.spin(current_user.id, bet_amount)
    except ValueError as e:
        # Return 200 with status=error for cleaner frontend handling if preferred, 
        # or 400 Bad Request.
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")

# --- 好友系統 Endpoints ---

@router.get("/friends/search")
def search_users(q: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """搜尋用戶（用於加好友）"""
    if len(q) < 2:
        return []
    
    # 搜尋用戶名稱（模糊匹配）
    users = session.exec(
        select(User).where(
            User.username.contains(q),
            User.id != current_user.id
        ).limit(10)
    ).all()
    
    # 檢查是否已是好友或有待處理請求
    results = []
    for user in users:
        # 檢查雙向好友關係
        existing = session.exec(
            select(Friendship).where(
                ((Friendship.user_id == current_user.id) & (Friendship.friend_id == user.id)) |
                ((Friendship.user_id == user.id) & (Friendship.friend_id == current_user.id))
            )
        ).first()
        
        status = "none"
        if existing:
            if existing.status == "ACCEPTED":
                status = "friend"
            elif existing.status == "PENDING":
                status = "pending_sent" if existing.user_id == current_user.id else "pending_received"
        
        results.append({
            "id": user.id,
            "username": user.username,
            "status": status
        })
    
    return results

@router.post("/friends/request/{user_id}")
def send_friend_request(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """發送好友請求"""
    if user_id == current_user.id:
        return {"status": "error", "message": "不能加自己為好友"}
    
    target_user = session.get(User, user_id)
    if not target_user:
        return {"status": "error", "message": "用戶不存在"}
    
    # 檢查是否已有關係
    existing = session.exec(
        select(Friendship).where(
            ((Friendship.user_id == current_user.id) & (Friendship.friend_id == user_id)) |
            ((Friendship.user_id == user_id) & (Friendship.friend_id == current_user.id))
        )
    ).first()
    
    if existing:
        if existing.status == "ACCEPTED":
            return {"status": "error", "message": "已經是好友了"}
        elif existing.status == "PENDING":
            return {"status": "error", "message": "已有待處理的請求"}
    
    # 建立好友請求
    friendship = Friendship(
        user_id=current_user.id,
        friend_id=user_id,
        status="PENDING"
    )
    session.add(friendship)
    session.commit()
    
    return {"status": "success", "message": f"已發送好友請求給 {target_user.username}"}

@router.post("/friends/accept/{request_id}")
def accept_friend_request(request_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """接受好友請求"""
    friendship = session.get(Friendship, request_id)
    
    if not friendship or friendship.friend_id != current_user.id:
        return {"status": "error", "message": "請求不存在"}
    
    if friendship.status != "PENDING":
        return {"status": "error", "message": "請求已處理"}
    
    friendship.status = "ACCEPTED"
    friendship.accepted_at = datetime.now()
    session.add(friendship)
    session.commit()
    
    sender = session.get(User, friendship.user_id)
    return {"status": "success", "message": f"已接受 {sender.username} 的好友請求"}

@router.post("/friends/reject/{request_id}")
def reject_friend_request(request_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """拒絕好友請求"""
    friendship = session.get(Friendship, request_id)
    
    if not friendship or friendship.friend_id != current_user.id:
        return {"status": "error", "message": "請求不存在"}
    
    if friendship.status != "PENDING":
        return {"status": "error", "message": "請求已處理"}
    
    friendship.status = "REJECTED"
    session.add(friendship)
    session.commit()
    
    return {"status": "success", "message": "已拒絕好友請求"}

@router.delete("/friends/{friend_id}")
def remove_friend(friend_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """刪除好友"""
    # 找到雙向好友關係
    friendship = session.exec(
        select(Friendship).where(
            ((Friendship.user_id == current_user.id) & (Friendship.friend_id == friend_id)) |
            ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user.id)),
            Friendship.status == "ACCEPTED"
        )
    ).first()
    
    if not friendship:
        return {"status": "error", "message": "好友關係不存在"}
    
    session.delete(friendship)
    session.commit()
    
    return {"status": "success", "message": "已刪除好友"}

@router.get("/friends/pending")
def get_pending_requests(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """取得待處理的好友請求"""
    requests = session.exec(
        select(Friendship).where(
            Friendship.friend_id == current_user.id,
            Friendship.status == "PENDING"
        )
    ).all()
    
    results = []
    for req in requests:
        sender = session.get(User, req.user_id)
        results.append({
            "request_id": req.id,
            "user_id": sender.id,
            "username": sender.username,
            "sent_at": req.created_at
        })
    
    return results

@router.get("/friends")
def get_friends_list(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """取得好友列表（含淨值）"""
    # 找出所有已接受的好友關係
    friendships = session.exec(
        select(Friendship).where(
            ((Friendship.user_id == current_user.id) | (Friendship.friend_id == current_user.id)),
            Friendship.status == "ACCEPTED"
        )
    ).all()
    
    friend_ids = []
    for f in friendships:
        friend_id = f.friend_id if f.user_id == current_user.id else f.user_id
        friend_ids.append(friend_id)
    
    if not friend_ids:
        return []
    
    # 計算每個好友的淨值
    friends = session.exec(select(User).where(User.id.in_(friend_ids))).all()
    stocks = session.exec(select(Stock)).all()
    stock_map = {s.id: s.price for s in stocks}
    
    results = []
    for friend in friends:
        portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == friend.id)).all()
        stock_value = sum(p.quantity * stock_map.get(p.stock_id, 0) for p in portfolios)
        net_worth = friend.balance + stock_value
        
        results.append({
            "id": friend.id,
            "username": friend.username,
            "balance": round(friend.balance, 2),
            "stock_value": round(stock_value, 2),
            "net_worth": round(net_worth, 2)
        })
    
    # 按淨值排序
    results.sort(key=lambda x: x["net_worth"], reverse=True)
    return results

@router.get("/friends/leaderboard")
def get_friends_leaderboard(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """好友排行榜（含自己）"""
    # 取得好友列表
    friends = get_friends_list(current_user, session)
    
    # 計算自己的淨值
    stocks = session.exec(select(Stock)).all()
    stock_map = {s.id: s.price for s in stocks}
    my_portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == current_user.id)).all()
    my_stock_value = sum(p.quantity * stock_map.get(p.stock_id, 0) for p in my_portfolios)
    my_net_worth = current_user.balance + my_stock_value
    
    # 加入自己
    leaderboard = [{
        "id": current_user.id,
        "username": current_user.username,
        "balance": round(current_user.balance, 2),
        "stock_value": round(my_stock_value, 2),
        "net_worth": round(my_net_worth, 2),
        "is_me": True
    }]
    
    for f in friends:
        f["is_me"] = False
        leaderboard.append(f)
    
    # 按淨值排序
    leaderboard.sort(key=lambda x: x["net_worth"], reverse=True)
    
    # 加入排名
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return leaderboard

# --- 個人資料 API ---

@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """取得個人資料（包含暱稱、資產統計、賭場統計等）"""
    # 計算股票市值
    stocks = session.exec(select(Stock)).all()
    stock_map = {s.id: s.price for s in stocks}
    portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == current_user.id)).all()
    stock_value = sum(p.quantity * stock_map.get(p.stock_id, 0) for p in portfolios)
    
    # 計算已實現損益
    transactions = session.exec(select(Transaction).where(Transaction.user_id == current_user.id)).all()
    realized_pnl = sum(t.profit or 0 for t in transactions)
    
    # 計算未實現損益
    unrealized_pnl = 0
    for p in portfolios:
        if p.quantity > 0:
            current_price = stock_map.get(p.stock_id, 0)
            unrealized_pnl += (current_price - p.average_cost) * p.quantity
    
    # 賭場統計
    bets = session.exec(select(Bet).where(Bet.user_id == current_user.id)).all()
    race_stats = {
        "total_bets": len(bets),
        "total_wagered": sum(b.amount for b in bets),
        "total_won": sum(b.payout for b in bets if b.result == "WON"),
        "total_lost": sum(b.amount for b in bets if b.result == "LOST"),
        "wins": len([b for b in bets if b.result == "WON"]),
        "losses": len([b for b in bets if b.result == "LOST"])
    }
    race_stats["net_profit"] = race_stats["total_won"] - race_stats["total_wagered"]
    
    spins = session.exec(select(SlotSpin).where(SlotSpin.user_id == current_user.id)).all()
    slots_stats = {
        "total_spins": len(spins),
        "total_wagered": sum(s.bet_amount for s in spins),
        "total_won": sum(s.payout for s in spins),
    }
    slots_stats["net_profit"] = slots_stats["total_won"] - slots_stats["total_wagered"]
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "nickname": current_user.nickname or current_user.username,
        "nickname_updated_at": current_user.nickname_updated_at,
        "balance": current_user.balance,
        "stock_value": round(stock_value, 2),
        "total_assets": round(current_user.balance + stock_value, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "realized_pnl": round(realized_pnl, 2),
        "created_at": current_user.created_at,
        "race_stats": race_stats,
        "slots_stats": slots_stats
    }

@router.put("/profile/nickname")
def update_nickname(body: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """更新暱稱（一週內只能改一次）"""
    nickname = body.get("nickname", "").strip()
    
    # 驗證暱稱長度
    if len(nickname) < 2 or len(nickname) > 16:
        return {"status": "error", "message": "暱稱長度必須在 2-16 字元之間"}
    
    # 檢查一週限制
    if current_user.nickname_updated_at:
        time_diff = datetime.now() - current_user.nickname_updated_at
        if time_diff < timedelta(days=7):
            remaining_days = 7 - time_diff.days
            remaining_hours = (timedelta(days=7) - time_diff).seconds // 3600
            return {"status": "error", "message": f"還需等待 {remaining_days} 天 {remaining_hours} 小時才能修改暱稱"}
    
    # 更新暱稱
    current_user.nickname = nickname
    current_user.nickname_updated_at = datetime.now()
    session.add(current_user)
    session.commit()
    
    return {"status": "success", "message": "暱稱已更新", "nickname": nickname}

@router.get("/profile/asset-history")
def get_asset_history(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """取得資產走勢（每日記錄）"""
    snapshots = session.exec(
        select(UserDailySnapshot)
        .where(UserDailySnapshot.user_id == current_user.id)
        .order_by(UserDailySnapshot.date.asc())
    ).all()
    
    return [
        {
            "date": s.date,
            "total_assets": s.total_assets,
            "cash": s.cash,
            "stock_value": s.stock_value
        }
        for s in snapshots
    ]

@router.get("/race/friends-bets/{race_id}")
def get_friends_bets(race_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """取得好友在某場比賽的下注資訊"""
    # 取得好友列表
    friendships = session.exec(
        select(Friendship).where(
            ((Friendship.user_id == current_user.id) | (Friendship.friend_id == current_user.id)),
            Friendship.status == "ACCEPTED"
        )
    ).all()
    
    friend_ids = []
    for f in friendships:
        friend_id = f.friend_id if f.user_id == current_user.id else f.user_id
        friend_ids.append(friend_id)
    
    if not friend_ids:
        return []
    
    # 取得好友的下注
    bets = session.exec(
        select(Bet).where(
            Bet.race_id == race_id,
            Bet.user_id.in_(friend_ids)
        )
    ).all()
    
    # 取得用戶資訊
    friends = session.exec(select(User).where(User.id.in_(friend_ids))).all()
    user_map = {u.id: u for u in friends}
    
    # 取得馬匹名稱
    horse_ids = list(set(b.horse_id for b in bets))
    horses = session.exec(select(Horse).where(Horse.id.in_(horse_ids))).all() if horse_ids else []
    horse_map = {h.id: h.name for h in horses}
    
    results = []
    for bet in bets:
        user = user_map.get(bet.user_id)
        if user:
            results.append({
                "user_id": bet.user_id,
                "username": user.nickname or user.username,
                "horse_id": bet.horse_id,
                "horse_name": horse_map.get(bet.horse_id, "Unknown"),
                "amount": bet.amount,
                "odds": bet.odds
            })
    
    return results

# ============ 21 點 API ============

from blackjack_engine import BlackjackEngine
blackjack_engine = BlackjackEngine(lambda: Session(engine))

@router.post("/blackjack/start")
def blackjack_start(bet_amount: float, current_user: User = Depends(get_current_user)):
    """開始單人 21 點"""
    return blackjack_engine.start_solo_game(current_user.id, bet_amount)

@router.post("/blackjack/hit/{hand_id}")
def blackjack_hit(hand_id: int, current_user: User = Depends(get_current_user)):
    """要牌"""
    return blackjack_engine.hit(hand_id)

@router.post("/blackjack/stand/{hand_id}")
def blackjack_stand(hand_id: int, current_user: User = Depends(get_current_user)):
    """停牌"""
    return blackjack_engine.stand(hand_id)

@router.post("/blackjack/double/{hand_id}")
def blackjack_double(hand_id: int, current_user: User = Depends(get_current_user)):
    """雙倍下注"""
    return blackjack_engine.double_down(hand_id)

@router.post("/blackjack/create-room")
def blackjack_create_room(
    name: str, 
    min_bet: float, 
    max_bet: float = None, 
    max_seats: int = 6,
    player_dealer: bool = False,
    current_user: User = Depends(get_current_user)
):
    """開設牌桌（player_dealer=True 時房主當莊）"""
    return blackjack_engine.create_room(current_user.id, name, min_bet, max_bet, max_seats, player_dealer)

@router.get("/blackjack/rooms")
def blackjack_rooms():
    """取得房間列表"""
    return blackjack_engine.get_rooms()

@router.get("/blackjack/history")
def blackjack_history(current_user: User = Depends(get_current_user)):
    """取得歷史紀錄"""
    return blackjack_engine.get_history(current_user.id)

@router.get("/blackjack/my-room")
def blackjack_my_room(current_user: User = Depends(get_current_user)):
    """取得用戶當前所在房間"""
    return blackjack_engine.get_my_room(current_user.id)

# --- 多人房間 API ---

@router.post("/blackjack/join/{room_id}")
def blackjack_join(room_id: int, current_user: User = Depends(get_current_user)):
    """加入房間"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.join_room(current_user.id, room_id)
    if result.get("status") == "success":
        room_state = blackjack_engine.get_room_state(room_id)
        broadcast_room_state(room_id, room_state)
    return result

@router.post("/blackjack/leave/{room_id}")
def blackjack_leave(room_id: int, current_user: User = Depends(get_current_user)):
    """離開房間"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.leave_room(current_user.id, room_id)
    if result.get("status") == "success":
        # 如果房間還存在才廣播
        room_state = blackjack_engine.get_room_state(room_id)
        if room_state.get("status") == "success":
            broadcast_room_state(room_id, room_state)
    return result

@router.post("/blackjack/bet/{room_id}")
def blackjack_bet(room_id: int, bet_amount: float, current_user: User = Depends(get_current_user)):
    """多人模式下注"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.place_bet(current_user.id, room_id, bet_amount)
    if result.get("status") == "success":
        room_state = blackjack_engine.get_room_state(room_id)
        broadcast_room_state(room_id, room_state)
    return result

@router.get("/blackjack/room/{room_id}")
def blackjack_room_state(room_id: int):
    """取得房間狀態"""
    return blackjack_engine.get_room_state(room_id)

@router.post("/blackjack/start-round/{room_id}")
def blackjack_start_round(room_id: int, current_user: User = Depends(get_current_user)):
    """房主開始發牌"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.start_round(room_id, current_user.id)
    if result.get("status") == "success":
        broadcast_room_state(room_id, result)
    return result

@router.post("/blackjack/multi/hit/{hand_id}")
def blackjack_multi_hit(hand_id: int, current_user: User = Depends(get_current_user)):
    """多人模式要牌"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.multi_hit(hand_id, current_user.id)
    if result.get("status") == "success" and result.get("room"):
        broadcast_room_state(result["room"]["id"], result)
    return result

@router.post("/blackjack/multi/stand/{hand_id}")
def blackjack_multi_stand(hand_id: int, current_user: User = Depends(get_current_user)):
    """多人模式停牌"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.multi_stand(hand_id, current_user.id)
    if result.get("status") == "success" and result.get("room"):
        broadcast_room_state(result["room"]["id"], result)
    return result

@router.post("/blackjack/multi/double/{hand_id}")
def blackjack_multi_double(hand_id: int, current_user: User = Depends(get_current_user)):
    """多人模式雙倍下注"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.multi_double(hand_id, current_user.id)
    if result.get("status") == "success" and result.get("room"):
        broadcast_room_state(result["room"]["id"], result)
    return result

@router.post("/blackjack/reset/{room_id}")
def blackjack_reset(room_id: int, current_user: User = Depends(get_current_user)):
    """重置房間開始新一局"""
    from blackjack_ws import broadcast_room_state
    result = blackjack_engine.reset_room(room_id, current_user.id)
    if result.get("status") == "success":
        # 重新取得房間狀態並廣播
        room_state = blackjack_engine.get_room_state(room_id)
        broadcast_room_state(room_id, room_state)
    return result

