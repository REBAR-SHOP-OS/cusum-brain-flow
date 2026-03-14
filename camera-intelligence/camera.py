"""
Camera — RTSP/Reolink stream manager and frame capture via OpenCV.
"""
import cv2
import threading
import time
from dataclasses import dataclass, field


@dataclass
class CameraStream:
    camera_id: str
    rtsp_url: str
    _cap: cv2.VideoCapture | None = field(default=None, repr=False)
    _frame: any = field(default=None, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _running: bool = False

    def start(self):
        self._cap = cv2.VideoCapture(self.rtsp_url)
        self._running = True
        threading.Thread(target=self._capture_loop, daemon=True).start()

    def _capture_loop(self):
        while self._running and self._cap and self._cap.isOpened():
            ret, frame = self._cap.read()
            if ret:
                with self._lock:
                    self._frame = frame
            time.sleep(0.033)  # ~30 FPS cap

    def get_frame(self):
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    def stop(self):
        self._running = False
        if self._cap:
            self._cap.release()


class CameraManager:
    def __init__(self, camera_configs: list[dict]):
        self.streams: dict[str, CameraStream] = {}
        for cfg in camera_configs:
            s = CameraStream(camera_id=cfg["id"], rtsp_url=cfg["rtsp_url"])
            self.streams[cfg["id"]] = s

    def start_all(self):
        for s in self.streams.values():
            s.start()

    def get_frame(self, camera_id: str):
        s = self.streams.get(camera_id)
        return s.get_frame() if s else None

    def stop_all(self):
        for s in self.streams.values():
            s.stop()
