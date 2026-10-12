import uuid
import logging
from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient, PyJWKClientConnectionError, PyJWKClientError, PyJWTError
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_db_session
from app.models import Workspace, WorkspaceMember

security = HTTPBearer()

# Dynamic JWKS client that automatically fetches & caches Supabase public signing keys
JWKS_URL = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)
logger = logging.getLogger(__name__)


def get_db() -> Generator[Session, None, None]:
    """Database session dependency wrapper."""
    yield from get_db_session()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """
    Decodes Supabase Auth JWT token and extracts the authenticated user's UUID.
    Supports modern RS256/ES256 JWKS keys and legacy HS256 secret-based tokens.
    """
    token = credentials.credentials
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
    except PyJWTError as error:
        logger.warning("Rejected Supabase JWT with an invalid header.")
        raise unauthorized from error

    if algorithm == "HS256":
        signing_key = settings.SUPABASE_JWT_SECRET
    elif algorithm in {"RS256", "ES256"}:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token).key
        except PyJWKClientConnectionError as error:
            logger.error("Could not reach Supabase JWKS endpoint.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication signing keys are temporarily unavailable.",
            ) from error
        except PyJWKClientError as error:
            logger.warning("Supabase JWKS lookup failed (%s).", type(error).__name__)
            raise unauthorized from error
    else:
        raise unauthorized

    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=[algorithm],
            options={"verify_aud": False},
        )
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise unauthorized
        return uuid.UUID(user_id_str)
    except (PyJWTError, ValueError, TypeError) as error:
        logger.warning("Supabase JWT verification failed (%s).", type(error).__name__)
        raise unauthorized from error


class WorkspaceAccess:
    """
    Dependency class that verifies if the authenticated user has access
    to a specific workspace with at least the required role level.
    """

    def __init__(self, required_role: str = "viewer"):
        self.required_role = required_role
        self.role_hierarchy = {"viewer": 1, "editor": 2, "owner": 3}

    def __call__(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID = Depends(get_current_user_id),
        db: Session = Depends(get_db),
    ) -> Workspace:
        workspace = db.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found.",
            )

        stmt = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        member = db.exec(stmt).first()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this workspace.",
            )

        user_level = self.role_hierarchy.get(member.role, 0)
        required_level = self.role_hierarchy.get(self.required_role, 3)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires '{self.required_role}' permission level.",
            )

        return workspace