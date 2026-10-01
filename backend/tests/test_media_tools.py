"""Tests for generative media, SSRF security firewall, TTS, and tool registry additions."""

import pytest

from backend.services.browser_tool import is_safe_public_url
from backend.services.image_generator import generate_image
from backend.services.tool_registry import get_tool_registry


def test_ssrf_blocking_private_and_loopback_ips():
    """Verify that SSRF firewall blocks loopback, private IPs, and cloud metadata."""
    safe, msg = is_safe_public_url("http://127.0.0.1:8000/secret")
    assert not safe
    assert "private" in msg.lower() or "loopback" in msg.lower() or "forbidden" in msg.lower()

    safe, msg = is_safe_public_url("http://localhost:3000")
    assert not safe

    safe, msg = is_safe_public_url("http://169.254.169.254/latest/meta-data")
    assert not safe

    safe, msg = is_safe_public_url("http://192.168.1.100/admin")
    assert not safe

    safe, msg = is_safe_public_url("http://10.0.0.5/internal")
    assert not safe


def test_ssrf_allows_safe_urls():
    """Verify safe public hostnames pass validation."""
    safe, msg = is_safe_public_url("https://example.com/page")
    assert safe
    assert msg == "URL is safe."


def test_tool_registry_has_new_tools():
    """Verify newly registered tools are present and described."""
    reg = get_tool_registry()
    assert reg.get_tool("generate_image") is not None
    assert reg.get_tool("browse_web") is not None
    assert reg.get_tool("web_search") is not None
    assert reg.get_tool("analyze_image") is not None


def test_generate_image_constructs_valid_pollinations_url():
    """Verify Pollinations.ai URL builder without local disk cache."""
    res = generate_image("Cyberpunk cat coding in Python", width=512, height=512, save_local=False)
    assert res.get("success") is True
    assert "https://image.pollinations.ai/prompt/" in res["image_url"]
    assert "512" in res["image_url"]
