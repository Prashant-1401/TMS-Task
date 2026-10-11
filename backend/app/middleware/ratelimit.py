"""In-memory sliding-window rate limiter. Zero external dependencies.

Per-worker (each gunicorn worker keeps its own counters) — good enough for
brute-force damping and AI-endpoint cost control. For stricter global limits,
front the app with a CDN/WAF (e.g. Cloudflare) — see PRODUCTION_SETUP.md.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings

_buckets: dict[str, deque] = defaultdict(deque)
_LAST_SWEEP = {"t": time.monotonic()}


def _sweep(now: float) -> None:
    """Drop stale windows occasionally to bound memory."""
    if now - _LAST_SWEEP["t"] < 300:
        return
    _LAST_SWEEP["t"] = now
    for key in [k for k, w in _buckets.items() if not w or (w and w[-1] < now - 3600)]:
        _buckets.pop(key, None)


def hit(key: str, limit: int, window_seconds: int = 60) -> bool:
    """Record an event. Returns True if allowed, False if over limit."""
    now = time.monotonic()
    _sweep(now)
    window = _buckets[key]
    cutoff = now - window_seconds
    while window and window[0] < cutoff:
        window.popleft()
    if len(window) >= limit:
        return False
    window.append(now)
    return True


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_login_rate(request: Request) -> None:
    """Call at the top of login/master-login handlers."""
    key = f"login:{client_ip(request)}"
    if not hit(key, settings.rate_limit_login_per_min):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Try again in a minute.",
            headers={"Retry-After": "60"},
        )


def check_ai_rate(user_key: str) -> None:
    """Call at the top of AI endpoints (keyed by username)."""
    key = f"ai:{user_key}"
    if not hit(key, settings.rate_limit_ai_per_min):
        raise HTTPException(
            status_code=429,
            detail="AI request limit reached. Please wait a moment.",
            headers={"Retry-After": "60"},
        )
