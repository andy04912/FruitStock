# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

請使用**繁體中文**回覆使用者。

## Project Overview

A stock market simulation platform with gambling features (horse racing, slots, blackjack). Users trade fictional food-themed stocks (fruits, meats, roots), participate in casino games, and compete on leaderboards.

## Tech Stack

- **Backend**: Python FastAPI with SQLModel ORM, PostgreSQL database, Redis for caching/pub-sub
- **Frontend**: React 19 + Vite, TailwindCSS, lightweight-charts for candlestick charts
- **Deployment**: Docker Compose (postgres, redis, backend, frontend with nginx)

## Development Commands

### Backend (from `backend/` directory)
```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8080
```

### Frontend (from `frontend/` directory)
```bash
npm install
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run lint     # ESLint
```

### Docker (from root directory)
```bash
docker compose up -d          # Start all services
docker compose down           # Stop services
docker compose logs backend   # View backend logs
```

## Architecture

### Backend Core Systems

- **main.py**: FastAPI app setup, WebSocket managers, APScheduler jobs (tick every 1s, persistence every 60s)
- **api.py**: All REST API endpoints under `/api` prefix
- **market.py**: `MarketEngine` - handles stock price updates, dividends, IPO logic. Maintains in-memory state and periodically persists to DB
- **race_engine.py**: Horse racing betting system
- **slots_engine.py**: Slot machine gambling
- **blackjack_engine.py** + **blackjack_ws.py**: Multiplayer blackjack with WebSocket rooms
- **events.py**: Random market events and news generation

### Data Flow

1. `MarketEngine` updates stock prices in memory every second
2. Changes broadcast via WebSocket (`/api/ws`) and Redis pub/sub
3. State persisted to PostgreSQL every 60 seconds
4. Redis caches `market_stocks` for fast reads

### Frontend Structure

- **context/**: `AuthContext` (JWT auth), `SocketContext` (WebSocket connection)
- **pages/**: Main views - Dashboard, StockDetailPage, RacePage, SlotMachine, BlackjackPage, ProfilePage
- **components/charts/**: `CandlestickChart.jsx` using lightweight-charts library

### Database Models (models.py)

Key entities: `User`, `Stock`, `Portfolio`, `Transaction`, `StockPriceHistory`, `Horse`, `Race`, `Bet`, `SlotSpin`, `BlackjackRoom`, `BlackjackHand`

### WebSocket Endpoints

- `/api/ws` - Main market data stream (tick updates)
- `/api/ws/blackjack/{room_id}` - Per-room blackjack state

## Key Patterns

- Stock prices use Redis as source of truth for real-time reads, DB for persistence
- Frontend proxies `/api` to backend in dev via Vite config
- Admin endpoints require `X-Admin-Key` header matching `ADMIN_SECRET` env var
- Time display uses +28800 offset for Asia/Taipei timezone

## Environment Variables

Backend requires `.env` file with:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ADMIN_SECRET` - Admin API authentication key
- `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT expiry
