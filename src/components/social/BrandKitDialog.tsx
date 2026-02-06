import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrandKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandKitDialog({ open, onOpenChange }: BrandKitDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState("Rebar.shop");
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

  const handleAddMedia = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (url) {
          setMediaImages((prev) => [...prev, url]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    setMediaImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate saving (replace with actual persistence later)
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast({ title: "Brand Kit saved", description: "Your brand kit has been updated." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Brand Kit</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Your business</Label>
            <Input
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
            <div className="p-6 rounded-lg border bg-muted/30 flex items-center justify-center h-[120px] cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toast({ title: "Coming soon", description: "Logo upload will be available soon." })}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                {businessName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Color palette <span className="text-muted-foreground font-normal">- Used in your post visuals.</span>
            </Label>
            <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-around">
              {(["primary", "secondary", "tertiary"] as const).map((key) => (
                <label key={key} className="text-center cursor-pointer">
                  <input
                    type="color"
                    value={colors[key]}
                    onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="sr-only"
                  />
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-1 ring-2 ring-transparent hover:ring-primary/50 transition-all"
                    style={{ backgroundColor: colors[key] }}
                  />
                  <span className="text-xs text-muted-foreground capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Brand Voice */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Brand voice <span className="text-muted-foreground font-normal">- Sets your post's tone.</span>
            </Label>
            <Textarea
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="Describe your brand's tone of voice..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">- What your business does.</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what your business does..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          {/* Value Proposition */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Value proposition <span className="text-muted-foreground font-normal">- What makes business unique.</span>
            </Label>
            <Textarea
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
                  <img
                    src={src}
                    alt={`Media ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
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
