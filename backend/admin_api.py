"""
後台管理 API 模組
提供系統配置、股票管理、事件管理、賽馬管理等功能
"""
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Dict, Any

from database import get_session, engine
from models import (
    User, Stock, Portfolio, Transaction, Horse, Race, Bet,
    SlotSpin, EventLog, SystemConfig
)

router = APIRouter()

# ==================== 預設系統參數 ====================
# 每個參數都有說明，方便後台顯示

DEFAULT_CONFIGS = {
    # === 市場參數 ===
    "market.individual_weight": {
        "value": 0.6,
        "description": "個別股票趨勢權重 (0-1)。數值越高，股票走勢越獨立，不受市場整體影響。",
        "category": "market"
    },
    "market.market_weight": {
        "value": 0.4,
        "description": "市場整體趨勢權重 (0-1)。數值越高，股票越容易隨大盤同向波動。",
        "category": "market"
    },
    "market.major_event_market_weight": {
        "value": 0.7,
        "description": "大事件時市場權重 (0-1)。當市場處於 CRASH 或 CHAOS 時，市場影響力會提升到此數值。",
        "category": "market"
    },
    "market.herd_effect_chance": {
        "value": 0.03,
        "description": "群體效應觸發機率 (0-0.2)。每秒有此機率讓同類股票短暫同向移動。",
        "category": "market"
    },
    "market.trend_duration_min": {
        "value": 60,
        "description": "個股趨勢最短持續時間（秒）。趨勢結束後會隨機產生新趨勢方向。",
        "category": "market"
    },
    "market.trend_duration_max": {
        "value": 600,
        "description": "個股趨勢最長持續時間（秒）。",
        "category": "market"
    },
    "market.gravity_strength": {
        "value": 0.01,
        "description": "重力回歸強度 (0-0.1)。數值越高，股價越快回歸基準價。0 表示無重力。",
        "category": "market"
    },
    "market.breakthrough_chance": {
        "value": 0.02,
        "description": "突破機率 (0-0.1)。每秒有此機率讓股票無視重力，自由飛行。",
        "category": "market"
    },
    "market.regime_change_interval": {
        "value": 120,
        "description": "市場狀態變換間隔（秒）。每隔這段時間，市場有機會切換狀態（BOOM/CRASH/CHAOS/NORMAL）。",
        "category": "market"
    },
    
    # === 賽馬參數 ===
    "race.bet_deadline_seconds": {
        "value": 180,
        "description": "下注截止時間（秒）。比賽開始前多久關閉下注。",
        "category": "race"
    },
    "race.race_duration_seconds": {
        "value": 30,
        "description": "比賽時長（秒）。從起跑到終點的時間。",
        "category": "race"
    },
    "race.min_odds": {
        "value": 1.2,
        "description": "最低賠率。最強的馬的賠率下限。",
        "category": "race"
    },
    "race.max_odds": {
        "value": 10.0,
        "description": "最高賠率。最弱的馬的賠率上限。",
        "category": "race"
    },
    "race.interval_seconds": {
        "value": 300,
        "description": "比賽間隔（秒）。一場比賽結束到下一場開始的時間。",
        "category": "race"
    },
    
    # === 老虎機參數 ===
    "slots.base_rtp": {
        "value": 0.92,
        "description": "基礎回報率 (0.5-1.0)。長期而言，玩家每投入 $100 平均可拿回的金額。0.92 表示 92%。",
        "category": "slots"
    },
    "slots.jackpot_multiplier": {
        "value": 100,
        "description": "頭獎倍率。三個 7️⃣ 的獎金倍率。",
        "category": "slots"
    },
    "slots.min_bet": {
        "value": 1,
        "description": "最低下注金額。",
        "category": "slots"
    },
    "slots.max_bet": {
        "value": 1000,
        "description": "最高下注金額。",
        "category": "slots"
    },
    
    # === 用戶參數 ===
    "user.initial_balance": {
        "value": 10000,
        "description": "新用戶初始資金。註冊時獲得的起始金額。",
        "category": "user"
    },
    "user.daily_bonus": {
        "value": 100,
        "description": "每日登入獎勵金額。",
        "category": "user"
    },
    "user.dividend_interval_minutes": {
        "value": 120,
        "description": "配息間隔（分鐘）。持有 ROOT 類股票的配息頻率。",
        "category": "user"
    },
}


