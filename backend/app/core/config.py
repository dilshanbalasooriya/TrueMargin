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
    ALLOW_ORIGIN_REGEX: str | None = Field(
        default=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
        description="Regex pattern for dynamically allowed origins in CORS (e.g. local IP testing)",
    )

    # Database Pool & Engine Configuration
    DB_POOL_SIZE: int = Field(default=10, description="Database connection pool size")
    DB_MAX_OVERFLOW: int = Field(default=20, description="Database pool max overflow connections")
    DB_ECHO: bool | None = Field(
        default=None,
        description="SQLAlchemy echo SQL queries (defaults to True in development)",
    )

    # Supabase JWT Verification Settings
    SUPABASE_JWT_ALGORITHM: str = Field(default="HS256", description="Supabase JWT token algorithm")
    SUPABASE_JWT_AUDIENCE: str = Field(default="authenticated", description="Supabase JWT expected audience")

    # Application & API Routing Settings
    PROJECT_NAME: str = Field(default="Unit Cost SaaS API", description="FastAPI project name")
    PROJECT_VERSION: str = Field(default="1.0.0", description="API version")
    API_V1_PREFIX: str = Field(default="/api/v1", description="API v1 prefix")
    DOCS_URL: str | None = Field(default="/docs", description="Interactive API docs endpoint")
    REDOC_URL: str | None = Field(default="/redoc", description="ReDoc endpoint")
    OPENAPI_URL: str | None = Field(default="/openapi.json", description="OpenAPI schema endpoint")

    # Workspace & Localization Defaults
    DEFAULT_CURRENCY: str = Field(default="LKR", description="Default workspace currency")
    DEFAULT_COUNTRY: str = Field(default="LK", description="Default workspace country")

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