import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const campaignTypes = [
  { value: "nurture", label: "Nurture (RFQ follow-up)" },
  { value: "follow_up", label: "Follow-up (quote conversion)" },
  { value: "newsletter", label: "Newsletter" },
  { value: "winback", label: "Win-back (reactivation)" },
  { value: "announcement", label: "Announcement" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CreateCampaignDialog({ open, onOpenChange }: Props) {
  const { createCampaign } = useEmailCampaigns();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("newsletter");
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!brief.trim()) {
      toast.error("Enter a brief for AI generation");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-campaign-generate", {
        body: {
          action: "plan-campaign",
          campaign_type: type,
          brief: brief.trim(),
          title: title.trim() || undefined,
        },
      });
      if (error) throw error;
      toast.success("AI campaign generated! Review it below.");
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleManualCreate = async () => {
    if (!title.trim()) {
      toast.error("Enter a campaign title");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user!.id)
      .single();
    if (!profile) return;

    createCampaign.mutate({
      title: title.trim(),
      campaign_type: type,
      status: "draft",
      created_by: profile.id,
      company_id: profile.company_id,
    } as any);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setType("newsletter");
    setBrief("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Email Campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Campaign Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. March Newsletter"
            />
          </div>

          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {campaignTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>AI Brief (optional)</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what this campaign should achieve, who it targets, and any key messages..."
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for manual creation, or describe your goals and let AI draft everything.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleManualCreate} disabled={generating}>
            Create manually
          </Button>
          <Button onClick={handleGenerate} disabled={generating || !brief.trim()} className="gap-1.5">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Generating..." : "AI Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
