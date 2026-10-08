"""Centralized, versioned tool registry for the ReAct agent framework.

Each tool defines its JSON Schema parameters, safety classification (read-only vs mutating),
and whether human confirmation is required prior to execution.
"""

from __future__ import annotations

import ast
import json
import logging
import math
import operator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .browser_tool import fetch_page_content, web_search
from .file_tools import preview_file, propose_edit, search_files
from .image_generator import generate_image
from .indexer import index_folder_path
from .intent_router import resolve_folder_reference
from .privacy_config import ai_mode, history_feature_enabled
from .retrieval import retrieve_matches, serialize_match
from .scraper import ScrapeError, scrape_page
from .vector_db import SQLiteFTSIndex
from .vision import analyze_image_with_vision

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]
    category: str = "read_only"  # "read_only" | "mutating"
    requires_confirmation: bool = False
    handler: Optional[Callable[..., Any]] = None


class SafeMathEvaluator:
    """Safely evaluates basic arithmetic expressions without arbitrary code execution."""

    ALLOWED_OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    ALLOWED_FUNCTIONS = {
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "sum": sum,
        "sqrt": math.sqrt,
        "log": math.log,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "pi": math.pi,
        "e": math.e,
    }

    @classmethod
    def evaluate(cls, expr: str) -> float | int | str:
        try:
            tree = ast.parse(expr.strip(), mode="eval")
            return cls._eval_node(tree.body)
        except Exception as exc:
            return f"Calculation error: {exc}"

    @classmethod
    def _eval_node(cls, node: ast.AST) -> Any:
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError(f"Unsupported constant type: {type(node.value)}")
        if isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type in cls.ALLOWED_OPERATORS:
                left = cls._eval_node(node.left)
                right = cls._eval_node(node.right)
                return cls.ALLOWED_OPERATORS[op_type](left, right)
            raise ValueError(f"Operator {op_type.__name__} not allowed")
        if isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type in cls.ALLOWED_OPERATORS:
                operand = cls._eval_node(node.operand)
                return cls.ALLOWED_OPERATORS[op_type](operand)
            raise ValueError(f"Unary operator {op_type.__name__} not allowed")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            func_name = node.func.id
            if func_name in cls.ALLOWED_FUNCTIONS:
                func = cls.ALLOWED_FUNCTIONS[func_name]
                args = [cls._eval_node(arg) for arg in node.args]
                return func(*args)
            raise ValueError(f"Function '{func_name}' not allowed")
        if isinstance(node, ast.Name) and node.id in cls.ALLOWED_FUNCTIONS:
            return cls.ALLOWED_FUNCTIONS[node.id]
        raise ValueError(f"Unsupported syntax expression: {type(node).__name__}")


