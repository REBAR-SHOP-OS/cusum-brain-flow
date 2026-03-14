"""
Detector — YOLOv8 inference wrapper with class filtering.
"""
from ultralytics import YOLO
from dataclasses import dataclass
import numpy as np

RELEVANT_CLASSES = {"person", "truck", "car", "forklift", "bicycle"}

# Map COCO class IDs to readable names
COCO_MAP = {
    0: "person", 2: "car", 5: "bus", 7: "truck",
    1: "bicycle", 3: "motorcycle",
}


@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    center: tuple[int, int]


class Detector:
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.4):
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold

    def detect(self, frame: np.ndarray) -> list[Detection]:
        results = self.model(frame, conf=self.conf_threshold, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                cls_name = COCO_MAP.get(cls_id, f"class_{cls_id}")
                if cls_name not in RELEVANT_CLASSES:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                detections.append(Detection(
                    class_name=cls_name,
                    confidence=float(box.conf[0]),
                    bbox=(x1, y1, x2, y2),
                    center=(cx, cy),
                ))
        return detections
