from typing import List, Dict, Optional
from pydantic import BaseModel


class KnowledgeEntry(BaseModel):
    """A single piece of knowledge about a product."""
    key: str
    content: str
    category: str  # "faq", "spec", "selling_point", "audience", "use_case", "general"
    keywords: List[str] = []


class ProductKnowledge(BaseModel):
    """Full knowledge context for a single product."""
    product_id: str
    product_name: str
    tagline: str = ""
    entries: List[KnowledgeEntry] = []
    raw_data: Dict = {}

    def search(self, query: str, top_k: int = 5) -> List[KnowledgeEntry]:
        """Simple keyword-based search over knowledge entries."""
        q = query.lower()
        query_words = [w for w in q.split() if len(w) > 1]

        scored: list[tuple[float, KnowledgeEntry]] = []
        for entry in self.entries:
            score = 0.0
            entry_text = (entry.content + " " + " ".join(entry.keywords)).lower()

            # Keyword match
            for word in query_words:
                if word in entry_text:
                    score += 1.0
                if word in [k.lower() for k in entry.keywords]:
                    score += 2.0

            # Category boost for FAQ
            if entry.category == "faq" and score > 0:
                score += 1.5

            if score > 0:
                scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:top_k]]


def product_json_to_knowledge(data: Dict) -> ProductKnowledge:
    """Convert a product JSON (from web/public/data/products.json) into a
    ProductKnowledge object with structured entries."""
    entries: List[KnowledgeEntry] = []

    # Tagline
    if data.get("tagline"):
        entries.append(KnowledgeEntry(
            key="tagline",
            content=data["tagline"],
            category="general",
            keywords=["介绍", "一句话", "是什么"],
        ))

    # Selling points
    for i, point in enumerate(data.get("selling_points", [])):
        entries.append(KnowledgeEntry(
            key=f"selling_point_{i}",
            content=point,
            category="selling_point",
            keywords=["卖点", "优势", "特点", "亮点"],
        ))

    # Specs
    for k, v in data.get("specs", {}).items():
        entries.append(KnowledgeEntry(
            key=f"spec_{k}",
            content=f"{k}：{v}",
            category="spec",
            keywords=["参数", "规格", "配置", k],
        ))

    # Audience
    for i, aud in enumerate(data.get("audience", [])):
        entries.append(KnowledgeEntry(
            key=f"audience_{i}",
            content=aud,
            category="audience",
            keywords=["适合", "人群", "谁用", "适用"],
        ))

    # Use cases
    for i, uc in enumerate(data.get("use_cases", [])):
        entries.append(KnowledgeEntry(
            key=f"use_case_{i}",
            content=uc,
            category="use_case",
            keywords=["场景", "用途", "用在", "怎么用"],
        ))

    # FAQ
    for i, faq in enumerate(data.get("faq", [])):
        q = faq.get("question", "")
        a = faq.get("answer", "")
        entries.append(KnowledgeEntry(
            key=f"faq_{i}",
            content=f"问：{q}\n答：{a}",
            category="faq",
            keywords=q.split(),
        ))

    return ProductKnowledge(
        product_id=data.get("product_id", ""),
        product_name=data.get("product_name", ""),
        tagline=data.get("tagline", ""),
        entries=entries,
        raw_data=data,
    )
