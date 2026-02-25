import React, { useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PixelPostData {
  id: string;
  imageUrl: string;
  caption: string;
  hashtags?: string;
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
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 px-3 pb-2.5">
          {approved ? (
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 fill-primary/20" />
              Saved to calendar
            </span>
          ) : (
            <>
              <button
                onClick={handleApprove}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Approve post"
              >
                <CheckCircle2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleRegenerate}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Regenerate post"
              >
                <RefreshCw className="w-5 h-5" />
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
