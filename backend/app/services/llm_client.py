"""Provider-agnostic LLM client.

Public surface used by the rest of the application:
    LLMClient        — abstract interface
    get_llm_client() — factory / DI entry point

Adding a new provider (OpenAI, Anthropic, Ollama, …):
  1. Implement a private subclass of LLMClient below.
  2. Add a branch in get_llm_client() keyed on settings.llm_provider.
  3. Add the SDK to requirements.txt.
  4. Nothing outside this file needs to change.

Current provider: Groq (groq SDK).
Activated via: LLM_PROVIDER=groq  GROQ_API_KEY=...  GROQ_MODEL=llama-3.3-70b-versatile
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
import structlog

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


class LLMClient(ABC):
    """Minimal async LLM interface consumed by all business modules."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 800,
    ) -> str:
        """Send a prompt pair and return the model's text response."""


# ---------------------------------------------------------------------------
# Internal implementations  (prefixed _ — never import directly)
# ---------------------------------------------------------------------------


class _GroqClient(LLMClient):
    """Groq implementation via the groq SDK."""

    def __init__(self, api_key: str, model: str) -> None:
        from groq import AsyncGroq
        self._client = AsyncGroq(api_key=api_key)
        self._model = model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 800,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        text = response.choices[0].message.content or ""
        logger.debug("groq_generate", model=self._model, output_len=len(text))
        return text


class _NullLLMClient(LLMClient):
    """Returned when no provider is configured; raises at call time so the
    caller can handle the failure gracefully (e.g. return an offline response).
    """

    def __init__(self, reason: str) -> None:
        self._reason = reason
        logger.warning("llm_client_unconfigured", reason=reason)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 800,
    ) -> str:
        from app.exceptions import ServiceUnavailableError

        raise ServiceUnavailableError(
            f"LLM service ({self._reason})",
            detail_ta="AI சேவை தற்போது இணைக்கப்படவில்லை. மாவட்ட விவசாய அலுவலகத்தை தொடர்பு கொள்ளவும்.",
        )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def get_llm_client() -> LLMClient:
    """Return the configured LLMClient singleton.

    The instance is created once (lru_cache) so FastAPI Depends() reuses it
    across all requests without re-reading settings on every call.

    To add a provider, add a branch here and keep all SDK-specific code in
    the corresponding private class above.
    """
    from app.config import get_settings

    settings = get_settings()
    provider = settings.llm_provider.lower()

    if provider == "groq":
        if not settings.groq_api_key:
            return _NullLLMClient("GROQ_API_KEY not set")
        try:
            return _GroqClient(settings.groq_api_key, settings.groq_model)
        except (ImportError, ModuleNotFoundError) as e:
            return _NullLLMClient(f"groq SDK not installed: {e}")

    return _NullLLMClient(f"unknown provider '{provider}'")
