import os

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend_dist")

load_dotenv(os.path.join(BASE_DIR, ".env"), override=False)


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is not set")
    return value


DATABASE_URL = _required("DATABASE_URL")
SECRET_KEY = _required("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 6

APP_NAME = "Planeola"
APP_URL = os.getenv("APP_URL", "http://localhost:8000").rstrip("/")

# Served over HTTPS means a real deployment: no public API docs, and a key
# short enough to guess would let anyone forge a session token.
PRODUCTION = APP_URL.startswith("https://")
if PRODUCTION and len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters on a deployment")

# Prints verification codes and reset links to stdout. Never on a server.
ECHO_SECRETS = os.getenv("ECHO_SECRETS", "").lower() == "true"
