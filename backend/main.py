import logging
import time
import traceback
from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI, Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.types import ExceptionHandler

from core.config import APP_NAME, APP_URL, PRODUCTION
from core.limiter import limiter
from core.logging import logger
from db import engine
from routers import assignments, auth, holidays, mailing, members, options, submissions
from routers.static import register_static


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {APP_NAME} — public URL: {APP_URL}")
    yield
    await engine.dispose()


# The interactive API docs help in development; a deployment does not publish them.
app = FastAPI(
    lifespan=lifespan,
    docs_url=None if PRODUCTION else "/docs",
    redoc_url=None if PRODUCTION else "/redoc",
    openapi_url=None if PRODUCTION else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(ExceptionHandler, _rate_limit_exceeded_handler))


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    # A reset link carries its token in the URL: never hand it to another site.
    response.headers["Referrer-Policy"] = "same-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # 'unsafe-inline' is what Tailwind and React's inline styles/scripts need.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self' data:; "
        "connect-src 'self';"
    )
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Logs failed API calls only."""
    if not request.url.path.startswith("/api"):
        return await call_next(request)

    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        logger.error(
            f"✗ {request.method} {request.url.path} "
            f"| Unhandled exception: {exc} ({elapsed:.0f}ms)\n"
            + traceback.format_exc()
        )
        raise

    if response.status_code >= 400:
        elapsed = (time.perf_counter() - start) * 1000
        logger.log(
            logging.ERROR if response.status_code >= 500 else logging.WARNING,
            f"{request.method} {request.url.path} "
            f"| status={response.status_code} | {elapsed:.0f}ms",
        )
    return response


for module in (auth, members, submissions, assignments, holidays, options, mailing):
    app.include_router(module.router)

# Last, so the SPA catch-all doesn't shadow the API.
register_static(app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
