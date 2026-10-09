from typing import Generator
from sqlmodel import create_engine, Session
from app.core.config import settings

# Configure connection pooling for production PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    echo=(settings.ENVIRONMENT == "development"),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)


def get_db_session() -> Generator[Session, None, None]:
    """Provides a transactional database session generator."""
    with Session(engine) as session:
        yield session