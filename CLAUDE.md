# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

請使用**繁體中文**回覆使用者。

## Project Overview

A stock market simulation platform with gambling features (horse racing, slots, blackjack). Users trade fictional food-themed stocks (fruits, meats, roots), participate in casino games, and compete on leaderboards.

## Tech Stack

- **Backend**: Python 3.11+ with FastAPI, SQLModel ORM, PostgreSQL 18, Redis 7, APScheduler
- **Frontend**: React 19 + Vite, TailwindCSS, lightweight-charts, Socket.IO client, Recharts
- **Authentication**: JWT (python-jose) with bcrypt password hashing
- **Deployment**: Docker Compose (postgres, redis, backend, frontend with nginx)
- **Additional**: Lucide React icons, Sonner toast notifications

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
docker compose up -d             # Start all services in detached mode
docker compose down              # Stop and remove containers
docker compose logs backend      # View backend logs
docker compose logs -f backend   # Follow backend logs in real-time
docker compose restart backend   # Restart backend service
docker compose exec backend bash # Enter backend container shell
docker compose ps                # List running containers
```

**Port Mappings:**
- Frontend: `3002:80` (NAS port 3002 → Nginx port 80)
- PostgreSQL: `55432:5432` (exposed for external connections)
- Redis: `6379:6379`
- Backend: Exposed internally only (port 8000)

## Architecture

### Backend Core Systems

- **main.py**: FastAPI app setup, WebSocket managers, APScheduler jobs (tick every 1s, persistence every 60s)
- **api.py**: All REST API endpoints under `/api` prefix
- **admin_api.py**: Admin-only endpoints (user management, system controls) requiring `X-Admin-Key` header
- **auth.py**: JWT token generation and validation, password hashing utilities
- **database.py**: Database session management and initialization utilities
- **redis_utils.py**: Redis connection pool and helper functions for caching/pub-sub
- **market.py**: `MarketEngine` - handles stock price updates, dividends, IPO logic. Maintains in-memory state and periodically persists to DB
- **trader.py**: AI trader system that simulates market participant behavior
- **events.py**: Random market events and news generation
- **ai_service.py**: AI-powered features (event generation, content creation)
- **content_library.py**: Predefined content templates for events and news
- **race_engine.py**: Horse racing betting system with dynamic odds
- **slots_engine.py**: Slot machine gambling with configurable payouts
- **blackjack_engine.py** + **blackjack_ws.py**: Multiplayer blackjack with WebSocket rooms and game state management
- **models.py**: SQLModel definitions for all database entities

### Data Flow

1. `MarketEngine` updates stock prices in memory every second
2. Changes broadcast via WebSocket (`/api/ws`) and Redis pub/sub
3. State persisted to PostgreSQL every 60 seconds
4. Redis caches `market_stocks` for fast reads

### Frontend Structure

- **context/**:
  - `AuthContext.jsx`: JWT auth state, login/logout, token management
  - `SocketContext.jsx`: WebSocket connection with reconnection logic
- **pages/**:
  - `Dashboard.jsx`: Main trading interface with stock list and market overview
  - `StockDetailPage.jsx`: Individual stock charts, trading, and analysis
  - `RacePage.jsx`: Horse racing betting interface
  - `SlotMachine.jsx`: Slot machine gambling
  - `BlackjackPage.jsx`: Multiplayer blackjack game rooms
  - `ProfilePage.jsx`: User portfolio, transaction history, achievements
  - `LeaderboardPage.jsx`: Wealth rankings and top traders
  - `NewsPage.jsx`: Market news and event history
  - `FriendsPage.jsx`: Social features and friend management
  - `AdminPage.jsx`: Admin control panel (restricted access)
  - `Login.jsx`: Authentication page
- **components/**:
  - `charts/CandlestickChart.jsx`: Real-time candlestick charts using lightweight-charts
  - `common/`: Shared widgets (NewsTicker, LeaderboardWidget, BonusWidget)
  - `layout/Navbar.jsx`: Navigation bar with user balance and menu
  - `ui/components.jsx`: Reusable UI components

### Database Models (models.py)

**Core Trading:**
- `User`: User accounts with balance, karma_score, nickname, is_trading_frozen
- `Stock`: Stock entities with symbol, price, volatility, category, dividend_yield
- `Portfolio`: User holdings (uses BigInteger for quantity to handle large positions)
- `Transaction`: Trade history (BUY/SELL/SHORT/COVER/DIVIDEND types, BigInteger quantity)
- `StockPriceHistory`: OHLC candlestick data with timestamp indexing
- `EventLog`: Market events with impact multiplier and duration
- `Alert`: Price alerts with trigger conditions (above/below)
- `Watchlist`: User watchlists for favorite stocks
- `Prediction`: User stock price predictions
- `Achievement`: User achievement tracking

**Gambling Systems:**
- `Horse`, `Race`, `Bet`: Horse racing system
- `SlotSpin`: Slot machine play records
- `BlackjackRoom`, `BlackjackHand`: Multiplayer blackjack game state

**Social:**
- Friend relationships and social interactions

### WebSocket Endpoints

- `/api/ws` - Main market data stream (tick updates)
- `/api/ws/blackjack/{room_id}` - Per-room blackjack state

## Key Patterns

- **Real-time Architecture**: Stock prices use Redis as source of truth for real-time reads, PostgreSQL for persistence
- **WebSocket Broadcasting**: Market updates broadcast via WebSocket and Redis pub/sub to all connected clients
- **In-Memory State**: `MarketEngine` maintains stocks in memory, updates every second, persists every 60 seconds
- **API Proxy**: Frontend proxies `/api` to backend in dev mode via Vite config (`vite.config.js`)
- **Admin Access**: Admin endpoints require `X-Admin-Key` header matching `ADMIN_SECRET` env var
- **Timezone**: All timestamps use Asia/Taipei timezone (UTC+8, offset +28800)
- **BigInteger for Quantities**: Portfolio and Transaction quantities use BigInteger to handle extremely large positions
- **JWT Authentication**: Access tokens with configurable expiry (default 43200 minutes = 30 days)

## Important Implementation Notes

- **Never use `git status -uall`** - can cause memory issues on large repos
- **Stock Trading Logic**:
  - Uses real-time prices from Redis for buy/sell operations
  - Includes error tolerance in max quantity calculations
  - Implements ceiling/floor price limits to prevent extreme values
- **Blackjack**: Supports multiplayer mode with room-based WebSocket connections
- **Karma System**: Users have karma_score affecting trading privileges
- **Trading Freeze**: Users can be frozen from trading via `is_trading_frozen` flag

## Environment Variables

Backend requires `.env` file in `backend/` directory:
```env
DATABASE_URL=postgresql://user:password@postgres:5432/stock_sim
REDIS_URL=redis://redis:6379/0
ADMIN_SECRET=your_admin_secret_key_here
ACCESS_TOKEN_EXPIRE_MINUTES=43200
```

**Docker Compose Environment:**
- `TZ=Asia/Taipei` - Timezone setting for backend container
- Postgres credentials: user/password (defined in docker-compose.yml)

## Common Tasks

### Adding New Stock
Use admin API endpoints with `X-Admin-Key` header to create new stocks.

### Resetting Database
```bash
docker compose down -v  # Remove volumes
docker compose up -d    # Recreate with fresh DB
```

### Viewing Real-time Logs
```bash
docker compose logs -f backend  # Backend logs
docker compose logs -f frontend # Nginx access logs
```

### Database Migrations
Currently using SQLModel auto-creation. For schema changes:
1. Update models in `models.py`
2. Restart backend to apply changes (dev mode)
3. For production, consider adding Alembic migrations

## Testing & Verification

Backend includes verification scripts:
- `verify_race.py` - Test horse racing odds and payout logic
- `verify_odds.py` - Verify betting odds calculations
- `verify_slots.py` - Test slot machine payout distributions

## Troubleshooting

**WebSocket Connection Issues:**
- Check Redis connection in backend logs
- Verify WebSocket URL in `SocketContext.jsx`
- Ensure backend is running and accessible

**Stock Price Not Updating:**
- Check APScheduler jobs in backend logs
- Verify Redis contains `market_stocks` key
- Check `MarketEngine` initialization

**Database Connection Errors:**
- Ensure PostgreSQL container is running: `docker compose ps`
- Check DATABASE_URL format and credentials
- Verify network connectivity between containers

**Frontend Build Errors:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for React 19 compatibility issues with dependencies
- Verify Vite config for proxy settings
