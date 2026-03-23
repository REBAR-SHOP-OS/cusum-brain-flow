import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SocialApproval {
  id: string;
  post_id: string;
  approver_id: string;
  status: "pending" | "approved" | "rejected";
  feedback: string | null;
  deadline: string;
  decided_at: string | null;
  escalation_count: number;
  notified_at: string | null;
  created_at: string;
}

export function useSocialApprovals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime: auto-refresh when any team member changes approvals
  useEffect(() => {
    const channel = supabase
      .channel("social_approvals_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_approvals" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["social_approvals"] });
          }, 500);
        }
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["social_approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_approvals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SocialApproval[];
    },
  });

  const pendingApprovals = approvals?.filter((a) => a.status === "pending") ?? [];

  const approvePost = useMutation({
    mutationFn: async ({ approvalId, postId }: { approvalId: string; postId: string }) => {
      // Update approval record
      const { error: approvalError } = await supabase
        .from("social_approvals")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", approvalId);
      if (approvalError) throw approvalError;

      // Move post to scheduled (must set qa_status too for DB trigger)
      const { error: postError } = await supabase
        .from("social_posts")
        .update({ status: "scheduled", qa_status: "approved", neel_approved: true })
        .eq("id", postId);
      if (postError) throw postError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      toast({ title: "Post approved", description: "Post has been moved to scheduled." });
    },
    onError: (err: Error) => {
      toast({ title: "Error approving post", description: err.message, variant: "destructive" });
    },
  });

  const rejectPost = useMutation({
    mutationFn: async ({ approvalId, postId, feedback }: { approvalId: string; postId: string; feedback: string }) => {
      const { error: approvalError } = await supabase
        .from("social_approvals")
        .update({ status: "rejected", decided_at: new Date().toISOString(), feedback })
        .eq("id", approvalId);
      if (approvalError) throw approvalError;

      const { error: postError } = await supabase
        .from("social_posts")
        .update({ status: "declined" })
        .eq("id", postId);
      if (postError) throw postError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
      toast({ title: "Post rejected", description: "Feedback has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error rejecting post", description: err.message, variant: "destructive" });
    },
  });

  return { approvals: approvals ?? [], pendingApprovals, isLoading, approvePost, rejectPost };
}
