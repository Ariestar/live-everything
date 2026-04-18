from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # agent/ project root
DATA_DIR = BASE_DIR / "data"

# LLM
LLM_PROVIDER = "ollama"  # "ollama" | "openai_compatible" | "rule"
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "qwen2.5:7b"

# If using OpenAI-compatible API (local or remote)
OPENAI_BASE_URL = "http://localhost:8000/v1"
OPENAI_API_KEY = ""
OPENAI_MODEL = "default"

# STT
STT_PROVIDER = "whisper"  # "whisper" | "stub"
WHISPER_MODEL_SIZE = "base"

# Agent
MAX_AGENTS = 10
MAX_HISTORY_PER_AGENT = 30
DEFAULT_TEMPERATURE = 0.7
DEFAULT_SYSTEM_PROMPT = (
    "你是一个专业的商品讲解员。"
    "你只回答与当前商品相关的问题。"
    "如果本地知识库中没有相关信息，请诚实告知用户。"
    "回答要简洁、准确、有吸引力。"
)

# RAG
RAG_ENABLED = True
RAG_PERSIST_DIR = BASE_DIR / "data" / ".chroma"  # ChromaDB persistence
RAG_COLLECTION_PREFIX = "product_"
RAG_CHUNK_SIZE = 300          # characters per chunk
RAG_CHUNK_OVERLAP = 50        # overlap between chunks
RAG_TOP_K = 5                 # number of chunks to retrieve
RAG_SCORE_THRESHOLD = 1.5     # max L2 distance (lower = more similar)
KNOWLEDGE_DIR = DATA_DIR / "knowledge"  # markdown/txt knowledge files

# Server
HOST = "0.0.0.0"
PORT = 8000
CORS_ORIGINS = ["*"]
