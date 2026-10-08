"""Lightweight rule-based routing for the one-box assistant command interface."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class AssistantIntent:
    name: str
    argument: str = ""


_HELP_WORDS = {"help", "help?", "commands", "what can you do", "what can i do"}
_COMMAND_PATTERN = re.compile(
    r"^/?(?P<verb>index|scan|search|find|open|show|preview|edit|image|img|help|audio|web|s|music|sound|generate)\b(?:\s+(?P<argument>.*))?$",
    flags=re.IGNORECASE,
)


def detect_intent(text: str) -> AssistantIntent:
    """Map explicit commands to safe tool stages; unknown text stays RAG chat."""
    normalized = " ".join(text.strip().split())
    if not normalized:
        return AssistantIntent("help")

    # Strip leading / for help matching
    stripped = normalized.lstrip("/")
    if stripped.lower() in _HELP_WORDS:
        return AssistantIntent("help")

    match = _COMMAND_PATTERN.match(normalized)
    if match:
        verb = match.group("verb").lower()
        argument = (match.group("argument") or "").strip()
        if verb == "help":
            return AssistantIntent("help")
        if verb in {"index", "scan"}:
            return AssistantIntent("index_web" if looks_like_url(argument) else "index_folder", argument)
        if verb in {"search", "find"}:
            return AssistantIntent("search", argument)
        if verb in {"open", "show"}:
            return AssistantIntent("open_candidates", argument)
        if verb == "preview":
            return AssistantIntent("preview_candidates", argument)
        if verb == "edit":
            return AssistantIntent("edit_candidates", argument)
        if verb in {"image", "img"}:
            return AssistantIntent("generate_image", argument)
        if verb == "audio":
            return AssistantIntent("generate_audio", argument)
        if verb == "web":
            return AssistantIntent("web_search", argument)
        if verb == "s":
            return AssistantIntent("web_search", argument)
        if verb == "music":
            return AssistantIntent("music_stub", argument)
        if verb == "sound":
            return AssistantIntent("sound_stub", argument)
        if verb == "generate":
            return AssistantIntent("generate_text", argument)

    # A bare URL is an explicit request to add a web source to RAG.
    if looks_like_url(normalized):
        return AssistantIntent("index_web", normalized)
    return AssistantIntent("chat", normalized)


def resolve_folder_reference(argument: str) -> str:
    """Map friendly spoken folder names to local paths without another text box."""
    cleaned = argument.strip().strip('"')
    if not cleaned:
        return ""
    if cleaned.startswith(("~", "/", ".")):
        return cleaned

    normalized = re.sub(r"\b(folder|directory)\b", "", cleaned.lower())
    normalized = re.sub(r"\b(my|the)\b", "", normalized)
    normalized = " ".join(normalized.split())
    home = Path.home()
    aliases = {
        "documents": home / "Documents",
        "downloads": home / "Downloads",
        "desktop": home / "Desktop",
        "projects": home / "Desktop" / "projects",
        "project": home / "Desktop" / "projects",
        "notes": home / "Notes",
        "home": home,
        "home folder": home,
    }
    resolved = aliases.get(normalized)
    return str(resolved) if resolved is not None else cleaned


def looks_like_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def command_help() -> str:
    return (
        "You can use this one box for questions and safe local commands.\n\n"
        "• search <words> — search indexed files and relevant prior chats\n"
        "• index ~/Documents — approve and index a local folder\n"
        "• index my projects folder — use a common folder alias\n"
        "• index https://example.com/docs — index a web page into RAG\n"
        "• web <question> — search the web for answers and images\n"
        "• s <question> — search the web for answers and URLs\n"
        "• music <prompt> — generate music (e.g. music lofi chill beat)\n"
        "• sound <effect> — sound effects via HF Spaces\n"
        "• open <filename> — find safe files, then confirm opening\n"
        "• preview <filename> — find an indexed text file to preview\n"
        "• edit <filename> — find an editable file; edits always require a diff and confirmation\n"
        "• image <description> — generate an AI image (e.g. image a sunset over mountains)\n"
        "• generate <prompt> — generate text directly from the LLM (no RAG, no tools)\n"
        "• audio [N sec] <topic or script> — generate spoken TTS audio\n"
        "    N sec: approximate target duration (e.g. '20 sec')\n"
        "    voice: <style> :: <script> — style instruction, not spoken aloud\n"
        "    If no script given, a narration is generated to fill the duration\n"
        "• Any other question — use local RAG, with an LLM only when available"
    )