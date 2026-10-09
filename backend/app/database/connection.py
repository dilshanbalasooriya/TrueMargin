import os
from collections.abc import Generator
import sqlite3

from sqlalchemy import Engine, event
from sqlmodel import Session, create_engine


def database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./truemargin.db")


_database_url = database_url()
_connect_args = {"check_same_thread": False} if _database_url.startswith("sqlite") else {}

engine: Engine = create_engine(
    _database_url,
    connect_args=_connect_args,
    pool_pre_ping=not _database_url.startswith("sqlite"),
)


if _database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(
        dbapi_connection: sqlite3.Connection,
        connection_record: object,
    ) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
