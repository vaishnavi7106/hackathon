from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://uzhavar:uzhavar@localhost:5432/uzhavar"
    database_url_sync: str = "postgresql+psycopg2://uzhavar:uzhavar@localhost:5432/uzhavar"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # LLM provider — set LLM_PROVIDER to switch implementations
    # Supported: "gemini" (default). Future: "openai", "anthropic", "ollama"
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # External APIs
    enam_api_key: str = ""
    imd_api_key: str = ""

    # Media storage
    media_storage: str = "local"
    local_media_path: str = "./media"
    aws_s3_bucket: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # App
    app_env: str = "development"
    log_level: str = "info"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
