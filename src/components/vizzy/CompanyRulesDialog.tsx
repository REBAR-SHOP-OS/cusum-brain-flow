import { useState, useEffect } from "react";
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";
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
      <DialogPortal>
        <DialogOverlay className="z-[100001]" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-[100002] grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg max-h-[80vh] flex flex-col"
        >
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
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
