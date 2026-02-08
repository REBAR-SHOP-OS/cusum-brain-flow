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
      setOffset({ x: dx * 24, y: dy * 18 });
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
      {/* Glow pulse behind brain */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full opacity-20 blur-3xl animate-pulse"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.6), transparent 70%)",
          transform: `translate(calc(-50% + ${offset.x * 0.5}px), calc(-50% + ${offset.y * 0.5}px))`,
          transition: "transform 0.3s ease-out",
        }}
      />

      {/* Brain image */}
      <img
        src={brainHero}
        alt=""
        className="absolute top-1/2 left-1/2 w-[320px] h-[320px] object-contain opacity-[0.12] select-none"
        draggable={false}
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${offset.x * 0.3}deg) scale(${1 + Math.abs(offset.x + offset.y) * 0.002})`,
          transition: "transform 0.25s ease-out",
          filter: "drop-shadow(0 0 40px hsl(var(--primary) / 0.15))",
        }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/10"
          style={{
            width: 4 + (i % 3) * 3,
            height: 4 + (i % 3) * 3,
            top: `${20 + i * 12}%`,
            left: `${15 + i * 13}%`,
            transform: `translate(${offset.x * (0.4 + i * 0.15)}px, ${offset.y * (0.4 + i * 0.15)}px)`,
            transition: "transform 0.4s ease-out",
            animation: `float-particle ${3 + i * 0.5}s ease-in-out infinite alternate`,
          }}
        />
      ))}

      <style>{`
        @keyframes float-particle {
          0% { opacity: 0.3; transform: translateY(0); }
          100% { opacity: 0.7; transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
