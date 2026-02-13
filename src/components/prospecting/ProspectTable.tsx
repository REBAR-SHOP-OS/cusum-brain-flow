import { ThumbsUp, ThumbsDown, Mail, Check, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Prospect {
  id: string;
  company_name: string;
  contact_name: string;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  industry: string | null;
  estimated_value: number | null;
  fit_reason: string | null;
  intro_angle: string | null;
  status: string;
}

interface Props {
  prospects: Prospect[];
  onApprove: (prospect: Prospect) => void;
  onReject: (id: string) => void;
  onSendIntro: (prospect: Prospect) => void;
  onSendFollowup: (prospect: Prospect) => void;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  emailed: { label: "Emailed", variant: "secondary" },
};

export function ProspectTable({ prospects, onApprove, onReject, onSendIntro, onSendFollowup }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">Company</TableHead>
          <TableHead className="w-[140px]">Contact</TableHead>
          <TableHead className="hidden lg:table-cell">Title</TableHead>
          <TableHead className="hidden md:table-cell">Email</TableHead>
          <TableHead className="hidden xl:table-cell">City</TableHead>
          <TableHead className="hidden xl:table-cell">Industry</TableHead>
          <TableHead className="hidden 2xl:table-cell">Fit Reason</TableHead>
          <TableHead className="w-[90px]">Status</TableHead>
          <TableHead className="w-[120px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prospects.map((p) => {
          const badge = STATUS_BADGE[p.status] || STATUS_BADGE.pending;
          const isActioned = p.status !== "pending";
          return (
            <TableRow
              key={p.id}
              className={cn(p.status === "rejected" && "opacity-40")}
            >
              <TableCell className="font-medium text-sm">{p.company_name}</TableCell>
              <TableCell className="text-sm">{p.contact_name}</TableCell>
              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{p.contact_title}</TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{p.email}</TableCell>
              <TableCell className="hidden xl:table-cell text-xs">{p.city}</TableCell>
              <TableCell className="hidden xl:table-cell text-xs">{p.industry}</TableCell>
              <TableCell className="hidden 2xl:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{p.fit_reason}</TableCell>
              <TableCell>
                <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {!isActioned && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10" onClick={() => onApprove(p)} title="Approve">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onReject(p.id)} title="Reject">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  {(p.status === "approved" || p.status === "pending") && p.email && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => onSendIntro(p)} title="Send intro email">
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {p.status === "emailed" && p.email && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => onSendFollowup(p)} title="Send follow-up">
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
