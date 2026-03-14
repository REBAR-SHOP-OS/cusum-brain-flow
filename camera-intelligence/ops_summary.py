"""
Ops Summary — Health summary builder for ERP operations.
"""
from fastapi import APIRouter
import erp_adapter

router = APIRouter()


def categorize_machines(machines: list[dict]) -> dict:
    idle, running, blocked, down = [], [], [], []
    for m in machines:
        status = (m.get("status") or "").lower()
        if status in ("running", "active"):
            running.append(m)
        elif status in ("blocked", "error", "fault"):
            blocked.append(m)
        elif status in ("down", "offline", "maintenance"):
            down.append(m)
        else:
            idle.append(m)
    return {"idle": idle, "running": running, "blocked": blocked, "down": down}


def categorize_orders(orders: list[dict]) -> dict:
    waiting, in_production, ready_delivery, completed = [], [], [], []
    for o in orders:
        status = (o.get("status") or "").lower()
        if status in ("pending", "queued", "new"):
            waiting.append(o)
        elif status in ("in_production", "cutting", "bending", "processing"):
            in_production.append(o)
        elif status in ("ready", "ready_for_delivery", "complete"):
            ready_delivery.append(o)
        elif status in ("delivered", "closed"):
            completed.append(o)
        else:
            waiting.append(o)
    return {
        "waiting_production": waiting,
        "in_production": in_production,
        "ready_for_delivery": ready_delivery,
        "completed": completed,
    }


@router.get("/summary")
async def ops_summary():
    machines = await erp_adapter.get_machines()
    orders = await erp_adapter.get_orders()
    deliveries = await erp_adapter.get_deliveries()
    cut_plans = await erp_adapter.get_cut_plans()

    m_cat = categorize_machines(machines)
    o_cat = categorize_orders(orders)

    return {
        "machines": {
            "total": len(machines),
            "idle": len(m_cat["idle"]),
            "running": len(m_cat["running"]),
            "blocked": len(m_cat["blocked"]),
            "down": len(m_cat["down"]),
        },
        "orders": {
            "total": len(orders),
            "waiting_production": len(o_cat["waiting_production"]),
            "in_production": len(o_cat["in_production"]),
            "ready_for_delivery": len(o_cat["ready_for_delivery"]),
            "completed": len(o_cat["completed"]),
        },
        "deliveries": {
            "total": len(deliveries),
            "pending": len([d for d in deliveries if (d.get("status") or "").lower() in ("pending", "scheduled")]),
            "in_transit": len([d for d in deliveries if (d.get("status") or "").lower() == "in_transit"]),
            "completed": len([d for d in deliveries if (d.get("status") or "").lower() in ("delivered", "completed")]),
        },
        "cut_plans": {
            "total": len(cut_plans),
        },
    }


@router.get("/machines")
async def list_machines():
    return await erp_adapter.get_machines()


@router.get("/orders")
async def list_orders():
    return await erp_adapter.get_orders()


@router.get("/deliveries")
async def list_deliveries():
    return await erp_adapter.get_deliveries()
