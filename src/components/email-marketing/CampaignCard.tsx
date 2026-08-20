import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Mail, Users, Clock } from "lucide-react";
import type { EmailCampaign } from "@/hooks/useEmailCampaigns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-500/20 text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  sending: "bg-blue-500/20 text-blue-400",
  sent: "bg-primary/20 text-primary",
  paused: "bg-orange-500/20 text-orange-400",
  canceled: "bg-destructive/20 text-destructive",
};

const typeLabels: Record<string, string> = {
  nurture: "Nurture",
  follow_up: "Follow-up",
  newsletter: "Newsletter",
  winback: "Win-back",
  announcement: "Announcement",
};

interface Props {
  campaign: EmailCampaign;
  onClick: () => void;
}

export function CampaignCard({ campaign, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium truncate">{campaign.title}</h3>
          {campaign.subject_line && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {campaign.subject_line}
            </p>
          )}
        </div>
        <Badge className={statusColors[campaign.status] || "bg-muted text-muted-foreground"}>
          {campaign.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Mail className="w-3 h-3" />
          {typeLabels[campaign.campaign_type] || campaign.campaign_type}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {campaign.estimated_recipients} recipients
        </span>
        {campaign.scheduled_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(campaign.scheduled_at), "MMM d, h:mm a")}
          </span>
        )}
      </div>
    </button>
  );
}
