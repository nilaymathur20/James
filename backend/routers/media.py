"""Generative Media, Multimodal Vision, and Web Exploration REST Router.

Supports Image, Audio, and Video generation via Pollinations.ai.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..services.browser_tool import fetch_page_content, web_search
from ..services.media_generator import (
    generate_audio,
    generate_image,
    generate_video,
    get_media_file,
    list_media_library,
    delete_media_file,
)
from ..services.vision import analyze_image_with_vision

router = APIRouter()
logger = logging.getLogger(__name__)


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Image generation prompt")
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    model: str = Field(default="flux", description="Model: flux, turbo, etc.")
    seed: Optional[int] = Field(default=None)
    init_image: Optional[str] = Field(default=None, description="URL or base64 of image to edit/modify")


class AudioGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Audio generation prompt / description")
    model: str = Field(default="audio", description="Audio model")


class VideoGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Video generation prompt")
    duration: int = Field(default=5, ge=1, le=30, description="Duration in seconds")
    width: int = Field(default=720, ge=320, le=1920)
    height: int = Field(default=480, ge=240, le=1080)
    model: str = Field(default="video", description="Video model")


class ImageEditRequest(BaseModel):
    filename: str = Field(..., description="Filename of the library image to edit")
    prompt: str = Field(..., min_length=1, max_length=2000, description="Edit instructions")
    model: str = Field(default="flux", description="Model: flux, turbo, etc.")


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
    """Generate or edit an image using Pollinations.ai."""
    result = generate_image(
        prompt=payload.prompt,
        width=payload.width,
        height=payload.height,
        model=payload.model,
        seed=payload.seed,
        init_image=payload.init_image,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/media/generate-audio")
def generate_audio_endpoint(payload: AudioGenerationRequest) -> dict[str, Any]:
    """Generate audio using Pollinations.ai."""
    result = generate_audio(
        prompt=payload.prompt,
        model=payload.model,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/media/generate-video")
def generate_video_endpoint(payload: VideoGenerationRequest) -> dict[str, Any]:
    """Generate video using Pollinations.ai (takes 15-45 seconds)."""
    result = generate_video(
        prompt=payload.prompt,
        duration=payload.duration,
        width=payload.width,
        height=payload.height,
        model=payload.model,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/media/edit-image")
def edit_image_endpoint(payload: ImageEditRequest) -> dict[str, Any]:
    """Edit an existing library image using prompt-based modifications."""
    from ..services.media_generator import IMAGE_DIR
    img_path = IMAGE_DIR / payload.filename

    if not img_path.exists() or not img_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found in library")

    try:
        from PIL import Image
        with Image.open(img_path) as img:
            width, height = img.size
    except Exception:
        width, height = 1024, 1024

    result = generate_image(
        prompt=payload.prompt,
        width=width,
        height=height,
        model=payload.model,
        seed=None,
        init_image=str(img_path),
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


@router.get("/media/library")
def get_media_library(
    type: Optional[str] = Query(default=None, description="Filter by media type: images, audio, videos")
) -> dict[str, Any]:
    """List all cached media files (images, audio, video)."""
    return list_media_library(media_type=type)


@router.get("/media/library/{media_type}/{filename}")
def get_media_file_endpoint(media_type: str, filename: str):
    """Serve a media file by type and filename."""
    # Map 'images' -> 'image', 'audio' -> 'audio', 'videos' -> 'video'
    type_map = {
        "images": "image",
        "image": "image",
        "audio": "audio",
        "videos": "video",
        "video": "video",
    }
    normalized_type = type_map.get(media_type)
    if not normalized_type:
        raise HTTPException(status_code=400, detail=f"Invalid media type: {media_type}")

    try:
        file_path, mime_type = get_media_file(normalized_type, filename)
        return FileResponse(file_path, media_type=mime_type)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Media file not found")


@router.delete("/media/library/{media_type}/{filename}")
def delete_media_file_endpoint(media_type: str, filename: str) -> dict[str, Any]:
    """Delete a media file by type and filename."""
    type_map = {
        "images": "image",
        "image": "image",
        "audio": "audio",
        "videos": "video",
        "video": "video",
    }
    normalized_type = type_map.get(media_type)
    if not normalized_type:
        raise HTTPException(status_code=400, detail=f"Invalid media type: {media_type}")

    result = delete_media_file(normalized_type, filename)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message"))
    return result