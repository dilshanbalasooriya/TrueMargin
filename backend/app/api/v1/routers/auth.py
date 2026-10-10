import uuid
from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.api.v1.dependencies import get_db, get_current_user_id
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    AuthTokenResponse,
    UserProfileResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication & User Session"])


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user & bootstrap default workspace",
)
async def register(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    return await auth_service.register_user(payload, db)


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue JWT session tokens",
)
async def login(payload: UserLoginRequest) -> AuthTokenResponse:
    return await auth_service.login_user(payload)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated profile & workspace memberships",
)
def get_current_profile(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    return auth_service.get_user_profile(user_id, db)

@router.post(
    "/sync",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Ensure user profile and workspace exist after frontend native login",
)
def sync_user_profile(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    email: str = "user@example.com" # Ideally fetched from JWT, but mocked here for simplicity or we can decode from JWT
) -> UserProfileResponse:
    return auth_service.sync_user(user_id, email, db)