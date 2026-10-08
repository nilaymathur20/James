"""Tests for generative media, SSRF security firewall, TTS, and tool registry additions."""

import asyncio
import os
from unittest.mock import AsyncMock, patch

import pytest

from backend.services.browser_tool import is_safe_public_url
from backend.services.command_handler import (
    _generate_narration,
    _handle_generate_audio,
    _handle_music_stub,
    _handle_sound_stub,
    _is_likely_script,
    _is_music_request,
    _measure_audio_duration,
    _parse_duration,
    _separate_style_and_content,
)
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


# --- _parse_duration tests ---

def test_parse_duration_seconds():
    duration, remaining = _parse_duration("20 sec heavy metal breakdown")
    assert duration == 20
    assert remaining == "heavy metal breakdown"


def test_parse_duration_seconds_plural():
    duration, remaining = _parse_duration("30 seconds energetic voice")
    assert duration == 30
    assert remaining == "energetic voice"


def test_parse_duration_minutes():
    duration, remaining = _parse_duration("1 min jazz piano")
    assert duration == 60
    assert remaining == "jazz piano"


def test_parse_duration_minutes_plural():
    duration, remaining = _parse_duration("2 minutes classical orchestral")
    assert duration == 120
    assert remaining == "classical orchestral"


def test_parse_duration_no_duration():
    duration, remaining = _parse_duration("heavy metal breakdown")
    assert duration is None
    assert remaining == "heavy metal breakdown"


def test_parse_duration_empty():
    duration, remaining = _parse_duration("")
    assert duration is None
    assert remaining == ""


# --- _separate_style_and_content tests ---

def test_separate_style_with_prefix():
    style, content = _separate_style_and_content("voice: energetic announcer :: Welcome to the show.")
    assert style == "energetic announcer"
    assert content == "Welcome to the show."


def test_separate_style_without_separator():
    style, content = _separate_style_and_content("style: calm and soothing meditation guide")
    assert style == "calm and soothing meditation guide"
    assert content == ""


def test_separate_style_case_insensitive():
    style, content = _separate_style_and_content("VOICE: gritty rock announcer")
    assert style == "gritty rock announcer"
    assert content == ""


def test_separate_style_no_prefix():
    style, content = _separate_style_and_content("heavy metal breakdown")
    assert style is None
    assert content == "heavy metal breakdown"


def test_separate_style_double_colon_no_prefix():
    style, content = _separate_style_and_content("energetic announcer :: Welcome to the show.")
    assert style == "energetic announcer"
    assert content == "Welcome to the show."


# --- _is_likely_script tests ---

def test_is_likely_script_with_punctuation():
    assert _is_likely_script("This is a complete sentence.") is True


def test_is_likely_script_long_text():
    assert _is_likely_script(" ".join(["word"] * 20)) is True


def test_is_likely_script_short_topic():
    assert _is_likely_script("heavy metal breakdown") is False


def test_is_likely_script_empty():
    assert _is_likely_script("") is False


# --- _generate_narration tests ---

def test_generate_narration_word_count_approximate():
    """Generated narration for 20 sec should be ~42 words (20 * 2.1)."""
    script = _generate_narration("heavy metal breakdown", 20)
    word_count = len(script.split())
    # Should be close to target (42 words) with tolerance
    assert 35 <= word_count <= 55, f"Expected ~42 words, got {word_count}: {script!r}"


def test_generate_narration_short_topic():
    """Even a short topic generates a usable narration."""
    script = _generate_narration("jazz", 10)
    assert len(script.split()) > 0


def test_generate_narration_no_duration():
    """Default narration without duration target still generates content."""
    script = _generate_narration("test topic", 15)
    assert len(script.split()) > 0


# --- _measure_audio_duration tests ---

def test_measure_audio_duration_nonexistent():
    """Measuring a nonexistent file returns None."""
    assert _measure_audio_duration("/tmp/nonexistent_audio_file_12345.mp3") is None


# --- _handle_generate_audio tests ---

