import { useState, useEffect } from "react";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  body: string;
}

const STORAGE_KEY = "inbox-email-templates";

function loadTemplates(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: EmailTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface EmailTemplatesDrawerProps {
  onInsert: (text: string) => void;
  currentDraft?: string;
}

export function EmailTemplatesDrawer({ onInsert, currentDraft }: EmailTemplatesDrawerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(loadTemplates);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  const handleSave = () => {
    if (!newName.trim() || !newBody.trim()) return;
    const template: EmailTemplate = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      body: newBody.trim(),
    };
    setTemplates((prev) => [...prev, template]);
    setNewName("");
    setNewBody("");
    setAdding(false);
    toast({ title: "Template saved" });
  };

  const handleSaveCurrent = () => {
    if (!currentDraft?.trim()) {
      toast({ title: "No draft to save", variant: "destructive" });
      return;
    }
    setAdding(true);
    setNewBody(currentDraft);
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast({ title: "Template deleted" });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Email templates">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] sm:w-[380px]">
        <SheetHeader>
          <SheetTitle className="text-sm">Email Templates</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => setAdding(true)}>
              <Plus className="w-3 h-3" /> New Template
            </Button>
            {currentDraft && (
              <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={handleSaveCurrent}>
                Save Current Draft
              </Button>
            )}
          </div>

          {adding && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name..."
                className="h-8 text-xs"
              />
              <SmartTextarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Template body..."
                className="min-h-[80px] text-xs"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setAdding(false); setNewName(""); setNewBody(""); }}>
                  Cancel
                </Button>
                <Button size="sm" className="text-xs h-7" onClick={handleSave} disabled={!newName.trim() || !newBody.trim()}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {templates.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground text-center py-6">No templates yet. Create one to get started.</p>
          )}

          {templates.map((t) => (
            <div key={t.id} className="group border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{t.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{t.body}</p>
              <Button
                size="sm"
                variant="secondary"
                className="text-[11px] h-6 px-2"
                onClick={() => onInsert(t.body)}
              >
                Insert
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
