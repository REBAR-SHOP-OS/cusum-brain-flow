import React, { useState } from "react";
import { CheckCircle2, RefreshCw, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

export interface PixelPostData {
  id: string;
  imageUrl: string;
  caption: string;
  hashtags?: string;
  contactInfo?: string;
  imageTextTranslation?: string;
  captionTranslation?: string;
  persianTranslation?: string; // kept for backward compat
  platform?: string;
  status: "published" | "scheduled" | "draft";
}

interface PixelPostCardProps {
  post: PixelPostData;
  onView?: (post: PixelPostData) => void;
  onApprove?: (post: PixelPostData) => void;
  onRegenerate?: (post: PixelPostData) => void;
}

const PixelPostCard = React.forwardRef<HTMLDivElement, PixelPostCardProps>(
  ({ post, onView, onApprove, onRegenerate }, ref) => {
    const [approved, setApproved] = useState(false);
    const [imageZoomOpen, setImageZoomOpen] = useState(false);

    const handleApprove = () => {
      if (!approved) {
        setApproved(true);
        onApprove?.(post);
      }
    };

    const handleRegenerate = () => {
      if (!approved) {
        onRegenerate?.(post);
      }
    };

    const hasInternalRef = post.imageTextTranslation || post.captionTranslation;

    return (
      <div
        ref={ref}
        className="rounded-xl border border-border bg-card my-2 shadow-sm overflow-hidden max-w-sm"
      >
        {/* 1. Image with zoom overlay */}
        <div className="relative group cursor-pointer" onClick={() => setImageZoomOpen(true)}>
          <img
            src={post.imageUrl}
            alt="Post preview"
            className="w-full aspect-square object-cover"
          />
          <button
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Zoom image"
            onClick={(e) => { e.stopPropagation(); setImageZoomOpen(true); }}
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Image zoom dialog */}
        <Dialog open={imageZoomOpen} onOpenChange={setImageZoomOpen}>
          <DialogContent className="max-w-[60vw] max-h-[70vh] p-2 border-none bg-background/95 backdrop-blur-sm flex items-center justify-center">
            <img
              src={post.imageUrl}
              alt="Zoomed preview"
              className="max-w-full max-h-[65vh] object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>

        {/* 2. Caption */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-sm text-foreground leading-snug whitespace-pre-line">
            {post.caption || "Untitled post"}
          </p>
        </div>

        {/* 3. Contact Info */}
        {post.contactInfo && (
          <div className="px-3 py-1">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {post.contactInfo}
            </p>
          </div>
        )}

        {/* 4. Hashtags */}
        {post.hashtags && (
          <div className="px-3 py-1">
            <p className="text-xs text-primary/70 leading-tight">
              {post.hashtags}
            </p>
          </div>
        )}

        {/* 5. Internal Reference Box */}
        {hasInternalRef && (
          <div className="mx-3 my-2 p-2.5 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1.5">
              🔒 Internal reference only — not published
            </p>
            {post.imageTextTranslation && (
              <div className="mb-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">🖼️ Image text:</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line" dir="rtl">
                  {post.imageTextTranslation}
                </p>
              </div>
            )}
            {post.captionTranslation && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">📝 Caption translation:</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line" dir="rtl">
                  {post.captionTranslation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 6. Action buttons */}
        <div className="flex items-center gap-3 px-4 pb-4 pt-1">
          {approved ? (
            <span className="text-sm text-emerald-500 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 fill-emerald-500/20" />
              Saved to calendar
            </span>
          ) : (
            <>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition-colors font-medium text-sm"
                aria-label="Approve post"
              >
                <CheckCircle2 className="w-7 h-7" />
                Approve
              </button>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/15 text-orange-500 hover:bg-orange-500/25 transition-colors font-medium text-sm"
                aria-label="Regenerate post"
              >
                <RefreshCw className="w-7 h-7" />
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
);

PixelPostCard.displayName = "PixelPostCard";

export { PixelPostCard };
