

# Production Visibility + Dispatch Intelligence Module

## What We're Building

Two parallel deliverables:

1. **Python FastAPI service** (reference code, deployed externally) — connects Reolink cameras + YOLOv8 to ERP data
2. **Lovable-side integration** — database table, webhook edge function, React dashboard page

## Part A — Python FastAPI Service (10 files)

Reference files under `camera-intelligence/` in project root. These are deployed separately on your own server/Docker.

| File | Purpose |
|---|---|
| `main.py` | FastAPI app with all routers, CORS, lifespan startup |
| `erp_adapter.py` | Reads machines/orders/cut_plans/deliveries from Supabase REST API |
| `camera.py` | RTSP stream manager, frame capture via OpenCV |
| `detector.py` | YOLOv8 inference, class filtering (person/truck/forklift/pallet) |
| `zones.py` | Polygon zone engine with point-in-zone checks |
| `rules.py` | `(class, zone)` → ERP event mapping (truck+loading_dock → truck_arrived) |
| `events.py` | Event generation, JSONL file logging, webhook POST to Lovable edge function |
| `alerts.py` | Webhook + Telegram placeholder alert routing |
| `ops_summary.py` | Health summary: idle/running/blocked machines, order bottlenecks |
| `config.yaml` | Zone polygons, camera URLs, alert thresholds, ERP connection |
| `requirements.txt` | fastapi, uvicorn, opencv-python, ultralytics, shapely, httpx, pyyaml |

Key features:
- **Zone Engine**: polygon coords, allowed_classes, priority, linked ERP entity
- **Rules Engine**: detection → ERP event mapping
- **Dispatch Readiness**: truck at loading zone + order ready → `dispatch_ready_event`
- **Machine Utilization**: camera activity vs ERP machine status → anomaly events
- **JSONL logging**: full event context with snapshot_path, recommended_action

Endpoints: `GET /ops/summary`, `/ops/machines`, `/ops/orders`, `/ops/deliveries`, `/events/recent`, `POST /zones/update`, `/rules/update`, `/alerts/test`, `GET /system/health`

## Part B — Lovable Integration

### 1. DB Migration: `camera_events` table
```sql
CREATE TABLE public.camera_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  camera_id text,
  zone text,
  detected_class text,
  confidence numeric,
  related_machine_id uuid REFERENCES machines(id),
  related_order_id uuid REFERENCES work_orders(id),
  related_delivery_id uuid,
  snapshot_url text,
  recommended_action text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
-- RLS: company_id scoped read for authenticated users
-- Realtime enabled
```

### 2. Edge Function: `camera-events`
- POST webhook receiver with API-key auth (not JWT — external FastAPI caller)
- Validates payload, inserts into `camera_events`
- Returns 200 with event ID

### 3. React Page: `src/pages/CameraIntelligence.tsx`
Route: `/shopfloor/camera-intelligence`

Four panels:
- **Live Event Feed** — realtime table with event type badges, zone, confidence, timestamps
- **Dispatch Readiness** — highlights `dispatch_ready_event` and `truck_arrived`
- **Machine Anomaly** — utilization mismatches (idle-but-active, running-but-empty)
- **Zone Status Grid** — cards per zone showing last activity and alert level

### 4. Wiring
- Add hub card to `ShopFloor.tsx` (Camera icon, "CAMERA AI" label)
- Add route in `App.tsx`
- Add to `useActiveModule.ts`

## Files Created/Modified
- **Created**: `camera-intelligence/` (10 Python files), `src/pages/CameraIntelligence.tsx`, `supabase/functions/camera-events/index.ts`
- **Modified**: `src/pages/ShopFloor.tsx`, `src/App.tsx`, `src/hooks/useActiveModule.ts`
- **Migration**: 1 (camera_events table + RLS + realtime)

