import os
from sqlmodel import SQLModel, create_engine, Session

SQLITE_FILE_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{SQLITE_FILE_NAME}")

connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {
        "check_same_thread": False,
        "timeout": 15  # Increase timeout to 15 seconds
    }

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    
    # Enable WAL for SQLite
    if "sqlite" in DATABASE_URL:
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA journal_mode=WAL;")
            connection.exec_driver_sql("PRAGMA synchronous=NORMAL;")
            
    # Auto-Migration for new columns
    # We use valid SQL for both SQLite and Postgres (ADD COLUMN syntax is mostly standard)
    from sqlalchemy import text, inspect
    
    with engine.connect() as connection:
        # Check if 'user' table exists (it should after create_all)
        inspector = inspect(engine)
        if inspector.has_table("user"):
            columns = [c["name"] for c in inspector.get_columns("user")]
            
            # Migration 1: is_trading_frozen
            if "is_trading_frozen" not in columns:
                print("Migrating: Adding is_trading_frozen to user table...")
                try:
                    connection.execute(text('ALTER TABLE "user" ADD COLUMN is_trading_frozen BOOLEAN DEFAULT FALSE'))
                    connection.commit()
                except Exception as e:
                    print(f"Migration Error (is_trading_frozen): {e}")

            # Migration 2: karma_score
            if "karma_score" not in columns:
                print("Migrating: Adding karma_score to user table...")
                try:
                    connection.execute(text('ALTER TABLE "user" ADD COLUMN karma_score INTEGER DEFAULT 100'))
                    connection.commit()
                except Exception as e:
                    print(f"Migration Error (karma_score): {e}")

def get_session():
    with Session(engine) as session:
        yield session
