"""Shared Gemini chat model for all agents."""

from __future__ import annotations

import os

from langchain_google_genai import ChatGoogleGenerativeAI

MODEL = "gemini-2.5-flash"


def chat_model(*, temperature: float | None = None) -> ChatGoogleGenerativeAI:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    kwargs: dict = {"model": MODEL, "google_api_key": api_key}
    if temperature is not None:
        kwargs["temperature"] = temperature
    return ChatGoogleGenerativeAI(**kwargs)
