"""
Events — Event generation, JSONL file logging, webhook POST to Lovable edge function.
"""
import json
import httpx
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "events.jsonl"


class CameraEvent(BaseModel):
    event_type: str
    camera_id: str = ""
    zone: str = ""
    detected_class: str = ""
    confidence: float = 0.0
    related_machine_id: str | None = None
    related_order_id: str | None = None
    related_delivery_id: str | None = None
    snapshot_path: str = ""
    recommended_action: str = ""
    metadata: dict = {}


def build_event(
    event_type: str,
    camera_id: str = "",
    zone: str = "",
    detected_class: str = "",
    confidence: float = 0.0,
    related_machine: str | None = None,
    related_order: str | None = None,
    related_delivery: str | None = None,
    snapshot_path: str = "",
    recommended_action: str = "",
    metadata: dict | None = None,
) -> dict:
    return {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "camera_id": camera_id,
        "zone": zone,
        "detected_class": detected_class,
        "confidence": round(confidence, 3),
        "related_machine_id": related_machine,
        "related_order_id": related_order,
        "related_delivery_id": related_delivery,
        "snapshot_path": snapshot_path,
        "recommended_action": recommended_action,
        "metadata": metadata or {},
    }


def log_event(event: dict):
    """Append event to JSONL log file."""
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(event) + "\n")


async def push_to_erp(event: dict, webhook_url: str, api_key: str, company_id: str):
    """POST event to Lovable edge function webhook."""
    payload = {**event, "company_id": company_id}
    # Remove snapshot_path, add snapshot_url if available
    payload.pop("snapshot_path", None)
    payload.pop("timestamp", None)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                webhook_url,
                json=payload,
                headers={"x-camera-api-key": api_key, "Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        print(f"[Events] Webhook push failed: {e}")
        return None


def read_recent_events(limit: int = 50) -> list[dict]:
    """Read last N events from JSONL log."""
    if not LOG_FILE.exists():
        return []
    lines = LOG_FILE.read_text().strip().split("\n")
    events = []
    for line in reversed(lines[-limit:]):
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


@router.get("/recent")
async def recent_events(limit: int = 50):
    return read_recent_events(limit)
