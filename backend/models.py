from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
from enum import Enum

class TransactionType(str, Enum):
    BUY = "buy"
    SELL = "sell"
    SHORT = "short"
    COVER = "cover"
    DIVIDEND = "dividend"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    balance: float = Field(default=10000.0)
    created_at: datetime = Field(default_factory=datetime.now)
    is_trading_frozen: bool = Field(default=False)
    karma_score: int = Field(default=100)
    
    # 暱稱系統（新增）
    nickname: Optional[str] = Field(default=None, max_length=16)
    nickname_updated_at: Optional[datetime] = Field(default=None)
    
    portfolios: List["Portfolio"] = Relationship(back_populates="user")
    transactions: List["Transaction"] = Relationship(back_populates="user")
    alerts: List["Alert"] = Relationship(back_populates="user")
    achievements: List["Achievement"] = Relationship(back_populates="user")
    watchlists: List["Watchlist"] = Relationship(back_populates="user")

class Stock(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, unique=True)
    name: str
    price: float
    day_open: float = Field(default=0.0)
    volatility: float = 0.02
    category: str = Field(default="FRUIT") # "FRUIT" or "MEAT"
    dividend_yield: float = Field(default=0.0)
    
    portfolios: List["Portfolio"] = Relationship(back_populates="stock")
    transactions: List["Transaction"] = Relationship(back_populates="stock")
    predictions: List["Prediction"] = Relationship(back_populates="stock")

class StockPriceHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    stock_id: int = Field(foreign_key="stock.id", index=True)
    timestamp: datetime = Field(default_factory=datetime.now, index=True)
    open: float
    high: float
    low: float
    close: float
    volume: int = Field(default=0)

class EventLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    target_stock_id: Optional[int] = Field(default=None, foreign_key="stock.id")
    impact_multiplier: float = Field(default=0.0) # e.g. 0.05 for +5%
    created_at: datetime = Field(default_factory=datetime.now)
    duration_seconds: int = Field(default=60)

