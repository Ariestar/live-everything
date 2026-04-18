"""AR Product Guide — Agent Service Entry Point."""

import logging
import uvicorn
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .core.agent_manager import AgentManager
from .api.routes import router as api_router, set_manager
from .api.websocket import websocket_endpoint
from . import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

agent_manager = AgentManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ─────────────────────────────────────────────
    set_manager(agent_manager)

    # Load knowledge from data/ directory
    loaded = agent_manager.knowledge_store.load_all_from_dir()
    logger.info("Loaded knowledge for %d products: %s", len(loaded), loaded)

    health = await agent_manager.health()
    logger.info("System health: %s", health)

    yield

    # ── Shutdown ────────────────────────────────────────────
    logger.info("Shutting down agent service")


app = FastAPI(
    title="AR Product Guide — Agent Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.websocket("/ws")
async def ws_route(ws: WebSocket):
    await websocket_endpoint(ws, agent_manager)


def start():
    uvicorn.run(
        "agent.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )


if __name__ == "__main__":
    start()
