import os

import uvicorn

from backend.app.main import app


if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host="127.0.0.1",
            port=int(os.getenv("PORT", "8012")),
        reload=os.getenv("TREATMENTPATH_RELOAD", "0") == "1",
    )
