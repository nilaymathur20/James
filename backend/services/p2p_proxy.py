import httpx
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from backend.services.trust_store import TrustStore
from pathlib import Path
import os

class P2PProxyMiddleware(BaseHTTPMiddleware):
    """
    Middleware to route requests to remote peers if a 'X-James-Target-Peer'
    header is present and the peer is trusted.
    """
    async def dispatch(self, request: Request, call_next):
        target_peer_id = request.headers.get("X-James-Target-Peer")

        if not target_peer_id:
            return await call_next(request)

        # Verify target peer is trusted
        db_path = Path(os.getenv("RAG_DB_PATH", "data/rag_index.db"))
        store = TrustStore(db_path)
        device = store.get_device(target_peer_id)

        if not device or device.revoked:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Target peer not trusted or revoked")

        # In a full implementation, this would use the P2P data channel.
        # For this architectural implementation, we route via HTTP to the peer's known address.
        # This assumes the P2P layer has updated the trust store with current IP:Port.

        # We need to resolve the PeerID to an actual network address.
        # Since the TrustStore currently only stores metadata, we'll assume a naming convention
        # or a lookup service. Here we use a placeholder for the actual P2P address resolution.
        peer_address = f"http://{target_peer_id}:8000" # Placeholder

        url = f"{peer_address}{request.url.path}"
        if request.url.query:
            url += f"?{request.url.query}"

        async with httpx.AsyncClient() as client:
            try:
                # Forward the request
                proxy_resp = await client.request(
                    method=request.method,
                    url=url,
                    headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
                    content=await request.body(),
                    timeout=10.0
                )

                return Response(
                    content=proxy_resp.content,
                    status_code=proxy_resp.status_code,
                    headers=dict(proxy_resp.headers)
                )
            except Exception as e:
                from fastapi import HTTPException
                raise HTTPException(status_code=502, detail=f"Remote peer unreachable: {str(e)}")
