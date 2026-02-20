import { useState, useEffect } from "react";
import { Send, Loader2, Users, MessageSquare } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
}

interface Template {
  id: string;
  name: string;
  body: string;
}

export function BulkSMSDialog() {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const { companyId } = useCompanyId();
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !companyId) return;
    const load = async () => {
      const [contactsRes, templatesRes] = await Promise.all([
        supabase.from("contacts").select("id, first_name, last_name, phone").not("phone", "is", null).limit(200),
        supabase.from("sms_templates").select("id, name, body").eq("company_id", companyId),
      ]);
      setContacts(contactsRes.data || []);
      setTemplates(templatesRes.data || []);
    };
    load();
  }, [open, companyId]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const phoneable = contacts.filter((c) => c.phone);
    if (selectedIds.size === phoneable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(phoneable.map((c) => c.id)));
    }
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find((t) => t.id === templateId);
    if (t) setMessage(t.body);
  };

  const handleSend = async () => {
    const recipients = contacts.filter((c) => selectedIds.has(c.id) && c.phone);
    if (recipients.length === 0 || !message.trim()) {
      toast({ title: "Select recipients and enter a message", variant: "destructive" });
      return;
    }

    setSending(true);
    setProgress(0);
    let sent = 0;
    let failed = 0;

    for (const contact of recipients) {
      const personalizedMsg = message
        .replace(/\{name\}/gi, `${contact.first_name} ${contact.last_name || ""}`.trim())
        .replace(/\{first_name\}/gi, contact.first_name)
        .replace(/\{phone\}/gi, contact.phone || "");

      try {
        const { error } = await supabase.functions.invoke("ringcentral-action", {
          body: {
            type: "ringcentral_sms",
            phone: contact.phone,
            message: personalizedMsg,
            contact_name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
          },
        });
        if (error) throw error;
        sent++;
      } catch {
        failed++;
      }

      setProgress(Math.round(((sent + failed) / recipients.length) * 100));

      // Rate limit: 1 SMS per second
      if (sent + failed < recipients.length) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    setSending(false);
    toast({
      title: "Bulk SMS Complete",
      description: `${sent} sent, ${failed} failed out of ${recipients.length}`,
    });
    if (failed === 0) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="w-4 h-4" />
          Bulk SMS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Bulk SMS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <Label>Use Template</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Message */}
          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi {name}, ..."
              rows={3}
            />
          </div>

          {/* Contact list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Recipients ({selectedIds.size} selected)</Label>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedIds.size === contacts.filter((c) => c.phone).length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <ScrollArea className="h-48 border rounded-lg p-2">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-secondary/50 rounded cursor-pointer">
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleContact(c.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{c.first_name} {c.last_name || ""}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>
                  </div>
                </label>
              ))}
            </ScrollArea>
          </div>

          {/* Progress */}
          {sending && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">{progress}% complete</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || selectedIds.size === 0} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending..." : `Send to ${selectedIds.size} contacts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
