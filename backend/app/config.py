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

    # LLM provider
    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # External APIs
    enam_api_key: str = ""
    imd_api_key: str = ""
    openweathermap_api_key: str = ""

    # Web Push / VAPID
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@uzhavar.ai"

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

    # Inference engine
    gemini_api_key: str = ""
    inference_engine: str = "gemini"   # "gemini" | "mobilenet"

    # Pillar 3 — Market Navigator pipeline
    agmarknet_api_key: str = ""
    pipeline_root: str = "./pillar3_data"
    models_root: str = "./pillar3/models/models_all_horizons"

    # Pillar 5 — Outbreak Alert
    outbreak_detection_interval_hours: int = 6
    outbreak_cluster_radius_km: float = 10.0
    outbreak_lookback_days: int = 7
    outbreak_min_reports: int = 3
    outbreak_confidence_threshold: float = 0.70
    # FCM — set FCM_SERVER_KEY to enable real push notifications
    fcm_server_key: str = ""
    # TN Agriculture Dept webhook — set to real URL to enable
    tn_agri_webhook_url: str = ""
    # Twilio — account credentials
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    # Twilio Verify service SID (VA...) — no "from" number needed
    twilio_verify_service_sid: str = ""
    # Legacy from-number (unused when Verify is configured)
    twilio_from_number: str = ""
    tn_agri_officer_phone: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
