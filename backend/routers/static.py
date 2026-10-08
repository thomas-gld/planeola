"""The built SPA. Registered after the API routers so its catch-all does not shadow them."""

import os

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core.config import FRONTEND_DIR
from core.logging import logger


def register_static(app):
    if not os.path.isdir(FRONTEND_DIR):
        logger.warning(f"No frontend build at {FRONTEND_DIR}: serving the API only.")
        return

    root = os.path.realpath(FRONTEND_DIR)
    app.mount("/assets", StaticFiles(directory=os.path.join(root, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """A file of the build if there is one, else index.html for client-side routing."""
        # An unknown API route is an error, not a page: answering 200 with the
        # app's HTML would hide a mistyped URL from its caller.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        path = os.path.realpath(os.path.join(root, full_path))
        if path.startswith(root + os.sep) and os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(root, "index.html"))
