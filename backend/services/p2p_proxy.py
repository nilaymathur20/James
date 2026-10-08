import httpx
from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from backend.services.trust_store import TrustStore
from pathlib import Path
import os

# Maximum request body size forwarded to a peer (1 MB).
MAX_BODY_SIZE = 1_000_000

# Headers safe to forward from a trusted peer response.
_PROXY_SAFE_HEADERS = frozenset({
    "content-type",
    "content-length",
    "cache-control",
    "content-encoding",
    "content-language",
    "content-location",
    "content-disposition",
    "expires",
    "last-modified",
    "etag",
    "accept-ranges",
    "range",
    "x-request-id",
})

# Module-level TrustStore cache — avoids opening SQLite on every proxied request.
_trust_store: TrustStore | None = None
_trust_store_path: str | None = None


def _get_trust_store() -> TrustStore:
    global _trust_store, _trust_store_path
    db_path = Path(os.getenv("RAG_DB_PATH", "data/rag_index.db"))
    path_str = str(db_path)
    if _trust_store is None or _trust_store_path != path_str:
        _trust_store = TrustStore(db_path)
        _trust_store_path = path_str
    return _trust_store

class P2PProxyMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        target_peer_id = request.headers.get("X-James-Target-Peer")

        if not target_peer_id:
            return await call_next(request)

        # Verify target peer is trusted
        store = _get_trust_store()
        device = store.get_device(target_peer_id)

        if not device or device.revoked:
            raise HTTPException(status_code=403, detail="Target peer not trusted or revoked")

        # Use the address stored at pairing time — never construct a URL from
        # user-supplied device_id (SSRF prevention).
        peer_address = device.address
        if not peer_address:
            raise HTTPException(status_code=400, detail="Trusted peer has no configured address")

        # Normalize the path: reject traversal sequences and double-slash redirects.
        forward_path = request.url.path
        if ".." in forward_path or "//" in forward_path:
            raise HTTPException(status_code=400, detail="Invalid request path.")

        # Join peer address and path safely: strip trailing slash from peer
        # address to avoid double-slash when forward_path starts with '/'.
        peer_address = peer_address.rstrip("/")
        url = f"{peer_address}{forward_path}"
        if request.url.query:
            url += f"?{request.url.query}"

        # Check content-length if provided.
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            raise HTTPException(status_code=413, detail="Request body too large")

        body = await request.body()
        if len(body) > MAX_BODY_SIZE:
            raise HTTPException(status_code=413, detail="Request body too large")

        async with httpx.AsyncClient() as client:
            try:
                # Forward the request
                proxy_resp = await client.request(
                    method=request.method,
                    url=url,
                    headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
                    content=body,
                    timeout=10.0
                )

                # Filter response headers: only forward safe headers.
                # Prevents leaking Set-Cookie, Server, X-Powered-By, etc.
                filtered_headers = {
                    k: v for k, v in proxy_resp.headers.items()
                    if k.lower() in _PROXY_SAFE_HEADERS
                }

                return Response(
                    content=proxy_resp.content,
                    status_code=proxy_resp.status_code,
                    headers=filtered_headers,
                )
            except httpx.TimeoutException as e:
                raise HTTPException(status_code=504, detail=f"Remote peer timed out: {str(e)}")
            except httpx.ConnectError as e:
                raise HTTPException(status_code=502, detail=f"Remote peer unreachable: {str(e)}")
            except httpx.NetworkError as e:
                raise HTTPException(status_code=502, detail=f"Network error to peer: {str(e)}")
            except httpx.RemoteProtocolError as e:
                raise HTTPException(status_code=502, detail=f"Peer returned invalid response: {str(e)}")
