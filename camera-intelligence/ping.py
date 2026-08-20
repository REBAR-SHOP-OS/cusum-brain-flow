"""
Local agent relay — camera ping endpoint.
Runs inside the on-premise FastAPI service so it has LAN access.
"""
import socket
import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class PingRequest(BaseModel):
    ip_address: str
    port: int = 554


class PingResponse(BaseModel):
    reachable: bool
    http_reachable: bool
    rtsp_reachable: bool
    latency_ms: float | None = None


@router.post("/ping", response_model=PingResponse)
async def ping_camera(req: PingRequest):
    http_ok = False
    rtsp_ok = False
    latency: float | None = None

    # HTTP probe (port 80)
    import time
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.get(f"http://{req.ip_address}/")
        http_ok = True
        latency = round((time.monotonic() - t0) * 1000, 1)
    except Exception:
        latency = round((time.monotonic() - t0) * 1000, 1)

    # TCP probe on RTSP port
    t1 = time.monotonic()
    try:
        sock = socket.create_connection((req.ip_address, req.port), timeout=5)
        sock.close()
        rtsp_ok = True
        if not http_ok:
            latency = round((time.monotonic() - t1) * 1000, 1)
    except Exception:
        pass

    return PingResponse(
        reachable=http_ok or rtsp_ok,
        http_reachable=http_ok,
        rtsp_reachable=rtsp_ok,
        latency_ms=latency,
    )
