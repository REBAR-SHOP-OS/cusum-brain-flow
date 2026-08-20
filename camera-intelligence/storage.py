"""
Storage — Snapshot saving for detection events.
"""
import cv2
import numpy as np
from pathlib import Path
from datetime import datetime

SNAPSHOT_DIR = Path("snapshots")
SNAPSHOT_DIR.mkdir(exist_ok=True)


def save_snapshot(
    frame: np.ndarray,
    camera_id: str,
    event_type: str,
    detections: list | None = None,
) -> str:
    """Save a detection snapshot with optional bounding box overlay. Returns file path."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{camera_id}_{event_type}_{timestamp}.jpg"
    filepath = SNAPSHOT_DIR / filename

    # Draw bounding boxes if detections provided
    if detections:
        frame = frame.copy()
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = (0, 0, 255) if "unauthorized" in event_type else (0, 255, 0)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{det.class_name} {det.confidence:.0%}"
            cv2.putText(frame, label, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    cv2.imwrite(str(filepath), frame)
    return str(filepath)


def cleanup_old_snapshots(max_age_hours: int = 72):
    """Remove snapshots older than max_age_hours."""
    cutoff = datetime.now().timestamp() - (max_age_hours * 3600)
    for f in SNAPSHOT_DIR.iterdir():
        if f.stat().st_mtime < cutoff:
            f.unlink()
