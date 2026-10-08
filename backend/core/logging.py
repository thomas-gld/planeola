import logging
import logging.handlers
import os

from core.config import BASE_DIR

_formatter = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_formatter)
logging.basicConfig(level=logging.INFO, handlers=[_console_handler])

logger = logging.getLogger("planeola")

_log_dir = os.path.join(BASE_DIR, "logs")
os.makedirs(_log_dir, exist_ok=True)
# One file per day, 180 kept: the privacy policy promises logs (emails, IPs)
# are kept six months at most.
_file_handler = logging.handlers.TimedRotatingFileHandler(
    os.path.join(_log_dir, "app.log"), when="midnight", backupCount=180, encoding="utf-8"
)
_file_handler.setFormatter(_formatter)
# On our logger, not the root one, so the file only holds what the app says.
logger.addHandler(_file_handler)
