import { useState, useRef, useCallback, useEffect } from "react";

const DRAG_THRESHOLD = 5;

interface Position { x: number; y: number }

interface UseDraggablePositionOptions {
  storageKey: string;
  btnSize?: number;
  defaultPos?: (isMobile: boolean) => Position;
}

function getDefault(btnSize: number) {
  return {
    x: typeof window !== "undefined" ? window.innerWidth - btnSize - 24 : 300,
    y: typeof window !== "undefined" ? window.innerHeight - btnSize - 24 : 300,
  };
}

function clamp(x: number, y: number, btnSize: number): Position {
  const maxX = window.innerWidth - btnSize;
  const maxY = window.innerHeight - btnSize;
  return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
}

function loadPos(key: string, btnSize: number, customDefault?: (isMobile: boolean) => Position): Position {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === "number" && typeof p.y === "number") {
        const maxX = window.innerWidth - btnSize;
        const maxY = window.innerHeight - btnSize;
        if (p.x < 0 || p.y < 0 || p.x > maxX || p.y > maxY) {
          localStorage.removeItem(key);
          return customDefault ? customDefault(false) : getDefault(btnSize);
        }
        return p;
      }
    }
  } catch {}
  return customDefault ? customDefault(false) : getDefault(btnSize);
}

export function useDraggablePosition({ storageKey, btnSize = 56, defaultPos }: UseDraggablePositionOptions) {
  const [pos, setPos] = useState<Position>(() => loadPos(storageKey, btnSize, defaultPos));
  const dragging = useRef(false);
  const startPointer = useRef<Position>({ x: 0, y: 0 });
  const startPos = useRef<Position>({ x: 0, y: 0 });
  const moved = useRef(false);
  const wasDragged = useRef(false);

  // Re-clamp on resize
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y, btnSize));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [btnSize]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    wasDragged.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved.current = true;
    }
    setPos(clamp(startPos.current.x + dx, startPos.current.y + dy, btnSize));
  }, [btnSize]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (moved.current) {
      wasDragged.current = true;
      const final = clamp(
        startPos.current.x + e.clientX - startPointer.current.x,
        startPos.current.y + e.clientY - startPointer.current.y,
        btnSize
      );
      setPos(final);
      localStorage.setItem(storageKey, JSON.stringify(final));
    }
  }, [btnSize, storageKey]);

  return {
    pos,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
    wasDragged,
  };
}
