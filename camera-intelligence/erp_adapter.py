"""
ERP Adapter — reads machines, orders, cut_plans, deliveries from Supabase REST API.
"""
import httpx
import yaml
from pathlib import Path

_cfg = yaml.safe_load(Path("config.yaml").read_text())
SUPABASE_URL = _cfg["erp"]["supabase_url"]
SUPABASE_KEY = _cfg["erp"]["supabase_service_key"]
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


async def _get(table: str, params: dict | None = None) -> list[dict]:
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        r = await client.get(url, headers=HEADERS, params=params or {})
        r.raise_for_status()
        return r.json()


async def get_machines() -> list[dict]:
    return await _get("machines", {"select": "*"})


async def get_orders() -> list[dict]:
    return await _get("work_orders", {"select": "*", "order": "created_at.desc", "limit": "200"})


async def get_cut_plans() -> list[dict]:
    return await _get("cut_plans", {"select": "*", "order": "created_at.desc", "limit": "100"})


async def get_deliveries() -> list[dict]:
    return await _get("deliveries", {"select": "*", "order": "created_at.desc", "limit": "100"})
