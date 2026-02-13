import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
  onView: (post: PixelPostData) => void;
}

const PixelPostCard = React.forwardRef<HTMLDivElement, PixelPostCardProps>(
  ({ post, onView }, ref) => {
    const [confirmed, setConfirmed] = useState(false);

    const handleConfirm = () => {
      if (!confirmed) {
        setConfirmed(true);
        onView(post);
      }
    };

    return (
      <div
        ref={ref}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 my-2 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Thumbnail */}
        <img
          src={post.imageUrl}
          alt="Post thumbnail"
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />

        {/* Caption + Hashtags */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-tight truncate">
            {post.caption || "Untitled post"}
          </p>
          {post.hashtags && (
            <p className="text-xs text-primary/70 leading-tight mt-0.5 truncate">
              {post.hashtags}
            </p>
          )}
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={confirmed}
          className={cn(
            "flex-shrink-0 p-1.5 rounded-full transition-colors",
            confirmed
              ? "text-primary cursor-default"
              : "text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
          )}
          aria-label={confirmed ? "Post confirmed" : "Confirm post"}
        >
          <CheckCircle2 className={cn("w-5 h-5", confirmed && "fill-primary/20")} />
        </button>
      </div>
    );
  }
);

PixelPostCard.displayName = "PixelPostCard";

export { PixelPostCard };
