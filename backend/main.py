import os
import asyncio
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select
from typing import List
import json

from database import create_db_and_tables, engine, get_session
from api import router
from market import MarketEngine
from events import EventSystem
from models import Stock, EventLog, Prediction, User, Portfolio, Transaction, Watchlist, Alert, Achievement, BonusLog, Guru

# Redis Config
REDIS_URL = os.getenv("REDIS_URL")
redis_client = None

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_to_local(self, message: str):
        # Broadcast to locally connected clients
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

    async def broadcast(self, message: str):
        # If Redis is available, publish to channel
        if redis_client:
            await redis_client.publish("stock_updates", message)
        else:
            # Local mode fallback
            await self.send_to_local(message)

manager = ConnectionManager()
scheduler = AsyncIOScheduler()

# Market Systems
market_engine = MarketEngine(lambda: Session(engine))
event_system = EventSystem(lambda: Session(engine))

def tick():
    # 1. Update Prices
    market_engine.update_prices()
    
    # 2. Try Generate Event
    event_system.generate_random_event()
    
async def async_tick_job():
    # Wrapper for async operations
    tick() # Synchronous part (DB ops, price updates)
    
    # Async broadcast
    current_event = event_system.get_active_event()
    
    with Session(engine) as session:
        stocks = session.exec(select(Stock)).all()
        
        current_forecast = event_system.get_forecast()
        
        data = {
            "type": "tick",
            "stocks": [s.model_dump() for s in stocks],
            "event": current_event.model_dump() if current_event else None,
            "forecast": current_forecast
        }
    # Broadcast in async context
    await manager.broadcast(json.dumps(data, default=str))

async def redis_listener():
    """Background task to subscribe to Redis and push to local clients"""
    if not redis_client: return
    
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("stock_updates")
    print(f"[Redis] Subscribed to stock_updates channel")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await manager.send_to_local(message["data"].decode("utf-8"))
    except Exception as e:
        print(f"[Redis] Listener Error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    
    create_db_and_tables()
    market_engine.initialize_market()
    
    # Init Redis
    listener_task = None
    if REDIS_URL:
        try:
            redis_client = redis.from_url(REDIS_URL)
            print(f"[Redis] Connected to {REDIS_URL}")
            # Start listener
            listener_task = asyncio.create_task(redis_listener())
        except Exception as e:
            print(f"[Redis] Connection failed: {e}")
            redis_client = None
    
    # Weekly IPO Check (Monday 9:00 AM)
    scheduler.add_job(market_engine.attempt_weekly_ipo, 'cron', day_of_week='mon', hour=9, minute=0)

    # Root Market Dividends (Every 2 hours)
    scheduler.add_job(market_engine.payout_dividends, 'interval', hours=2)
    
    # Job runs every second
    scheduler.add_job(async_tick_job, 'interval', seconds=1)
    
    # Cleanup old news every hour (keep last 24h)
    scheduler.add_job(event_system.cleanup_old_events, 'interval', hours=1, args=[24])
    
    scheduler.start()
    
    yield
    
    scheduler.shutdown()
    if listener_task:
        listener_task.cancel()
    if redis_client:
        await redis_client.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Stock Market Simulation API"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- New Endpoints ---

@app.get("/api/news")
def get_news(limit: int = 20, session: Session = Depends(get_session)):
    events = session.exec(select(EventLog).order_by(EventLog.created_at.desc()).limit(limit)).all()
    return events

@app.get("/api/stocks/{stock_id}/news")
def get_stock_news(stock_id: int, limit: int = 10, session: Session = Depends(get_session)):
    events = session.exec(select(EventLog).where(EventLog.target_stock_id == stock_id).order_by(EventLog.created_at.desc()).limit(limit)).all()
    return events

@app.get("/api/stocks/{stock_id}/predictions")
def get_stock_predictions(stock_id: int, session: Session = Depends(get_session)):
    # Return ACTIVE predictions for specific stock
    preds = session.exec(select(Prediction).where(
        Prediction.status == "ACTIVE",
        Prediction.stock_id == stock_id
    ).order_by(Prediction.created_at.desc())).all()
    
    data = []
    for p in preds:
        item = p.model_dump()
        
        # Attach Guru Stats
        if p.guru:
            total = p.guru.total_predictions
            wins = p.guru.wins
            win_rate = round((wins / total * 100), 1) if total > 0 else 0
            
            item["guru_stats"] = {
                "wins": wins,
                "total": total,
                "win_rate": win_rate
            }
        else:
            item["guru_stats"] = None
            
        data.append(item)
    return data

@app.get("/api/predictions")
def get_predictions(session: Session = Depends(get_session)):
    # Return ACTIVE predictions with Guru stats
    preds = session.exec(select(Prediction).where(Prediction.status == "ACTIVE").order_by(Prediction.created_at.desc())).all()
    
    data = []
    for p in preds:
        item = p.model_dump()
        
        # Attach Guru Stats
        if p.guru:
            total = p.guru.total_predictions
            wins = p.guru.wins
            win_rate = round((wins / total * 100), 1) if total > 0 else 0
            
            item["guru_stats"] = {
                "wins": wins,
                "total": total,
                "win_rate": win_rate
            }
        else:
            item["guru_stats"] = None
            
        # Attach Stock Info
        if p.stock:
            item["stock_name"] = p.stock.name
            item["stock_symbol"] = p.stock.symbol
            
        data.append(item)
    return data
