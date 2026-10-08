"""ReAct (Reasoning + Acting) autonomous agent orchestration loop.

Executes iterative Thought -> Action -> Observation cycles with context pruning,
per-step timeouts, and human-in-the-loop confirmation gates for mutating operations.

Tool-calling: structured function-calling (Option A) — asks the LLM for tool calls
via function-calling parameters where supported; falls back to regex parsing for
providers without native tool-call support (e.g., Gemini).

Streaming: token deltas are emitted in real-time via the event callback when a
token callback is provided, giving live feedback over WebSocket.

Parallel calls: when the LLM outputs multiple independent tool calls in one
response, they are executed concurrently via asyncio.gather.

Untrusted content: observations from external sources (web, files, RAG) are
tagged with <untrusted> markers before entering the conversation history, so
the LLM treats them as reference material — never as direct instructions.

Write-after-read approval: if the agent has consumed content from external
sources (web reads, file reads, RAG), file-edit operations require explicit
human approval rather than just the standard confirmation gate.
"""

from __future__ import annotations

import asyncio
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

# Tools that read external/untrusted content
READ_TOOLS = frozenset({
    "browse_web", "scrape_web", "web_search",
    "preview_file", "discover_files", "search_rag",
    "analyze_image",
})
# Tools that mutate files
WRITE_TOOLS = frozenset({"propose_file_edit"})

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

# Match multiple Action/Action Input pairs for parallel tool calling
_MULTI_ACTION_PATTERN = re.compile(r"Action:\s*([a-zA-Z0-9_-]+)", re.IGNORECASE)
_MULTI_ACTION_INPUT_PATTERN = re.compile(
    r"Action Input:\s*(\{.*?\}|\[.*?\]|null|true|false|\".*?\")",
    re.DOTALL | re.IGNORECASE,
)

# Tags untrusted content so the LLM treats it as reference, not instruction
_UNTRUSTED_TAG_OPEN = "<untrusted source=\"external\">"
_UNTRUSTED_TAG_CLOSE = "</untrusted>"


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
    """Parse a single tool call from an LLM response.

    Tries structured function-calling format first, then falls back to regex.
    Returns (tool_name, tool_args) or (None, None) if no tool call detected.
    """
    clean_resp = response.strip()
    if clean_resp.startswith("```"):
        clean_resp = re.sub(r"^```(?:json)?\s*", "", clean_resp)
        clean_resp = re.sub(r"\s*```$", "", clean_resp)

    # --- Structured function-calling format ---
    try:
        parsed = json.loads(clean_resp)
    except (json.JSONDecodeError, TypeError):
        parsed = None

    if isinstance(parsed, dict):
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

        action_name = parsed.get("action")
        action_input = parsed.get("action_input")
        if action_name and isinstance(action_name, str):
            if action_input is None:
                action_input = {}
            if isinstance(action_input, str):
                try:
                    action_input = json.loads(action_input)
                except Exception:
                    action_input = {"input": action_input}
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


def parse_tool_calls(response: str) -> list[tuple[str, dict[str, Any]]]:
    """Parse multiple tool calls from a single LLM response.

    Finds all Action/Action Input pairs and returns them as a list.
    Returns an empty list if no tool calls are detected.
    """
    single_name, single_args = parse_tool_call(response)
    if single_name:
        return [(single_name, single_args or {})]

    clean_resp = response.strip()
    if clean_resp.startswith("```"):
        clean_resp = re.sub(r"^```(?:json)?\s*", "", clean_resp)
        clean_resp = re.sub(r"\s*```$", "", clean_resp)

    try:
        parsed = json.loads(clean_resp)
    except (json.JSONDecodeError, TypeError):
        parsed = None

        parsed = None

    if isinstance(parsed, dict):
        tool_calls = parsed.get("tool_calls")
        if isinstance(tool_calls, list) and tool_calls:
            result = []
            for tc in tool_calls:
                if isinstance(tc, dict):
                    func = tc.get("function", {})
                    name = func.get("name", "")
                    args_str = func.get("arguments", "{}")
                    if name:
                        try:
                            args = json.loads(args_str) if isinstance(args_str, str) else args_str
                        except (json.JSONDecodeError, TypeError):
                            args = {"raw_input": args_str}
                        result.append((name, args))
            if result:
                return result

    # --- Regex fallback: find all Action / Action Input pairs ---
    actions = list(_MULTI_ACTION_PATTERN.finditer(response))
    if not actions:
        return []

    # Find all Action Input matches with their positions
    input_matches = list(_MULTI_ACTION_INPUT_PATTERN.finditer(response))

    results: list[tuple[str, dict[str, Any]]] = []
    for i, action_match in enumerate(actions):
        tool_name = action_match.group(1).strip()
        # Find the Action Input that follows this Action
        action_input_str = "{}"
        for inp_match in input_matches:
            if inp_match.start() > action_match.end():
                action_input_str = inp_match.group(1).strip()
                break

        try:
            tool_args = json.loads(action_input_str)
            if not isinstance(tool_args, dict):
                tool_args = {"input": tool_args}
        except json.JSONDecodeError:
            tool_args = {"raw_input": action_input_str}

        results.append((tool_name, tool_args))

    return results