def get_config_value(key: str, session: Session) -> Any:
    """取得配置值，如果不存在則返回預設值"""
    config = session.exec(select(SystemConfig).where(SystemConfig.key == key)).first()
    if config:
        return json.loads(config.value)
    elif key in DEFAULT_CONFIGS:
        return DEFAULT_CONFIGS[key]["value"]
    return None


def set_config_value(key: str, value: Any, session: Session) -> bool:
    """設定配置值"""
    if key not in DEFAULT_CONFIGS:
        return False
    
    config = session.exec(select(SystemConfig).where(SystemConfig.key == key)).first()
    if config:
        config.value = json.dumps(value)
        config.updated_at = datetime.now()
    else:
        config = SystemConfig(
            key=key,
            value=json.dumps(value),
            description=DEFAULT_CONFIGS[key]["description"],
            category=DEFAULT_CONFIGS[key]["category"]
        )
    session.add(config)
    session.commit()
    return True


# ==================== 系統配置 API ====================

@router.get("/config")
def get_all_configs(session: Session = Depends(get_session)):
    """取得所有系統配置和說明"""
    result = {}
    
    for key, default in DEFAULT_CONFIGS.items():
        config = session.exec(select(SystemConfig).where(SystemConfig.key == key)).first()
        result[key] = {
            "value": json.loads(config.value) if config else default["value"],
            "description": default["description"],
            "category": default["category"],
            "is_default": config is None,
            "updated_at": config.updated_at.isoformat() if config else None
        }
    
    return result


@router.put("/config/{key}")
def update_config(key: str, body: dict, session: Session = Depends(get_session)):
    """更新單個配置值"""
    if key not in DEFAULT_CONFIGS:
        return {"status": "error", "message": f"未知的配置項: {key}"}
    
    value = body.get("value")
    if value is None:
        return {"status": "error", "message": "缺少 value 欄位"}
    
    set_config_value(key, value, session)
    return {
        "status": "success",
        "message": f"已更新 {key}",
        "new_value": value,
        "description": DEFAULT_CONFIGS[key]["description"]
    }


@router.post("/config/reset")
def reset_configs(session: Session = Depends(get_session)):
    """重置所有配置為預設值"""
    configs = session.exec(select(SystemConfig)).all()
    for c in configs:
        session.delete(c)
    session.commit()
    return {"status": "success", "message": "已重置所有配置為預設值"}


# ==================== 股票管理 API ====================

@router.get("/stocks")
def get_all_stocks(session: Session = Depends(get_session)):
    """取得所有股票詳細資訊"""
    stocks = session.exec(select(Stock)).all()
    return [
        {
            "id": s.id,
            "symbol": s.symbol,
            "name": s.name,
            "price": round(s.price, 2),
            "day_open": round(s.day_open, 2),
            "category": s.category,
            "volatility": s.volatility,
            "dividend_yield": s.dividend_yield,
            "change_pct": round((s.price - s.day_open) / s.day_open * 100, 2) if s.day_open > 0 else 0
        }
        for s in stocks
    ]


@router.put("/stocks/{stock_id}")
def update_stock(stock_id: int, body: dict, session: Session = Depends(get_session)):
    """修改股票屬性"""
    stock = session.get(Stock, stock_id)
    if not stock:
        return {"status": "error", "message": "股票不存在"}
    
    # 可修改的欄位
    if "name" in body:
        stock.name = body["name"]
    if "volatility" in body:
        stock.volatility = float(body["volatility"])
    if "dividend_yield" in body:
        stock.dividend_yield = float(body["dividend_yield"])
    if "category" in body:
        stock.category = body["category"]
    
    session.add(stock)
    session.commit()
    return {"status": "success", "message": f"已更新股票 {stock.symbol}"}


