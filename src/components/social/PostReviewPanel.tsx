import { useState } from "react";
import { RefreshCw, Sparkles, Calendar, MapPin, Phone, Globe, Trash2, Pencil, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublishPost } from "@/hooks/usePublishPost";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";

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
  const { updatePost, deletePost } = useSocialPosts();
  const { publishPost, publishing } = usePublishPost();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!post) return null;

  const startEdit = () => {
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditHashtags(post.hashtags.join(", "));
    setEditPlatform(post.platform);
    setEditing(true);
  };

  const saveEdit = () => {
    const hashtagArray = editHashtags
      .split(/[,\s]+/)
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => (h.startsWith("#") ? h : `#${h}`));

    updatePost.mutate({
      id: post.id,
      title: editTitle,
      content: editContent,
      hashtags: hashtagArray,
      platform: editPlatform as SocialPost["platform"],
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deletePost.mutateAsync(post.id);
    setDeleting(false);
    onClose();
  };

  return (
    <Sheet open={!!post} onOpenChange={(open) => { if (!open) { setEditing(false); onClose(); } }}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Social media post</SheetTitle>
            <span className="text-sm text-muted-foreground">{postsToReview} left to review</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preview Image */}
          {post.image_url && (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-square">
              <img src={post.image_url} alt="Post preview" className="w-full h-full object-cover" />
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Platform</Label>
                <Select value={editPlatform} onValueChange={setEditPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">X / Twitter</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Content</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Hashtags</Label>
                <Input value={editHashtags} onChange={(e) => setEditHashtags(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveEdit}>Save changes</Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Content</p>
                  <Button variant="ghost" size="sm" onClick={startEdit}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-3">
                  <p className="font-medium">{post.title || post.content.split("\n")[0]}</p>
                  <p className="text-muted-foreground whitespace-pre-line">{post.content}</p>
                  {post.hashtags.length > 0 && (
                    <p className="text-primary">{post.hashtags.join(" ")}</p>
                  )}
                </div>
              </div>

              {/* Platform & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Platform</p>
                  <p className="text-sm font-medium capitalize">{post.platform}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="text-sm font-medium capitalize">{post.status}</p>
                </div>
              </div>

              {/* Scheduled Date */}
              {post.scheduled_date && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Publish date</p>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">
                      {format(new Date(post.scheduled_date), "MMMM d, yyyy 'at' h:mm a")}
                    </span>
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!editing && (
          <div className="p-4 border-t space-y-2">
            {(post.platform === "facebook" || post.platform === "instagram") && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  const success = await publishPost(post);
                  if (success) onClose();
                }}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {publishing ? "Publishing..." : `Publish to ${post.platform}`}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onDecline}>
                Decline
              </Button>
              <Button className="flex-1 bg-primary" onClick={onSchedule}>
                {post.status === "scheduled" ? "Approve" : "Schedule"}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete post
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
