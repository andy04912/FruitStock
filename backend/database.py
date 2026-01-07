import os
from sqlmodel import SQLModel, create_engine, Session

SQLITE_FILE_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{SQLITE_FILE_NAME}")

connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
