import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyRulesDialog({ open, onOpenChange }: Props) {
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    setLoading(true);
    supabase
      .from("knowledge")
      .select("id, content")
      .eq("company_id", companyId)
      .eq("category", "company-rules")
      .maybeSingle()
      .then(({ data }) => {
        setContent(data?.content ?? "");
        setExistingId(data?.id ?? null);
        setLoading(false);
      });
  }, [open, companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from("knowledge")
          .update({ content: content.trim(), updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("knowledge").insert({
          company_id: companyId,
          category: "company-rules",
          title: "Company Rules & Policies",
          content: content.trim(),
        });
        if (error) throw error;
      }
      toast({ title: "✅ Company rules saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Company Rules & Policies</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Write your company's employee rules and policies here. Vizzy will learn and reference these when answering questions.
            </p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Working hours are 8 AM – 5 PM. Employees must notify their manager 24 hours before any absence..."
              className="min-h-[300px] resize-none flex-1"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Rules
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
