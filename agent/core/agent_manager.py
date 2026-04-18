"""Agent lifecycle manager — create, query, destroy, multi-agent coordination."""

import asyncio
import logging
import uuid
import time
from typing import Dict, List, Optional

from ..models.agent import AgentState, AgentConfig, AgentSummary
from ..models.message import Message, MessageRole, AgentStatus
from ..models.knowledge import ProductKnowledge
from .knowledge_store import KnowledgeStore
from .llm_provider import LLMProvider, create_llm_provider
from .stt_provider import STTProvider, create_stt_provider
from .. import config

logger = logging.getLogger(__name__)


class AgentManager:
    """Manages multiple concurrent agents, each bound to a product."""

    def __init__(self) -> None:
        self._agents: Dict[str, AgentState] = {}
        self.knowledge_store = KnowledgeStore()
        self.llm: LLMProvider = create_llm_provider()
        self.stt: STTProvider = create_stt_provider()

    # ── Agent Lifecycle ─────────────────────────────────────────

    def create_agent(
        self,
        product_id: str,
        agent_config: Optional[AgentConfig] = None,
    ) -> AgentState:
        """Create a new agent for a product. Injects knowledge automatically."""
        if len(self._agents) >= config.MAX_AGENTS:
            raise RuntimeError(f"Max agents ({config.MAX_AGENTS}) reached")

        agent_id = f"agent_{uuid.uuid4().hex[:8]}"
        knowledge = self.knowledge_store.get(product_id)

        system_prompt = (
            agent_config.system_prompt if agent_config and agent_config.system_prompt
            else config.DEFAULT_SYSTEM_PROMPT
        )
        max_history = (
            agent_config.max_history if agent_config
            else config.MAX_HISTORY_PER_AGENT
        )
        temperature = (
            agent_config.temperature if agent_config
            else config.DEFAULT_TEMPERATURE
        )

        agent = AgentState(
            agent_id=agent_id,
            product_id=product_id,
            product_name=knowledge.product_name if knowledge else product_id,
            knowledge=knowledge,
            system_prompt=system_prompt,
            max_history=max_history,
            temperature=temperature,
        )
        self._agents[agent_id] = agent
        logger.info("Created agent %s for product %s", agent_id, product_id)
        return agent

    def destroy_agent(self, agent_id: str) -> bool:
        if agent_id in self._agents:
            del self._agents[agent_id]
            logger.info("Destroyed agent %s", agent_id)
            return True
        return False

    def get_agent(self, agent_id: str) -> Optional[AgentState]:
        return self._agents.get(agent_id)

    def list_agents(self) -> List[AgentSummary]:
        return [
            AgentSummary(
                agent_id=a.agent_id,
                product_id=a.product_id,
                product_name=a.product_name,
                status=a.status,
                message_count=len(a.history),
                created_at=a.created_at,
            )
            for a in self._agents.values()
        ]

    # ── Knowledge Injection ─────────────────────────────────────

    def inject_knowledge(
        self, agent_id: str, knowledge: ProductKnowledge
    ) -> bool:
        """Hot-swap knowledge for a running agent."""
        agent = self._agents.get(agent_id)
        if not agent:
            return False
        agent.knowledge = knowledge
        agent.product_name = knowledge.product_name
        # Also update the global store
        self.knowledge_store.inject(knowledge.product_id, knowledge)
        logger.info("Injected knowledge into agent %s (product %s, %d entries)",
                     agent_id, knowledge.product_id, len(knowledge.entries))
        return True

    def inject_knowledge_from_dict(self, agent_id: str, data: dict) -> bool:
        """Inject knowledge from raw product dict into a running agent."""
        from ..models.knowledge import product_json_to_knowledge
        knowledge = product_json_to_knowledge(data)
        return self.inject_knowledge(agent_id, knowledge)

    # ── Single Agent Ask ────────────────────────────────────────

    async def ask(self, agent_id: str, query: str) -> str:
        """Ask a question to a specific agent."""
        agent = self._agents.get(agent_id)
        if not agent:
            return "Agent not found"

        agent.status = AgentStatus.THINKING

        # Record user message
        user_msg = Message(
            role=MessageRole.USER,
            content=query,
            agent_id=agent_id,
            product_id=agent.product_id,
        )
        agent.add_message(user_msg)

        # Build knowledge context
        knowledge_ctx = agent.build_knowledge_context(query)

        # Generate answer via LLM
        answer = await self.llm.generate(
            system_prompt=agent.system_prompt,
            knowledge_context=knowledge_ctx,
            history=agent.get_context_window()[:-1],  # exclude the just-added user msg
            query=query,
            temperature=agent.temperature,
        )

        if not answer:
            answer = "当前本地资料未覆盖该问题，请尝试换一种方式提问。"

        # Record agent message
        agent_msg = Message(
            role=MessageRole.AGENT,
            content=answer,
            agent_id=agent_id,
            product_id=agent.product_id,
        )
        agent.add_message(agent_msg)
        agent.status = AgentStatus.IDLE

        return answer

    # ── Multi-Agent Ask ─────────────────────────────────────────

    async def multi_ask(
        self,
        agent_ids: List[str],
        query: str,
    ) -> Dict[str, str]:
        """Ask the same question to multiple agents concurrently.
        Returns {agent_id: answer}."""
        tasks = {
            aid: self.ask(aid, query)
            for aid in agent_ids
            if aid in self._agents
        }

        results: Dict[str, str] = {}
        if not tasks:
            return results

        done = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for aid, result in zip(tasks.keys(), done):
            if isinstance(result, Exception):
                logger.error("Multi-ask error for agent %s: %s", aid, result)
                results[aid] = f"回答出错：{result}"
            else:
                results[aid] = result  # type: ignore

        return results

    # ── Audio → Text → Answer ───────────────────────────────────

    async def ask_audio(
        self,
        agent_id: str,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
    ) -> tuple[str, str]:
        """Transcribe audio then ask. Returns (transcription, answer)."""
        text = await self.stt.transcribe(audio_bytes, mime_type)
        if not text:
            return "", "未能识别语音内容，请重试。"
        answer = await self.ask(agent_id, text)
        return text, answer

    # ── Health ──────────────────────────────────────────────────

    async def health(self) -> dict:
        llm_ok = await self.llm.health_check()
        stt_ok = await self.stt.health_check()
        return {
            "agents": len(self._agents),
            "knowledge_products": self.knowledge_store.count,
            "llm_provider": config.LLM_PROVIDER,
            "llm_healthy": llm_ok,
            "stt_provider": config.STT_PROVIDER,
            "stt_healthy": stt_ok,
        }
