import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface EisenhowerInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EisenhowerInstructionsDialog({ open, onOpenChange }: EisenhowerInstructionsDialogProps) {
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!open || !user) return;
    loadInstructions();
  }, [open, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInstructions = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!profile?.company_id) return;

      const { data: allItems } = await supabase
        .from("knowledge")
        .select("id, content, metadata")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(100);

      const found = allItems?.find((d: any) => d.metadata?.agent === "eisenhower" && d.metadata?.type === "instructions");
      if (found) {
        setInstructions(found.content || "");
        setExistingId(found.id);
      } else {
        setInstructions("");
        setExistingId(null);
      }
    } catch (err) {
      console.error("Failed to load eisenhower instructions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      if (!profile?.company_id) throw new Error("No company");

      if (existingId) {
        const { error } = await supabase
          .from("knowledge")
          .update({ content: instructions.trim() || null })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("knowledge").insert({
          company_id: profile.company_id,
          title: "Eisenhower Agent Instructions",
          content: instructions.trim() || null,
          category: "note",
          metadata: { agent: "eisenhower", type: "instructions" },
        });
        if (error) throw error;
      }
      toast({ title: "✅ Instructions saved" });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Agent Instructions</SheetTitle>
          <SheetDescription>
            Write custom instructions for the Eisenhower agent. It will always follow these.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 mt-4 flex flex-col gap-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Always prioritize sales-related tasks. Use Persian for responses..."
              className="flex-1 min-h-[200px] resize-none"
            />
          )}

          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Instructions
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
