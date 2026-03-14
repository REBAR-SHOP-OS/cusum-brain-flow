"""
Zones — Polygon zone engine with point-in-zone checks.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from shapely.geometry import Point, Polygon
from dataclasses import dataclass
import yaml
from pathlib import Path

router = APIRouter()


@dataclass
class Zone:
    zone_id: str
    label: str
    polygon: Polygon
    allowed_classes: list[str]
    priority: int
    erp_entity: str  # e.g. "loading_dock", "cutter_area"


class ZoneEngine:
    def __init__(self):
        self.zones: list[Zone] = []

    def load_from_config(self, config_path: str = "config.yaml"):
        cfg = yaml.safe_load(Path(config_path).read_text())
        self.zones = []
        for z in cfg.get("zones", []):
            self.zones.append(Zone(
                zone_id=z["id"],
                label=z["label"],
                polygon=Polygon(z["polygon"]),
                allowed_classes=z.get("allowed_classes", []),
                priority=z.get("priority", 5),
                erp_entity=z.get("erp_entity", ""),
            ))

    def find_zone(self, x: int, y: int) -> Zone | None:
        pt = Point(x, y)
        for z in sorted(self.zones, key=lambda z: z.priority):
            if z.polygon.contains(pt):
                return z
        return None

    def is_allowed(self, zone: Zone, class_name: str) -> bool:
        if not zone.allowed_classes:
            return True
        return class_name in zone.allowed_classes

    def to_dict(self) -> list[dict]:
        return [
            {
                "zone_id": z.zone_id,
                "label": z.label,
                "polygon": list(z.polygon.exterior.coords),
                "allowed_classes": z.allowed_classes,
                "priority": z.priority,
                "erp_entity": z.erp_entity,
            }
            for z in self.zones
        ]


# Global instance
zone_engine = ZoneEngine()


class ZoneUpdate(BaseModel):
    zones: list[dict]


@router.post("/update")
async def update_zones(payload: ZoneUpdate):
    """Hot-reload zone config."""
    cfg_path = Path("config.yaml")
    cfg = yaml.safe_load(cfg_path.read_text())
    cfg["zones"] = payload.zones
    cfg_path.write_text(yaml.dump(cfg, default_flow_style=False))
    zone_engine.load_from_config()
    return {"status": "ok", "zones": len(zone_engine.zones)}


@router.get("/list")
async def list_zones():
    return zone_engine.to_dict()
