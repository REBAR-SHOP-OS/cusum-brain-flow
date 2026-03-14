"""
Alerts — Webhook and Telegram placeholder alert routing.
"""
import httpx
from fastapi import APIRouter
from pydantic import BaseModel
import yaml
from pathlib import Path

router = APIRouter()

HIGH_PRIORITY_EVENTS = {
    "after_hours_motion",
    "unauthorized_zone_entry",
    "truck_arrived_no_dispatch",
    "utilization_anomaly",
}


class AlertPayload(BaseModel):
    event_type: str
    zone: str = ""
    detected_class: str = ""
    confidence: float = 0.0
    recommended_action: str = ""
    camera_id: str = ""
    message: str = ""


async def send_webhook_alert(event: dict, webhook_url: str):
    """POST alert to configured webhook endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json=event)
            r.raise_for_status()
            return True
    except Exception as e:
        print(f"[Alert] Webhook failed: {e}")
        return False


async def send_telegram_alert(event: dict, bot_token: str, chat_id: str):
    """Placeholder — send alert to Telegram bot."""
    msg = (
        f"🚨 *{event.get('event_type', 'ALERT')}*\n"
        f"Zone: {event.get('zone', '—')}\n"
        f"Class: {event.get('detected_class', '—')}\n"
        f"Action: {event.get('recommended_action', '—')}\n"
        f"Camera: {event.get('camera_id', '—')}"
    )
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json={
                "chat_id": chat_id,
                "text": msg,
                "parse_mode": "Markdown",
            })
            r.raise_for_status()
            return True
    except Exception as e:
        print(f"[Alert] Telegram failed: {e}")
        return False


async def route_alert(event: dict):
    """Route alert based on priority and config."""
    if event.get("event_type") not in HIGH_PRIORITY_EVENTS:
        return

    cfg = yaml.safe_load(Path("config.yaml").read_text())
    alert_cfg = cfg.get("alerts", {})

    if alert_cfg.get("webhook_url"):
        await send_webhook_alert(event, alert_cfg["webhook_url"])

    if alert_cfg.get("telegram_bot_token") and alert_cfg.get("telegram_chat_id"):
        await send_telegram_alert(
            event,
            alert_cfg["telegram_bot_token"],
            alert_cfg["telegram_chat_id"],
        )


@router.post("/test")
async def test_alert(payload: AlertPayload):
    """Send a test alert through all configured channels."""
    event = payload.model_dump()
    event["event_type"] = event.get("event_type", "test_alert")

    cfg = yaml.safe_load(Path("config.yaml").read_text())
    alert_cfg = cfg.get("alerts", {})
    results = {}

    if alert_cfg.get("webhook_url"):
        results["webhook"] = await send_webhook_alert(event, alert_cfg["webhook_url"])
    if alert_cfg.get("telegram_bot_token"):
        results["telegram"] = await send_telegram_alert(
            event,
            alert_cfg["telegram_bot_token"],
            alert_cfg.get("telegram_chat_id", ""),
        )

    return {"status": "ok", "results": results}
