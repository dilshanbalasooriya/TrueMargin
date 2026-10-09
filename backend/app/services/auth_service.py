import uuid
import httpx
from typing import List
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Profile, Workspace, WorkspaceMember
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    AuthTokenResponse,
    UserProfileResponse,
    WorkspaceInfo,
)


class AuthService:
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL.rstrip("/")
        self.anon_key = settings.SUPABASE_ANON_KEY

    def _get_headers(self) -> dict:
        return {
            "apikey": self.anon_key,
            "Content-Type": "application/json",
        }

    async def register_user(
        self, payload: UserRegisterRequest, db: Session
    ) -> AuthTokenResponse:
        """
        1. Registers user with Supabase Auth REST API.
        2. Creates profile record in PostgreSQL.
        3. Bootstraps default personal workspace and sets ownership.
        """
        signup_url = f"{self.supabase_url}/auth/v1/signup"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                signup_url,
                headers=self._get_headers(),
                json={
                    "email": payload.email,
                    "password": payload.password,
                    "data": {"display_name": payload.display_name},
                },
            )

        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=response.status_code,
                detail=error_data.get("msg") or error_data.get("error_description") or "Registration failed.",
            )

        data = response.json()
        user_id = uuid.UUID(data["user"]["id"])
        session_data = data.get("session")

        # Fallback if email confirmation is enabled on Supabase
        access_token = session_data["access_token"] if session_data else ""
        refresh_token = session_data["refresh_token"] if session_data else ""
        expires_in = session_data.get("expires_in", 3600) if session_data else 0

        try:
            # Step 2: Create local profile
            profile = Profile(
                id=user_id,
                display_name=payload.display_name,
                country=payload.country,
                currency=payload.currency or "LKR",
            )
            db.add(profile)

            # Step 3: Create default workspace
            default_workspace = Workspace(
                owner_id=user_id,
                name=f"{payload.display_name}'s Workspace",
                country=payload.country or "LK",
                currency=payload.currency or "LKR",
            )
            db.add(default_workspace)
            db.flush()  # Generates default_workspace.id

            # Step 4: Assign owner membership
            membership = WorkspaceMember(
                workspace_id=default_workspace.id,
                user_id=user_id,
                role="owner",
            )
            db.add(membership)
            db.commit()

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to bootstrap user workspace profile: {str(e)}",
            )

        return AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            user_id=user_id,
        )

    async def login_user(self, payload: UserLoginRequest) -> AuthTokenResponse:
        """Authenticates user credentials against Supabase Auth API."""
        token_url = f"{self.supabase_url}/auth/v1/token?grant_type=password"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                headers=self._get_headers(),
                json={
                    "email": payload.email,
                    "password": payload.password,
                },
            )

        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_data.get("error_description") or "Invalid email or password.",
            )

        data = response.json()
        return AuthTokenResponse(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            expires_in=data["expires_in"],
            user_id=uuid.UUID(data["user"]["id"]),
        )

    def get_user_profile(self, user_id: uuid.UUID, db: Session) -> UserProfileResponse:
        """Retrieves user profile and active workspace memberships."""
        profile = db.get(Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found.",
            )

        # Query memberships and workspace details
        statement = (
            select(WorkspaceMember, Workspace)
            .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id)
        )
        results = db.exec(statement).all()

        workspaces_list: List[WorkspaceInfo] = []
        for member, workspace in results:
            workspaces_list.append(
                WorkspaceInfo(
                    id=workspace.id,
                    name=workspace.name,
                    role=member.role,
                    country=workspace.country,
                    currency=workspace.currency,
                )
            )

        return UserProfileResponse(
            id=profile.id,
            display_name=profile.display_name,
            country=profile.country,
            currency=profile.currency,
            rounding_preference=profile.rounding_preference or 2,
            workspaces=workspaces_list,
        )


auth_service = AuthService()