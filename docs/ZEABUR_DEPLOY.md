# Zeabur 部署指南

本指南說明如何將股票模擬系統從 NAS (Docker + PostgreSQL) 部署到 Zeabur 平台。

---

## 一、架構說明

**你目前的 NAS 設定：**
```
Docker Compose
├── postgres (PostgreSQL 15)     ← 資料庫
├── redis (Redis 7)              ← 快取/WebSocket
├── backend (FastAPI)            ← 後端 API
└── frontend (React + Nginx)     ← 前端
```

**Zeabur 對應設定：**
```
Zeabur
├── PostgreSQL (Marketplace)     ← 資料庫
├── Redis (Marketplace)          ← 快取
├── Backend (Git Deploy)         ← 後端
└── Frontend (Git Deploy)        ← 前端
```

---

## 二、Zeabur 部署步驟

### Step 1: 登入 Zeabur
1. 前往 https://zeabur.com
2. 使用 GitHub 帳號登入
3. 點擊 **Create Project**
4. 選擇區域：`Asia East (Taiwan)` 或 `Asia East (Japan)`

### Step 2: 部署 PostgreSQL
1. 點擊 **Deploy Service**
2. 選擇 **Marketplace**
3. 搜尋 **PostgreSQL** → 點擊部署
4. 部署完成後，點擊 PostgreSQL 服務
5. 在 **Connect** 標籤，複製 **Connection String**

> 📝 格式類似：`postgresql://user:password@xxx.zeabur.com:5432/dbname`

### Step 3: 部署 Redis
1. 點擊 **Deploy Service** → **Marketplace**
2. 搜尋 **Redis** → 點擊部署
3. 複製連接字串

### Step 4: 部署 Backend
1. 點擊 **Deploy Service** → **Git**
2. 選擇你的 GitHub repo
3. **Root Directory**: `backend`
4. Zeabur 會自動偵測 Python 專案

**設定環境變數：** 點擊 Backend 服務 → **Variables**

| 變數名 | 值 | 說明 |
|--------|-----|------|
| `DATABASE_URL` | （PostgreSQL 連接字串） | 步驟2 複製的 |
| `REDIS_URL` | （Redis 連接字串） | 步驟3 複製的 |
| `GEMINI_API_KEY` | 你的 API Key | AI 新聞生成 |
| `ADMIN_SECRET` | 任意複雜字串 | 後台密碼 |
| `TZ` | `Asia/Taipei` | 時區 |

### Step 5: 部署 Frontend
1. 點擊 **Deploy Service** → **Git**
2. 選擇同一個 repo
3. **Root Directory**: `frontend`

**設定環境變數：**

| 變數名 | 值 | 說明 |
|--------|-----|------|
| `VITE_API_URL` | `https://你的backend網址/api` | 後端 API |

### Step 6: 綁定網域
1. 點擊 Backend 服務 → **Networking** → **Generate Domain**
   - 得到：`xxx-backend.zeabur.app`
2. 點擊 Frontend 服務 → **Networking** → **Generate Domain**
   - 得到：`xxx-frontend.zeabur.app`

> ⚠️ **重要**：Frontend 的 `VITE_API_URL` 要設成 Backend 的網址 + `/api`

---

## 三、從 NAS 遷移資料

### 方法 A：使用 pg_dump（推薦）

**在 NAS 上導出：**
```bash
# 進入 postgres 容器
docker exec -it stock_sim_db bash

# 導出資料庫
pg_dump -U user stock_sim > /tmp/backup.sql

# 離開容器
exit

# 從容器複製到主機
docker cp stock_sim_db:/tmp/backup.sql ./backup.sql
```

**下載到本地：**
```bash
scp your-nas-user@nas-ip:/path/to/backup.sql ./backup.sql
```

**導入到 Zeabur PostgreSQL：**

Zeabur 的 PostgreSQL 連接資訊在 **Connect** 標籤可以找到：
```bash
# 安裝 psql 客戶端（如果沒有）
# Windows: 安裝 PostgreSQL 會附帶
# Mac: brew install libpq

# 連接並導入
psql "postgresql://user:password@xxx.zeabur.com:5432/dbname" < backup.sql
```

### 方法 B：使用 Zeabur CLI（簡單）

```bash
# 安裝 Zeabur CLI
npm install -g zeabur

# 登入
zeabur login

# 連接資料庫（互動式）
zeabur db connect
```

---

## 四、環境變數完整列表

### Backend（後端）

```env
# 必填
DATABASE_URL=postgresql://user:password@xxx.zeabur.com:5432/dbname
REDIS_URL=redis://xxx.zeabur.com:6379
GEMINI_API_KEY=AIzaSy...
ADMIN_SECRET=你的管理員密碼

# 選填
TZ=Asia/Taipei
ACCESS_TOKEN_EXPIRE_MINUTES=43200
```

### Frontend（前端）

```env
# 必填
VITE_API_URL=https://your-backend.zeabur.app/api

# 選填（通常自動推導）
VITE_WS_URL=wss://your-backend.zeabur.app/ws
```

---

## 五、驗證部署

### 1. 檢查後端
訪問：`https://your-backend.zeabur.app/`
應該看到：`{"message": "Stock Market Simulation API"}`

### 2. 檢查 WebSocket
打開瀏覽器 Console，看是否有 WebSocket 連線成功

### 3. 測試前端
訪問前端網址，嘗試登入

### 4. 測試後台
訪問：`https://your-frontend.zeabur.app/admin`
輸入 `ADMIN_SECRET`

---

## 六、常見問題

### Q1: 前端連不上後端
**檢查 VITE_API_URL 是否正確設定**
- 必須是完整 URL：`https://xxx.zeabur.app/api`
- 修改環境變數後需要重新部署前端

### Q2: WebSocket 連不上
**確認後端 URL 使用 HTTPS**
- WebSocket 會自動轉換為 WSS

### Q3: 資料庫連線失敗
**檢查 DATABASE_URL 格式**
- 應為：`postgresql://user:password@host:port/database`
- 從 Zeabur PostgreSQL → Connect 複製

### Q4: 部署後沒有資料
**需要手動遷移**
- 使用上面「從 NAS 遷移資料」的步驟
- 或者讓系統從空資料庫開始

---

## 七、自訂網域（可選）

1. 在 Zeabur 的 **Networking** 中點擊 **Custom Domain**
2. 輸入你的網域（例如：`stock.example.com`）
3. 在你的 DNS 設定中添加 CNAME 記錄：
   ```
   stock.example.com  CNAME  xxx.zeabur.app
   ```
4. 等待 DNS 生效（幾分鐘到幾小時）

---

## 八、費用估算

Zeabur 的計費方式：
- **PostgreSQL**：約 $5/月（依資料量）
- **Redis**：約 $3/月
- **Backend**：依運算量，低流量約 $3-5/月
- **Frontend**：靜態網站通常免費或很低

預估總費用：**$10-15/月**（低流量情況）
