import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserNote {
  id: string;
  profile_id: string;
  company_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function usePersonalNotes(profileId: string | undefined, companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notes, isLoading } = useQuery({
    queryKey: ["user_notes", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notes" as any)
        .select("*")
        .eq("profile_id", profileId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as UserNote[];
    },
  });

  const createNote = useMutation({
    mutationFn: async (note: { title: string; content: string }) => {
      if (!profileId || !companyId) throw new Error("Missing profile/company");
      const { data, error } = await supabase
        .from("user_notes" as any)
        .insert({ profile_id: profileId, company_id: companyId, title: note.title, content: note.content })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as UserNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_notes", profileId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating note", description: err.message, variant: "destructive" });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string }) => {
      const { error } = await supabase
        .from("user_notes" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_notes", profileId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error saving note", description: err.message, variant: "destructive" });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_notes", profileId] });
      toast({ title: "Note deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting note", description: err.message, variant: "destructive" });
    },
  });

  return { notes: notes ?? [], isLoading, createNote, updateNote, deleteNote };
}
