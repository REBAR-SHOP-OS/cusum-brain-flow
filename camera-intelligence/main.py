"""
Camera Intelligence — FastAPI entry point.
Mounts all routers, CORS, lifespan startup.
Deploy separately on your own server or Docker.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ops_summary import router as ops_router
from events import router as events_router
from zones import router as zones_router
from rules import router as rules_router
from alerts import router as alerts_router
from ping import router as ping_router
from discover import router as discover_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Camera Intelligence] Starting up...")
    yield
    print("[Camera Intelligence] Shutting down...")


app = FastAPI(
    title="Camera Intelligence — Rebar ERP",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(ops_router, prefix="/ops", tags=["Operations"])
app.include_router(events_router, prefix="/events", tags=["Events"])
app.include_router(zones_router, prefix="/zones", tags=["Zones"])
app.include_router(rules_router, prefix="/rules", tags=["Rules"])
app.include_router(alerts_router, prefix="/alerts", tags=["Alerts"])
app.include_router(ping_router, prefix="/agent", tags=["Agent Relay"])
app.include_router(discover_router, prefix="/agent", tags=["Discovery"])


@app.get("/system/health")
async def health():
    return {"status": "ok", "service": "camera-intelligence", "version": "1.0.0"}
