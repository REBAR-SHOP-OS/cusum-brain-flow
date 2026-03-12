import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X, Image as ImageIcon } from "lucide-react";
import type { BrandProfile } from "@/types/adDirector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BrandKitSidePanelProps {
  brand: BrandProfile;
  onBrandChange: (b: BrandProfile) => void;
  onSaveBrandKit?: () => void;
  savingBrandKit?: boolean;
}

export function BrandKitSidePanel({ brand, onBrandChange, onSaveBrandKit, savingBrandKit }: BrandKitSidePanelProps) {
  const { toast } = useToast();
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in", description: "Authentication required to upload logo", variant: "destructive" });
        return;
      }
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${user.id}/logo-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: publicData } = supabase.storage.from("brand-assets").getPublicUrl(fileName);
      onBrandChange({ ...brand, logoUrl: publicData.publicUrl });
      toast({ title: "Logo uploaded", description: "Watermark will be applied to all clips" });
    } catch (err: any) {
      console.error("Logo upload failed:", err);
      toast({ title: "Logo upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Brand fields */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Brand Name</Label>
          <Input value={brand.name} onChange={(e) => onBrandChange({ ...brand, name: e.target.value })} className="h-7 text-xs bg-background/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Website</Label>
          <Input value={brand.website} onChange={(e) => onBrandChange({ ...brand, website: e.target.value })} className="h-7 text-xs bg-background/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tagline</Label>
          <Input value={brand.tagline} onChange={(e) => onBrandChange({ ...brand, tagline: e.target.value })} className="h-7 text-xs bg-background/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Audience</Label>
          <Input value={brand.targetAudience} onChange={(e) => onBrandChange({ ...brand, targetAudience: e.target.value })} className="h-7 text-xs bg-background/50" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Call to Action</Label>
        <Input value={brand.cta} onChange={(e) => onBrandChange({ ...brand, cta: e.target.value })} className="h-7 text-xs bg-background/50" />
      </div>

      {/* Colors */}
      <div className="border-t border-border/20 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input type="color" value={brand.primaryColor} onChange={(e) => onBrandChange({ ...brand, primaryColor: e.target.value })} className="w-6 h-6 rounded-md cursor-pointer border border-border/30" />
            <span className="text-[10px] text-muted-foreground">Primary</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={brand.secondaryColor} onChange={(e) => onBrandChange({ ...brand, secondaryColor: e.target.value })} className="w-6 h-6 rounded-md cursor-pointer border border-border/30" />
            <span className="text-[10px] text-muted-foreground">Secondary</span>
          </div>
        </div>
      </div>

      {/* Preview strip */}
      {brand.name && (
        <div className="rounded-lg px-3 py-1.5 text-xs font-semibold text-center truncate" style={{ backgroundColor: brand.primaryColor, color: brand.secondaryColor }}>
          {brand.name} {brand.tagline ? `· ${brand.tagline}` : ""}
        </div>
      )}

      {/* Logo */}
      <div className="border-t border-border/20 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-medium">Brand Logo</span>
          <Badge variant="secondary" className="text-[8px] ml-auto">Watermark</Badge>
        </div>
        {brand.logoUrl ? (
          <div className="flex items-center gap-2">
            <img src={brand.logoUrl} alt="Logo" className="h-8 rounded border border-border/30" />
            <span className="text-[10px] text-muted-foreground flex-1 truncate">{brand.name} logo</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onBrandChange({ ...brand, logoUrl: null })}>
              <X className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <>
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} className="hidden" id="side-logo-upload" />
            <label htmlFor="side-logo-upload" className={cn(
              "flex items-center gap-2 p-2 rounded-lg border border-border/20 bg-background/30 hover:border-primary/30 cursor-pointer text-xs",
              uploadingLogo && "opacity-50 pointer-events-none"
            )}>
              {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />}
              <span>{uploadingLogo ? "Uploading…" : "Upload logo"}</span>
            </label>
          </>
        )}
      </div>

      {/* Save */}
      {onSaveBrandKit && (
        <Button variant="outline" size="sm" onClick={onSaveBrandKit} disabled={savingBrandKit || !brand.name.trim()} className="w-full text-xs gap-1.5">
          {savingBrandKit ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Sparkles className="w-3.5 h-3.5" /> Save Brand Kit</>}
        </Button>
      )}
    </div>
  );
}