def test_handle_generate_audio_preserves_user_script():
    """User-provided script is preserved exactly, not rewritten or padded."""
    user_script = "This is my exact script. It should be spoken as written. No changes at all."

    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=4.5):
            result = _handle_generate_audio(f"20 sec {user_script}")

    assert result["kind"] == "audio_generated"
    assert result["data"]["script_source"] == "user_script"
    assert result["data"]["script"] == user_script
    assert result["data"]["target_duration_sec"] == 20


def test_handle_generate_audio_generates_narration_for_topic():
    """Topic-only input generates a narration script, not raw topic as TTS text."""
    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=18.2):
            result = _handle_generate_audio("20 sec heavy metal breakdown")

    assert result["kind"] == "audio_generated"
    assert result["data"]["script_source"] == "generated"
    assert result["data"]["target_duration_sec"] == 20
    # Word count should approach the 20-second target (~42 words)
    assert result["data"]["word_count"] >= 30


def test_handle_generate_audio_no_duration():
    """Request without a duration still works (uses default narration)."""
    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=14.0):
            result = _handle_generate_audio("jazz piano")

    assert result["kind"] == "audio_generated"
    assert result["data"]["script_source"] == "generated"
    assert result["data"]["target_duration_sec"] is None


def test_handle_generate_audio_style_instruction_separated():
    """Style/voice instructions are separated from spoken content."""
    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=19.5):
            result = _handle_generate_audio(
                "20 sec voice: energetic gritty announcer :: heavy metal breakdown"
            )

    assert result["kind"] == "audio_generated"
    assert result["data"]["style_instruction"] is not None
    assert "energetic" in result["data"]["style_instruction"].lower()


def test_handle_generate_audio_short_script_warning():
    """Short user scripts should trigger a duration warning."""
    short_script = "Hi there."

    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=1.2):
            result = _handle_generate_audio(f"20 sec {short_script}")

    assert result["kind"] == "audio_generated"
    assert result["data"]["script_source"] == "user_script"
    assert result["data"]["duration_warning"] is not None
    assert "shorter" in result["data"]["duration_warning"].lower()


def test_handle_generate_audio_actual_duration_reported():
    """Actual duration from ffprobe is reported, not just the requested duration."""
    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=21.3):
            result = _handle_generate_audio("20 sec heavy metal breakdown")

    assert result["kind"] == "audio_generated"
    assert result["data"]["actual_duration_sec"] == 21.3
    assert result["data"]["target_duration_sec"] == 20


def test_handle_generate_audio_empty_content_returns_clarification():
    """Empty content returns a clarification response."""
    result = _handle_generate_audio("")
    assert result["kind"] == "clarification"


def test_handle_command_audio_intent():
    """Verifies the /audio command is routed to generate_audio handler."""
    from backend.services.intent_router import detect_intent

    intent = detect_intent("/audio 20 sec heavy metal breakdown")
    assert intent.name == "generate_audio"
    assert "20 sec" in intent.argument
    assert "heavy metal breakdown" in intent.argument


# --- _is_music_request tests ---

def test_is_music_request_beat():
    assert _is_music_request("lofi chill beat") is True


def test_is_music_request_instrumental():
    assert _is_music_request("instrumental music") is True


def test_is_music_request_lofi():
    assert _is_music_request("lofi beats") is True


def test_is_music_request_jazz():
    # "jazz piano" is a topic for narration, not a request for music
    assert _is_music_request("jazz piano") is False


def test_is_music_request_speech_explicit():
    # User explicitly asks for speech — not a music request
    assert _is_music_request("speak about heavy metal") is False


def test_is_music_request_narration_topic():
    # A topic for narration, not a music request
    assert _is_music_request("explain the history of jazz") is False


def test_is_music_request_heavy_metal_topic():
    # "heavy metal breakdown" is a narration topic, not a music request
    assert _is_music_request("heavy metal breakdown") is False


def test_is_music_request_empty():
    assert _is_music_request("") is False


# --- Music request clarification tests ---