class Portfolio(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    stock_id: int = Field(foreign_key="stock.id")
    quantity: int = Field(default=0)
    average_cost: float = Field(default=0.0)
    
    user: User = Relationship(back_populates="portfolios")
    stock: Stock = Relationship(back_populates="portfolios")

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    stock_id: int = Field(foreign_key="stock.id")
    type: TransactionType
    price: float
    quantity: int
    profit: Optional[float] = Field(default=None) # Realized PnL for SELL/COVER
    timestamp: datetime = Field(default_factory=datetime.now)
    
    user: User = Relationship(back_populates="transactions")
    stock: Stock = Relationship(back_populates="transactions")

class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    stock_id: int = Field(foreign_key="stock.id")
    target_price: float
    condition: str # "above" or "below"
    is_triggered: bool = Field(default=False)
    
    user: User = Relationship(back_populates="alerts")

class Achievement(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    badge_name: str
    description: str
    unlocked_at: datetime = Field(default_factory=datetime.now)

    user: User = Relationship(back_populates="achievements")

class Watchlist(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    stock_id: int = Field(foreign_key="stock.id")
    
    user: User = Relationship(back_populates="watchlists")

class BonusLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    date: str # YYYY-MM-DD
    amount: float

class Guru(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    bio: str # Persona/Style description
    wins: int = Field(default=0)
    total_predictions: int = Field(default=0)

class Prediction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    guru_id: Optional[int] = Field(default=None, foreign_key="guru.id")
    guru_name: str
    stock_id: int = Field(foreign_key="stock.id")
    target_price: float
    start_price: float
    prediction_type: str # "BULL" or "BEAR"
    description: str
    deadline: datetime
    status: str = Field(default="ACTIVE") # ACTIVE, FULFILLED, FAILED
    created_at: datetime = Field(default_factory=datetime.now)
    
    stock: Stock = Relationship(back_populates="predictions")
    guru: Optional[Guru] = Relationship()

class Horse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    speed: int = Field(default=50)   # 基礎速度 (0-100)
    stamina: int = Field(default=50) # 基礎耐力 (0-100)
    luck: int = Field(default=50)    # 運氣值 (影響突發事件)
    wins: int = Field(default=0)
    total_races: int = Field(default=0)
    status: str = Field(default="READY") # READY, RETIRED

class Race(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    start_time: datetime
    status: str = Field(default="SCHEDULED") # SCHEDULED, OPEN, CLOSED, RUNNING, FINISHED
    winner_horse_id: Optional[int] = Field(default=None, foreign_key="horse.id")
    
    # 儲存該場比賽的馬匹與賠率 (JSON 格式 snapshot)
    participants_snapshot: str 

class Bet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    race_id: int = Field(foreign_key="race.id")
    horse_id: int = Field(foreign_key="horse.id")
    amount: float
    odds: float
    result: str = Field(default="PENDING") # PENDING, WON, LOST
    payout: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.now)

class SlotSpin(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    bet_amount: float
    payout: float
    result_symbols: str  # JSON list of symbols e.g. ["🍒", "7️⃣", "💎"]
    created_at: datetime = Field(default_factory=datetime.now)
    
    user: User = Relationship()

class Friendship(SQLModel, table=True):
    """好友關係模型"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)  # 發起者
    friend_id: int = Field(foreign_key="user.id", index=True)  # 被加的人
    status: str = Field(default="PENDING")  # PENDING, ACCEPTED, REJECTED
    created_at: datetime = Field(default_factory=datetime.now)
    accepted_at: Optional[datetime] = Field(default=None)

class UserDailySnapshot(SQLModel, table=True):
    """每日資產快照，用於繪製資產走勢圖"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    date: str = Field(index=True)  # YYYY-MM-DD
    total_assets: float  # 總資產（現金 + 股票市值）
    cash: float  # 現金餘額
    stock_value: float  # 股票市值
    created_at: datetime = Field(default_factory=datetime.now)

class SystemConfig(SQLModel, table=True):
    """系統配置，可動態調整的參數"""
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)  # 參數名稱
    value: str  # 參數值（JSON 格式儲存）
    description: str  # 參數說明
    category: str = Field(default="general")  # 分類：market, race, slots, user
    updated_at: datetime = Field(default_factory=datetime.now)

# ============ 21 點相關模型 ============

class BlackjackRoom(SQLModel, table=True):
    """21 點房間"""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")  # 開房者
    name: str = Field(max_length=32)  # 房間名稱
    min_bet: float = Field(default=1000)  # 最低下注
    max_bet: Optional[float] = Field(default=None)  # 最高下注（None = 無上限）
    max_seats: int = Field(default=6)  # 座位數 1-6
    status: str = Field(default="WAITING")  # WAITING, BETTING, PLAYING, FINISHED
    current_seat: int = Field(default=0)  # 目前輪到哪個座位
    deck: str = Field(default="[]")  # 剩餘牌組 JSON
    dealer_cards: str = Field(default="[]")  # 莊家牌 JSON
    created_at: datetime = Field(default_factory=datetime.now)

class BlackjackHand(SQLModel, table=True):
    """21 點玩家手牌"""
    id: Optional[int] = Field(default=None, primary_key=True)
    room_id: int = Field(foreign_key="blackjackroom.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    seat: int = Field(default=1)  # 座位號 1-6
    bet_amount: float = Field(default=0)
    cards: str = Field(default="[]")  # 玩家牌 JSON
    status: str = Field(default="WAITING")  # WAITING, BETTING, PLAYING, STAND, BUST, BLACKJACK, WIN, LOSE, PUSH
    is_doubled: bool = Field(default=False)  # 是否雙倍
    is_split: bool = Field(default=False)  # 是否分牌
    payout: float = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)

class BlackjackHistory(SQLModel, table=True):
    """21 點歷史紀錄"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    room_id: Optional[int] = None
    bet_amount: float
    result: str  # WIN, LOSE, BLACKJACK, PUSH, BUST
    payout: float
    player_cards: str  # JSON
    dealer_cards: str  # JSON
    created_at: datetime = Field(default_factory=datetime.now)

