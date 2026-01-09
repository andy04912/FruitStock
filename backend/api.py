from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from datetime import timedelta, datetime
from typing import List, Optional
from bank import BankService
from pydantic import BaseModel

from database import get_session
from models import User, Portfolio, Stock, BonusLog, StockPriceHistory, Transaction, Watchlist, Loan, LaborLog
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_password_hash,
    verify_password,
    get_current_user,
)
from trader import Trader

router = APIRouter()

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
def buy_stock(stock_id: int, quantity: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Strict Freeze Check
    bank = BankService(session)
    bank.check_loan_expiry()
    session.refresh(current_user)
    
    if current_user.is_trading_frozen:
        raise HTTPException(status_code=403, detail=f"Account Frozen: {current_user.frozen_reason}")

    trader = Trader(session)
    return trader.buy_stock(current_user, stock_id, quantity)

@router.post("/trade/sell")
def sell_stock(stock_id: int, quantity: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Strict Freeze Check
    bank = BankService(session)
    bank.check_loan_expiry()
    session.refresh(current_user)
    
    if current_user.is_trading_frozen:
         # Exception: Allow selling if it's for LIQUIDATION? 
         # Actually, normal selling is blocked. Liquidation is special endpoint.
         # So we block this.
         raise HTTPException(status_code=403, detail=f"Account Frozen: {current_user.frozen_reason}")

    trader = Trader(session)
    return trader.sell_stock(current_user, stock_id, quantity)

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
            "username": user.username,
            "balance": user.balance,
            "net_worth": net_worth
        })
    
    leaderboard.sort(key=lambda x: x["net_worth"], reverse=True)
    return leaderboard[:10]

@router.get("/stocks")
def get_stocks(session: Session = Depends(get_session)):
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
def get_stock_history(stock_id: int, interval: str = "1m", session: Session = Depends(get_session)):
    # interval: 1m, 5m, 15m, 1h, 1d
    
    # Determine how much data to fetch
    # For now, fetch ALL history and resample in memory (Inefficient for prod, OK for sim)
    statement = select(StockPriceHistory).where(
        StockPriceHistory.stock_id == stock_id
    ).order_by(StockPriceHistory.timestamp.asc()) # Get all ascending
    
    raw_history = session.exec(statement).all()
    
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
            "time": int(d["time"].timestamp()) + 28800,
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
            "timestamp": txn.timestamp,  # Local Time (UTC+8) from db
            "total": txn.price * txn.quantity
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

# --- BANK SYSTEM API ---

class BorrowRequest(BaseModel):
    amount: float

class RepayRequest(BaseModel):
    amount: Optional[float] = None

class WorkRequest(BaseModel):
    type: str  # "NORMAL", "BUDDHA", "BLACK"
    hours: int # 2-12

class BailRequest(BaseModel):
    target_user_id: int

@router.get("/bank/status")
def get_bank_status(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    rates = bank.get_dynamic_rates()
    
    # Active Loans
    loans = session.exec(select(Loan).where(Loan.user_id == current_user.id, Loan.status.in_(["ACTIVE", "DEFAULT"]))).all()
    total_debt = sum(l.total_due for l in loans)
    
    # Active Labor
    labor = session.exec(select(LaborLog).where(LaborLog.user_id == current_user.id, LaborLog.status == "IN_PROGRESS")).first()
    labor_info = None
    if labor:
        labor_info = {
            "type": labor.type,
            "end_time": labor.end_time,
            "status": labor.status
        }
        
    # Jail Roster (for Bailout)
    all_jailed = session.exec(select(LaborLog).where(LaborLog.type == "JAIL", LaborLog.status == "IN_PROGRESS")).all()
    roster = []
    for log in all_jailed:
        u = session.get(User, log.user_id)
        if u and u.id != current_user.id: 
            # Get debt
            u_loans = session.exec(select(Loan).where(Loan.user_id == u.id, Loan.status == "DEFAULT")).all()
            debt = sum(l.total_due for l in u_loans)
            roster.append({
                "user_id": u.id,
                "username": u.username,
                "debt": debt,
                "bail_cost": debt * 1.5,
                "end_time": log.end_time
            })
            
    return {
        "rates": rates,
        "loans": loans,
        "total_debt": total_debt,
        "labor": labor_info,
        "jail_roster": roster,
        "is_frozen": current_user.is_trading_frozen,
        "frozen_reason": current_user.frozen_reason,
        "karma": current_user.karma_score
    }

@router.post("/bank/borrow")
def borrow_money(req: BorrowRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    return bank.borrow(current_user, req.amount)

@router.post("/bank/repay")
def repay_money(req: RepayRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    return bank.repay(current_user, req.amount)

@router.post("/bank/liquidate")
def liquidate_now(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    return bank.liquidate_assets(current_user)

@router.post("/bank/work")
def start_work(req: WorkRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    return bank.start_labor(current_user, f"WORK_{req.type}", req.hours)

@router.post("/bank/jail")
def go_to_jail(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    return bank.start_labor(current_user, "JAIL", 0)

@router.post("/bank/bail")
def bail_out(req: BailRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    bank = BankService(session)
    return bank.bail_user(current_user, req.target_user_id)
