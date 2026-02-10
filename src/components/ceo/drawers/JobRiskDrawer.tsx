import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { mockAtRiskJobs } from "../mockData";
import { cn } from "@/lib/utils";

interface Props { open: boolean; onClose: () => void; }

export function JobRiskDrawer({ open, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border/50 overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
            Jobs at Risk
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {mockAtRiskJobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{job.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3" /> {job.customer}
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-xs", job.probability >= 60 ? "border-destructive/40 text-destructive" : "border-amber-500/40 text-amber-500")}>
                  {job.probability}% late risk
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Late probability</span>
                  <span>{job.probability}%</span>
                </div>
                <Progress value={job.probability} className="h-2" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {job.dueDate}</span>
                  <span>{job.daysLeft}d left</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7">Create Task</Button>
              </div>

              <p className="text-xs text-amber-500/80 bg-amber-500/5 rounded-md px-2 py-1 border border-amber-500/20">
                ⚠ {job.riskReason}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
