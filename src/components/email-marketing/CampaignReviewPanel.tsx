import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, X, Edit3, Users, Calendar, Send } from "lucide-react";
import { format } from "date-fns";
import type { EmailCampaign } from "@/hooks/useEmailCampaigns";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  campaign: EmailCampaign | null;
  onClose: () => void;
}

export function CampaignReviewPanel({ campaign, onClose }: Props) {
  const { updateCampaign } = useEmailCampaigns();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);

  const open = !!campaign;

  const handleOpen = () => {
    if (campaign) {
      setSubject(campaign.subject_line || "");
      setBodyHtml(campaign.body_html || "");
      setEditing(false);
    }
  };

  const handleApprove = async () => {
    if (!campaign || !user) return;
    // Get the user's profile ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      toast.error("Profile not found");
      return;
    }

    updateCampaign.mutate({
      id: campaign.id,
      status: "approved",
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
      subject_line: subject || campaign.subject_line,
      body_html: bodyHtml || campaign.body_html,
    } as any);
    toast.success("Campaign approved!");
    onClose();
  };

  const handleDecline = () => {
    if (!campaign) return;
    updateCampaign.mutate({ id: campaign.id, status: "canceled" } as any);
    toast.info("Campaign declined");
    onClose();
  };

  const handleSave = () => {
    if (!campaign) return;
    updateCampaign.mutate({
      id: campaign.id,
      subject_line: subject,
      body_html: bodyHtml,
    } as any);
    setEditing(false);
    toast.success("Changes saved");
  };

  const handleSend = async () => {
    if (!campaign) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-campaign-send", {
        body: { campaign_id: campaign.id },
      });
      if (error) throw error;
      toast.success(data?.message || "Campaign sending started!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const segmentRules = campaign?.segment_rules as Record<string, unknown> | undefined;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {campaign && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {campaign.title}
                <Badge variant="outline" className="text-xs">
                  {campaign.status.replace("_", " ")}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Subject Line */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Subject Line</label>
                {editing ? (
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                ) : (
                  <p className="text-sm">{campaign.subject_line || "No subject"}</p>
                )}
              </div>

              {/* Preview Text */}
              {campaign.preview_text && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Preview Text</label>
                  <p className="text-sm text-muted-foreground">{campaign.preview_text}</p>
                </div>
              )}

              <Separator />

              {/* Body Preview */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Email Body</label>
                {editing ? (
                  <Textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    className="min-h-[200px] font-mono text-xs"
                  />
                ) : (
                  <div
                    className="border border-border rounded-lg p-4 bg-background text-sm max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: campaign.body_html || "<p>No content yet</p>" }}
                  />
                )}
              </div>

              <Separator />

              {/* Audience */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Audience
                </label>
                <p className="text-sm">{campaign.estimated_recipients} estimated recipients</p>
                {segmentRules && Object.keys(segmentRules).length > 0 && (
                  <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-x-auto">
                    {JSON.stringify(segmentRules, null, 2)}
                  </pre>
                )}
              </div>

              {/* Schedule */}
              {campaign.scheduled_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Scheduled
                  </label>
                  <p className="text-sm">{format(new Date(campaign.scheduled_at), "PPpp")}</p>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {campaign.status === "pending_approval" && (
                  <>
                    <Button onClick={handleApprove} className="gap-1.5 flex-1">
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={handleDecline} className="gap-1.5">
                      <X className="w-4 h-4" /> Decline
                    </Button>
                  </>
                )}

                {campaign.status === "approved" && (
                  <Button onClick={handleSend} disabled={sending} className="gap-1.5 flex-1">
                    <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send Now"}
                  </Button>
                )}

                {editing ? (
                  <Button variant="outline" onClick={handleSave} className="gap-1.5">
                    <Check className="w-4 h-4" /> Save
                  </Button>
                ) : (
                  ["draft", "pending_approval"].includes(campaign.status) && (
                    <Button variant="outline" onClick={() => { setSubject(campaign.subject_line || ""); setBodyHtml(campaign.body_html || ""); setEditing(true); }} className="gap-1.5">
                      <Edit3 className="w-4 h-4" /> Edit
                    </Button>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
