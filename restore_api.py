
import os

file_path = "backend/api.py"

# Read original content
with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

# Find the start of corruption (where we appended)
cut_index = -1
for i, line in enumerate(lines):
    if "def get_user_full_profile" in line:
        cut_index = i
        break

if cut_index != -1:
    lines = lines[:cut_index]
    print(f"Truncating at line {cut_index}")
else:
    print("Could not find split point, appending to end (or file was already truncated?)")
    # If not found, maybe it's cleaner to just append if we are sure?
    # But if it's corrupted differently...
    # Let's assume we keep what we have if we don't find it, but we know it's there.

# New content to append
new_code = r'''
@router.get("/users/{user_id}/full_profile")
def get_user_full_profile(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """取得指定用戶的完整個人檔案（公開資訊）"""
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 1. 計算資產
    portfolios = session.exec(select(Portfolio).where(Portfolio.user_id == user_id)).all()
    stocks = session.exec(select(Stock)).all()
    stock_map = {s.id: s}
    
    stock_value = 0
    holdings_data = []
    
    for p in portfolios:
        stock = stock_map.get(p.stock_id)
        if stock:
            # 確保使用絕對值計算市值（空頭也是資產負債的一部份，但在這裡視為曝險價值，或依您的邏輯計算）
            # 這裡簡化：多頭市值 + 空頭市值（絕對值）
            s_val = abs(p.quantity) * stock.price
            stock_value += s_val
            
            holdings_data.append({
                "stock_id": p.stock_id,
                "quantity": p.quantity,
                "average_cost": p.average_cost,
                "stock": {
                    "id": stock.id,
                    "symbol": stock.symbol,
                    "name": stock.name,
                    "price": stock.price
                }
            })
            
    total_assets = target_user.balance + stock_value
    unrealized_pnl = 0 
    # 簡單計算未實現損益 (Frontend calculate accurately usually, but we can provide base)
    for p in portfolios:
        stock = stock_map.get(p.stock_id)
        if stock and p.quantity != 0:
            if p.quantity > 0:
                unrealized_pnl += (stock.price - p.average_cost) * p.quantity
            else:
                unrealized_pnl += (p.average_cost - stock.price) * abs(p.quantity)

    # 2. Race Stats
    race_bets = session.exec(select(Bet).where(Bet.user_id == user_id)).all()
    race_stats = {
        "total_bets": len(race_bets),
        "total_wagered": sum(b.amount for b in race_bets),
        "wins": len([b for b in race_bets if b.status == "WON"]),
        "total_won": sum(b.payout for b in race_bets if b.status == "WON"),
    }
    race_stats["net_profit"] = race_stats["total_won"] - race_stats["total_wagered"]

    # 3. Slots Stats
    slot_spins = session.exec(select(SlotSpin).where(SlotSpin.user_id == user_id)).all()
    slots_stats = {
        "total_spins": len(slot_spins),
        "total_wagered": sum(s.bet_amount for s in slot_spins),
        "total_won": sum(s.payout for s in slot_spins)
    }
    slots_stats["net_profit"] = slots_stats["total_won"] - slots_stats["total_wagered"]

    # 4. Asset History (Limit to last 30 days)
    history = session.exec(
        select(UserDailySnapshot)
        .where(UserDailySnapshot.user_id == user_id)
        .order_by(UserDailySnapshot.date.asc())
        .limit(30)
    ).all()
    
    # 5. Recent Transactions (Limit 10)
    transactions = session.exec(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.timestamp.desc())
        .limit(10)
    ).all()
    
    # Construct Profile Object matching frontend expectations
    profile_data = {
        "id": target_user.id,
        "username": target_user.username,
        "nickname": target_user.nickname,
        "balance": target_user.balance,
        "stock_value": stock_value,
        "total_assets": total_assets,
        "unrealized_pnl": unrealized_pnl,
        "realized_pnl": 0, # Difficult to calc on fly without field, leave 0 or implement later
        "nickname_updated_at": target_user.nickname_updated_at,
        "race_stats": race_stats,
        "slots_stats": slots_stats
    }

    return {
        "profile": profile_data,
        "asset_history": history,
        "holdings": portfolios, # Frontend expects raw portfolio list for parsing
        "transactions": transactions,
        "stocks": [s for s in stocks] # Return basic stock list for mapping
    }
'''

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
    f.write("\n")
    f.write(new_code)

print("Restored api.py")
