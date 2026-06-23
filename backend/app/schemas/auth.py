import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SendOtpRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")


class SendOtpResponse(BaseModel):
    success: bool
    expires_in: int = 300


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerifyOtpResponse(BaseModel):
    is_new_user: bool
    # Existing farmer
    token: str | None = None
    farmer_id: uuid.UUID | None = None
    expires_at: datetime | None = None
    # New farmer
    registration_token: str | None = None
    phone: str | None = None


class RegisterRequest(BaseModel):
    phone: str | None = Field(None, pattern=r"^\d{10}$")
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
