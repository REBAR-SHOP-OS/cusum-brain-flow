import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  category: string;
  variables: string[];
}

interface SMSTemplateManagerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SMSTemplateManager({ open: controlledOpen, onOpenChange }: SMSTemplateManagerProps = {}) {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const { companyId } = useCompanyId();
  const { toast } = useToast();

  const loadTemplates = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("sms_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    setTemplates(
      (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        body: t.body,
        category: t.category || "general",
        variables: (t.variables as string[]) || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, [companyId]);

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{(\w+)\}/g) || [];
    return [...new Set(matches.map((m) => m.slice(1, -1)))];
  };

  const handleSave = async () => {
    if (!name.trim() || !body.trim() || !companyId) return;
    setSaving(true);
    try {
      const vars = extractVariables(body);
      if (editId) {
        const { error } = await supabase
          .from("sms_templates")
          .update({ name, body, category, variables: vars, updated_at: new Date().toISOString() })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sms_templates")
          .insert({ name, body, category, variables: vars, company_id: companyId });
        if (error) throw error;
      }
      toast({ title: editId ? "Template updated" : "Template created" });
      setOpen(false);
      resetForm();
      loadTemplates();
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sms_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", variant: "destructive" });
    } else {
      toast({ title: "Template deleted" });
      loadTemplates();
    }
  };

  const handleEdit = (t: SMSTemplate) => {
    setEditId(t.id);
    setName(t.name);
    setBody(t.body);
    setCategory(t.category);
    setOpen(true);
  };

  const resetForm = () => {
    setEditId(null);
    setName("");
    setBody("");
    setCategory("general");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SMS Templates</h3>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Template" : "New SMS Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Follow-up reminder" />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="general" />
              </div>
              <div>
                <Label>Message Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi {name}, this is a reminder about your order with {company}..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{name}"}, {"{company}"}, {"{phone}"} as placeholders
                </p>
              </div>
              {body && extractVariables(body).length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {extractVariables(body).map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs">{`{${v}}`}</Badge>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center p-4">No templates yet</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="p-3 rounded-lg border border-border flex items-start gap-3">
              <MessageSquare className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{t.body}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                  <Save className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
