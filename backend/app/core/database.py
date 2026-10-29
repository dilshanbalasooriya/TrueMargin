from typing import Generator
from sqlmodel import create_engine, Session
from app.core.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
echo = settings.DB_ECHO if settings.DB_ECHO is not None else (settings.ENVIRONMENT == "development")

engine_kwargs = {
    "echo": echo,
    "pool_pre_ping": True,
}

if not is_sqlite:
    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
else:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# Configure database engine
engine = create_engine(settings.DATABASE_URL, **engine_kwargs)


def get_db_session() -> Generator[Session, None, None]:
    """Provides a transactional database session generator."""
    with Session(engine) as session:
        yield session