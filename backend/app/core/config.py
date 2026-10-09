from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development")

    # Database Connection (Strictly required from ENV)
    DATABASE_URL: str = Field(
        ...,
        description="PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/dbname)",
    )

    # Supabase Auth Credentials (Strictly required from ENV)
    SUPABASE_URL: str = Field(
        ...,
        description="Supabase project URL (base project URL, not the /rest/v1 URL)",
    )
    SUPABASE_ANON_KEY: str = Field(
        ...,
        description="Supabase anonymous API key",
    )
    SUPABASE_JWT_SECRET: str = Field(
        ...,
        description="Supabase JWT secret for token verification",
    )

    # CORS Configuration
    ALLOWED_ORIGINS: str = Field(
        default="",
        description="Allowed CORS origins as a comma-separated list, e.g. http://localhost:3000,http://localhost:5173",
    )

    @field_validator("SUPABASE_URL", mode="before")
    @classmethod
    def normalize_supabase_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        normalized = value.strip().rstrip("/")
        if normalized.endswith("/rest/v1"):
            return normalized.rsplit("/rest/v1", 1)[0]
        return normalized

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()