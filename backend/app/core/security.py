import jwt
from typing import Dict, Any
from fastapi import HTTPException, status
from app.core.config import settings  # Contains SUPABASE_JWT_SECRET

def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Decodes and verifies a JWT token issued by Supabase Auth.
    Ensures token signature, expiration, and 'authenticated' audience.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )