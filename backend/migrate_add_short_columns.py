#!/usr/bin/env python3
"""
新增做空功能所需的資料庫欄位
"""
import os
from sqlalchemy import create_engine, text

# 從環境變數取得資料庫連線
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@127.0.0.1:55432/stock_sim")

print(f"連接資料庫: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)

# 新增欄位的 SQL
sql_statements = [
    """
    ALTER TABLE portfolio
    ADD COLUMN IF NOT EXISTS margin_locked DOUBLE PRECISION DEFAULT 0.0;
    """,
    """
    ALTER TABLE portfolio
    ADD COLUMN IF NOT EXISTS short_entry_price DOUBLE PRECISION DEFAULT NULL;
    """,
    """
    ALTER TABLE portfolio
    ADD COLUMN IF NOT EXISTS last_interest_charged TIMESTAMP DEFAULT NULL;
    """
]

try:
    with engine.connect() as conn:
        for sql in sql_statements:
            print(f"\n執行: {sql.strip()[:80]}...")
            conn.execute(text(sql))
            conn.commit()
            print("[OK] 完成")

    print("\n[SUCCESS] 資料庫 migration 成功完成！")
    print("可以重新啟動後端服務了。")

except Exception as e:
    print(f"\n[ERROR] Migration 失敗: {e}")
    raise
