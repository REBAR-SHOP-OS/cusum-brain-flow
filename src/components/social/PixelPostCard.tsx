import React, { useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PixelPostData {
  id: string;
  imageUrl: string;
  caption: string;
  hashtags?: string;
  persianTranslation?: string;
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

    return (
      <div
        ref={ref}
        className="rounded-xl border border-border bg-card my-2 shadow-sm overflow-hidden max-w-sm"
      >
        {/* Larger image */}
        <img
          src={post.imageUrl}
          alt="Post preview"
          className="w-full aspect-square object-cover"
        />

        {/* Caption + Hashtags */}
        <div className="px-3 py-2">
          <p className="text-sm text-foreground leading-snug">
            {post.caption || "Untitled post"}
          </p>
          {post.hashtags && (
            <p className="text-xs text-primary/70 leading-tight mt-1">
              {post.hashtags}
            </p>
          )}
          {post.persianTranslation && (
            <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">🇮🇷 Persian Translation (internal)</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line" dir="rtl">
                {post.persianTranslation}
              </p>
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-3 px-4 pb-4">
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
