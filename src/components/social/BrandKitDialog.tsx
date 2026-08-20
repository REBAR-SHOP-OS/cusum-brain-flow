import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Save, Loader2, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrandKit } from "@/hooks/useBrandKit";
import brandLogo from "@/assets/brand-logo.png";

// Helper images
import salesHelper from "@/assets/helpers/sales-helper.png";
import supportHelper from "@/assets/helpers/support-helper.png";
import accountingHelper from "@/assets/helpers/accounting-helper.png";
import estimatingHelper from "@/assets/helpers/estimating-helper.png";
import shopfloorHelper from "@/assets/helpers/shopfloor-helper.png";
import deliveryHelper from "@/assets/helpers/delivery-helper.png";
import emailHelper from "@/assets/helpers/email-helper.png";
import dataHelper from "@/assets/helpers/data-helper.png";
import socialHelper from "@/assets/helpers/social-helper.png";

interface HelperAvatar {
  id: string;
  name: string;
  role: string;
  defaultImage: string;
}

const defaultHelpers: HelperAvatar[] = [
  { id: "sales", name: "Salesy", role: "Sales & Pipeline", defaultImage: salesHelper },
  { id: "support", name: "Sasha", role: "Customer Support", defaultImage: supportHelper },
  { id: "accounting", name: "Archie", role: "Accounting", defaultImage: accountingHelper },
  { id: "estimating", name: "Eddie", role: "Estimating", defaultImage: estimatingHelper },
  { id: "shopfloor", name: "Steely", role: "Shop Floor", defaultImage: shopfloorHelper },
  { id: "delivery", name: "Danny", role: "Deliveries", defaultImage: deliveryHelper },
  { id: "email", name: "Emmy", role: "Email & Inbox", defaultImage: emailHelper },
  { id: "social", name: "Sushie", role: "Social Media", defaultImage: socialHelper },
  { id: "data", name: "Dexter", role: "Data & Insights", defaultImage: dataHelper },
];

