"""
Reolink subnet discovery — scans an IP range, tries Login + GetDevInfo
on each IP via the Reolink HTTP API.
"""
import asyncio
from typing import Optional
from pydantic import BaseModel
import httpx
from fastapi import APIRouter

router = APIRouter()


class DiscoverRequest(BaseModel):
    subnet: str = "10.0.0"
    start: int = 1
    end: int = 254
    username: str = "admin"
    password: str = ""


class DiscoveredCamera(BaseModel):
    ip: str
    name: str
    model: Optional[str] = None
    serial: Optional[str] = None
    firmware: Optional[str] = None
    channels: Optional[int] = None


async def probe_ip(ip: str, username: str, password: str) -> Optional[DiscoveredCamera]:
    """Try Reolink HTTP API Login + GetDevInfo on a single IP."""
    url = f"http://{ip}/cgi-bin/api.cgi?cmd=Login&token=null"
    login_payload = [
        {
            "cmd": "Login",
            "action": 0,
            "param": {"User": {"userName": username, "password": password}},
        }
    ]
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            # Login
            resp = await client.post(url, json=login_payload)
            data = resp.json()
            if not isinstance(data, list) or len(data) == 0:
                return None
            login_result = data[0]
            token = login_result.get("value", {}).get("Token", {}).get("name")
            if not token:
                return None

            # GetDevInfo
            info_url = f"http://{ip}/cgi-bin/api.cgi?cmd=GetDevInfo&token={token}"
            info_resp = await client.post(
                info_url,
                json=[{"cmd": "GetDevInfo", "action": 0, "param": {}}],
            )
            info_data = info_resp.json()
            dev = {}
            if isinstance(info_data, list) and len(info_data) > 0:
                dev = info_data[0].get("value", {}).get("DevInfo", {})

            return DiscoveredCamera(
                ip=ip,
                name=dev.get("name", f"Camera-{ip.split('.')[-1]}"),
                model=dev.get("model"),
                serial=dev.get("serial"),
                firmware=dev.get("firmVer"),
                channels=dev.get("channelNum"),
            )
    except Exception:
        return None


@router.post("/discover")
async def discover_cameras(req: DiscoverRequest):
    """Scan a subnet range for Reolink cameras."""
    start = max(1, min(req.start, 254))
    end = max(start, min(req.end, 254))

    ips = [f"{req.subnet}.{i}" for i in range(start, end + 1)]

    # Run probes concurrently in batches of 20
    found: list[DiscoveredCamera] = []
    batch_size = 20
    for i in range(0, len(ips), batch_size):
        batch = ips[i : i + batch_size]
        results = await asyncio.gather(
            *[probe_ip(ip, req.username, req.password) for ip in batch]
        )
        found.extend([r for r in results if r is not None])

    return {
        "scanned": len(ips),
        "found": len(found),
        "cameras": [c.model_dump() for c in found],
    }
