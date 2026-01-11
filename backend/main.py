import os
import asyncio
try:
    import redis.asyncio as redis
except ImportError:
    redis = None
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select
from typing import List
import json

from database import create_db_and_tables, engine, get_session
from api import router
from models import Stock, EventLog, Prediction
from race_engine import RaceEngine
from market import MarketEngine
from events import EventSystem

# Redis Config
# REDIS_URL = os.getenv("REDIS_URL") # Removed
redis_client = None

from redis_utils import get_redis, close_redis

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
race_engine = RaceEngine(lambda: Session(engine))

def tick():
    # 1. Update Prices
    market_engine.update_prices()
    
    # 2. Try Generate Event
    event_system.generate_random_event()
    
    # 3. Race Loop
    race_engine.process_race_loop()
    
async def async_tick_job():
    # Wrapper for async operations
    tick() # Synchronous part (updates memory)
    
    # Async broadcast
    current_event = event_system.get_active_event()
    
    # Use In-Memory Stocks (No DB Read)
    # Ensure cache is loaded (tick should have loaded it if needed)
    stocks_data = [s.model_dump() for s in market_engine.active_stocks]
    
    with Session(engine) as session:
        # stocks = session.exec(select(Stock)).all() # REMOVED DB READ
        
        current_forecast = event_system.get_forecast()
        
        # Get Race Info for Broadcast (Optional, or just let frontend poll)
        current_race = race_engine.get_current_race(session)
        race_info = None
        if current_race:
            race_info = {
                "id": current_race.id,
                "status": current_race.status,
                "start_time": current_race.start_time,
                "winner_id": current_race.winner_horse_id
            }

        data = {
            "type": "tick",
            "stocks": stocks_data,
            "event": current_event.model_dump() if current_event else None,
            "forecast": current_forecast,
            "race": race_info
        }
    
    # Validated: Redis persistence in tick job
    # Use get_redis util to ensure we have the connection
    from redis_utils import get_redis
    client = await get_redis()
    if client:
        try:
            # SAVE LATEST STATE TO REDIS
            await client.set("market_stocks", json.dumps(stocks_data, default=str))
        except Exception as e:
            print(f"Redis Save Error: {e}")

    # Broadcast in async context
    await manager.broadcast(json.dumps(data, default=str))

async def redis_listener():
    """Background task to subscribe to Redis and push to local clients"""
    client = await get_redis()
    if not client: return
    
    pubsub = client.pubsub()
    await pubsub.subscribe("stock_updates")
    print(f"[Redis] Subscribed to stock_updates channel")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await manager.send_to_local(message["data"]) # already decoded if decode_responses=True
    except Exception as e:
        print(f"[Redis] Listener Error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init Redis via Utils
    redis_client = await get_redis()
    
    create_db_and_tables()
    
    # TRY RESTORE FROM REDIS
    restored = False
    if redis_client:
        try:
            cached = await redis_client.get("market_stocks")
            if cached:
                market_engine.load_from_dict(json.loads(cached))
                restored = True
        except Exception as e:
            print(f"Redis Restore Error: {e}")
            
    if not restored:
        market_engine.initialize_market()
        market_engine.load_cache() # Fallback to DB
        
    race_engine.initialize_horses()
    
    # Init Redis Listener
    listener_task = None
    if redis_client:
        listener_task = asyncio.create_task(redis_listener())
    
    # Weekly IPO Check (Monday 9:00 AM)
    scheduler.add_job(market_engine.attempt_weekly_ipo, 'cron', day_of_week='mon', hour=9, minute=0)

    # Root Market Dividends (Every 2 hours for production)
    scheduler.add_job(market_engine.payout_dividends, 'interval', minutes=120)
    
    # PERSISTENCE JOB: Flush memory to DB every 60 seconds (Reduce Disk I/O)
    scheduler.add_job(market_engine.persist_state, 'interval', seconds=60)
    
    # Job runs every second (Updates Memory Only)
    scheduler.add_job(async_tick_job, 'interval', seconds=1)
    
    # Cleanup old news every hour (keep last 24h)
    scheduler.add_job(event_system.cleanup_old_events, 'interval', hours=1, args=[24])
    
    scheduler.start()
    
    yield
    
    scheduler.shutdown()
    if listener_task:
        listener_task.cancel()
    await close_redis()

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
