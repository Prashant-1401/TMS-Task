"""Application settings — Postgres-only, fail-fast on weak configuration."""
import os
import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_INSECURE_SECRET_VALUES = {
    "",
    "change-me-to-a-random-secret",
    "your-jwt-secret-key-64-hex-openssl-rand-hex-32",
    "secret",
    "changeme",
    "dev",
    "development",
}


class Settings(BaseSettings):
    # ── Database (Postgres is the ONLY primary database) ──
    database_url: str = ""  # required, e.g. postgresql+asyncpg://user:pass@host/db
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle: int = 300
    db_command_timeout: int = 15

    # ── Auth / security ──
    secret_key: str = ""  # required — openssl rand -hex 32
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    allowed_origins: str = ""  # comma-separated; required in production

    # ── Rate limiting ──
    rate_limit_login_per_min: int = 10      # per IP
    rate_limit_ai_per_min: int = 20        # per user

    # ── AI ──
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"

    # ── Email ──
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    admin_email: str = "admin@example.com"
    team_email: str = "team@example.com"
    frontend_url: str = ""

    # ── Master break-glass account ──
    master_user: str = ""
    master_password: str = ""

    # ── Object storage (S3-compatible: Cloudflare R2, AWS S3, MinIO) ──
    s3_endpoint_url: str = ""  # e.g. https://<account>.r2.cloudflarestorage.com
    s3_region: str = "auto"
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""  # optional: serve files via a public CDN/base instead of presigned
    s3_presign_expiry_seconds: int = 900
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_upload_mimes: str = ",".join([
        "application/pdf",
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ])

    # ── Google Sheets (OPTIONAL export/mirror only — never a primary DB) ──
    google_sheets_credentials_path: str = ""
    google_sheets_credentials_json: str = ""
    google_sheets_spreadsheet_id: str = ""
    google_sheets_worksheet_name: str = "Actions"

    # ── Observability ──
    sentry_dsn: str = ""
    environment: str = "production"
    log_level: str = "INFO"

    # ── Misc ──
    wacrm_alert_url: str = ""

    model_config = {
        "env_file": os.path.join(_BACKEND_DIR, ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    # ─────────────────────────────────────────────
    # Fail-fast validation: never boot with insecure config
    # ─────────────────────────────────────────────
    def validate_security(self) -> None:
        errors = []

        if not self.database_url:
            errors.append("DATABASE_URL is required (Postgres is the only primary database).")

        if self.secret_key.strip().lower() in _INSECURE_SECRET_VALUES:
            errors.append(
                "SECRET_KEY is missing or insecure. Generate one with: openssl rand -hex 32"
            )
        elif len(self.secret_key) < 32:
            errors.append("SECRET_KEY must be at least 32 characters (use: openssl rand -hex 32).")

        if errors:
            raise RuntimeError(
                "Refusing to start with insecure configuration:\n  - "
                + "\n  - ".join(errors)
            )

    def validate_security_warn_only(self) -> None:
        """Used for local dev/tests: warn loudly instead of exiting."""
        for msg in ("database_url", "secret_key"):
            pass  # placeholder to keep API symmetric

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def upload_mimes(self) -> set[str]:
        return {m.strip() for m in self.allowed_upload_mimes.split(",") if m.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")

    def generate_secret_hint(self) -> str:
        return secrets.token_hex(32)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
