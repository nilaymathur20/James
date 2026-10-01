"""Generative Media, Multimodal Vision, and Web Exploration REST Router."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.browser_tool import fetch_page_content, web_search
from ..services.image_generator import generate_image
from ..services.vision import analyze_image_with_vision

router = APIRouter()
logger = logging.getLogger(__name__)


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Image generation prompt")
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    model: str = Field(default="flux", description="Model: flux, turbo, etc.")
    seed: Optional[int] = Field(default=None)


class VisionAnalysisRequest(BaseModel):
    image_base64: str = Field(..., min_length=10, description="Base64 encoded image string or data URI")
    prompt: str = Field(default="Analyze this image and describe what you see.", max_length=2000)


class WebFetchRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=2000, description="Web page URL to fetch")
    max_chars: int = Field(default=8000, ge=100, le=50000)


class WebSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    num_results: int = Field(default=5, ge=1, le=20)


@router.post("/media/generate-image")
def generate_image_endpoint(payload: ImageGenerationRequest) -> dict[str, Any]:
    """Generate an image using Pollinations.ai."""
    result = generate_image(
        prompt=payload.prompt,
        width=payload.width,
        height=payload.height,
        model=payload.model,
        seed=payload.seed,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/media/analyze-vision")
def analyze_vision_endpoint(payload: VisionAnalysisRequest) -> dict[str, Any]:
    """Analyze an image using Multimodal Vision."""
    result = analyze_image_with_vision(payload.image_base64, prompt=payload.prompt)
    if "error" in result and not result.get("success"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/media/fetch-page")
def fetch_page_endpoint(payload: WebFetchRequest) -> dict[str, Any]:
    """Safely fetch web page text with SSRF protections."""
    result = fetch_page_content(payload.url, max_chars=payload.max_chars)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/media/web-search")
def web_search_endpoint(payload: WebSearchRequest) -> dict[str, Any]:
    """Perform a web search."""
    result = web_search(payload.query, num_results=payload.num_results)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
