"""REST API routes for agent management."""

import base64
from typing import Optional, List

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from ..core.agent_manager import AgentManager
from ..models.agent import AgentConfig

router = APIRouter(prefix="/api", tags=["agents"])

# Will be set by main.py on startup
manager: AgentManager = None  # type: ignore


def set_manager(m: AgentManager) -> None:
    global manager
    manager = m


# ── Request / Response schemas ──────────────────────────────────

class CreateAgentRequest(BaseModel):
    product_id: str
    system_prompt: Optional[str] = None
    max_history: int = 30
    temperature: float = 0.7


class AskRequest(BaseModel):
    query: str


class MultiAskRequest(BaseModel):
    agent_ids: List[str]
    query: str


class InjectKnowledgeRequest(BaseModel):
    data: dict


class AskResponse(BaseModel):
    agent_id: str
    answer: str


class AudioAskResponse(BaseModel):
    agent_id: str
    transcription: str
    answer: str


# ── Routes ──────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return await manager.health()


@router.get("/agents")
async def list_agents():
    return manager.list_agents()


@router.post("/agents")
async def create_agent(req: CreateAgentRequest):
    try:
        cfg = AgentConfig(
            product_id=req.product_id,
            system_prompt=req.system_prompt or "",
            max_history=req.max_history,
            temperature=req.temperature,
        )
        agent = manager.create_agent(req.product_id, cfg)
        return {
            "agent_id": agent.agent_id,
            "product_id": agent.product_id,
            "product_name": agent.product_name,
        }
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))


@router.delete("/agents/{agent_id}")
async def destroy_agent(agent_id: str):
    if not manager.destroy_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "destroyed", "agent_id": agent_id}


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "agent_id": agent.agent_id,
        "product_id": agent.product_id,
        "product_name": agent.product_name,
        "status": agent.status,
        "message_count": len(agent.history),
        "history": [
            {"role": m.role, "content": m.content, "timestamp": m.timestamp}
            for m in agent.history
        ],
    }


@router.post("/agents/{agent_id}/ask", response_model=AskResponse)
async def ask_agent(agent_id: str, req: AskRequest):
    agent = manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    answer = await manager.ask(agent_id, req.query)
    return AskResponse(agent_id=agent_id, answer=answer)


@router.post("/agents/{agent_id}/audio", response_model=AudioAskResponse)
async def ask_agent_audio(
    agent_id: str,
    audio: UploadFile = File(...),
):
    agent = manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    audio_bytes = await audio.read()
    mime = audio.content_type or "audio/webm"
    transcription, answer = await manager.ask_audio(agent_id, audio_bytes, mime)
    return AudioAskResponse(
        agent_id=agent_id,
        transcription=transcription,
        answer=answer,
    )


@router.post("/agents/multi-ask")
async def multi_ask(req: MultiAskRequest):
    results = await manager.multi_ask(req.agent_ids, req.query)
    return {"query": req.query, "results": results}


@router.post("/agents/{agent_id}/knowledge")
async def inject_knowledge(agent_id: str, req: InjectKnowledgeRequest):
    if not manager.inject_knowledge_from_dict(agent_id, req.data):
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "injected", "agent_id": agent_id}


@router.get("/knowledge")
async def list_knowledge():
    return {
        "products": manager.knowledge_store.list_products(),
        "count": manager.knowledge_store.count,
    }


@router.post("/knowledge/inject")
async def inject_knowledge_global(req: InjectKnowledgeRequest):
    """Inject knowledge into global store (not bound to an agent)."""
    pid = manager.knowledge_store.inject_from_dict(req.data)
    if not pid:
        raise HTTPException(status_code=400, detail="Missing product_id in data")
    return {"status": "injected", "product_id": pid}
