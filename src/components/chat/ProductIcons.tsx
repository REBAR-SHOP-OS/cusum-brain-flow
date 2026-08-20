import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

/** Fiberglass — straight ribbed bar with texture lines */
export const FiberglassIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="6" y1="10" x2="6" y2="14" />
    <line x1="9" y1="10" x2="9" y2="14" />
    <line x1="12" y1="10" x2="12" y2="14" />
    <line x1="15" y1="10" x2="15" y2="14" />
    <line x1="18" y1="10" x2="18" y2="14" />
    <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

/** Stirrups — closed rectangular bent loop */
export const StirrupIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="5" y="5" width="14" height="14" rx="1" />
    <line x1="5" y1="5" x2="3" y2="3" />
    <line x1="19" y1="5" x2="21" y2="3" />
  </svg>
);

/** Cages — cylindrical cage with vertical + spiral bars */
export const CageIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
    {/* Top ellipse */}
    <ellipse cx="12" cy="5" rx="7" ry="2.5" />
    {/* Bottom ellipse */}
    <ellipse cx="12" cy="19" rx="7" ry="2.5" />
    {/* Vertical bars */}
    <line x1="5" y1="5" x2="5" y2="19" />
    <line x1="19" y1="5" x2="19" y2="19" />
    <line x1="12" y1="2.5" x2="12" y2="16.5" />
    {/* Spiral/ring hints */}
    <ellipse cx="12" cy="9" rx="7" ry="2" strokeDasharray="3 3" />
    <ellipse cx="12" cy="14" rx="7" ry="2" strokeDasharray="3 3" />
  </svg>
);

/** Hooks — bar with a J-hook/90° bent end */
export const HookIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" y1="12" x2="16" y2="12" />
    <path d="M16 12 C16 12 20 12 20 16 C20 20 16 20 14 20" />
  </svg>
);

/** Dowels — two parallel straight bars (slab joint) */
export const DowelIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    {/* End caps */}
    <circle cx="3" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="21" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="21" cy="15" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** Wire Mesh — welded grid pattern */
export const WireMeshIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
    {/* Horizontal bars */}
    <line x1="2" y1="6" x2="22" y2="6" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="18" x2="22" y2="18" />
    {/* Vertical bars */}
    <line x1="6" y1="2" x2="6" y2="22" />
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="18" y1="2" x2="18" y2="22" />
    {/* Weld dots at intersections */}
    <circle cx="6" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="6" cy="18" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18" cy="18" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

/** Straight Rebar — single ribbed bar */
export const StraightRebarIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <line x1="2" y1="12" x2="22" y2="12" />
    {/* Rib marks */}
    <line x1="5" y1="10.5" x2="6" y2="13.5" strokeWidth="1.5" />
    <line x1="8" y1="10.5" x2="9" y2="13.5" strokeWidth="1.5" />
    <line x1="11" y1="10.5" x2="12" y2="13.5" strokeWidth="1.5" />
    <line x1="14" y1="10.5" x2="15" y2="13.5" strokeWidth="1.5" />
    <line x1="17" y1="10.5" x2="18" y2="13.5" strokeWidth="1.5" />
    <line x1="20" y1="10.5" x2="21" y2="13.5" strokeWidth="1.5" />
  </svg>
);
