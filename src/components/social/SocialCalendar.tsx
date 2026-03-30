import { addDays, format, isSameDay, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Video } from "lucide-react";
import type { SocialPost } from "@/hooks/useSocialPosts";

const PLATFORM_ORDER = ["unassigned", "facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube"];


/** Sort posts by scheduled_date ascending, then by platform order */
function sortPosts(posts: SocialPost[]): SocialPost[] {
  return [...posts].sort((a, b) => {
    const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
    const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    const platA = PLATFORM_ORDER.indexOf(a.platform) === -1 ? 99 : PLATFORM_ORDER.indexOf(a.platform);
    const platB = PLATFORM_ORDER.indexOf(b.platform) === -1 ? 99 : PLATFORM_ORDER.indexOf(b.platform);
    return platA - platB;
  });
}

const STATUS_LABELS: Record<string, string> = {
  published: "Published ✅",
  scheduled: "Scheduled 📅",
  draft: "Draft",
  pending_approval: "Pending Approval ⏳",
  declined: "Declined ❌",
  publishing: "Publishing 🔄",
  failed: "Failed ❌",
};
  const counts: Record<string, number> = {};
  for (const p of posts) {
    counts[p.status] = (counts[p.status] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant = entries[0][0];
  if (entries.length === 1) {
    return { dominant, label: STATUS_LABELS[dominant] || dominant };
  }
  const parts = entries.map(([s, n]) => `${n} ${STATUS_LABELS[s] || s}`);
  return { dominant, label: parts.join(" · ") };
}

const platformIcons: Record<string, { bg: string; icon: JSX.Element }> = {
  unassigned: {
    bg: "bg-muted-foreground/30",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  facebook: {
    bg: "bg-[#1877F2]",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  instagram: {
    bg: "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
  linkedin: {
    bg: "bg-[#0A66C2]",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  twitter: {
    bg: "bg-black",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  tiktok: {
    bg: "bg-black",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
  },
  youtube: {
    bg: "bg-[#FF0000]",
    icon: (
      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
};

interface SocialCalendarProps {
  posts: SocialPost[];
  weekStart: Date;
  onPostClick: (post: SocialPost) => void;
  onGroupClick?: (post: SocialPost, siblingPages: string[]) => void;
  selectedPostIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectDay?: (dayPostIds: string[]) => void;
}

export function SocialCalendar({ posts, weekStart, onPostClick, onGroupClick, selectedPostIds, onToggleSelect, onSelectDay }: SocialCalendarProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
      {days.map((day) => {
        const dayPostsRaw = posts.filter((post) => {
          if (!post.scheduled_date) return false;
          return isSameDay(parseISO(post.scheduled_date), day);
        });
        const dayPosts = dayPostsRaw;
        const isCurrentDay = isToday(day);
        const dayPostIds = dayPosts.map((p) => p.id);
        const allDaySelected = dayPostIds.length > 0 && dayPostIds.every((id) => selectedPostIds?.has(id));

        return (
          <div key={day.toISOString()} className="min-h-[400px]">
            {/* Day Header */}
            <div className={cn(
              "text-center py-2 mb-2 rounded-lg relative",
              isCurrentDay && "bg-muted"
            )}>
              <p className="text-sm text-muted-foreground">{format(day, "EEE d")}</p>
              {isCurrentDay && (
                <p className="text-xs font-medium text-primary">Today</p>
              )}
              {onSelectDay && dayPostIds.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectDay(dayPostIds); }}
                  className="absolute top-1.5 right-1.5"
                >
                  <div className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center transition-colors",
                    allDaySelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40 hover:border-primary"
                  )}>
                    {allDaySelected && (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </div>
                </button>
              )}
            </div>

            {/* Individual Post Cards */}
            <div className="space-y-2">
              {sortPosts(dayPosts).map((post) => {
                const platform = post.platform || "other";
                const pIcon = platformIcons[platform] || platformIcons.twitter;
                const isSelected = selectedPostIds?.has(post.id) ?? false;
                const status = post.status;
                const statusLabel = STATUS_LABELS[status] || status;
                const isApproved = post.neel_approved || post.qa_status === "approved";

                return (
                  <button
                    key={post.id}
                    onClick={() => {
                      if (onToggleSelect) {
                        onToggleSelect(post.id);
                      } else if (onGroupClick) {
                        onGroupClick(post, [post.page_name].filter(Boolean) as string[]);
                      } else {
                        onPostClick(post);
                      }
                    }}
                    className={cn(
                      "w-full p-2 rounded-lg border text-left transition-all hover:shadow-md relative",
                      isSelected && "ring-2 ring-primary",
                      status === "published"
                        ? "bg-green-500/10 border-green-500/40"
                        : status === "scheduled" && isApproved
                        ? "bg-card border-green-500/30"
                        : status === "scheduled"
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : status === "draft"
                        ? "bg-muted/30 border-dashed border-muted-foreground/30"
                        : status === "declined"
                        ? "bg-destructive/5 border-destructive/30"
                        : "bg-muted/50 border-border"
                    )}
                  >
                    {onToggleSelect && (
                      <div
                        className="absolute top-1.5 right-1.5 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelect(post.id);
                        }}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-sm border flex items-center justify-center cursor-pointer",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40 hover:border-primary"
                        )}>
                          {isSelected && (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center", pIcon.bg)}>
                        {pIcon.icon}
                      </div>
                      {post.image_url?.match(/\.(mp4|mov|webm)(\?|$)/i) && (
                        <Video className="w-3 h-3 text-muted-foreground" />
                      )}
                      {post.title === "?" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          ?
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium truncate">
                      {post.page_name || (platform.charAt(0).toUpperCase() + platform.slice(1))}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                      {post.scheduled_date && (
                        <span className="text-muted-foreground">{format(parseISO(post.scheduled_date), "h:mm a")}</span>
                      )}
                      {post.scheduled_date && <span className="text-muted-foreground">·</span>}
                      <span className={cn(
                        status === "published" ? "text-green-600 font-medium"
                          : status === "scheduled" && isApproved ? "text-green-500 font-medium"
                          : status === "scheduled" ? "text-yellow-600"
                          : status === "declined" ? "text-destructive"
                          : status === "pending_approval" ? "text-yellow-600"
                          : "text-muted-foreground"
                      )}>
                        {status === "scheduled" && !isApproved
                          ? "Pending Approval"
                          : status === "scheduled" && isApproved
                          ? "Scheduled · Approved"
                        : statusLabel}
                      </span>
                    </div>
                    {status === "declined" && post.decline_reason && (
                      <p className="text-[10px] text-destructive/70 truncate mt-0.5" title={post.decline_reason}>
                        💬 {post.decline_reason}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