def _tag_untrusted(content: str, source: str) -> str:
    """Wrap externally-sourced content with untrusted tags."""
    if not content:
        return content
    return f"{_UNTRUSTED_TAG_OPEN}[source: {source}]{_UNTRUSTED_TAG_CLOSE}\n{content}\n{_UNTRUSTED_TAG_OPEN}[/source]{_UNTRUSTED_TAG_CLOSE}"


def _is_read_tool(tool_name: str) -> bool:
    return tool_name in READ_TOOLS


def _is_write_tool(tool_name: str) -> bool:
    return tool_name in WRITE_TOOLS


class ReActAgent:
    """Multi-step ReAct agent engine with structured function-calling support."""

    def __init__(self, registry: Optional[ToolRegistry] = None) -> None:
        self.registry = registry or get_tool_registry()

    async def run(
        self,
        query: str,
        context: Optional[dict[str, Any]] = None,
        event_callback: Optional[Callable[[dict[str, Any]], None]] = None,
        token_callback: Optional[Callable[[str], None]] = None,
    ) -> dict[str, Any]:
        """Async execute the full ReAct loop with time budgets and event callbacks.

        Args:
            query: The user's request.
            context: Additional context (history_dir, use_history, source).
            event_callback: Called for each event (thought, tool_call, tool_result, etc.).
            token_callback: Called for each token delta during LLM generation.
        """
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

        # Track whether any external content was read in this session
        has_external_reads = False

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
                if token_callback:
                    llm_response = await _stream_chat_completion_async(
                        conversation_history,
                        system_prompt=system_prompt,
                        max_tokens=1024,
                        token_callback=token_callback,
                    )
                else:
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

            # Parse tool calls from response (supports single and multiple tool calls)
            tool_calls = parse_tool_calls(llm_response)

            # Check for Final Answer (no tool calls detected)
            if not tool_calls:
                thought_match = _THOUGHT_PATTERN.search(llm_response)
                thought = thought_match.group(1).strip() if thought_match else ""
                if thought:
                    emit({"event_type": "agent_thought", "thought": thought, "step": step_num})
                final_match = _FINAL_ANSWER_PATTERN.search(llm_response)
                final_answer = final_match.group(1).strip() if final_match else llm_response.strip()
                break

            # Extract thought for emission
            thought_match = _THOUGHT_PATTERN.search(llm_response)
            thought = thought_match.group(1).strip() if thought_match else ""
            if thought:
                emit({"event_type": "agent_thought", "thought": thought, "step": step_num})

            # Check if any write tool requires approval after external reads
            write_tools = [(name, args) for name, args in tool_calls if _is_write_tool(name)]
            read_tools = [(name, args) for name, args in tool_calls if _is_read_tool(name)]

            if write_tools and has_external_reads:
                # Gate write operations after external reads — require explicit approval
                for tool_name, tool_args in write_tools:
                    emit({
                        "event_type": "approval_required",
                        "tool": tool_name,
                        "params": tool_args,
                        "step": step_num,
                        "reason": "Write after external content read — explicit approval required.",
                    })
                    # Still execute the tool but mark it as needing approval
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

                    step_record = AgentStepRecord(
                        step=step_num,
                        thought=thought,
                        tool=tool_name,
                        tool_input=tool_args,
                        observation=observation,
                    )
                    trajectory.append(step_record)

                    emit({
                        "event_type": "tool_result",
                        "tool": tool_name,
                        "observation": observation[:500] + ("…" if len(observation) > 500 else ""),
                        "step": step_num,
                    })

                    # Append to conversation with untrusted tagging
                    step_text = f"Thought: {thought}\nAction: {tool_name}\nAction Input: {json.dumps(tool_args)}\nObservation: {_tag_untrusted(observation, tool_name)}"
                    conversation_history.append({"role": "assistant", "content": step_text})

                # Execute non-write tools (reads) in parallel with writes
                other_tools = [(name, args) for name, args in tool_calls if not _is_write_tool(name)]
                if other_tools:
                    await _execute_tool_calls_parallel(
                        other_tools, step_num, emit, self.registry, context,
                        trajectory, conversation_history, thought, tool_proposals,
                    )

                # Mark that we've had external reads
                has_external_reads = True
                continue

            # Execute all tool calls — in parallel if multiple, sequentially otherwise
            if len(tool_calls) > 1:
                await _execute_tool_calls_parallel(
                    tool_calls, step_num, emit, self.registry, context,
                    trajectory, conversation_history, thought, tool_proposals,
                )
            elif tool_calls:
                tool_name, tool_args = tool_calls[0]
                await _execute_single_tool_call(
                    tool_name, tool_args, step_num, emit, self.registry, context,
                    trajectory, conversation_history, thought, tool_proposals,
                    tag_untrusted=True,
                )

            # Track external reads
            if read_tools:
                has_external_reads = True

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


