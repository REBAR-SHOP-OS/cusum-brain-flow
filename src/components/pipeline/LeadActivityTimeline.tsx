import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Users, FileText, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const COMM_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Users,
  note: FileText,
  sms: MessageSquare,
};

const COMM_COLORS: Record<string, string> = {
  email: "bg-blue-500",
  call: "bg-green-500",
  meeting: "bg-purple-500",
  note: "bg-amber-500",
  sms: "bg-cyan-500",
};

interface Props {
  leadId: string;
}

export function LeadActivityTimeline({ leadId }: Props) {
  const { data: comms, isLoading } = useQuery({
    queryKey: ["lead_communications", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!comms || comms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No activity yet</p>
        <p className="text-[11px] text-muted-foreground">Log calls, emails, or notes to track interactions</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {comms.map((comm) => {
        const Icon = COMM_ICONS[comm.comm_type] ?? MessageSquare;
        const color = COMM_COLORS[comm.comm_type] ?? "bg-muted";

        return (
          <div key={comm.id} className="relative pl-10 pb-4">
            {/* Dot */}
            <div className={cn(
              "absolute left-[10px] top-1 w-3 h-3 rounded-full flex items-center justify-center z-10",
              color
            )}>
              <Icon className="w-2 h-2 text-white" />
            </div>

            <div className="bg-muted/30 rounded-sm px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold capitalize text-foreground">{comm.comm_type}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0 rounded",
                  comm.direction === "inbound" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"
                )}>
                  {comm.direction}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                </span>
              </div>
              {comm.subject && <p className="text-xs font-medium mt-0.5">{comm.subject}</p>}
              {comm.body_preview && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{comm.body_preview}</p>}
              {comm.contact_name && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {comm.contact_name}{comm.contact_email ? ` · ${comm.contact_email}` : ""}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
