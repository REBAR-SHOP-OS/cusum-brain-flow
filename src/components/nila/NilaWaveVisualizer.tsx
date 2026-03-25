import { useEffect, useRef } from "react";
import { NilaStatus } from "@/hooks/useNilaVoiceAssistant";

interface Props {
  status: NilaStatus;
}

export function NilaWaveVisualizer({ status }: Props) {
  const barsRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>();

  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    const bars = el.children;
    let t = 0;

    const animate = () => {
      t += 0.05;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i] as HTMLElement;
        let h: number;
        if (status === "listening") {
          h = 4 + Math.random() * 28;
        } else if (status === "speaking" || status === "processing") {
          h = 4 + (Math.sin(t * 3 + i * 0.4) + 1) * 16;
        } else {
          h = 2;
        }
        bar.style.height = `${h}px`;
      }
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [status]);

  const isActive = status === "listening" || status === "speaking" || status === "processing";

  return (
    <div className="flex items-center justify-center h-12 gap-[3px]" ref={barsRef}>
      {Array.from({ length: 32 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-colors duration-300"
          style={{
            height: "2px",
            background: isActive
              ? status === "speaking"
                ? `linear-gradient(to top, hsl(210, 100%, 60%), hsl(280, 80%, 65%))`
                : `hsl(210, 100%, 60%)`
              : "hsl(0, 0%, 30%)",
          }}
        />
      ))}
    </div>
  );
}