@router.post("/stocks/{stock_id}/price")
def set_stock_price(stock_id: int, body: dict, session: Session = Depends(get_session)):
    """強制設定股價"""
    stock = session.get(Stock, stock_id)
    if not stock:
        return {"status": "error", "message": "股票不存在"}
    
    new_price = body.get("price")
    if new_price is None or new_price <= 0:
        return {"status": "error", "message": "價格必須大於 0"}
    
    old_price = stock.price
    stock.price = float(new_price)
    session.add(stock)
    session.commit()
    
    return {
        "status": "success",
        "message": f"{stock.symbol} 價格從 ${old_price:.2f} 調整為 ${new_price:.2f}",
        "old_price": old_price,
        "new_price": new_price
    }


# ==================== 用戶管理 API ====================

@router.get("/users")
def get_all_users(session: Session = Depends(get_session)):
    """取得所有用戶資訊"""
    users = session.exec(select(User)).all()
    stocks = session.exec(select(Stock)).all()
    stock_map = {s.id: s.price for s in stocks}

    result = []
    for user in users:
        # 計算股票市值（正確處理空頭）
        portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == user.id)).all()
        stock_value = sum(abs(p.quantity) * stock_map.get(p.stock_id, 0) for p in portfolios)

        result.append({
            "id": user.id,
            "username": user.username,  # 真實帳號
            "nickname": user.nickname,   # 顯示暱稱
            "balance": round(user.balance, 2),
            "stock_value": round(stock_value, 2),
            "net_worth": round(user.balance + stock_value, 2),
            "is_frozen": getattr(user, 'is_trading_frozen', False),
            "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') else None
        })

    # 按淨值排序
    result.sort(key=lambda x: x['net_worth'], reverse=True)
    return result


@router.put("/users/{user_id}/balance")
def adjust_user_balance(user_id: int, body: dict, session: Session = Depends(get_session)):
    """調整用戶餘額"""
    user = session.get(User, user_id)
    if not user:
        return {"status": "error", "message": "用戶不存在"}
    
    amount = body.get("amount", 0)
    reason = body.get("reason", "管理員調整")
    
    old_balance = user.balance
    user.balance += amount
    session.add(user)
    session.commit()
    
    return {
        "status": "success",
        "message": f"已調整 {user.username} 餘額",
        "old_balance": old_balance,
        "new_balance": user.balance,
        "adjustment": amount,
        "reason": reason
    }


@router.put("/users/{user_id}/freeze")
def toggle_user_freeze(user_id: int, body: dict, session: Session = Depends(get_session)):
    """凍結/解凍用戶交易"""
    user = session.get(User, user_id)
    if not user:
        return {"status": "error", "message": "用戶不存在"}
    
    freeze = body.get("freeze", True)
    user.is_trading_frozen = freeze
    session.add(user)
    session.commit()
    
    return {
        "status": "success",
        "message": f"已{'凍結' if freeze else '解凍'} {user.username} 的交易權限",
        "is_frozen": freeze
    }


@router.get("/users/{user_id}/gambling")
def get_user_gambling_stats(user_id: int, session: Session = Depends(get_session)):
    """取得用戶賭場記錄"""
    user = session.get(User, user_id)
    if not user:
        return {"status": "error", "message": "用戶不存在"}
    
    # 賽馬
    bets = session.exec(select(Bet).where(Bet.user_id == user_id)).all()
    race_stats = {
        "total_bets": len(bets),
        "total_wagered": sum(b.amount for b in bets),
        "total_won": sum(b.payout for b in bets if b.result == "WON"),
        "wins": len([b for b in bets if b.result == "WON"]),
        "losses": len([b for b in bets if b.result == "LOST"]),
        "recent": [{"horse_name": "Unknown", "amount": b.amount, "result": b.result, "payout": b.payout} for b in bets[-10:]]
    }
    
    # 老虎機
    spins = session.exec(select(SlotSpin).where(SlotSpin.user_id == user_id)).all()
    slots_stats = {
        "total_spins": len(spins),
        "total_wagered": sum(s.bet_amount for s in spins),
        "total_won": sum(s.payout for s in spins),
        "recent": [{"bet": s.bet_amount, "payout": s.payout, "symbols": s.result_symbols} for s in spins[-10:]]
    }
    
    return {
        "user": user.username,
        "race_stats": race_stats,
        "slots_stats": slots_stats
    }


