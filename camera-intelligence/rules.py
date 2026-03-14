"""
Rules — Detection-to-ERP event mapping engine.
Maps (detected_class, zone) → ERP event type.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from dataclasses import dataclass
import yaml
from pathlib import Path
from datetime import datetime, time as dtime

router = APIRouter()


@dataclass
class Rule:
    rule_id: str
    detected_class: str
    zone_entity: str  # erp_entity of the zone
    event_type: str
    priority: str  # low, medium, high, critical
    recommended_action: str


class RulesEngine:
    def __init__(self):
        self.rules: list[Rule] = []
        self.after_hours_start = dtime(18, 0)
        self.after_hours_end = dtime(6, 0)

    def load_from_config(self, config_path: str = "config.yaml"):
        cfg = yaml.safe_load(Path(config_path).read_text())
        self.rules = []
        for r in cfg.get("rules", []):
            self.rules.append(Rule(
                rule_id=r["id"],
                detected_class=r["class"],
                zone_entity=r["zone_entity"],
                event_type=r["event_type"],
                priority=r.get("priority", "medium"),
                recommended_action=r.get("action", ""),
            ))
        ah = cfg.get("after_hours", {})
        if ah.get("start"):
            h, m = map(int, ah["start"].split(":"))
            self.after_hours_start = dtime(h, m)
        if ah.get("end"):
            h, m = map(int, ah["end"].split(":"))
            self.after_hours_end = dtime(h, m)

    def is_after_hours(self) -> bool:
        now = datetime.now().time()
        if self.after_hours_start > self.after_hours_end:
            return now >= self.after_hours_start or now <= self.after_hours_end
        return self.after_hours_start <= now <= self.after_hours_end

    def evaluate(self, detected_class: str, zone_entity: str) -> Rule | None:
        for r in self.rules:
            if r.detected_class == detected_class and r.zone_entity == zone_entity:
                return r
        # Check after-hours motion
        if self.is_after_hours() and detected_class == "person":
            return Rule(
                rule_id="auto_after_hours",
                detected_class="person",
                zone_entity=zone_entity,
                event_type="after_hours_motion",
                priority="high",
                recommended_action="Review camera feed — after-hours person detected",
            )
        return None


# Global instance
rules_engine = RulesEngine()


class RuleUpdate(BaseModel):
    rules: list[dict]


@router.post("/update")
async def update_rules(payload: RuleUpdate):
    cfg_path = Path("config.yaml")
    cfg = yaml.safe_load(cfg_path.read_text())
    cfg["rules"] = payload.rules
    cfg_path.write_text(yaml.dump(cfg, default_flow_style=False))
    rules_engine.load_from_config()
    return {"status": "ok", "rules": len(rules_engine.rules)}


@router.get("/list")
async def list_rules():
    return [
        {
            "rule_id": r.rule_id,
            "class": r.detected_class,
            "zone_entity": r.zone_entity,
            "event_type": r.event_type,
            "priority": r.priority,
            "action": r.recommended_action,
        }
        for r in rules_engine.rules
    ]
