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
    # Enable Write-Ahead Logging (WAL) mode for better concurrency
    if "sqlite" in DATABASE_URL:
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA journal_mode=WAL;")
            connection.exec_driver_sql("PRAGMA synchronous=NORMAL;")

def get_session():
    with Session(engine) as session:
        yield session
