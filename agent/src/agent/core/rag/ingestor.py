"""Knowledge ingestion — load files and push into vector store."""

import json
import logging
from pathlib import Path
from typing import List, Optional

from .chunker import Chunker, Chunk
from .vector_store import VectorStore
from ... import config

logger = logging.getLogger(__name__)


class RAGIngestor:
    """Ingest various knowledge sources into the vector store."""

    def __init__(self, vector_store: VectorStore, chunker: Optional[Chunker] = None):
        self.store = vector_store
        self.chunker = chunker or Chunker()

    # ── Product JSON ────────────────────────────────────────────

    def ingest_product_json(self, data: dict) -> int:
        """Ingest a single product dict. Returns chunk count."""
        pid = data.get("product_id")
        if not pid:
            logger.warning("Product JSON missing product_id, skipping")
            return 0
        chunks = self.chunker.chunk_product_json(data, pid)
        return self.store.add_chunks(pid, chunks)

    def ingest_products_file(self, path: Path) -> List[str]:
        """Load a products JSON file (single or array) and ingest.
        Returns list of ingested product_ids."""
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.error("Failed to read %s: %s", path, e)
            return []

        items = data if isinstance(data, list) else [data]
        ingested = []
        for item in items:
            count = self.ingest_product_json(item)
            if count > 0:
                ingested.append(item.get("product_id", ""))
        return ingested

    # ── Markdown files ──────────────────────────────────────────

    def ingest_markdown(
        self,
        path: Path,
        product_id: str,
        metadata: Optional[dict] = None,
    ) -> int:
        """Ingest a markdown file into a product's collection."""
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as e:
            logger.error("Failed to read %s: %s", path, e)
            return 0

        chunks = self.chunker.chunk_markdown(
            text,
            source=str(path.name),
            metadata={**(metadata or {}), "product_id": product_id},
        )
        return self.store.add_chunks(product_id, chunks)

    # ── Plain text ──────────────────────────────────────────────

    def ingest_text(
        self,
        path: Path,
        product_id: str,
        category: str = "general",
        metadata: Optional[dict] = None,
    ) -> int:
        """Ingest a plain text file into a product's collection."""
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as e:
            logger.error("Failed to read %s: %s", path, e)
            return 0

        chunks = self.chunker.chunk_text(
            text,
            source=str(path.name),
            category=category,
            metadata={**(metadata or {}), "product_id": product_id},
        )
        return self.store.add_chunks(product_id, chunks)

    # ── Raw text (no file) ──────────────────────────────────────

    def ingest_raw_text(
        self,
        text: str,
        product_id: str,
        source: str = "api",
        category: str = "general",
        metadata: Optional[dict] = None,
    ) -> int:
        """Ingest raw text string directly."""
        chunks = self.chunker.chunk_text(
            text,
            source=source,
            category=category,
            metadata={**(metadata or {}), "product_id": product_id},
        )
        return self.store.add_chunks(product_id, chunks)

    # ── Batch directory scan ────────────────────────────────────

    def ingest_directory(
        self,
        directory: Optional[Path] = None,
        default_product_id: str = "global",
    ) -> dict:
        """Scan a directory and ingest all supported files.

        File naming convention for per-product files:
          {product_id}.json       → product JSON
          {product_id}.md         → product markdown knowledge
          {product_id}.txt        → product text knowledge
          {product_id}__xxx.md    → additional knowledge for product

        Files without a recognized product_id go into `default_product_id`.
        """
        d = directory or config.KNOWLEDGE_DIR
        if not d.exists():
            logger.warning("Knowledge directory %s does not exist", d)
            return {"products": [], "total_chunks": 0}

        products_ingested: set[str] = set()
        total_chunks = 0

        for f in sorted(d.iterdir()):
            if f.is_dir() or f.name.startswith("."):
                continue

            # Derive product_id from filename
            stem = f.stem.split("__")[0]  # e.g. "prod001__extra" → "prod001"

            if f.suffix == ".json":
                ids = self.ingest_products_file(f)
                products_ingested.update(ids)
                total_chunks += sum(
                    self.store.collection_stats(pid).get("count", 0) for pid in ids
                )

            elif f.suffix == ".md":
                pid = stem or default_product_id
                count = self.ingest_markdown(f, product_id=pid)
                if count > 0:
                    products_ingested.add(pid)
                total_chunks += count

            elif f.suffix == ".txt":
                pid = stem or default_product_id
                count = self.ingest_text(f, product_id=pid)
                if count > 0:
                    products_ingested.add(pid)
                total_chunks += count

        result = {
            "products": sorted(products_ingested),
            "total_chunks": total_chunks,
        }
        logger.info("Directory ingestion complete: %s", result)
        return result
