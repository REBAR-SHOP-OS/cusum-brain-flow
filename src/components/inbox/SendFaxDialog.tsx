import { useState } from "react";
import { FileText, Send, Loader2, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function SendFaxDialog() {
  const [open, setOpen] = useState(false);
  const [faxNumber, setFaxNumber] = useState("");
  const [coverText, setCoverText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!faxNumber.trim()) {
      toast({ title: "Fax number required", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("fax_number", faxNumber);
      if (coverText) formData.append("cover_page_text", coverText);
      if (file) formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("ringcentral-fax-send", {
        body: formData,
      });

      if (error) throw error;
      toast({ title: "Fax sent", description: `Fax ID: ${data?.fax_id}` });
      setOpen(false);
      setFaxNumber("");
      setCoverText("");
      setFile(null);
    } catch (err) {
      toast({
        title: "Failed to send fax",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Send Fax
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Fax via RingCentral</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="fax-number">Fax Number</Label>
            <Input
              id="fax-number"
              placeholder="+14155551234"
              value={faxNumber}
              onChange={(e) => setFaxNumber(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cover-text">Cover Page Text (optional)</Label>
            <Textarea
              id="cover-text"
              placeholder="Enter cover page message..."
              value={coverText}
              onChange={(e) => setCoverText(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="fax-file">PDF Attachment</Label>
            <div className="mt-1">
              <label
                htmlFor="fax-file"
                className="flex items-center gap-2 p-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "Choose PDF file..."}
                </span>
              </label>
              <input
                id="fax-file"
                type="file"
                accept=".pdf,.tif,.tiff"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending..." : "Send Fax"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
