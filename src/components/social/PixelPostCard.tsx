import React from "react";
import { Eye, CheckCircle2, Clock, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PixelPostData {
  id: string;
  imageUrl: string;
  caption: string;
  platform?: string;
  status: "published" | "scheduled" | "draft";
}

interface PixelPostCardProps {
  post: PixelPostData;
  agentImage: string;
  agentName: string;
  onView: (post: PixelPostData) => void;
}

const statusConfig = {
  published: { label: "Published", icon: CheckCircle2, className: "text-green-500" },
  scheduled: { label: "Scheduled", icon: Clock, className: "text-amber-500" },
  draft: { label: "Draft", icon: FileEdit, className: "text-muted-foreground" },
};

const PixelPostCard = React.forwardRef<HTMLDivElement, PixelPostCardProps>(
  ({ post, agentImage, agentName, onView }, ref) => {
    const status = statusConfig[post.status];
    const StatusIcon = status.icon;

    return (
      <div
        ref={ref}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 my-2 shadow-sm hover:shadow-md transition-shadow"
      >
        <img
          src={agentImage}
          alt={agentName}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">Created a post</p>
          <div className={cn("flex items-center gap-1 mt-0.5", status.className)}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{status.label}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs flex-shrink-0"
          onClick={() => onView(post)}
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </Button>
      </div>
    );
  }
);

PixelPostCard.displayName = "PixelPostCard";

export { PixelPostCard };