async def _execute_single_tool_call(
    tool_name: str,
    tool_args: dict[str, Any],
    step_num: int,
    emit: Callable[[dict[str, Any]], None],
    registry: ToolRegistry,
    context: dict[str, Any],
    trajectory: List[AgentStepRecord],
    conversation_history: List[dict[str, str]],
    thought: str,
    tool_proposals: List[dict[str, Any]],
    tag_untrusted: bool = False,
) -> None:
    """Execute a single tool call and record the result."""
    step_record = AgentStepRecord(
        step=step_num,
        thought=thought,
        tool=tool_name,
        tool_input=tool_args,
    )

    emit({
        "event_type": "tool_call",
        "tool": tool_name,
        "params": tool_args,
        "step": step_num,
    })

    # Check if tool requires confirmation (e.g. file edit)
    tool_def = registry.get_tool(tool_name)
    if tool_def and tool_def.requires_confirmation:
        tool_result = registry.execute(tool_name, tool_args, context)
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
            observation = json.dumps(tool_result, ensure_ascii=False)
        else:
            tool_result = registry.execute(tool_name, tool_args, context)
            observation = json.dumps(tool_result, ensure_ascii=False)

    step_record.observation = observation
    trajectory.append(step_record)

    emit({
        "event_type": "tool_result",
        "tool": tool_name,
        "observation": observation[:500] + ("…" if len(observation) > 500 else ""),
        "step": step_num,
    })

    # Append assistant step and environment observation to conversation trajectory
    obs_content = observation
    if tag_untrusted and _is_read_tool(tool_name):
        obs_content = _tag_untrusted(observation, tool_name)

    step_text = f"Thought: {thought}\nAction: {tool_name}\nAction Input: {json.dumps(tool_args)}\nObservation: {obs_content}"
    conversation_history.append({"role": "assistant", "content": step_text})


async def _execute_tool_calls_parallel(
    tool_calls: list[tuple[str, dict[str, Any]]],
    step_num: int,
    emit: Callable[[dict[str, Any]], None],
    registry: ToolRegistry,
    context: dict[str, Any],
    trajectory: List[AgentStepRecord],
    conversation_history: List[dict[str, str]],
    thought: str,
    tool_proposals: List[dict[str, Any]],
) -> None:
    """Execute multiple independent tool calls concurrently."""

    async def _execute_one(tool_name: str, tool_args: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
        """Execute a single tool and return (tool_name, tool_args, observation)."""
        emit({
            "event_type": "tool_call",
            "tool": tool_name,
            "params": tool_args,
            "step": step_num,
        })

        tool_def = registry.get_tool(tool_name)
        if tool_def and tool_def.requires_confirmation:
            tool_result = registry.execute(tool_name, tool_args, context)
            proposal_id = tool_result.get("proposal_id")
            diff = tool_result.get("diff")

            if proposal_id:
                emit({
                    "event_type": "confirmation_required",
                    "tool": tool_name,
                    "proposal_id": proposal_id,
                    "diff": diff,
                    "step": step_num,
                })

            observation = json.dumps(tool_result, ensure_ascii=False)
        else:
            tool_result = registry.execute(tool_name, tool_args, context)
            observation = json.dumps(tool_result, ensure_ascii=False)

        emit({
            "event_type": "tool_result",
            "tool": tool_name,
            "observation": observation[:500] + ("…" if len(observation) > 500 else ""),
            "step": step_num,
        })

        return tool_name, tool_args, observation

    # Execute all tool calls concurrently
    results = await asyncio.gather(*[
        _execute_one(name, args)
        for name, args in tool_calls
    ])

    # Record all results in trajectory and conversation history
    for tool_name, tool_args, observation in results:
        step_record = AgentStepRecord(
            step=step_num,
            thought=thought,
            tool=tool_name,
            tool_input=tool_args,
            observation=observation,
        )
        trajectory.append(step_record)

        # Tag untrusted content from external sources
        obs_content = observation
        if _is_read_tool(tool_name):
            obs_content = _tag_untrusted(observation, tool_name)

        step_text = f"Thought: {thought}\nAction: {tool_name}\nAction Input: {json.dumps(tool_args)}\nObservation: {obs_content}"
        conversation_history.append({"role": "assistant", "content": step_text})


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
    loop = asyncio.get_running_loop()
    result = await asyncio.to_thread(
        _generate_chat_completion_sync,
        messages,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
    )
    return result


async def _stream_chat_completion_async(
    messages: list[dict[str, str]],
    system_prompt: str,
    max_tokens: int | None = None,
    token_callback: Optional[Callable[[str], None]] = None,
) -> str:
    """Stream token deltas from the LLM via a thread, emitting each through the callback.

    Returns the full accumulated response string for parsing.
    """
    full_tokens: list[str] = []

    def _collect() -> str:
        for token in stream_chat_completion(messages, system_prompt=system_prompt, max_tokens=max_tokens):
            if token_callback:
                try:
                    token_callback(token)
                except Exception:
                    pass
            full_tokens.append(token)
        return "".join(full_tokens)

    loop = asyncio.get_running_loop()
    result = await asyncio.to_thread(_collect)
    return result