import { useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [fixingHero, setFixingHero] = useState(false);

  const handleFixHero = async () => {
    setFixingHero(true);
    try {
      const { data, error } = await supabase.functions.invoke("wp-fix-hero", {
        method: "POST",
        body: { action: "inject" },
      });
      if (error) throw error;
      if (data?.injected) {
        toast.success(`Hero CSS fix injected (${data.slideIds?.length || 0} slides). Refresh to see changes.`);
        onRefresh();
      } else if (data?.removed) {
        toast.success("Hero CSS fix removed.");
      } else {
        toast.info("Hero fix applied.");
        onRefresh();
      }
    } catch (err: any) {
      toast.error("Failed to fix hero: " + (err.message || "Unknown error"));
    } finally {
      setFixingHero(false);
    }
  };
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

      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5 hidden sm:flex"
        onClick={handleFixHero}
        disabled={fixingHero}
        title="Inject static hero to fix blank homepage"
      >
        {fixingHero ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        Repair Slider
      </Button>

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
