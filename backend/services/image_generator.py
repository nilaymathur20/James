"""Zero-auth AI Image Generation via Pollinations.ai.

Generates high-resolution images using state-of-the-art open diffusion models
(Flux, SDXL, Turbo) with zero API keys required and local output caching.
"""

from __future__ import annotations

import logging
import os
import urllib.parse
from pathlib import Path
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path.home() / ".james" / "generated_images"


def generate_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    model: str = "flux",
    seed: Optional[int] = None,
    save_local: bool = True,
) -> dict[str, Any]:
    """Generate an image from a text prompt via Pollinations.ai."""
    clean_prompt = prompt.strip()
    if not clean_prompt:
        return {"error": "Prompt cannot be empty."}

    encoded_prompt = urllib.parse.quote(clean_prompt)
    params = {
        "width": min(2048, max(256, width)),
        "height": min(2048, max(256, height)),
        "model": model,
        "nologo": "true",
    }
    if seed is not None:
        params["seed"] = str(seed)

    query_string = urllib.parse.urlencode(params)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?{query_string}"

    local_path_str: Optional[str] = None

    if save_local:
        try:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            import hashlib
            filename = f"gen_{hashlib.sha256(clean_prompt.encode()).hexdigest()[:12]}_{width}x{height}.jpg"
            target_path = OUTPUT_DIR / filename

            if not target_path.exists():
                response = requests.get(image_url, timeout=45)
                if response.ok and "image" in response.headers.get("content-type", ""):
                    target_path.write_bytes(response.content)
                    local_path_str = str(target_path)
            else:
                local_path_str = str(target_path)
        except Exception as exc:
            logger.warning(f"Could not cache generated image locally: {exc}")

    return {
        "prompt": clean_prompt,
        "image_url": image_url,
        "local_path": local_path_str,
        "model": model,
        "dimensions": f"{width}x{height}",
        "success": True,
    }
