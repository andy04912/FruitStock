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

            # Migration 3: nickname
            if "nickname" not in columns:
                print("Migrating: Adding nickname to user table...")
                try:
                    connection.execute(text('ALTER TABLE "user" ADD COLUMN nickname VARCHAR(16) DEFAULT NULL'))
                    connection.commit()
                except Exception as e:
                    print(f"Migration Error (nickname): {e}")

            # Migration 4: nickname_updated_at
            if "nickname_updated_at" not in columns:
                print("Migrating: Adding nickname_updated_at to user table...")
                try:
                    connection.execute(text('ALTER TABLE "user" ADD COLUMN nickname_updated_at DATETIME DEFAULT NULL'))
                    connection.commit()
                except Exception as e:
                    print(f"Migration Error (nickname_updated_at): {e}")

        # Check if userdailysnapshot table exists
        if not inspector.has_table("userdailysnapshot"):
            print("Creating userdailysnapshot table...")
            try:
                connection.execute(text('''
                    CREATE TABLE IF NOT EXISTS userdailysnapshot (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        date VARCHAR(10) NOT NULL,
                        total_assets FLOAT NOT NULL,
                        cash FLOAT NOT NULL,
                        stock_value FLOAT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES user(id)
                    )
                '''))
                connection.execute(text('CREATE INDEX IF NOT EXISTS ix_userdailysnapshot_user_id ON userdailysnapshot(user_id)'))
                connection.execute(text('CREATE INDEX IF NOT EXISTS ix_userdailysnapshot_date ON userdailysnapshot(date)'))
                connection.commit()
            except Exception as e:
                print(f"Migration Error (userdailysnapshot): {e}")

        # Check if systemconfig table exists
        if not inspector.has_table("systemconfig"):
            print("Creating systemconfig table...")
            try:
                connection.execute(text('''
                    CREATE TABLE IF NOT EXISTS systemconfig (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        key VARCHAR(100) NOT NULL UNIQUE,
                        value TEXT NOT NULL,
                        description TEXT NOT NULL,
                        category VARCHAR(50) DEFAULT 'general',
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                '''))
                connection.execute(text('CREATE INDEX IF NOT EXISTS ix_systemconfig_key ON systemconfig(key)'))
                connection.commit()
            except Exception as e:
                print(f"Migration Error (systemconfig): {e}")

def get_session():
    with Session(engine) as session:
        yield session

