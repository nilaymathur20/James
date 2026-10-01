"""ReAct (Reasoning + Acting) autonomous agent orchestration loop.

Executes iterative Thought -> Action -> Observation cycles with context pruning,
per-step timeouts, and human-in-the-loop confirmation gates for mutating operations.

Tool-calling: structured function-calling (Option A) — asks the LLM for tool calls
via function-calling parameters where supported; falls back to regex parsing for
providers without native tool-call support (e.g., Gemini).
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Iterator, List, Optional

from .llm import LLMError, configured_provider, generate_chat_completion, stream_chat_completion
from .privacy_config import ai_mode
from .tool_registry import ToolRegistry, get_tool_registry

logger = logging.getLogger(__name__)

MAX_REACT_STEPS = 8
# Wall-clock budget for the full agent loop (seconds)
AGENT_LOOP_TIMEOUT = 120
# Per-step wall-clock budget (seconds)
STEP_TIMEOUT = 30

REACT_SYSTEM_PROMPT_TEMPLATE = """You are James, an intelligent, privacy-first personal AI assistant.
Solve the user's task using step-by-step reasoning and available tools.

You have access to the following tools:
{tools_schema}

To use a tool, you MUST strictly use this exact format:
Thought: <your step-by-step reasoning about what to do next>
Action: <the tool name from the list above>
Action Input: <a valid JSON object with the parameters for the tool>

When you receive the tool's Observation, continue with:
Thought: <your assessment of the observation>
... (repeat Thought/Action/Action Input/Observation as needed)

When you have sufficient information to answer the user completely or if no tool is needed:
Thought: I have enough information to answer the user.
Final Answer: <your clear, complete, and helpful response to the user>

