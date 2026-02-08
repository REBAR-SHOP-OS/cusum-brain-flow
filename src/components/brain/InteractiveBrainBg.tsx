import { useState, useCallback, useRef } from "react";
import brainHero from "@/assets/brain-hero.png";

export function InteractiveBrainBg() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) { rafRef.current = null; return; }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      setOffset({ x: dx * 40, y: dy * 30 });
      rafRef.current = null;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="absolute inset-0 pointer-events-auto overflow-hidden"
      aria-hidden="true"
    >
      {/* Outer glow ring */}
      <div
        className="absolute top-1/2 left-1/2 w-[90vw] h-[90vh] rounded-full opacity-10 blur-[120px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.8), hsl(var(--accent) / 0.3) 50%, transparent 70%)",
          transform: `translate(calc(-50% + ${offset.x * 0.3}px), calc(-50% + ${offset.y * 0.3}px))`,
          transition: "transform 0.4s ease-out",
        }}
      />

      {/* Inner glow pulse */}
      <div
        className="absolute top-1/2 left-1/2 w-[70vw] h-[70vh] rounded-full opacity-25 blur-[60px]"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.7), transparent 65%)",
          transform: `translate(calc(-50% + ${offset.x * 0.6}px), calc(-50% + ${offset.y * 0.6}px))`,
          transition: "transform 0.3s ease-out",
          animation: "brain-pulse 4s ease-in-out infinite",
        }}
      />

      {/* Brain image — large & centered */}
      <img
        src={brainHero}
        alt=""
        className="absolute top-1/2 left-1/2 w-[80vh] h-[80vh] max-w-[800px] max-h-[800px] object-contain opacity-[0.18] select-none"
        draggable={false}
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${offset.x * 0.4}deg) scale(${1 + Math.abs(offset.x + offset.y) * 0.003})`,
          transition: "transform 0.2s ease-out",
          filter: "drop-shadow(0 0 60px hsl(var(--primary) / 0.25))",
        }}
      />

      {/* Orbiting particles */}
      {[...Array(10)].map((_, i) => {
        const angle = (i / 10) * 360;
        const radius = 260 + (i % 3) * 80;
        const size = 3 + (i % 4) * 2;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-primary/20"
            style={{
              width: size,
              height: size,
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${offset.x * (0.3 + i * 0.1)}px + ${Math.cos((angle * Math.PI) / 180) * radius}px), calc(-50% + ${offset.y * (0.3 + i * 0.1)}px + ${Math.sin((angle * Math.PI) / 180) * radius}px))`,
              transition: "transform 0.35s ease-out",
              animation: `orbit-float ${4 + i * 0.7}s ease-in-out infinite alternate`,
              boxShadow: "0 0 6px hsl(var(--primary) / 0.3)",
            }}
          />
        );
      })}

      {/* Neural connection lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" style={{ transition: "transform 0.3s ease-out", transform: `translate(${offset.x * 0.15}px, ${offset.y * 0.15}px)` }}>
        {[...Array(5)].map((_, i) => (
          <line
            key={i}
            x1={`${30 + i * 10}%`}
            y1={`${25 + i * 8}%`}
            x2={`${50 + i * 5}%`}
            y2="50%"
            stroke="hsl(var(--primary))"
            strokeWidth="1"
            strokeDasharray="4 8"
            style={{ animation: `dash-flow ${3 + i}s linear infinite` }}
          />
        ))}
      </svg>

      <style>{`
        @keyframes brain-pulse {
          0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.35; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes orbit-float {
          0% { opacity: 0.2; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
        @keyframes dash-flow {
          to { stroke-dashoffset: -24; }
        }
      `}</style>
    </div>
  );
}
