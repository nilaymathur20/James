"""Pydantic request schemas shared by API routers."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20_000)
    use_history: bool = True


class AssistantRequest(BaseModel):
    """Input to the one-box text/voice command interface."""

    text: str = Field(..., min_length=1, max_length=20_000)
    use_history: bool = True
    source: str = Field(default="typed", max_length=30)


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=20_000)
    top_k: int = Field(default=5, ge=1, le=10)
    include_history: bool = False


class IndexFolderRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=4_000)
    replace: bool = False


class ScrapeRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=4_000)


class FileSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2_000)
    limit: int = Field(default=10, ge=1, le=50)


class FilePreviewRequest(BaseModel):
    file_id: str = Field(..., min_length=1, max_length=100)
    max_chars: int = Field(default=20_000, ge=1, le=20_000)


class OpenFileRequest(BaseModel):
    file_id: str = Field(..., min_length=1, max_length=100)
    confirmed: bool = False


class EditProposalRequest(BaseModel):
    file_id: str = Field(..., min_length=1, max_length=100)
    old_text: str = Field(..., min_length=1, max_length=200_000)
    new_text: str = Field(..., max_length=200_000)


class ApplyEditRequest(BaseModel):
    proposal_id: str = Field(..., min_length=1, max_length=100)
    confirmed: bool = False


class UndoEditRequest(BaseModel):
    backup_id: str = Field(..., min_length=1, max_length=100)
    confirmed: bool = False


class ActionRequest(BaseModel):
    action_type: str = Field(..., min_length=1, max_length=100)
    target: str = Field(default="", max_length=1_000_000)
