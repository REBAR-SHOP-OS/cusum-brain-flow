import { Monitor, Tablet, Smartphone, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DeviceMode = "desktop" | "tablet" | "mobile";

export interface WpPage {
  label: string;
  path: string;
}

export const WP_PAGES: WpPage[] = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about/" },
  { label: "Products", path: "/products/" },
  { label: "Shop", path: "/shop/" },
  { label: "Contact", path: "/contact/" },
  { label: "Blog", path: "/blog/" },
  { label: "Services", path: "/services/" },
  { label: "Cart", path: "/cart/" },
];

const SITE_ORIGIN = "https://rebar.shop";

interface WebsiteToolbarProps {
  currentPath: string;
  onPageChange: (path: string) => void;
  device: DeviceMode;
  onDeviceChange: (d: DeviceMode) => void;
  onRefresh: () => void;
}

export function WebsiteToolbar({
  currentPath,
  onPageChange,
  device,
  onDeviceChange,
  onRefresh,
}: WebsiteToolbarProps) {
  const deviceButtons: { mode: DeviceMode; icon: React.ElementType; label: string }[] = [
    { mode: "desktop", icon: Monitor, label: "Desktop" },
    { mode: "tablet", icon: Tablet, label: "Tablet" },
    { mode: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card shrink-0">
      {/* Page selector */}
      <Select value={currentPath} onValueChange={onPageChange}>
        <SelectTrigger className="w-32 sm:w-44 h-9 text-sm">
          <SelectValue placeholder="Select page" />
        </SelectTrigger>
        <SelectContent>
          {WP_PAGES.map((p) => (
            <SelectItem key={p.path} value={p.path}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Device toggles — hidden on mobile */}
      <div className="hidden sm:flex items-center bg-muted rounded-lg p-0.5">
        {deviceButtons.map(({ mode, icon: Icon, label }) => (
          <Button
            key={mode}
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-md",
              device === mode && "bg-background shadow-sm text-foreground"
            )}
            onClick={() => onDeviceChange(mode)}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} title="Refresh">
        <RefreshCw className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => window.open(`${SITE_ORIGIN}${currentPath}`, "_blank")}
        title="Open in new tab"
      >
        <ExternalLink className="w-4 h-4" />
      </Button>
    </div>
  );
}