def test_handle_generate_audio_music_request_clarification():
    """Music requests get a clarification explaining TTS-only limitation."""
    result = _handle_generate_audio("lofi chill beat")
    assert result["kind"] == "clarification"
    assert "TTS" in result["response"]
    assert "cannot produce music" in result["response"]


# --- New music keyword tests ---

def test_is_music_request_ambient():
    assert _is_music_request("ambient sound") is True


def test_is_music_request_sound_effect():
    assert _is_music_request("sound effect rain") is True


# --- Speech response format test ---

def test_handle_generate_audio_speech_response_format():
    """Response says what was spoken, not a generic 'Audio generated' message."""
    mock_synth = AsyncMock(return_value=b"fake_mp3_bytes")

    with patch("backend.services.command_handler.synthesize_speech", mock_synth):
        with patch("backend.services.command_handler._measure_audio_duration", return_value=3.2):
            result = _handle_generate_audio("Hello, this is a test of text to speech.")

    assert result["kind"] == "audio_generated"
    assert 'Speech generated from:' in result["response"]
    assert "Hello, this is a test of text to speech." in result["response"]


# --- Music / Sound stub tests ---

def test_handle_music_stub_returns_openrouter_error_when_no_key():
    """Without OPENROUTER_API_KEY, /music tries HF Spaces next."""
    import os

    saved = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        result = _handle_music_stub("lofi chill beat")
        assert result["kind"] == "music_stub"
        # Auto mode tries OpenRouter first, then HF Spaces
        # Result comes from HF Spaces (either needs_install or hf-spaces error)
        data = result["data"]
        assert data.get("backend") in ("hf-spaces",)
        # Either gradio_client missing or HF Spaces error
        assert "error" in data
    finally:
        if saved:
            os.environ["OPENROUTER_API_KEY"] = saved


def test_handle_music_stub_falls_back_to_hf_spaces_when_openrouter_has_no_key():
    """When OPENROUTER_API_KEY is missing, auto mode tries HF Spaces next."""
    import os

    saved_or = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        result = _handle_music_stub("lofi chill beat")
        # OpenRouter fails (no key), HF Spaces attempted next
        assert result["kind"] == "music_stub"
        assert "error" in result["data"]
        assert result["data"].get("backend") == "hf-spaces"
    finally:
        if saved_or:
            os.environ["OPENROUTER_API_KEY"] = saved_or


def test_generate_music_dispatcher_auto_fallback():
    """generate_music(backend='auto') tries OpenRouter → HF Spaces."""
    from backend.services.media_generator import generate_music

    saved_or = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        result = generate_music(prompt="test", backend="auto")
        # OpenRouter fails (no key), HF Spaces attempted next
        assert "error" in result
        assert result.get("backend") == "hf-spaces"
    finally:
        if saved_or:
            os.environ["OPENROUTER_API_KEY"] = saved_or


def test_generate_music_unlimited_fallback():
    """UnlimitedMusicGen is tried when OpenRouter has no key."""
    from backend.services.media_generator import generate_music

    saved_or = os.environ.pop("OPENROUTER_API_KEY", None)
    try:
        result = generate_music(prompt="lofi chill beat", backend="auto")
        # OpenRouter fails (no key), UnlimitedMusicGen attempted next
        assert result.get("backend") == "hf-spaces"
        assert "error" in result
    finally:
        if saved_or:
            os.environ["OPENROUTER_API_KEY"] = saved_or


def test_handle_sound_stub_redirects_to_search():
    """Sound effects redirect to web search since no SFX backend exists."""
    result = _handle_sound_stub("thunder rain")
    assert result["kind"] == "sound_stub"
    assert "/s sound effect" in result["response"]
    assert result["data"]["backend"] is None


# --- Music / Sound intent routing tests ---

def test_handle_command_music_intent():
    from backend.services.intent_router import detect_intent
    intent = detect_intent("/music lofi beat")
    assert intent.name == "music_stub"
    assert "lofi beat" in intent.argument


def test_handle_command_sound_intent():
    from backend.services.intent_router import detect_intent
    intent = detect_intent("/sound effect rain")
    assert intent.name == "sound_stub"
    assert "effect rain" in intent.argument