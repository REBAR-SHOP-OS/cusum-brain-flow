import { cn } from "@/lib/utils";

interface ProductionProgressProps {
  completed: number;
  total: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProductionProgress({ completed, total, size = "md", className }: ProductionProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const sizeMap = {
    sm: { diameter: 40, stroke: 3, fontSize: 10 },
    md: { diameter: 64, stroke: 4, fontSize: 14 },
    lg: { diameter: 96, stroke: 5, fontSize: 20 },
  };

  const { diameter, stroke, fontSize } = sizeMap[size];
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
        {/* Background circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
          className="transition-all duration-500"
        />
        {/* Percentage text */}
        <text
          x={diameter / 2}
          y={diameter / 2 + fontSize / 3}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          fontSize={fontSize}
          fontWeight="bold"
        >
          {percentage}%
        </text>
      </svg>
    </div>
  );
}
