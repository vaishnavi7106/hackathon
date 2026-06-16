"""Provider-agnostic LLM client.

Public surface used by the rest of the application:
    LLMClient        — abstract interface
    get_llm_client() — factory / DI entry point

Adding a new provider (OpenAI, Anthropic, Ollama, …):
  1. Implement a private subclass of LLMClient below.
  2. Add a branch in get_llm_client() keyed on settings.llm_provider.
  3. Add the SDK to requirements.txt.
  4. Nothing outside this file needs to change.

Current default: Gemini (google-genai SDK).
Activated via: LLM_PROVIDER=gemini  GEMINI_API_KEY=...  GEMINI_MODEL=gemini-2.5-flash
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from functools import lru_cache

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
        max_tokens: int = 400,
    ) -> str:
        """Send a prompt pair and return the model's text response."""


# ---------------------------------------------------------------------------
# Internal implementations  (prefixed _ — never import directly)
# ---------------------------------------------------------------------------


class _GeminiClient(LLMClient):
    """Gemini implementation via the google-genai SDK."""

    def __init__(self, api_key: str, model: str) -> None:
        from google import genai  # lazy import — SDK only needed when provider=gemini

        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 400,
    ) -> str:
        from google.genai import types

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_tokens,
            ),
        )
        logger.debug("gemini_generate", model=self._model, output_len=len(response.text or ""))
        return response.text


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
        max_tokens: int = 400,
    ) -> str:
        from app.exceptions import ServiceUnavailableError

        raise ServiceUnavailableError(
            f"LLM service ({self._reason})",
            detail_ta="AI சேவை தற்போது இணைக்கப்படவில்லை. மாவட்ட விவசாய அலுவலகத்தை தொடர்பு கொள்ளவும்.",
        )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
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

    if provider == "gemini":
        if not settings.gemini_api_key:
            return _NullLLMClient("GEMINI_API_KEY not set")
        return _GeminiClient(settings.gemini_api_key, settings.gemini_model)

    # ---- future providers (uncomment + install SDK) ----
    # if provider == "openai":
    #     from app.services._openai_impl import _OpenAIClient
    #     return _OpenAIClient(settings.openai_api_key, settings.openai_model)
    #
    # if provider == "anthropic":
    #     from app.services._anthropic_impl import _AnthropicClient
    #     return _AnthropicClient(settings.anthropic_api_key, settings.anthropic_model)
    #
    # if provider == "ollama":
    #     from app.services._ollama_impl import _OllamaClient
    #     return _OllamaClient(settings.ollama_base_url, settings.ollama_model)

    return _NullLLMClient(f"unknown provider '{provider}'")