class ToolRegistry:
    """Registry managing available tools, parameter validation, and execution."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}
        self._register_default_tools()

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        return list(self._tools.values())

    def get_tools_schema_prompt(self) -> str:
        """Render a readable JSON schema prompt describing all registered tools."""
        tool_descriptions = []
        for tool in self._tools.values():
            tool_descriptions.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
                "requires_confirmation": tool.requires_confirmation,
            })
        return json.dumps(tool_descriptions, indent=2)

    def execute(self, tool_name: str, arguments: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        tool = self.get_tool(tool_name)
        if not tool:
            return {"error": f"Tool '{tool_name}' is not registered."}
        if tool.handler is None:
            return {"error": f"Tool '{tool_name}' has no execution handler."}

        try:
            return tool.handler(arguments, context or {})
        except Exception as exc:
            logger.exception(f"Error executing tool {tool_name}")
            return {"error": f"Tool execution failed: {str(exc)}"}

    def _register_default_tools(self) -> None:
        # 1. Search RAG Knowledge
        self.register(
            ToolDefinition(
                name="search_rag",
                description="Search local indexed documents and knowledge base using BM25 full-text lexical search.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search keywords or query phrase to look up."},
                        "top_k": {"type": "integer", "description": "Number of results to return (1-10).", "default": 5},
                    },
                    "required": ["query"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_search_rag,
            )
        )

        # 2. Discover / List Files
        self.register(
            ToolDefinition(
                name="discover_files",
                description="Find and list indexed files matching a name query or pattern.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Filename keyword or pattern to match."},
                        "limit": {"type": "integer", "description": "Maximum number of file candidates to return.", "default": 10},
                    },
                    "required": ["query"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_discover_files,
            )
        )

        # 3. Preview File
        self.register(
            ToolDefinition(
                name="preview_file",
                description="Safely inspect and read the content of a local file by its file_id or path.",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_id": {"type": "string", "description": "The file identifier returned from discover_files."},
                        "max_lines": {"type": "integer", "description": "Max lines to preview (default 100).", "default": 100},
                    },
                    "required": ["file_id"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_preview_file,
            )
        )

        # 4. Propose File Edit
        self.register(
            ToolDefinition(
                name="propose_file_edit",
                description="Propose a modification to an indexed file. Generates a unified diff and proposal ID for user review.",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_id": {"type": "string", "description": "The file identifier to edit."},
                        "old_text": {"type": "string", "description": "The exact existing text chunk to be replaced."},
                        "new_text": {"type": "string", "description": "The new replacement text."},
                    },
                    "required": ["file_id", "old_text", "new_text"],
                },
                category="mutating",
                requires_confirmation=True,
                handler=self._handle_propose_file_edit,
            )
        )

        # 5. Safe Math Calculator
        self.register(
            ToolDefinition(
                name="calculate",
                description="Evaluate mathematical calculations and expressions safely.",
                parameters={
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string", "description": "The math expression, e.g., 'sqrt(144) + 2 * (10 - 3)'"},
                    },
                    "required": ["expression"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_calculate,
            )
        )

        # 6. Index Directory
        self.register(
            ToolDefinition(
                name="index_directory",
                description="Index a folder path into the local SQLite FTS5 RAG store.",
                parameters={
                    "type": "object",
                    "properties": {
                        "folder_path": {"type": "string", "description": "Path to the directory to index, e.g. '~/Documents'."},
                    },
                    "required": ["folder_path"],
                },
                category="mutating",
                requires_confirmation=False,
                handler=self._handle_index_directory,
            )
        )

        # 7. Get System Status
        self.register(
            ToolDefinition(
                name="get_system_status",
                description="Retrieve local assistant statistics, privacy mode, and indexed chunk counts.",
                parameters={"type": "object", "properties": {}},
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_get_system_status,
            )
        )

        # 8. Generate Image
        self.register(
            ToolDefinition(
                name="generate_image",
                description="Generate an image from a detailed text prompt via zero-auth diffusion models (Flux/SDXL).",
                parameters={
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "description": "Visual prompt describing the image to generate."},
                        "width": {"type": "integer", "description": "Width in pixels (default 1024).", "default": 1024},
                        "height": {"type": "integer", "description": "Height in pixels (default 1024).", "default": 1024},
                        "model": {"type": "string", "description": "Model name: flux or turbo.", "default": "flux"},
                    },
                    "required": ["prompt"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_generate_image,
            )
        )

        # 9. Browse Web Page
        self.register(
            ToolDefinition(
                name="browse_web",
                description="Fetch and extract readable text from a safe public web page with SSRF firewall protections.",
                parameters={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "The public HTTP/HTTPS URL to fetch."},
                        "max_chars": {"type": "integer", "description": "Maximum characters to extract (default 8000).", "default": 8000},
                    },
                    "required": ["url"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_browse_web,
            )
        )

        # 9b. Scrape Web Page
        self.register(
            ToolDefinition(
                name="scrape_web",
                description="Fetch readable text from a public web page with SSRF protection and optional Selenium fallback for JS-rendered pages.",
                parameters={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "The public HTTP/HTTPS URL to scrape."},
                    },
                    "required": ["url"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_scrape_web,
            )
        )

        # 10. Web Search
        self.register(
            ToolDefinition(
                name="web_search",
                description="Perform an online web search for real-time information and summaries.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search keywords or question."},
                        "num_results": {"type": "integer", "description": "Number of results (1-10).", "default": 5},
                    },
                    "required": ["query"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_web_search,
            )
        )

        # 11. Multimodal Vision Analysis
        self.register(
            ToolDefinition(
                name="analyze_image",
                description="Analyze an image or screenshot using multimodal vision reasoning.",
                parameters={
                    "type": "object",
                    "properties": {
                        "image_base64": {"type": "string", "description": "Base64-encoded image data or data URI."},
                        "prompt": {"type": "string", "description": "Specific question or instruction about the image.", "default": "Analyze this image and describe what you see."},
                    },
                    "required": ["image_base64"],
                },
                category="read_only",
                requires_confirmation=False,
                handler=self._handle_analyze_image,
            )
        )

    # Tool Handlers
    def _handle_search_rag(self, args: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query", "")).strip()
        top_k = min(10, max(1, int(args.get("top_k", 5))))
        history_dir = context.get("history_dir") or Path.home() / ".james" / "history"
        use_history = bool(context.get("use_history", False))

        matches = retrieve_matches(query, history_dir, include_history=use_history, document_top_k=top_k)
        serialized = [serialize_match(m) for m in matches]
        return {
            "query": query,
            "match_count": len(serialized),
            "results": serialized,
        }

    def _handle_discover_files(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query", "")).strip()
        limit = min(20, max(1, int(args.get("limit", 10))))
        candidates = search_files(query, limit=limit)
        return {
            "query": query,
            "candidate_count": len(candidates),
            "files": candidates,
        }

    def _handle_preview_file(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        file_id = str(args.get("file_id", "")).strip()
        max_lines = int(args.get("max_lines", 100))
        return preview_file(file_id, max_lines=max_lines)

    def _handle_propose_file_edit(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        file_id = str(args.get("file_id", "")).strip()
        old_text = str(args.get("old_text", ""))
        new_text = str(args.get("new_text", ""))
        return propose_edit(file_id, old_text=old_text, new_text=new_text)

    def _handle_calculate(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        expression = str(args.get("expression", "")).strip()
        result = SafeMathEvaluator.evaluate(expression)
        return {"expression": expression, "result": result}

    def _handle_index_directory(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        raw_path = str(args.get("folder_path", "")).strip()
        resolved = resolve_folder_reference(raw_path)
        if not resolved:
            return {"error": f"Invalid folder path reference: {raw_path}"}
        summary = index_folder_path(resolved)
        return summary

    def _handle_get_system_status(self, _args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        db = SQLiteFTSIndex()
        stats = db.index_stats()
        return {
            "privacy_mode": ai_mode(),
            "history_enabled": history_feature_enabled(),
            "indexed_sources": stats.get("total_sources", 0),
            "indexed_chunks": stats.get("total_chunks", 0),
        }

    def _handle_generate_image(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        prompt = str(args.get("prompt", "")).strip()
        width = int(args.get("width", 1024))
        height = int(args.get("height", 1024))
        model = str(args.get("model", "flux"))
        return generate_image(prompt, width=width, height=height, model=model)

    def _handle_browse_web(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        url = str(args.get("url", "")).strip()
        max_chars = int(args.get("max_chars", 8000))
        return fetch_page_content(url, max_chars=max_chars)

    def _handle_scrape_web(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        url = str(args.get("url", "")).strip()
        try:
            result = scrape_page(url)
        except ScrapeError as exc:
            return {"error": exc.message, "url": url}
        return {
            "url": url,
            "content": result.text,
            "used_selenium": result.used_selenium,
            "content_length": len(result.text),
        }

    def _handle_web_search(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query", "")).strip()
        num_results = int(args.get("num_results", 5))
        return web_search(query, num_results=num_results)

    def _handle_analyze_image(self, args: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
        image_base64 = str(args.get("image_base64", "")).strip()
        prompt = str(args.get("prompt", "Analyze this image and describe what you see.")).strip()
        return analyze_image_with_vision(image_base64, prompt=prompt)


# Global Singleton Registry
_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry
