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
    
    # Bank System Fields
    is_trading_frozen: bool = Field(default=False)
    frozen_reason: Optional[str] = Field(default=None)
    karma_score: int = Field(default=0) # For "Halo" effect

    portfolios: List["Portfolio"] = Relationship(back_populates="user")
    transactions: List["Transaction"] = Relationship(back_populates="user")
    alerts: List["Alert"] = Relationship(back_populates="user")
    achievements: List["Achievement"] = Relationship(back_populates="user")
    watchlists: List["Watchlist"] = Relationship(back_populates="user")
    loans: List["Loan"] = Relationship(back_populates="user")
    labor_logs: List["LaborLog"] = Relationship(back_populates="user")

class Loan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    principal: float       # Original loan amount
    surcharge: float = Field(default=0.0) # Accumulated interest/fees
    total_due: float       # principal + surcharge
    due_date: datetime
    status: str = Field(default="ACTIVE") # "ACTIVE", "PAID", "DEFAULT"
    created_at: datetime = Field(default_factory=datetime.now)
    
    user: User = Relationship(back_populates="loans")

class LaborLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    type: str              # "WORK" or "JAIL"
    start_time: datetime
    end_time: datetime     
    status: str = Field(default="IN_PROGRESS") # "IN_PROGRESS", "COMPLETED"
    earnings: float = Field(default=0.0)
    
    user: User = Relationship(back_populates="labor_logs")

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
    stock_id: int = Field(foreign_key="stock.id")
    timestamp: datetime = Field(default_factory=datetime.now)
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
