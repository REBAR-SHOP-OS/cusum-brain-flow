import { useState, useCallback, useRef } from "react";
import brainHero from "@/assets/brain-hero.png";

export function InteractiveBrainBg() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const updateOffset = useCallback((clientX: number, clientY: number) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) { rafRef.current = null; return; }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (clientX - cx) / rect.width;
      const dy = (clientY - cy) / rect.height;
      setOffset({ x: dx * 40, y: dy * 30 });
      rafRef.current = null;
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateOffset(e.clientX, e.clientY);
  }, [updateOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) updateOffset(touch.clientX, touch.clientY);
  }, [updateOffset]);

  const resetOffset = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  // Neural pathway data (percentage-based for responsiveness)
  const neuralPaths = [
    "M50,50 Q30,20 15,10", "M50,50 Q70,20 85,8",
    "M50,50 Q25,50 5,45", "M50,50 Q75,50 95,55",
    "M50,50 Q35,75 10,90", "M50,50 Q65,75 90,92",
    "M50,50 Q40,30 20,5", "M50,50 Q60,30 80,5",
    "M50,50 Q30,65 8,70", "M50,50 Q70,65 92,72",
    "M50,50 Q50,25 50,2", "M50,50 Q50,75 50,98",
  ];

  // Electric arc paths (jagged zigzag)
  const arcPaths = [
    "M45,48 L38,35 L42,30 L35,18 L40,12",
    "M55,48 L62,32 L58,25 L65,15 L60,8",
    "M48,55 L35,65 L40,72 L28,82 L35,90",
  ];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetOffset}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetOffset}
      className="absolute inset-0 pointer-events-auto overflow-hidden"
      aria-hidden="true"
    >
      {/* Outer glow */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full opacity-35 blur-[80px]"
        style={{
          width: "110vmin", height: "110vmin",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.9), hsl(var(--accent) / 0.4) 50%, transparent 70%)",
          transform: `translate(calc(-50% + ${offset.x * 0.3}px), calc(-50% + ${offset.y * 0.3}px))`,
          transition: "transform 0.4s ease-out",
        }}
      />

      {/* Inner glow pulse */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full blur-[40px]"
        style={{
          width: "75vmin", height: "75vmin",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.8), transparent 65%)",
          transform: `translate(calc(-50% + ${offset.x * 0.6}px), calc(-50% + ${offset.y * 0.6}px))`,
          transition: "transform 0.3s ease-out",
          animation: "brain-pulse 4s ease-in-out infinite",
        }}
      />

      {/* Scanning ring */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full border border-primary/30"
        style={{
          width: "30vmin", height: "30vmin",
          transform: "translate(-50%, -50%)",
          animation: "scan-ring 4s ease-out infinite",
        }}
      />

      {/* Brain image */}
      <img
        src={brainHero}
        alt=""
        className="absolute top-1/2 left-1/2 object-contain select-none"
        draggable={false}
        style={{
          width: "clamp(250px, 70vmin, 700px)",
          height: "clamp(250px, 70vmin, 700px)",
          opacity: 0.55,
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${offset.x * 0.4}deg) scale(${1 + Math.abs(offset.x + offset.y) * 0.003})`,
          transition: "transform 0.2s ease-out",
          filter: "drop-shadow(0 0 60px hsl(var(--primary) / 0.5)) drop-shadow(0 0 120px hsl(var(--primary) / 0.25))",
        }}
      />

      {/* Particles */}
      {[...Array(20)].map((_, i) => {
        const angle = (i / 20) * 360;
        const size = 4 + (i % 4) * 2;
        const hasSpark = i % 5 === 0;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size, height: size,
              top: "50%", left: "50%",
              background: "hsl(var(--primary) / 0.5)",
              boxShadow: "0 0 12px hsl(var(--primary) / 0.4)",
              transform: `translate(calc(-50% + ${offset.x * (0.3 + i * 0.08)}px + ${Math.cos((angle * Math.PI) / 180) * 1}px), calc(-50% + ${offset.y * (0.3 + i * 0.08)}px + ${Math.sin((angle * Math.PI) / 180) * 1}px))`,
              // Orbit via CSS custom property
              // @ts-ignore
              "--orbit-r": `clamp(80px, ${12 + (i % 3) * 5}vmin, 300px)`,
              "--orbit-angle": `${angle}deg`,
              transition: "transform 0.35s ease-out",
              animation: `orbit-move ${4 + i * 0.5}s linear infinite${hasSpark ? `, electric-spark ${3 + i * 0.7}s ease-in-out infinite` : ""}`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Neural network SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{
          opacity: 0.18,
          transform: `translate(${offset.x * 0.15}px, ${offset.y * 0.15}px)`,
          transition: "transform 0.3s ease-out",
        }}
      >
        {/* Neural pathways with pulse */}
        {neuralPaths.map((d, i) => (
          <g key={`path-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.3"
              strokeDasharray="2 3"
              style={{ animation: `dash-flow ${3 + i * 0.4}s linear infinite` }}
            />
            {/* Pulse dot traveling along path */}
            <circle r="0.6" fill="hsl(var(--primary))" opacity="0.7">
              <animateMotion
                dur={`${2.5 + i * 0.3}s`}
                repeatCount="indefinite"
                path={d}
              />
              <animate
                attributeName="opacity"
                values="0.2;0.9;0.2"
                dur={`${2.5 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </circle>
            {/* Endpoint glow */}
            <circle
              cx={d.split(" ").pop()?.split(",")[0]}
              cy={d.split(" ").pop()?.split(",")[1]}
              r="0.8"
              fill="hsl(var(--primary))"
              opacity="0.4"
              style={{ animation: `endpoint-pulse ${2 + i * 0.5}s ease-in-out infinite` }}
            />
          </g>
        ))}

        {/* Electric arcs */}
        {arcPaths.map((d, i) => (
          <path
            key={`arc-${i}`}
            d={d}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.4"
            strokeLinecap="round"
            style={{ animation: `arc-flicker ${3 + i * 1.5}s ease-in-out infinite ${i * 1.2}s` }}
          />
        ))}
      </svg>

      <style>{`
        @keyframes brain-pulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.06); }
        }
        @keyframes orbit-move {
          from { rotate: 0deg; }
          to { rotate: 360deg; }
        }
        @keyframes electric-spark {
          0%, 85%, 100% { opacity: 0.3; box-shadow: 0 0 12px hsl(var(--primary) / 0.4); }
          90% { opacity: 1; box-shadow: 0 0 24px hsl(var(--primary) / 0.9), 0 0 48px hsl(var(--primary) / 0.4); }
        }
        @keyframes arc-flicker {
          0%, 70%, 100% { opacity: 0; }
          75% { opacity: 0.5; }
          80% { opacity: 0.1; }
          85% { opacity: 0.6; }
          90% { opacity: 0; }
        }
        @keyframes scan-ring {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.35; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes dash-flow {
          to { stroke-dashoffset: -20; }
        }
        @keyframes endpoint-pulse {
          0%, 100% { r: 0.6; opacity: 0.3; }
          50% { r: 1.2; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
