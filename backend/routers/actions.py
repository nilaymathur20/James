"""Explicit local system actions exposed by the API."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from ..schemas import ActionRequest

router = APIRouter()


@router.post("/system-action")
def system_action(payload: ActionRequest, request: Request) -> dict[str, str]:
    if payload.action_type == "create_file":
        output_dir = Path(request.app.state.output_dir)
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / "agent_output.txt"
            output_path.write_text(payload.target, encoding="utf-8")
        except OSError as exc:
            raise HTTPException(status_code=500, detail="Could not create the output file.") from exc
        return {"status": "success", "message": f"Created file at {output_path}"}

    if payload.action_type == "pyautogui_alert":
        # PyAutoGUI often fails to initialize on a headless server. Importing it
        # only for this route keeps the rest of the API usable in that case.
        try:
            import pyautogui  # type: ignore[import-not-found]
        except Exception as exc:
            raise HTTPException(
                status_code=501,
                detail="PyAutoGUI is unavailable in this server environment.",
            ) from exc

        try:
            pyautogui.alert(text=payload.target, title="Agent Alert")
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Could not show the PyAutoGUI alert.") from exc
        return {"status": "success", "message": "Triggered PyAutoGUI alert."}

    raise HTTPException(status_code=400, detail="Unknown action type.")
