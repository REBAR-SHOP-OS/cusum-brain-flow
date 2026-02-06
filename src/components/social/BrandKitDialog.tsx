import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface BrandKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandKitDialog({ open, onOpenChange }: BrandKitDialogProps) {
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
            <div className="p-6 rounded-lg border bg-muted/30 flex items-center justify-center">
              <span className="text-2xl font-bold">Rebar.shop</span>
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Logo <span className="text-muted-foreground font-normal">- Keeps your posts visually consistent.</span>
            </Label>
            <div className="p-6 rounded-lg border bg-muted/30 flex items-center justify-center h-[120px]">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                R
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Color palette <span className="text-muted-foreground font-normal">- Used in your post visuals.</span>
            </Label>
            <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-around">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2563EB] mx-auto mb-1" />
                <span className="text-xs text-muted-foreground">Primary</span>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#FACC15] mx-auto mb-1" />
                <span className="text-xs text-muted-foreground">Secondary</span>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#1F2937] mx-auto mb-1" />
                <span className="text-xs text-muted-foreground">Tertiary</span>
              </div>
            </div>
          </div>

          {/* Brand Voice */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Brand voice <span className="text-muted-foreground font-normal">- Sets your post's tone.</span>
            </Label>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Write social media content for Rebar.shop using a professional, strong, and trustworthy tone. The language must be clear, simple, and direct, delivering the message within seconds. Focus on being inspirational and...
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">- What your business does.</span>
            </Label>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Rebar.shop is an AI-driven steel and rebar fabrication and supply company operating in Ontario. It is a specialized online platform focused on rebar supply and fabrication. The core business is selling, cutting, bending,...
              </p>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Value proposition <span className="text-muted-foreground font-normal">- What makes business unique.</span>
            </Label>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Rebar.shop offers a fast, reliable, and fully online rebar ordering experience that saves time for contractors and builders. What makes the business unique is the combination of custom rebar fabrication,...
              </p>
            </div>
          </div>
        </div>

        {/* Media Library */}
        <div className="space-y-2 mt-4">
          <Label className="text-sm font-medium">
            Media library <span className="text-muted-foreground font-normal">- Used for your post visuals.</span>
          </Label>
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden"
                >
                  <img
                    src={`https://images.unsplash.com/photo-150430765125${i}-35680f356dfd?w=100`}
                    alt={`Media ${i}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              <button className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0 hover:border-muted-foreground/50 transition-colors">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
