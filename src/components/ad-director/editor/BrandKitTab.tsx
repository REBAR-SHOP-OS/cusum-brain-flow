import { Palette } from "lucide-react";
import type { BrandProfile } from "@/types/adDirector";
import type { LogoSettings } from "@/types/editorSettings";
import { LogoTab } from "./LogoTab";

interface BrandKitTabProps {
  brand: BrandProfile;
  logo: LogoSettings;
  onLogoChange: (s: LogoSettings) => void;
  onDeleteLogo?: () => void;
  onReplaceLogo?: (file: File) => void;
}

export function BrandKitTab({ brand, logo, onLogoChange, onDeleteLogo, onReplaceLogo }: BrandKitTabProps) {
  const colors = brand.colors && typeof brand.colors === "object" && !Array.isArray(brand.colors)
    ? brand.colors as Record<string, string>
    : {};

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Brand Kit</h4>

      {/* Brand Info */}
      <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/10">
        <div className="text-xs font-medium">{brand.name || "Untitled Brand"}</div>
        {brand.tagline && <div className="text-[10px] text-muted-foreground">{brand.tagline}</div>}
      </div>

      {/* Colors */}
      {Object.keys(colors).length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Colors</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(colors).map(([name, hex]) => (
              <div key={name} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md border border-border/40" style={{ background: String(hex) }} />
                <span className="text-[9px] text-muted-foreground capitalize">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Font */}
      {brand.fontStyle && (
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Font Style</span>
          <div className="text-xs font-medium">{brand.fontStyle}</div>
        </div>
      )}

      {/* Logo Section */}
      <div className="pt-3 border-t border-border/30">
        <LogoTab
          logo={logo}
          brand={brand}
          onChange={onLogoChange}
          onDeleteLogo={onDeleteLogo}
          onReplaceLogo={onReplaceLogo}
        />
      </div>
    </div>
  );
}
