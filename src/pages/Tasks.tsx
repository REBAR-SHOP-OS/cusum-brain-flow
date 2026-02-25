import React, { useState, useEffect, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare, Plus, RefreshCw, Copy, Check, Maximize2, Minus, Sparkles,
  MessageSquare, Paperclip, Send, Trash2, ExternalLink, X, Upload, CalendarDays,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AISuggestButton } from "@/components/ui/AISuggestButton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScheduledActivities } from "@/components/pipeline/ScheduledActivities";
import { format, isPast, isToday, startOfDay } from "date-fns";

// ─── Types ──────────────────────────────────────────────
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  company_id: string;
  source?: string | null;
  attachment_url?: string | null;
  created_by_profile?: { id: string; full_name: string | null } | null;
}

interface AuditEntry {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_user_id: string | null;
  created_at: string;
}

interface TaskComment {
  id: string;
  task_id: string;
  profile_id: string;
  content: string;
  company_id: string;
  created_at: string;
  profile?: { full_name: string | null } | null;
}

interface EmployeeProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  user_id: string | null;
}

// ─── Constants ──────────────────────────────────────────
const NEEL_PROFILE_ID = "a94932c5-e873-46fd-9658-dc270f6f5ff3";
const EXCLUDED_EMAILS = ["ai@rebar.shop", "kourosh@rebar.shop"];

const COLUMN_COLORS = [
  "border-t-blue-500 bg-blue-500/10",
  "border-t-purple-500 bg-purple-500/10",
  "border-t-emerald-500 bg-emerald-500/10",
  "border-t-orange-500 bg-orange-500/10",
  "border-t-pink-500 bg-pink-500/10",
  "border-t-teal-500 bg-teal-500/10",
  "border-t-yellow-500 bg-yellow-500/10",
  "border-t-red-500 bg-red-500/10",
  "border-t-indigo-500 bg-indigo-500/10",
  "border-t-cyan-500 bg-cyan-500/10",
];

const STATUS_MAP: Record<string, string> = { open: "Pending", in_progress: "In Progress", completed: "Completed" };
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  low: "bg-muted text-muted-foreground",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  in_progress: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  completed: "bg-green-500/20 text-green-600 dark:text-green-400",
};

// ─── Helpers ────────────────────────────────────────────
function isOverdue(task: TaskRow) {
  if (!task.due_date || task.status === "completed") return false;
  return isPast(startOfDay(new Date(task.due_date))) && !isToday(new Date(task.due_date));
}

function sortTasks(tasks: TaskRow[]): TaskRow[] {
  const active = tasks.filter(t => t.status !== "completed");
  const completed = tasks.filter(t => t.status === "completed");

  active.sort((a, b) => {
    const aOver = isOverdue(a) ? 0 : 1;
    const bOver = isOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    if (a.due_date && b.due_date) {
      const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (diff !== 0) return diff;
    } else if (a.due_date && !b.due_date) return -1;
    else if (!a.due_date && b.due_date) return 1;
    const ap = PRIORITY_ORDER[a.priority || "medium"] ?? 1;
    const bp = PRIORITY_ORDER[b.priority || "medium"] ?? 1;
    if (ap !== bp) return ap - bp;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  completed.sort((a, b) => {
    const aAt = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bAt = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bAt - aAt;
  });

  return [...active, ...completed];
}

async function copyImageToClipboard(url: string) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const imgBlob = blob.type.startsWith("image/") ? blob : new Blob([blob], { type: "image/png" });
    await navigator.clipboard.write([new ClipboardItem({ [imgBlob.type]: imgBlob })]);
    return true;
  } catch {
    return false;
  }
}

function ImageWithCopy({ src }: { src: string }) {
  const [copiedImg, setCopiedImg] = React.useState(false);
  const handleCopy = async () => {
    const ok = await copyImageToClipboard(src);
    if (ok) {
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 2000);
    } else {
      // fallback: copy URL
      navigator.clipboard.writeText(src);
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 2000);
    }
  };
  return (
    <span className="block my-2 relative group/img">
      <a href={src} target="_blank" rel="noopener noreferrer">
        <img src={src} alt="Screenshot" className="max-w-full h-auto rounded-lg border border-border" loading="lazy" />
      </a>
      <button
        onClick={handleCopy}
        title={copiedImg ? "Copied!" : "Copy image"}
        className="absolute top-1 right-1 bg-background/80 border border-border rounded p-1 opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-muted"
      >
        {copiedImg
          ? <Check className="w-3 h-3 text-green-500" />
          : <Copy className="w-3 h-3 text-muted-foreground" />}
      </button>
    </span>
  );
}

function linkifyText(text: string | null) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const imageExtRegex = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      if (imageExtRegex.test(part)) {
        return <ImageWithCopy key={i} src={part} />;
      }
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
}


