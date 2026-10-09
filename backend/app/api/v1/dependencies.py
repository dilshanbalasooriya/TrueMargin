import uuid
from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient, PyJWTError
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_db_session
from app.models import Workspace, WorkspaceMember

security = HTTPBearer()

# Dynamic JWKS client that automatically fetches & caches Supabase public signing keys
JWKS_URL = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)


def get_db() -> Generator[Session, None, None]:
    """Database session dependency wrapper."""
    yield from get_db_session()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """
    Decodes Supabase Auth JWT token and extracts the authenticated user's UUID.
    Supports modern RS256/ES256 asymmetric JWKS keys with fallback to legacy HS256 secret.
    """
    token = credentials.credentials
    try:
        # 1. Attempt dynamic verification via Supabase public JWKS key set
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256", "HS256"],
            options={"verify_aud": False},
        )
        user_id_str: str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing sub claim.",
            )
        return uuid.UUID(user_id_str)

    except (PyJWTError, Exception):
        # 2. Fallback check for legacy static HS256 secret
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            user_id_str = payload.get("sub")
            if not user_id_str:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload: missing sub claim.",
                )
            return uuid.UUID(user_id_str)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate authentication credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )


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