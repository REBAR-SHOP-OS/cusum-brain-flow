import { useState } from "react";
import { CheckCircle, XCircle, Clock, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSocialApprovals } from "@/hooks/useSocialApprovals";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";
import { formatDistanceToNow } from "date-fns";

const platformColors: Record<string, string> = {
  facebook: "bg-blue-500/10 text-blue-500",
  instagram: "bg-pink-500/10 text-pink-500",
  linkedin: "bg-sky-600/10 text-sky-600",
  twitter: "bg-foreground/10 text-foreground",
  tiktok: "bg-violet-500/10 text-violet-500",
  youtube: "bg-red-500/10 text-red-500",
};

export function ApprovalsPanel() {
  const { pendingApprovals, approvals, approvePost, rejectPost } = useSocialApprovals();
  const { posts } = useSocialPosts();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  const getPost = (postId: string): SocialPost | undefined =>
    posts.find((p) => p.id === postId);

  const handleApprove = (approvalId: string, postId: string) => {
    approvePost.mutate({ approvalId, postId });
  };

  const handleReject = (approvalId: string, postId: string) => {
    const feedback = feedbackText[approvalId] || "No feedback provided";
    rejectPost.mutate({ approvalId, postId, feedback });
    setFeedbackText((prev) => ({ ...prev, [approvalId]: "" }));
  };

  const decidedApprovals = approvals.filter((a) => a.status !== "pending");

  if (pendingApprovals.length === 0 && decidedApprovals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">No approvals pending</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Pending ({pendingApprovals.length})
          </h3>
          <div className="space-y-3">
            {pendingApprovals.map((approval) => {
              const post = getPost(approval.post_id);
              if (!post) return null;
              const isExpanded = expandedId === approval.id;
              const isOverdue = new Date(approval.deadline) < new Date();

              return (
                <div
                  key={approval.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-[10px]", platformColors[post.platform])}>
                          {post.platform}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                        )}
                        {approval.escalation_count > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            Escalated ×{approval.escalation_count}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Due {formatDistanceToNow(new Date(approval.deadline), { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {post.content}
                      </div>
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt="Post preview"
                          className="rounded-lg max-h-48 object-cover w-full"
                        />
                      )}
                      <div>
                        <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <MessageSquare className="w-3 h-3" /> Feedback (required for rejection)
                        </label>
                        <Textarea
                          value={feedbackText[approval.id] || ""}
                          onChange={(e) => setFeedbackText((prev) => ({ ...prev, [approval.id]: e.target.value }))}
                          placeholder="Add feedback or rejection reason..."
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove(approval.id, approval.post_id)}
                          className="flex-1 gap-1.5"
                          disabled={approvePost.isPending}
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </Button>
                        <Button
                          onClick={() => handleReject(approval.id, approval.post_id)}
                          variant="destructive"
                          className="flex-1 gap-1.5"
                          disabled={rejectPost.isPending || !(feedbackText[approval.id]?.trim())}
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {decidedApprovals.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            History ({decidedApprovals.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {decidedApprovals.slice(0, 20).map((approval) => {
                const post = getPost(approval.post_id);
                return (
                  <div key={approval.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm">
                    {approval.status === "approved" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <span className="truncate flex-1">{post?.title || "Unknown post"}</span>
                    <Badge className={cn("text-[10px]", platformColors[post?.platform || ""])}>
                      {post?.platform}
                    </Badge>
                    {approval.feedback && (
                      <span className="text-xs text-muted-foreground truncate max-w-32">
                        "{approval.feedback}"
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
