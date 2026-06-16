import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    phone: str | None = Field(None, pattern=r"^\d{10}$", description="10-digit mobile number")
    name: str | None = Field(None, max_length=100)
    district: str = Field(..., min_length=2, max_length=60)
    village: str | None = Field(None, max_length=100)
    language: str = Field("ta", pattern=r"^(ta|hi|en)$")


class LoginRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")


class TokenResponse(BaseModel):
    farmer_id: uuid.UUID
    token: str
    expires_at: datetime


class LogoutRequest(BaseModel):
    token: str