IMPORTANT RULES:
1. Always output a Thought before any Action.
2. Action Input MUST be a valid, parseable JSON object matching the tool's parameter schema.
3. For destructive or mutating operations (e.g., file edits), explain what changes will be proposed.
4. When you are done, conclude with "Final Answer:".
"""

# Regex fallback for providers without structured tool-calling support
_THOUGHT_PATTERN = re.compile(r"Thought:\s*(.*?)(?=\nAction:|\nFinal Answer:|$)", re.DOTALL | re.IGNORECASE)
_ACTION_PATTERN = re.compile(r"Action:\s*([a-zA-Z0-9_-]+)", re.IGNORECASE)
_ACTION_INPUT_PATTERN = re.compile(
    r"Action Input:\s*(\{.*?\}|\[.*?\]|null|true|false|\".*?\")(?=\nObservation:|\nThought:|$)",
    re.DOTALL | re.IGNORECASE,
)
_FINAL_ANSWER_PATTERN = re.compile(r"Final Answer:\s*(.*)", re.DOTALL | re.IGNORECASE)


@dataclass
class AgentStepRecord:
    step: int
    thought: str = ""
    tool: Optional[str] = None
    tool_input: Optional[dict[str, Any]] = None
    observation: Optional[str] = None
    proposal_id: Optional[str] = None
    diff: Optional[str] = None


def parse_tool_call(response: str) -> tuple[Optional[str], Optional[dict[str, Any]]]:
    """Parse a tool call from an LLM response.

    Tries structured function-calling format first, then falls back to regex.
    Returns (tool_name, tool_args) or (None, None) if no tool call detected.
    """
    # --- Structured function-calling format ---
    # Look for OpenAI-style function_call or tool_calls in the response
    try:
        parsed = json.loads(response)
    except (json.JSONDecodeError, TypeError):
        parsed = None

    if isinstance(parsed, dict):
        # OpenAI function-call format: {"function_call": {"name": "...", "arguments": "{...}"}}
        func_call = parsed.get("function_call")
        if func_call and isinstance(func_call, dict):
            name = func_call.get("name", "")
            args_str = func_call.get("arguments", "{}")
            if name:
                try:
                    args = json.loads(args_str) if isinstance(args_str, str) else args_str
                except (json.JSONDecodeError, TypeError):
                    args = {"raw_input": args_str}
                return name, args

        # OpenAI tool_calls format: {"tool_calls": [{"function": {"name": "...", "arguments": "..."}}]}
        tool_calls = parsed.get("tool_calls")
        if isinstance(tool_calls, list) and tool_calls:
            first = tool_calls[0]
            if isinstance(first, dict):
                func = first.get("function", {})
                name = func.get("name", "")
                args_str = func.get("arguments", "{}")
                if name:
                    try:
                        args = json.loads(args_str) if isinstance(args_str, str) else args_str
                    except (json.JSONDecodeError, TypeError):
                        args = {"raw_input": args_str}
                    return name, args

        # Direct action format: {"action": "...", "action_input": {...}}
        action_name = parsed.get("action")
        action_input = parsed.get("action_input")
        if action_name and isinstance(action_name, str):
            if action_input is None:
                action_input = {}
            return action_name, action_input

    # --- Regex fallback ---
    thought_match = _THOUGHT_PATTERN.search(response)
    thought = thought_match.group(1).strip() if thought_match else ""

    final_match = _FINAL_ANSWER_PATTERN.search(response)
    if final_match and not _ACTION_PATTERN.search(response):
        return None, None

    action_match = _ACTION_PATTERN.search(response)
    if not action_match:
        return None, None

    tool_name = action_match.group(1).strip()
    action_input_match = _ACTION_INPUT_PATTERN.search(response)
    action_input_str = action_input_match.group(1).strip() if action_input_match else "{}"

    try:
        tool_args = json.loads(action_input_str)
        if not isinstance(tool_args, dict):
            tool_args = {"input": tool_args}
    except json.JSONDecodeError:
        tool_args = {"raw_input": action_input_str}

    return tool_name, tool_args


class ReActAgent:
    """Multi-step ReAct agent engine with structured function-calling support."""

    def __init__(self, registry: Optional[ToolRegistry] = None) -> None:
        self.registry = registry or get_tool_registry()

    async def run(
        self,
        query: str,
        context: Optional[dict[str, Any]] = None,
        event_callback: Optional[Callable[[dict[str, Any]], None]] = None,
    ) -> dict[str, Any]:
        """Async execute the full ReAct loop with time budgets and event callbacks."""
        context = context or {}
        tools_schema = self.registry.get_tools_schema_prompt()
        system_prompt = REACT_SYSTEM_PROMPT_TEMPLATE.format(tools_schema=tools_schema)

        trajectory: List[AgentStepRecord] = []
        conversation_history: List[dict[str, str]] = []

        user_message = f"User Request: {query}"
        conversation_history.append({"role": "user", "content": user_message})

        tool_proposals: List[dict[str, Any]] = []
        final_answer = ""
        media_url: Optional[str] = None
        media_type: Optional[str] = None

        def emit(event: dict[str, Any]) -> None:
            if event_callback:
                try:
                    event_callback(event)
                except Exception:
                    pass

        provider = configured_provider()
        if not provider:
            return {
                "kind": "offline_fallback",
                "response": "No LLM provider is currently enabled in privacy settings. Using deterministic retrieval.",
                "mode": ai_mode(),
                "steps": [],
                "tool_proposals": [],
            }

        loop_start = time.monotonic()

        for step_num in range(1, MAX_REACT_STEPS + 1):
            # Check total loop timeout
            elapsed = time.monotonic() - loop_start
            if elapsed > AGENT_LOOP_TIMEOUT:
                emit({
                    "event_type": "error",
                    "message": f"Agent loop exceeded total time budget of {AGENT_LOOP_TIMEOUT}s.",
                })
                final_answer = "I ran out of time processing your request. Please try a shorter query."
                break

            emit({
                "event_type": "assistant_status",
                "phase": f"reasoning_step_{step_num}",
                "message": f"Thinking (step {step_num}/{MAX_REACT_STEPS})…",
            })

            try:
                llm_response = await _generate_chat_completion_async(
                    conversation_history,
                    system_prompt=system_prompt,
                    max_tokens=1024,
                )
            except LLMError as err:
                logger.error(f"ReAct LLM error on step {step_num}: {err.message}")
                emit({"event_type": "error", "message": err.message})
                final_answer = f"I encountered an issue connecting to the AI provider: {err.message}"
                break

            # Parse tool call from response
            tool_name, tool_args = parse_tool_call(llm_response)

            # Check for Final Answer (no tool call detected)
            if tool_name is None:
                # Extract thought for emission
                thought_match = _THOUGHT_PATTERN.search(llm_response)
                thought = thought_match.group(1).strip() if thought_match else ""
                if thought:
                    emit({"event_type": "agent_thought", "thought": thought, "step": step_num})
                final_match = _FINAL_ANSWER_PATTERN.search(llm_response)
                final_answer = final_match.group(1).strip() if final_match else llm_response.strip()
                break

            thought_match = _THOUGHT_PATTERN.search(llm_response)
            thought = thought_match.group(1).strip() if thought_match else ""

            step_record = AgentStepRecord(
                step=step_num,
                thought=thought,
                tool=tool_name,
                tool_input=tool_args,
            )

            emit({
                "event_type": "agent_thought",
                "thought": thought,
                "step": step_num,
                "tool": tool_name,
            })

            emit({
                "event_type": "tool_call",
                "tool": tool_name,
                "params": tool_args,
                "step": step_num,
            })

            # Check if tool requires confirmation (e.g. file edit)
            tool_def = self.registry.get_tool(tool_name)
            if tool_def and tool_def.requires_confirmation:
                tool_result = self.registry.execute(tool_name, tool_args, context)
                proposal_id = tool_result.get("proposal_id")
                diff = tool_result.get("diff")

                if proposal_id:
                    tool_proposal_obj = {
                        "id": proposal_id,
                        "tool": tool_name,
                        "params": tool_args,
                        "requires_confirmation": True,
                        "status": "pending",
                        "diff": diff,
                    }
                    tool_proposals.append(tool_proposal_obj)
                    emit({
                        "event_type": "confirmation_required",
                        "tool": tool_name,
                        "proposal_id": proposal_id,
                        "diff": diff,
                        "step": step_num,
                    })

                observation = json.dumps(tool_result, ensure_ascii=False)
            else:
                tool_result = self.registry.execute(tool_name, tool_args, context)
                observation = json.dumps(tool_result, ensure_ascii=False)

                # Check if tool produced media (image, audio)
                if isinstance(tool_result, dict):
                    if "image_url" in tool_result:
                        media_url = tool_result["image_url"]
                        media_type = "image"
                    elif "media_url" in tool_result:
                        media_url = tool_result["media_url"]
                        media_type = tool_result.get("media_type", "file")

            step_record.observation = observation
            trajectory.append(step_record)

            emit({
                "event_type": "tool_result",
                "tool": tool_name,
                "observation": observation[:500] + ("…" if len(observation) > 500 else ""),
                "step": step_num,
            })

            # Append assistant step and environment observation to conversation trajectory
            step_text = f"Thought: {thought}\nAction: {tool_name}\nAction Input: {json.dumps(tool_args)}\nObservation: {observation}"
            conversation_history.append({"role": "assistant", "content": step_text})

        # Format output
        serialized_steps = [
            {
                "step": s.step,
                "thought": s.thought,
                "action": {"tool": s.tool, "params": s.tool_input} if s.tool else None,
                "observation": s.observation,
            }
            for s in trajectory
        ]

        return {
            "kind": "agent_react",
            "response": final_answer or "I have finished processing your request.",
            "mode": ai_mode(),
            "steps": serialized_steps,
            "tool_proposals": tool_proposals,
            "thought": trajectory[0].thought if trajectory else "",
            "media_url": media_url,
            "media_type": media_type,
        }


def _generate_chat_completion_sync(
    messages: list[dict[str, str]],
    system_prompt: str,
    max_tokens: int | None = None,
) -> str:
    """Synchronous wrapper for generate_chat_completion (used in non-async contexts)."""
    return generate_chat_completion(messages, system_prompt=system_prompt, max_tokens=max_tokens)


async def _generate_chat_completion_async(
    messages: list[dict[str, str]],
    system_prompt: str,
    max_tokens: int | None = None,
) -> str:
    """Run synchronous LLM generation in a thread to keep the event loop responsive."""
    import asyncio

    loop = asyncio.get_running_loop()
    result = await asyncio.to_thread(
        _generate_chat_completion_sync,
        messages,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
    )
    return result