# ==================== 馬匹管理 API ====================

@router.get("/horses")
def get_all_horses(session: Session = Depends(get_session)):
    """取得所有馬匹"""
    horses = session.exec(select(Horse)).all()
    return [
        {
            "id": h.id,
            "name": h.name,
            "speed": h.speed,
            "stamina": h.stamina,
            "luck": h.luck,
            "wins": h.wins,
            "total_races": h.total_races,
            "win_rate": round(h.wins / h.total_races * 100, 1) if h.total_races > 0 else 0,
            "status": h.status
        }
        for h in horses
    ]


@router.put("/horses/{horse_id}")
def update_horse(horse_id: int, body: dict, session: Session = Depends(get_session)):
    """修改馬匹能力"""
    horse = session.get(Horse, horse_id)
    if not horse:
        return {"status": "error", "message": "馬匹不存在"}
    
    if "name" in body:
        horse.name = body["name"]
    if "speed" in body:
        horse.speed = max(0, min(100, int(body["speed"])))
    if "stamina" in body:
        horse.stamina = max(0, min(100, int(body["stamina"])))
    if "luck" in body:
        horse.luck = max(0, min(100, int(body["luck"])))
    if "status" in body:
        horse.status = body["status"]
    
    session.add(horse)
    session.commit()
    return {"status": "success", "message": f"已更新馬匹 {horse.name}"}


# ==================== 事件管理 API ====================

@router.get("/events")
def get_recent_events(limit: int = 50, session: Session = Depends(get_session)):
    """取得最近事件"""
    events = session.exec(
        select(EventLog).order_by(EventLog.created_at.desc()).limit(limit)
    ).all()
    
    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "target_stock_id": e.target_stock_id,
            "impact_multiplier": e.impact_multiplier,
            "created_at": e.created_at.isoformat(),
            "duration_seconds": e.duration_seconds
        }
        for e in events
    ]


@router.post("/events")
def create_event(body: dict, session: Session = Depends(get_session)):
    """手動觸發事件"""
    title = body.get("title", "管理員事件")
    description = body.get("description", "由管理員手動觸發")
    stock_id = body.get("stock_id")
    impact = body.get("impact", 0.05)
    duration = body.get("duration", 60)
    
    event = EventLog(
        title=title,
        description=description,
        target_stock_id=stock_id,
        impact_multiplier=impact,
        duration_seconds=duration
    )
    session.add(event)
    session.commit()
    
    return {
        "status": "success",
        "message": f"已創建事件: {title}",
        "event_id": event.id
    }


# ==================== 統計 API ====================

@router.get("/stats")
def get_system_stats(session: Session = Depends(get_session)):
    """取得系統統計"""
    users = session.exec(select(User)).all()
    stocks = session.exec(select(Stock)).all()
    
    # 計算總資產
    total_cash = sum(u.balance for u in users)
    stock_map = {s.id: s.price for s in stocks}
    
    total_stock_value = 0
    for user in users:
        portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == user.id)).all()
        for p in portfolios:
            # 正確計算市值：多頭 + 空頭（用絕對值）
            total_stock_value += abs(p.quantity) * stock_map.get(p.stock_id, 0)
    
    # 今日交易
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_txs = session.exec(
        select(Transaction).where(Transaction.timestamp >= today_start)
    ).all()
    
    return {
        "users": {
            "total": len(users),
            "total_cash": round(total_cash, 2),
            "total_stock_value": round(total_stock_value, 2),
            "total_assets": round(total_cash + total_stock_value, 2)
        },
        "stocks": {
            "total": len(stocks),
            "by_category": {
                "FRUIT": len([s for s in stocks if s.category == "FRUIT"]),
                "MEAT": len([s for s in stocks if s.category == "MEAT"]),
                "ROOT": len([s for s in stocks if s.category == "ROOT"])
            }
        },
        "today": {
            "transactions": len(today_txs),
            "buy_count": len([t for t in today_txs if t.type == "buy"]),
            "sell_count": len([t for t in today_txs if t.type == "sell"]),
            "volume": sum(t.price * t.quantity for t in today_txs)
        }
    }
