import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Phone, Mail, Calendar, Clock, Send,
  CheckCircle2, Loader2, ArrowRight, Zap, Paperclip, X, Image, Video,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useSalesLeadActivities, type SalesLeadActivity } from "@/hooks/useSalesLeadActivities";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { toast } from "sonner";
import { MentionMenu } from "@/components/chat/MentionMenu";

interface Props {
  salesLeadId: string;
  companyId: string;
  isExternalEstimator?: boolean;
  currentUserName?: string;
  currentUserId?: string;
  assignees?: { profile_id: string; full_name: string }[];
}

type TabMode = "note" | "activity" | null;
type ThreadFilter = "all" | "notes" | "system";

const activityIcons: Record<string, React.ElementType> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  follow_up: Clock,
  stage_change: ArrowRight,
  system: Zap,
};

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const IMAGE_REGEX = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
const VIDEO_REGEX = /\.(mp4|webm|mov|avi)(\?[^\s]*)?$/i;

function renderBodyWithMedia(text: string | null) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      if (IMAGE_REGEX.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="block my-1">
            <img src={part} alt="Attachment" className="max-w-full max-h-48 rounded-md border border-border object-contain" loading="lazy" />
          </a>
        );
      }
      if (VIDEO_REGEX.test(part)) {
        return (
          <video key={i} src={part} controls className="max-w-full max-h-48 rounded-md border border-border my-1" />
        );
      }
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function SalesLeadChatter({ salesLeadId, companyId, isExternalEstimator, currentUserName: propUserName, currentUserId: propUserId, assignees = [] }: Props) {
  const { activities, isLoading, create, markDone } = useSalesLeadActivities(salesLeadId);

  // Resolve current user if not passed
  const [resolvedUser, setResolvedUser] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (propUserId && propUserName) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const email = data.user.email || "";
        // Find matching assignee or profile name
        const match = assignees.find((a) => a.profile_id === data.user!.id);
        setResolvedUser({ id: data.user.id, name: match?.full_name || email.split("@")[0] });
      }
    });
  }, [propUserId, propUserName, assignees]);

  const currentUserId = propUserId || resolvedUser?.id;
  const currentUserName = propUserName || resolvedUser?.name;

  // Build extraUsers for MentionMenu from non-rebar assignees
  const extraMentionUsers = assignees
    .filter((a) => !a.full_name.toLowerCase().includes("rebar"))
    .map((a) => ({ id: a.profile_id, label: a.full_name, subtitle: "External estimator" }));
  const [activeTab, setActiveTab] = useState<TabMode>(null);
  const [text, setText] = useState("");
  const [activityType, setActivityType] = useState("follow_up");
  const [dueDate, setDueDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [assignedName, setAssignedName] = useState("");
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mention support
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const handleTextChange = useCallback((val: string) => {
    setText(val);
    const match = val.match(/@(\w*)$/);
    if (match) {
      setMentionFilter(match[1]);
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  }, []);

  const handleMentionSelect = useCallback((item: { id: string; label: string }) => {
    setText(prev => prev.replace(/@\w*$/, `@${item.label} `));
    setMentionOpen(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); }
    else if (e.key === "Escape") { setMentionOpen(false); }
  }, [mentionOpen]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }));
    setPendingFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const mediaItems = items.filter(item => item.type.startsWith("image/") || item.type.startsWith("video/"));
    if (mediaItems.length === 0) return;
    e.preventDefault();
    const newFiles: { file: File; previewUrl: string }[] = [];
    mediaItems.forEach(item => {
      const blob = item.getAsFile();
      if (blob) {
        const ext = blob.type.split("/")[1] || "png";
        const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type });
        newFiles.push({ file, previewUrl: URL.createObjectURL(blob) });
      }
    });
    if (newFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) added from clipboard`);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    setUploading(true);

    let body = text.trim();

    // Upload files and append URLs
    if (pendingFiles.length > 0) {
      for (const { file } of pendingFiles) {
        const path = `sales-activities/${salesLeadId}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
        const { error: uploadError } = await uploadToStorage("estimation-files", path, file);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("estimation-files").getPublicUrl(path);
          body += (body ? "\n" : "") + publicUrl;
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    }

    if (activeTab === "note") {
      // Strip attachment URLs for notification (keep only text lines)
      const noteTextForEmail = body
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("http"))
        .join("\n")
        .trim();

      create.mutate({
        sales_lead_id: salesLeadId,
        company_id: companyId,
        activity_type: "note",
        body,
      }, {
        onSuccess: () => {
          setText(""); setPendingFiles([]); setActiveTab(null); setUploading(false);
          // Fire notification email to assignees (fire-and-forget)
          supabase.functions.invoke("notify-lead-assignees", {
            body: {
              sales_lead_id: salesLeadId,
              event_type: "note",
              note_text: noteTextForEmail,
              actor_name: currentUserName || "Someone",
            },
          }).catch(() => {}); // silent — don't block UI
        },
        onError: () => setUploading(false),
      });
    } else if (activeTab === "activity") {
      create.mutate({
        sales_lead_id: salesLeadId,
        company_id: companyId,
        activity_type: activityType,
        subject: body,
        scheduled_date: dueDate,
        user_name: assignedName || currentUserName || undefined,
      }, {
        onSuccess: () => { setText(""); setPendingFiles([]); setActiveTab(null); setUploading(false); setAssignedName(""); },
        onError: () => setUploading(false),
      });
    } else {
      setUploading(false);
    }
  };

  // Filter by tab
  let filtered = activities.filter((a) => {
    if (filter === "notes") return a.activity_type === "note" || a.activity_type === "email";
    if (filter === "system") return a.activity_type === "stage_change" || a.activity_type === "system";
    return true;
  });

  // External estimators only see activities where they are @mentioned or ones they authored
  if (isExternalEstimator && currentUserName) {
    filtered = filtered.filter((a) => {
      // Always show own activities
      if (currentUserId && a.user_id === currentUserId) return true;
      // Check if @mentioned in body or subject
      const mentionTag = `@${currentUserName}`;
      if (a.body?.includes(mentionTag)) return true;
      if (a.subject?.includes(mentionTag)) return true;
      return false;
    });
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Action buttons */}
      <div className="flex gap-1.5">
        {(isExternalEstimator ? ["note"] as const : ["note", "activity"] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={activeTab === tab ? "default" : "outline"}
            className="h-7 text-[11px] gap-1 capitalize"
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
          >
            {tab === "note" ? <MessageSquare className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {tab === "note" ? "Log note" : "Schedule activity"}
          </Button>
        ))}
      </div>

      {/* Composer */}
      {activeTab && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-accent/30">
          {activeTab === "activity" && (
            <div className="flex gap-2">
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="email">✉️ Email</SelectItem>
                  <SelectItem value="meeting">📅 Meeting</SelectItem>
                  <SelectItem value="follow_up">⏰ Follow-up</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-36 h-8 text-xs"
              />
              {assignees.length > 0 && (
                <Select value={assignedName} onValueChange={setAssignedName}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Assign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((a) => (
                      <SelectItem key={a.profile_id} value={a.full_name}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={activeTab === "note" ? "Write a note... (type @ to mention)" : "Activity description..."}
              rows={3}
              className="text-sm resize-none"
            />
            <MentionMenu
              isOpen={mentionOpen}
              filter={mentionFilter}
              selectedIndex={mentionIndex}
              onSelect={handleMentionSelect}
              onClose={() => setMentionOpen(false)}
              extraUsers={extraMentionUsers}
            />
          </div>

          {/* File previews */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="relative group">
                  {f.file.type.startsWith("image/") ? (
                    <img src={f.previewUrl} alt="" className="h-16 w-16 object-cover rounded-md border border-border" />
                  ) : f.file.type.startsWith("video/") ? (
                    <div className="h-16 w-16 rounded-md border border-border bg-muted flex items-center justify-center">
                      <Video className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-md border border-border bg-muted flex items-center justify-center">
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFilePick}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => fileRef.current?.click()}
                title="Attach photo or video"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setActiveTab(null); setText(""); setPendingFiles([]); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={(!text.trim() && pendingFiles.length === 0) || create.isPending || uploading}
                className="gap-1.5"
              >
                {(create.isPending || uploading) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {activeTab === "note" ? "Log" : "Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Thread filter */}
      <div className="flex gap-1 border-b border-border pb-1">
        {(["all", "notes", "system"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded-sm capitalize transition-colors",
              filter === f
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Activity Feed */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-muted-foreground">
          No activities yet. Log a note to get started.
        </div>
      ) : (
        <div className="space-y-0">
          {filtered.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} onMarkDone={() => markDone.mutate(activity.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ activity, onMarkDone }: { activity: SalesLeadActivity; onMarkDone: () => void }) {
  const Icon = activityIcons[activity.activity_type] || MessageSquare;
  const isScheduled = !!activity.scheduled_date && !activity.completed_at;
  const initials = activity.user_name ? getInitials(activity.user_name) : "??";

  return (
    <div className="flex gap-3 py-2.5 border-b border-border/50 last:border-0 group">
      <Avatar className="h-7 w-7 mt-0.5 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{activity.user_name || "System"}</span>
          <span>·</span>
          <Icon className="w-3 h-3" />
          <span className="capitalize">{activity.activity_type.replace("_", " ")}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
        </div>
        {activity.subject && (
          <div className="text-[13px] font-medium mt-0.5">{renderBodyWithMedia(activity.subject)}</div>
        )}
        {activity.body && (
          <div className="text-[13px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{renderBodyWithMedia(activity.body)}</div>
        )}
        {isScheduled && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground">
              Due: {format(new Date(activity.scheduled_date + "T00:00:00"), "MMM d, yyyy")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5 text-green-600 hover:text-green-700 hover:bg-green-500/10"
              onClick={onMarkDone}
            >
              <CheckCircle2 className="w-3 h-3 mr-0.5" />
              Done
            </Button>
          </div>
        )}
        {activity.completed_at && (
          <span className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed {format(new Date(activity.completed_at), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}
