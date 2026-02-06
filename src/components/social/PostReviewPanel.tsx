import { X, RefreshCw, Sparkles, Calendar, MapPin, Phone, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import type { SocialPost } from "@/pages/SocialMediaManager";

interface PostReviewPanelProps {
  post: SocialPost | null;
  postsToReview: number;
  onClose: () => void;
  onSchedule: () => void;
  onDecline: () => void;
}

export function PostReviewPanel({
  post,
  postsToReview,
  onClose,
  onSchedule,
  onDecline,
}: PostReviewPanelProps) {
  if (!post) return null;

  return (
    <Sheet open={!!post} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Social media post</SheetTitle>
            <span className="text-sm text-muted-foreground">{postsToReview} left to review</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preview Image */}
          {post.imageUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-square">
              <img
                src={post.imageUrl}
                alt="Post preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                <p className="font-medium">Prefab Rebar.</p>
                <p>In Stock.</p>
                <p>Same-Day Pickup.</p>
              </div>
            </div>
          )}

          {/* Regenerate / AI Edit buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate image
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Edit
            </Button>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Content</p>
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-3">
              <p className="font-medium">{post.content.split("\n")[0]}</p>
              <p className="text-muted-foreground whitespace-pre-line">
                {post.content.split("\n").slice(1).join("\n")}
              </p>
              
              {/* Contact info */}
              <div className="space-y-1 text-muted-foreground">
                <p className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> 9 Cedar Ave, Thornhill, Ontario
                </p>
                <p className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> 647-260-9403
                </p>
                <p className="flex items-center gap-1">
                  <Globe className="w-3 h-3" /> www.rebar.shop
                </p>
              </div>

              {/* Hashtags */}
              <p className="text-primary">
                {post.hashtags.join(" ")}
              </p>
            </div>
          </div>

          {/* Regenerate Caption */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate caption
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Edit
            </Button>
          </div>

          {/* Publish Date */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Publish date</p>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">
                {format(post.scheduledDate, "MMMM d, yyyy")} at {format(post.scheduledDate, "h:mm a")}
              </span>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onDecline}>
            Decline
          </Button>
          <Button className="flex-1 bg-primary" onClick={onSchedule}>
            Schedule
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
