import uuid
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    display_name: str = Field(..., min_length=2)
    country: Optional[str] = "LK"
    currency: Optional[str] = "LKR"


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: uuid.UUID


class WorkspaceInfo(BaseModel):
    id: uuid.UUID
    name: str
    role: str  # 'owner', 'editor', 'viewer'
    country: str
    currency: str


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    country: Optional[str]
    currency: str
    rounding_preference: int
    workspaces: List[WorkspaceInfo]