interface BrandKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandKitDialog({ open, onOpenChange }: BrandKitDialogProps) {
  const { toast } = useToast();
  const { brandKit, saveBrandKit } = useBrandKit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState("Rebar.shop");
  const [logoUrl, setLogoUrl] = useState<string | null>(brandLogo);
  const [brandVoice, setBrandVoice] = useState(
    "Write social media content for Rebar.shop using a professional, strong, and trustworthy tone. The language must be clear, simple, and direct, delivering the message within seconds. Focus on being inspirational and motivating."
  );
  const [description, setDescription] = useState(
    "Rebar.shop is an AI-driven steel and rebar fabrication and supply company operating in Ontario. It is a specialized online platform focused on rebar supply and fabrication. The core business is selling, cutting, bending, and delivering rebar products."
  );
  const [valueProp, setValueProp] = useState(
    "Rebar.shop offers a fast, reliable, and fully online rebar ordering experience that saves time for contractors and builders. What makes the business unique is the combination of custom rebar fabrication, AI-driven optimization, and same-day delivery."
  );
  const [colors, setColors] = useState({
    primary: "#2563EB",
    secondary: "#FACC15",
    tertiary: "#1F2937",
  });
  const [mediaImages, setMediaImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=100",
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=100",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=100",
    "https://images.unsplash.com/photo-1590076215667-875d4ef2d7de?w=100",
    "https://images.unsplash.com/photo-1581094794329-c8112c4e5190?w=100",
  ]);
  const [saving, setSaving] = useState(false);
  const [helperImages, setHelperImages] = useState<Record<string, string>>(
    () => Object.fromEntries(defaultHelpers.map((h) => [h.id, h.defaultImage]))
  );
  const helperInputRef = useRef<HTMLInputElement>(null);
  const [activeHelperId, setActiveHelperId] = useState<string | null>(null);

  // Load brand kit from DB when available
  useEffect(() => {
    if (brandKit) {
      setBusinessName(brandKit.business_name || "Rebar.shop");
      if (brandKit.logo_url) setLogoUrl(brandKit.logo_url);
      if (brandKit.brand_voice) setBrandVoice(brandKit.brand_voice);
      if (brandKit.description) setDescription(brandKit.description);
      if (brandKit.value_prop) setValueProp(brandKit.value_prop);
      if (brandKit.colors) setColors(brandKit.colors);
      if (brandKit.media_urls?.length > 0) setMediaImages(brandKit.media_urls);
    }
  }, [brandKit]);

  const colorRefs = {
    primary: useRef<HTMLInputElement>(null),
    secondary: useRef<HTMLInputElement>(null),
    tertiary: useRef<HTMLInputElement>(null),
  };

  const handleAddMedia = () => {
    fileInputRef.current?.click();
  };

  const handleLogoClick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) setLogoUrl(url);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (url) setMediaImages((prev) => [...prev, url]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    setMediaImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHelperImageClick = (helperId: string) => {
    setActiveHelperId(helperId);
    helperInputRef.current?.click();
  };

  const handleHelperImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeHelperId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url && activeHelperId) {
        setHelperImages((prev) => ({ ...prev, [activeHelperId]: url }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setActiveHelperId(null);
  };

  const handleResetHelper = (helperId: string) => {
    const original = defaultHelpers.find((h) => h.id === helperId);
    if (original) {
      setHelperImages((prev) => ({ ...prev, [helperId]: original.defaultImage }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBrandKit.mutateAsync({
        business_name: businessName,
        logo_url: logoUrl,
        brand_voice: brandVoice,
        description,
        value_prop: valueProp,
        colors,
        media_urls: mediaImages,
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Brand Kit</DialogTitle>
          <DialogDescription className="sr-only">Edit your brand identity settings</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="brand-business-name" className="text-sm font-medium">Your business</Label>
            <Input
              id="brand-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your business name"
              className="text-lg font-bold"
            />
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Logo <span className="text-muted-foreground font-normal">- Keeps your posts visually consistent.</span>
            </Label>
            <div
              className="p-6 rounded-lg border bg-muted/30 flex items-center justify-center h-[120px] cursor-pointer hover:bg-muted/50 transition-colors relative"
              onClick={handleLogoClick}
            >
              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Brand logo" className="max-h-full max-w-full object-contain rounded" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setLogoUrl(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center text-primary-foreground text-2xl font-bold">
                    {businessName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground">Click to upload</span>
                </div>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Color palette <span className="text-muted-foreground font-normal">- Used in your post visuals.</span>
            </Label>
            <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-around">
              {(["primary", "secondary", "tertiary"] as const).map((key) => (
                <div key={key} className="text-center">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-1 ring-2 ring-transparent hover:ring-primary/50 transition-all cursor-pointer"
                    style={{ backgroundColor: colors[key] }}
                    onClick={() => colorRefs[key].current?.click()}
                  />
                  <input
                    ref={colorRefs[key]}
                    type="color"
                    value={colors[key]}
                    onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                  />
                  <span className="text-xs text-muted-foreground capitalize">{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Voice */}
          <div className="space-y-2">
            <Label htmlFor="brand-voice" className="text-sm font-medium">
              Brand voice <span className="text-muted-foreground font-normal">- Sets your post's tone.</span>
            </Label>
            <Textarea
              id="brand-voice"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="Describe your brand's tone of voice..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="brand-description" className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">- What your business does.</span>
            </Label>
            <Textarea
              id="brand-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what your business does..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          {/* Value Proposition */}
          <div className="space-y-2">
            <Label htmlFor="brand-value-prop" className="text-sm font-medium">
              Value proposition <span className="text-muted-foreground font-normal">- What makes business unique.</span>
            </Label>
            <Textarea
              id="brand-value-prop"
              value={valueProp}
              onChange={(e) => setValueProp(e.target.value)}
              placeholder="What makes your business unique..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>
        </div>

        {/* Media Library */}
        <div className="space-y-2 mt-4">
          <Label className="text-sm font-medium">
            Media library <span className="text-muted-foreground font-normal">- Used for your post visuals.</span>
          </Label>
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {mediaImages.map((src, i) => (
                <div
                  key={i}
                  className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden relative group cursor-pointer"
                  onClick={() => handleRemoveMedia(i)}
                >
                  <img src={src} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs">Remove</span>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddMedia}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0 hover:border-muted-foreground/50 transition-colors"
              >
                <Plus className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Helper Avatars */}
        <div className="space-y-2 mt-4">
          <Label className="text-sm font-medium">
            Helper avatars <span className="text-muted-foreground font-normal">- Click to replace any helper image.</span>
          </Label>
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {defaultHelpers.map((helper) => (
                <div key={helper.id} className="text-center group">
                  <div
                    className="relative w-16 h-16 mx-auto rounded-lg overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all"
                    onClick={() => handleHelperImageClick(helper.id)}
                  >
                    <img
                      src={helperImages[helper.id]}
                      alt={helper.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-[10px] font-medium mt-1 truncate">{helper.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{helper.role}</p>
                </div>
              ))}
            </div>
            <input
              ref={helperInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHelperImageChange}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Brand Kit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
