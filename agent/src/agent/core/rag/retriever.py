"""RAG Retriever — query vector store and format context for LLM."""

import logging
from typing import List, Optional

from .vector_store import VectorStore, RetrievalResult
from ... import config

logger = logging.getLogger(__name__)


class RAGRetriever:
    """High-level retrieval interface for the agent system."""

    def __init__(self, vector_store: VectorStore):
        self.store = vector_store

    def retrieve(
        self,
        product_id: str,
        query: str,
        top_k: int = config.RAG_TOP_K,
        score_threshold: float = config.RAG_SCORE_THRESHOLD,
        category_filter: Optional[str] = None,
    ) -> List[RetrievalResult]:
        """Retrieve relevant chunks for a product-specific query."""
        return self.store.query(
            product_id=product_id,
            query_text=query,
            top_k=top_k,
            score_threshold=score_threshold,
            category_filter=category_filter,
        )

    def retrieve_global(
        self,
        query: str,
        product_ids: Optional[List[str]] = None,
        top_k: int = config.RAG_TOP_K,
    ) -> List[RetrievalResult]:
        """Retrieve across all or specific product collections."""
        return self.store.query_global(
            query_text=query,
            product_ids=product_ids,
            top_k=top_k,
        )

    def build_context(
        self,
        product_id: str,
        product_name: str,
        query: str,
        top_k: int = config.RAG_TOP_K,
        score_threshold: float = config.RAG_SCORE_THRESHOLD,
    ) -> str:
        """Retrieve and format context string ready for LLM injection."""
        results = self.retrieve(
            product_id=product_id,
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        if not results:
            return ""

        parts = [f"以下是关于「{product_name}」的相关知识（按相关性排序）："]
        seen_texts: set[str] = set()

        for r in results:
            # Deduplicate near-identical chunks
            text_key = r.chunk_text[:100]
            if text_key in seen_texts:
                continue
            seen_texts.add(text_key)

            cat_label = {
                "faq": "常见问题",
                "spec": "规格参数",
                "selling_point": "核心卖点",
                "audience": "目标人群",
                "use_case": "使用场景",
                "tagline": "商品简介",
                "description": "详细描述",
            }.get(r.category, r.category)

            parts.append(f"\n【{cat_label}】\n{r.chunk_text}")

        context = "\n".join(parts)
        logger.debug("Built RAG context for '%s' (query='%s'): %d chars, %d chunks",
                      product_id, query[:30], len(context), len(results))
        return context

    def build_multi_product_context(
        self,
        query: str,
        product_ids: List[str],
        top_k: int = config.RAG_TOP_K,
    ) -> str:
        """Build context spanning multiple products (for comparison queries)."""
        results = self.retrieve_global(
            query=query,
            product_ids=product_ids,
            top_k=top_k,
        )

        if not results:
            return ""

        parts = ["以下是相关商品的知识（按相关性排序）："]
        for r in results:
            product_name = r.metadata.get("product_name", r.source)
            parts.append(f"\n【{product_name} - {r.category}】\n{r.chunk_text}")

        return "\n".join(parts)
