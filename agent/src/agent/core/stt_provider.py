"""Speech-to-text provider abstraction."""

import logging
from abc import ABC, abstractmethod
from typing import Optional

from .. import config

logger = logging.getLogger(__name__)


class STTProvider(ABC):
    """Abstract base for speech-to-text providers."""

    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class WhisperProvider(STTProvider):
    """Local Whisper model for offline STT.
    Requires `openai-whisper` package: pip install openai-whisper
    Lazy-loaded to avoid import overhead if not used."""

    def __init__(self, model_size: str = config.WHISPER_MODEL_SIZE):
        self.model_size = model_size
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        try:
            import whisper  # type: ignore
            logger.info("Loading Whisper model: %s", self.model_size)
            self._model = whisper.load_model(self.model_size)
            logger.info("Whisper model loaded")
        except ImportError:
            logger.error(
                "openai-whisper not installed. Run: pip install openai-whisper"
            )
            raise
        except Exception as e:
            logger.error("Failed to load Whisper model: %s", e)
            raise

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        import tempfile
        import os

        self._load_model()

        ext = ".webm" if "webm" in mime_type else ".wav"
        tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        try:
            tmp.write(audio_bytes)
            tmp.close()
            result = self._model.transcribe(tmp.name, language="zh")  # type: ignore
            text = result.get("text", "").strip()
            logger.info("Whisper transcription: %s", text[:100])
            return text
        finally:
            os.unlink(tmp.name)

    async def health_check(self) -> bool:
        try:
            self._load_model()
            return self._model is not None
        except Exception:
            return False


class StubSTTProvider(STTProvider):
    """Stub provider for development — returns empty string."""

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        logger.warning("Stub STT: returning empty transcription")
        return ""

    async def health_check(self) -> bool:
        return True


def create_stt_provider(provider_type: Optional[str] = None) -> STTProvider:
    """Factory to create the configured STT provider."""
    pt = provider_type or config.STT_PROVIDER

    if pt == "whisper":
        return WhisperProvider()
    elif pt == "stub":
        return StubSTTProvider()
    else:
        logger.warning("Unknown STT provider '%s', falling back to stub", pt)
        return StubSTTProvider()