// ─── Component ──────────────────────────────────────────
export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  // Detail drawer
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentFiles, setCommentFiles] = useState<{file: File, previewUrl: string}[]>([]);
  const [uploadingCommentFiles, setUploadingCommentFiles] = useState(false);

  // Create modal
  const [createForEmployee, setCreateForEmployee] = useState<EmployeeProfile | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [creating, setCreating] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Full screen desc
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Approval flow state
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Generate Fix Prompt state
  const [fixPromptOpen, setFixPromptOpen] = useState(false);
  const [fixPrompt, setFixPrompt] = useState("");
  const [fixLoading, setFixLoading] = useState(false);
  const [fixCopied, setFixCopied] = useState(false);

  // Fetch current user ID once
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      setCurrentUserEmail(data.user?.email ?? null);
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", uid)
          .single();
        setCurrentProfileId(profile?.id ?? null);
      }
    });
  }, []);

  const { isAdmin } = useUserRole();

  const authResolved = currentUserEmail !== null;
  const isInternal = authResolved && currentUserEmail.endsWith("@rebar.shop");

  // Assigned user, creator, or admin can mark a task complete
  const canMarkComplete = (task: TaskRow) =>
    isAdmin ||
    currentProfileId === task.assigned_to ||
    currentProfileId === task.created_by_profile_id;

  // Assigned user, creator, or admin can reopen/uncomplete
  const canUncomplete = (task: TaskRow) =>
    isAdmin ||
    currentProfileId === task.assigned_to ||
    currentProfileId === task.created_by_profile_id;

  // Only task creator or admin can approve/close or reopen with issue
  const canApproveTask = (task: TaskRow) =>
    isAdmin || currentProfileId === task.created_by_profile_id;

  // Only task creator or admin can delete or generate fix
  const canDeleteOrFix = (task: TaskRow) =>
    isAdmin || currentProfileId === task.created_by_profile_id;

  const canToggleTask = (task: TaskRow) => {
    if (task.status === "completed") return canUncomplete(task);
    return canMarkComplete(task);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const handleDescPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const newFiles: File[] = [];
    imageItems.forEach(item => {
      const blob = item.getAsFile();
      if (blob) {
        const fileName = `pasted-image-${Date.now()}.png`;
        const file = new File([blob], fileName, { type: blob.type });
        newFiles.push(file);
      }
    });
    if (newFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} image(s) added from clipboard`);
    }
  };
  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Data loading ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, employeesRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, created_by_profile:profiles!tasks_created_by_profile_id_fkey(id, full_name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email, user_id")
          .ilike("email", "%@rebar.shop"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (employeesRes.error) throw employeesRes.error;
      setTasks((tasksRes.data as any) || []);
      // Filter excluded emails, sort alphabetically, then move current user first
      const filtered = (employeesRes.data || [])
        .filter(e => !EXCLUDED_EMAILS.includes((e.email || "").toLowerCase()))
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      if (currentUserId) {
        const myIdx = filtered.findIndex(e => e.user_id === currentUserId);
        if (myIdx > 0) {
          const [me] = filtered.splice(myIdx, 1);
          filtered.unshift(me);
        }
      }
      setEmployees(filtered);
    } catch (err: any) {
      toast.error(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Audit log loading ────────────────────────────────
  const loadAudit = async (taskId: string) => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_audit_log")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAuditLog((data as AuditEntry[]) || []);
    } catch { setAuditLog([]); }
    finally { setAuditLoading(false); }
  };

  const loadComments = async (taskId: string) => {
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, profile:profiles!task_comments_profile_id_fkey(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments((data as any) || []);
    } catch { setComments([]); }
    finally { setCommentsLoading(false); }
  };

  const handleCommentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const newFiles = imageItems.map(item => {
      const blob = item.getAsFile()!;
      const file = new File([blob], `comment-image-${Date.now()}.png`, { type: blob.type });
      return { file, previewUrl: URL.createObjectURL(blob) };
    });
    setCommentFiles(prev => [...prev, ...newFiles]);
  };

  const postComment = async () => {
    if (!newComment.trim() && commentFiles.length === 0) return;
    if (!selectedTask || !currentProfileId) return;
    setSubmittingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const companyRes = await supabase.from("profiles").select("company_id").eq("user_id", user?.id || "").single();
      let content = newComment.trim();

      if (commentFiles.length > 0) {
        setUploadingCommentFiles(true);
        for (const { file } of commentFiles) {
          const path = `${user?.id}/${crypto.randomUUID()}.png`;
          const { error: uploadError } = await supabase.storage.from("estimation-files").upload(path, file);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("estimation-files").getPublicUrl(path);
            content += (content ? "\n" : "") + publicUrl;
          }
        }
        setUploadingCommentFiles(false);
      }

      const { error } = await supabase.from("task_comments").insert({
        task_id: selectedTask.id,
        profile_id: currentProfileId,
        content,
        company_id: companyRes.data?.company_id,
      } as any);
      if (error) throw error;
      setNewComment("");
      setCommentFiles([]);
      loadComments(selectedTask.id);
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmittingComment(false); setUploadingCommentFiles(false); }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
    if (error) { toast.error(error.message); return; }
    if (selectedTask) loadComments(selectedTask.id);
  };

  // ─── Group tasks by employee ──────────────────────────
  const tasksByEmployee = new Map<string, TaskRow[]>();
  for (const emp of employees) {
    tasksByEmployee.set(emp.id, []);
  }
  for (const t of tasks) {
    if (t.assigned_to && tasksByEmployee.has(t.assigned_to)) {
      tasksByEmployee.get(t.assigned_to)!.push(t);
    }
  }

  // ─── Mutations ────────────────────────────────────────
  const writeAudit = async (taskId: string, action: string, field: string | null, oldVal: string | null, newVal: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("task_audit_log").insert({
      task_id: taskId,
      action,
      field,
      old_value: oldVal,
      new_value: newVal,
      actor_user_id: user?.id || null,
    } as any);
  };

  const dismissTaskNotifications = async (taskId: string) => {
    try {
      const { data: humanTasks } = await supabase
        .from("human_tasks" as any)
        .select("id")
        .eq("entity_type", "task")
        .eq("entity_id", taskId);

      if (humanTasks && humanTasks.length > 0) {
        const htIds = (humanTasks as any[]).map((ht: any) => ht.id);
        for (const htId of htIds) {
          await supabase
            .from("notifications")
            .update({ status: "dismissed" })
            .eq("metadata->>human_task_id", htId);
        }
      }
    } catch (e) {
      console.error("Failed to dismiss task notifications", e);
    }
  };

  const toggleComplete = async (task: TaskRow) => {
    const isCompleted = task.status === "completed";
    if (!isCompleted && !canMarkComplete(task)) {
      toast.error("Only the assigned user can mark this task complete");
      return;
    }
    if (isCompleted && !canUncomplete(task)) {
      toast.error("Only the assigned user, creator, or admin can reopen this task");
      return;
    }
    const newStatus = isCompleted ? "open" : "completed";
    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      completed_at: isCompleted ? null : new Date().toISOString(),
    };

    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    if (error) { toast.error(error.message); return; }

    await writeAudit(task.id, isCompleted ? "uncomplete" : "complete", "status", task.status || "open", newStatus);

    // Create approval human_task for task owner when marked complete
    if (!isCompleted && task.created_by_profile_id) {
      try {
        const { data: agent } = await supabase
          .from("agents" as any)
          .select("id")
          .eq("code", "vizzy")
          .single();

        if (agent) {
          await supabase.from("human_tasks" as any).insert({
            agent_id: (agent as any).id,
            company_id: task.company_id,
            title: `Approve & Close: ${task.title}`,
            description: `Task completed. Review and approve to close, or reopen with new evidence.`,
            severity: "info",
            category: "task_approval",
            entity_type: "task",
            entity_id: task.id,
            assigned_to: task.created_by_profile_id,
            status: "open",
          });
        }
      } catch (e) {
        console.error("Failed to create approval task", e);
      }
    }

    // Dismiss related notifications when reopening
    if (isCompleted) {
      await dismissTaskNotifications(task.id);
    }

    toast.success(isCompleted ? "Task reopened" : "Task completed");
    loadData();
  };

  const approveAndClose = async (task: TaskRow) => {
    // Keep task as completed, resolve any open human_tasks for it
    try {
      await supabase
        .from("human_tasks" as any)
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("entity_type", "task")
        .eq("entity_id", task.id)
        .eq("category", "task_approval")
        .eq("status", "open");

      await dismissTaskNotifications(task.id);
      await writeAudit(task.id, "approved_and_closed", "status", "completed", "completed");

      // Send feedback resolution notification to original reporter
      if (task.source === "screenshot_feedback" && task.created_by_profile_id) {
        try {
          const { data: reporterProfile } = await supabase
            .from("profiles")
            .select("user_id, company_id")
            .eq("id", task.created_by_profile_id)
            .maybeSingle();

          if (reporterProfile?.user_id) {
            await supabase.from("notifications").insert({
              user_id: reporterProfile.user_id,
              type: "notification",
              title: `بازخورد شما بررسی شد: ${task.title}`,
              description: task.description || null,
              agent_name: "Feedback",
              agent_color: "bg-emerald-500",
              link_to: null,
              company_id: reporterProfile.company_id,
              metadata: {
                task_id: task.id,
                feedback_resolved: true,
                original_title: task.title,
                original_description: task.description || null,
                original_attachment_url: task.attachment_url || null,
              },
            });
          }
        } catch (notifErr) {
          console.error("Failed to send feedback resolution notification:", notifErr);
        }
      }

      toast.success("Task approved & closed");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    }
  };

  const reopenWithIssue = async (task: TaskRow, reason: string) => {
    if (!reason.trim()) { toast.error("Please describe the issue"); return; }
    try {
      // Reopen task
      await supabase.from("tasks").update({
        status: "open",
        completed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", task.id);

      // Add comment with the issue description
      const { data: { user } } = await supabase.auth.getUser();
      const companyRes = await supabase.from("profiles").select("company_id").eq("user_id", user?.id || "").single();
      await supabase.from("task_comments" as any).insert({
        task_id: task.id,
        profile_id: currentProfileId,
        content: `🔄 Reopened with issue:\n${reason}`,
        company_id: companyRes.data?.company_id,
      });

      // Resolve the approval human_task
      await supabase
        .from("human_tasks" as any)
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("entity_type", "task")
        .eq("entity_id", task.id)
        .eq("category", "task_approval")
        .eq("status", "open");

      await dismissTaskNotifications(task.id);
      await writeAudit(task.id, "reopened_with_issue", "status", "completed", "open");
      toast.success("Task reopened with issue — assignee notified");
      setReopenDialogOpen(false);
      setReopenReason("");
      loadData();
      // Refresh comments
      if (selectedTask?.id === task.id) {
        loadComments(task.id);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to reopen");
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    if (drawerOpen && selectedTask?.id === taskId) setDrawerOpen(false);
    loadData();
  };

  const createTask = async () => {
    if (!newTitle.trim() || !createForEmployee) { toast.error("Title is required"); return; }
    if (newDueDate && newDueDate < new Date().toISOString().split("T")[0]) { toast.error("Due date cannot be in the past"); return; }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const companyRes = await supabase.from("profiles").select("company_id").eq("user_id", user?.id || "").single();

      const { data, error } = await supabase.from("tasks").insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        assigned_to: createForEmployee.id,
        due_date: newDueDate || null,
        priority: newPriority,
        status: "open",
        company_id: companyRes.data?.company_id,
        created_by_profile_id: currentProfileId,
      } as any).select().single();

      if (error) throw error;
      await writeAudit(data.id, "create", null, null, null);

      // Upload pending files
      if (pendingFiles.length > 0) {
        setUploadingFiles(true);
        const urls: string[] = [];
        for (const file of pendingFiles) {
          const path = `task-attachments/${data.id}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("clearance-photos").upload(path, file);
          if (!upErr) {
            const { data: signed } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
            if (signed?.signedUrl) urls.push(signed.signedUrl);
          }
        }
        if (urls.length > 0) {
          await supabase.from("tasks").update({ attachment_urls: urls } as any).eq("id", data.id);
        }
        setPendingFiles([]);
        setUploadingFiles(false);
      }

      // Send notification to the assigned employee
      if (createForEmployee.user_id) {
        await supabase.from("notifications").insert({
          user_id: createForEmployee.user_id,
          type: "notification",
          title: "New Task Assigned",
          description: newTitle.trim().substring(0, 200),
          status: "unread",
        } as any);
      }

      toast.success("Task created");
      setCreateForEmployee(null);
      setNewTitle(""); setNewDesc(""); setNewDueDate(""); setNewPriority("medium"); setPendingFiles([]);
      await loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); setUploadingFiles(false); }
  };

  const handleDrawerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";
    const existingUrls: string[] = (selectedTask as any).attachment_urls || [];
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `task-attachments/${selectedTask.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("clearance-photos").upload(path, file);
      if (!upErr) {
        const { data: signed } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) newUrls.push(signed.signedUrl);
      }
    }
    if (newUrls.length > 0) {
      const combined = [...existingUrls, ...newUrls];
      await supabase.from("tasks").update({ attachment_urls: combined } as any).eq("id", selectedTask.id);
      setSelectedTask(prev => prev ? { ...prev, attachment_urls: combined } as any : prev);
      toast.success(`${newUrls.length} file(s) uploaded`);
      loadData();
    }
  };

  const deleteAttachment = async (url: string, index: number) => {
    if (!selectedTask) return;
    const existingUrls: string[] = (selectedTask as any).attachment_urls || [];
    const updatedUrls = existingUrls.filter((_, i) => i !== index);
    await supabase.from("tasks").update({ attachment_urls: updatedUrls } as any).eq("id", selectedTask.id);
    setSelectedTask(prev => prev ? { ...prev, attachment_urls: updatedUrls } as any : prev);
    toast.success("Attachment removed");
    loadData();
  };

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      toast.success("Copied!"); setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openDrawer = (task: TaskRow) => {
    setSelectedTask(task);
    setDrawerOpen(true);
    setNewComment("");
    loadAudit(task.id);
    loadComments(task.id);
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Employee Tasks</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : (
          <div className="flex gap-4 p-4 h-full min-w-max">
            {employees.map((emp, empIndex) => {
              const empTasks = sortTasks(tasksByEmployee.get(emp.id) || []);
              const activeTasks = empTasks.filter(t => t.status !== "completed");
              const completedTasks = empTasks.filter(t => t.status === "completed");

              return (
                <div
                  key={emp.id}
                  className={cn("w-[320px] flex flex-col bg-muted/30 rounded-lg border border-border shrink-0 border-t-4", COLUMN_COLORS[empIndex % COLUMN_COLORS.length])}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{emp.full_name || "Unknown"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{emp.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {activeTasks.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setCreateForEmployee(emp);
                          setNewTitle(""); setNewDesc(""); setNewDueDate(""); setNewPriority("medium");
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Task List */}
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1.5">
                      {activeTasks.length === 0 && completedTasks.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                      )}

                      {activeTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-background border border-border/50 hover:border-border transition-colors group"
                        >
                          <Checkbox
                            checked={false}
                            disabled={!canToggleTask(task)}
                            title={!canToggleTask(task) ? "Only the assigned user or creator can mark this complete" : undefined}
                            onCheckedChange={() => toggleComplete(task)}
                            className="mt-0.5 shrink-0"
                          />
                          <button
                            className="flex-1 text-left min-w-0"
                            onClick={() => openDrawer(task)}
                          >
                            <span className={cn(
                              "text-sm font-medium block truncate",
                              isOverdue(task) && "text-destructive"
                            )}>
                              {task.title}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {task.created_by_profile?.full_name && (
                                <span className="text-[10px] text-muted-foreground">
                                  by {task.created_by_profile.full_name}
                                </span>
                              )}
                              {task.due_date && (
                                <span className={cn(
                                  "text-[10px]",
                                  isOverdue(task) ? "text-destructive" : "text-muted-foreground"
                                )}>
                                  · {format(new Date(task.due_date), "MMM d")}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {completedTasks.length > 0 && (
                        <>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 pt-2">
                            Done ({completedTasks.length})
                          </div>
                          {completedTasks.map(task => (
                            <div
                              key={task.id}
                              className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-background/50 border border-border/30 opacity-50 group"
                            >
                              <Checkbox
                                checked={true}
                                disabled={!canToggleTask(task)}
                                title={!canToggleTask(task) ? "Only the assigned user or creator can mark this complete" : undefined}
                                onCheckedChange={() => toggleComplete(task)}
                                className="mt-0.5 shrink-0"
                              />
                              <button
                                className="flex-1 text-left min-w-0"
                                onClick={() => openDrawer(task)}
                              >
                                <span className="text-sm line-through text-muted-foreground block truncate">
                                  {task.title}
                                </span>
                                {task.created_by_profile?.full_name && (
                                  <span className="text-[10px] text-muted-foreground">
                                    by {task.created_by_profile.full_name}
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 text-muted-foreground hover:text-destructive"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create Task Modal ─── */}
      <Dialog open={!!createForEmployee} onOpenChange={(open) => { if (!open) setCreateForEmployee(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Task for {createForEmployee?.full_name}</DialogTitle>
            <DialogDescription className="sr-only">Create a new task assigned to this employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title" className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Description</Label>
                <AISuggestButton
                  contextType="task_description"
                  context={`Task title: ${newTitle}`}
                  currentText={newDesc}
                  onSuggestion={(text) => setNewDesc(text)}
                  label="Suggest"
                  compact={false}
                  disabled={!newTitle.trim()}
                />
              </div>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} onPaste={handleDescPaste} placeholder="Optional description — Ctrl+V to paste images" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {authResolved && isInternal && (
              <div>
                <Label className="text-xs">Attachments</Label>
                <label className="mt-1 flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  {pendingFiles.length > 0 ? `${pendingFiles.length} file(s) selected` : "Click to attach files"}
                  <input type="file" multiple className="sr-only" onChange={handleFilePick} />
                </label>
                {pendingFiles.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                        <span className="truncate">{f.name}</span>
                        <button onClick={() => removeFile(i)} type="button">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button onClick={createTask} disabled={creating || uploadingFiles} className="w-full">
              {creating || uploadingFiles ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Details Drawer ─── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedTask?.title}</SheetTitle>
            <SheetDescription className="sr-only">Task details and audit log</SheetDescription>
          </SheetHeader>
          {selectedTask && (
            <div className="mt-4 space-y-5">
              {/* Description */}
              {selectedTask.description && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(selectedTask.description)}>
                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFullScreenOpen(true)}>
                        <Maximize2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words overflow-y-auto max-h-[40vh] rounded-md border border-border/50 bg-muted/30 p-3">
                    {linkifyText(selectedTask.description)}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <p className="mt-0.5"><Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[selectedTask.status || "open"])}>{STATUS_MAP[selectedTask.status || "open"]}</Badge></p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <p className="mt-0.5"><Badge variant="secondary" className={cn("text-xs font-normal", PRIORITY_COLORS[selectedTask.priority || "medium"])}>{(selectedTask.priority || "medium").charAt(0).toUpperCase() + (selectedTask.priority || "medium").slice(1)}</Badge></p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Assigned To</span>
                  <Select
                    value={selectedTask.assigned_to || ""}
                    onValueChange={async (newAssignee) => {
                      const oldAssignee = selectedTask.assigned_to;
                      if (newAssignee === oldAssignee) return;
                      const { error } = await supabase
                        .from("tasks")
                        .update({ assigned_to: newAssignee, updated_at: new Date().toISOString() })
                        .eq("id", selectedTask.id);
                      if (error) { toast.error(error.message); return; }
                      const oldName = employees.find(e => e.id === oldAssignee)?.full_name || "Unassigned";
                      const newName = employees.find(e => e.id === newAssignee)?.full_name || "Unassigned";
                      await writeAudit(selectedTask.id, "reassign", "assigned_to", oldName, newName);
                      setSelectedTask({ ...selectedTask, assigned_to: newAssignee });
                      loadData();
                      toast.success("Task reassigned");
                    }}
                  >
                    <SelectTrigger className="mt-0.5 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created By</span>
                  <p className="mt-0.5 text-sm">{selectedTask.created_by_profile?.full_name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Due Date</span>
                  {canMarkComplete(selectedTask) ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "mt-0.5 text-sm flex items-center gap-1.5 hover:bg-accent rounded px-1.5 py-0.5 -ml-1.5 transition-colors",
                          isOverdue(selectedTask) && "text-destructive font-medium"
                        )}>
                          <CalendarDays className="h-3.5 w-3.5 opacity-60" />
                          {selectedTask.due_date ? format(new Date(selectedTask.due_date), "MMM d, yyyy") : <span className="text-muted-foreground">Set date</span>}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedTask.due_date ? new Date(selectedTask.due_date) : undefined}
                          onSelect={async (date) => {
                            const oldDate = selectedTask.due_date;
                            const newDate = date ? format(date, "yyyy-MM-dd") : null;
                            const { error } = await supabase.from("tasks").update({ due_date: newDate, updated_at: new Date().toISOString() }).eq("id", selectedTask.id);
                            if (error) { toast.error(error.message); return; }
                            await writeAudit(selectedTask.id, "reschedule", "due_date", oldDate || null, newDate);
                            setSelectedTask({ ...selectedTask, due_date: newDate });
                            loadData();
                            toast.success(newDate ? "Due date updated" : "Due date cleared");
                          }}
                          className="p-3 pointer-events-auto"
                          initialFocus
                        />
                        {selectedTask.due_date && (
                          <div className="border-t px-3 py-2">
                            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={async () => {
                              const oldDate = selectedTask.due_date;
                              const { error } = await supabase.from("tasks").update({ due_date: null, updated_at: new Date().toISOString() }).eq("id", selectedTask.id);
                              if (error) { toast.error(error.message); return; }
                              await writeAudit(selectedTask.id, "reschedule", "due_date", oldDate, null);
                              setSelectedTask({ ...selectedTask, due_date: null });
                              loadData();
                              toast.success("Due date cleared");
                            }}>
                              <X className="h-3 w-3 mr-1" /> Clear date
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <p className={cn("mt-0.5 text-sm", isOverdue(selectedTask) && "text-destructive font-medium")}>{selectedTask.due_date ? format(new Date(selectedTask.due_date), "MMM d, yyyy") : "—"}</p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created</span>
                  <p className="mt-0.5 text-sm">{format(new Date(selectedTask.created_at), "MMM d, yyyy")}</p>
                </div>
                {selectedTask.completed_at && (
                  <div>
                    <span className="text-xs text-muted-foreground">Completed At</span>
                    <p className="mt-0.5 text-sm">{format(new Date(selectedTask.completed_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {selectedTask.status === "completed" ? (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => approveAndClose(selectedTask)}
                      disabled={!canApproveTask(selectedTask)}
                      title={!canApproveTask(selectedTask) ? "Only the task creator or an admin can approve & close" : undefined}
                    >
                      <Check className="w-4 h-4" /> Approve & Close
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setReopenDialogOpen(true)}
                      disabled={!canApproveTask(selectedTask)}
                      title={!canApproveTask(selectedTask) ? "Only the task creator or an admin can reopen with an issue" : undefined}
                    >
                      <RefreshCw className="w-4 h-4" /> Reopen with Issue
                    </Button>
                    {!canApproveTask(selectedTask) && (
                      <p className="text-xs text-muted-foreground w-full">Only the task creator or an admin can approve or reopen this task.</p>
                    )}
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="default" onClick={() => toggleComplete(selectedTask)} className="flex-1" disabled={!canToggleTask(selectedTask)}>
                      Mark Complete
                    </Button>
                    {!canToggleTask(selectedTask) && (
                      <p className="text-xs text-muted-foreground w-full">Only the assigned user can mark this task complete.</p>
                    )}
                  </>
                )}
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
                  disabled={fixLoading || !canDeleteOrFix(selectedTask)}
                  onClick={async () => {
                    setFixLoading(true);
                    try {
                      const commentTexts = comments.map(c => {
                        let text = c.content;
                        if (c.profile?.full_name) text = `[${c.profile.full_name}] ${text}`;
                        return text;
                      });
                      // Extract screenshot URLs — first parse structured "Screenshot: <url>" lines
                      const screenshots: string[] = [];
                      const screenshotLineRegex = /Screenshot:\s*(https?:\/\/[^\s]+)/gi;
                      let lineMatch: RegExpExecArray | null;
                      const descText = selectedTask.description || "";
                      while ((lineMatch = screenshotLineRegex.exec(descText)) !== null) {
                        screenshots.push(lineMatch[1]);
                      }
                      // Fallback: generic image URL regex in description + comments
                      const urlRegex = /(https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)[^\s]*)/gi;
                      const descGenericMatches = descText.match(urlRegex) || [];
                      for (const url of descGenericMatches) {
                        if (!screenshots.includes(url)) screenshots.push(url);
                      }
                      for (const c of comments) {
                        const matches = c.content.match(urlRegex);
                        if (matches) {
                          for (const url of matches) {
                            if (!screenshots.includes(url)) screenshots.push(url);
                          }
                        }
                      }

                      const { data, error } = await supabase.functions.invoke("generate-fix-prompt", {
                        body: {
                          title: selectedTask.title,
                          description: selectedTask.description || "",
                          comments: commentTexts,
                          screenshots,
                        },
                      });
                      if (error) throw error;
                      setFixPrompt(data.prompt || "No prompt generated.");
                      setFixPromptOpen(true);
                      setFixCopied(false);
                    } catch (e: any) {
                      toast.error(e.message || "Failed to generate fix prompt");
                    } finally {
                      setFixLoading(false);
                    }
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  {fixLoading ? "Generating..." : "Generate Fix"}
                </Button>

                <Button size="sm" variant="destructive" disabled={!canDeleteOrFix(selectedTask)} onClick={() => { if (window.confirm("Delete this task?")) { supabase.from("tasks").delete().eq("id", selectedTask.id).then(({ error }) => { if (error) toast.error(error.message); else { toast.success("Task deleted"); setDrawerOpen(false); loadData(); } }); } }}>Delete</Button>
              </div>

              {/* Reopen with Issue Dialog */}
              <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reopen with Issue</DialogTitle>
                    <DialogDescription>Describe what's wrong so the assignee can fix it with new evidence.</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Describe the issue or problem found..."
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => selectedTask && reopenWithIssue(selectedTask, reopenReason)}>
                      <RefreshCw className="w-4 h-4" /> Reopen Task
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Generate Fix Prompt Dialog */}
              <Dialog open={fixPromptOpen} onOpenChange={setFixPromptOpen}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Generated Fix Prompt</DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                      Copy this prompt and paste it into Lovable AI chat to fix the issue.
                      {(() => {
                        const urlRegex = /(https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)[^\s]*)/gi;
                        const screenshotLineRegex = /Screenshot:\s*(https?:\/\/[^\s]+)/gi;
                        const found = new Set<string>();
                        const desc = selectedTask?.description || "";
                        let m: RegExpExecArray | null;
                        while ((m = screenshotLineRegex.exec(desc)) !== null) found.add(m[1]);
                        (desc.match(urlRegex) || []).forEach(u => found.add(u));
                        comments.forEach(c => (c.content.match(urlRegex) || []).forEach(u => found.add(u)));
                        return found.size > 0 ? (
                          <span className="text-xs text-muted-foreground ml-1">📎 {found.size} screenshot(s) detected — using vision AI</span>
                        ) : null;
                      })()}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="bg-muted rounded-lg p-4 max-h-[50vh] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">{fixPrompt}</pre>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setFixPromptOpen(false)}>Close</Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(fixPrompt);
                        setFixCopied(true);
                        toast.success("Prompt copied to clipboard!");
                        setTimeout(() => setFixCopied(false), 2000);
                      }}
                    >
                      {fixCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {fixCopied ? "Copied!" : "Copy Prompt"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Next Activity */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Next Activity</h4>
                <ScheduledActivities entityType="task" entityId={selectedTask.id} />
              </div>

              {/* Audit Log */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Audit Log</h4>
                {auditLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : auditLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No audit entries yet</p>
                ) : (
                  <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                    {auditLog.map(entry => (
                      <div key={entry.id} className="text-xs border-l-2 border-border pl-3 py-1">
                        <span className="font-medium">{entry.action}</span>
                        {entry.field && <span className="text-muted-foreground"> on {entry.field}</span>}
                        {entry.old_value && entry.new_value && (
                          <span className="text-muted-foreground">: {entry.old_value} → {entry.new_value}</span>
                        )}
                        <p className="text-muted-foreground mt-0.5">{format(new Date(entry.created_at), "MMM d, HH:mm")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                  <MessageSquare className="w-3 h-3" /> Comments ({comments.length})
                </h4>
                {commentsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet</p>
                ) : (
                  <div className="space-y-2 max-h-[25vh] overflow-y-auto mb-2">
                    {comments.map(c => (
                      <div key={c.id} className="text-xs bg-muted/40 rounded-md p-2 group/comment">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{(c as any).profile?.full_name || "Unknown"}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">{format(new Date(c.created_at), "MMM d, HH:mm")}</span>
                            {c.profile_id === currentProfileId && (
                              <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-foreground whitespace-pre-wrap">
                          {c.content.split('\n').map((line, j) =>
                            line.startsWith('https://') && /\.(png|jpg|jpeg|webp|gif)/i.test(line)
                              ? <img key={j} src={line} className="mt-1 max-h-32 rounded cursor-pointer border border-border" onClick={() => window.open(line)} alt="comment attachment" />
                              : <span key={j} className="block">{line}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1 mt-2">
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {commentFiles.map((cf, i) => (
                        <div key={i} className="relative">
                          <img src={cf.previewUrl} className="h-12 w-12 object-cover rounded border border-border" alt="paste preview" />
                          <button onClick={() => setCommentFiles(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Comment</span>
                      <AISuggestButton
                        contextType="task_comment"
                        context={`Task: ${selectedTask?.title || ""}\nDescription: ${selectedTask?.description || ""}`}
                        currentText={newComment}
                        onSuggestion={(text) => setNewComment(text)}
                        label="Suggest"
                        compact={false}
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onPaste={handleCommentPaste}
                        placeholder="Add a comment... (Ctrl+V to paste images)"
                        className="text-xs min-h-[72px] resize-none flex-1"
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                      />
                      <Button size="icon" className="h-8 w-8 shrink-0 mb-1" onClick={postComment} disabled={submittingComment || uploadingCommentFiles || (!newComment.trim() && commentFiles.length === 0)}>
                        {uploadingCommentFiles ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                  <Paperclip className="w-3 h-3" /> Attachments
                  {authResolved && isInternal && (
                    <label className="ml-auto cursor-pointer text-muted-foreground hover:text-primary transition-colors" title="Upload file">
                      <Upload className="w-3.5 h-3.5" />
                      <input type="file" multiple className="sr-only" onChange={handleDrawerUpload} />
                    </label>
                  )}
                </h4>
                {(selectedTask as any)?.attachment_urls?.length > 0 ? (
                  <div className="space-y-2">
                    {((selectedTask as any).attachment_urls as string[]).map((url, i) => {
                      const fileName = url.split("/").pop()?.split("?")[0] || `Attachment ${i + 1}`;
                      const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName);
                      return (
                        <div key={i} className="space-y-1">
                          {isImage && (
                            <div className="relative group/img rounded-md overflow-hidden border border-border">
                              <img src={url} alt={fileName} className="w-full max-h-48 object-contain bg-muted/30" loading="lazy" />
                              <button
                                onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
                                className="absolute top-1.5 right-1.5 p-1 rounded bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover/img:opacity-100 transition-opacity"
                                title="Copy image link"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-1 group/attachment">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate flex-1">
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              {fileName}
                            </a>
                            <button
                              onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
                              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              title="Copy link"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {authResolved && isInternal && (
                              <button
                                onClick={() => deleteAttachment(url, i)}
                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1"
                                title="Remove attachment"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No attachments</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Full Screen Description */}
      <Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription className="sr-only">Full description</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words p-4">
            {selectedTask?.description && linkifyText(selectedTask.description)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
