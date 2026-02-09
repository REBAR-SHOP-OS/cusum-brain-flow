import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, ChevronRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { RichMarkdown } from "@/components/chat/RichMarkdown";

interface EmployeeSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_report: string | null;
}

interface Employee {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  sessions: EmployeeSession[];
}

interface EisenhowerTeamReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EisenhowerTeamReportDialog({ open, onOpenChange }: EisenhowerTeamReportDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedSession, setSelectedSession] = useState<EmployeeSession | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedEmployee(null);
      setSelectedSession(null);
      return;
    }
    fetchReport();
  }, [open]);

  async function fetchReport() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("eisenhower-team-report", {
        body: {},
      });
      if (error) throw error;
      setEmployees(data.employees || []);
    } catch (err) {
      console.error("Failed to fetch team report:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleBack = () => {
    if (selectedSession) {
      setSelectedSession(null);
    } else if (selectedEmployee) {
      setSelectedEmployee(null);
    }
  };

  const title = selectedSession
    ? selectedSession.title
    : selectedEmployee
      ? `${selectedEmployee.full_name}'s Reports`
      : "Team Eisenhower Reports";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(selectedEmployee || selectedSession) && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-lg truncate">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="space-y-3 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : selectedSession ? (
            // Session detail: show the report
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(selectedSession.created_at), "MMM d, yyyy – h:mm a")}
              </div>
              {selectedSession.last_report ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <RichMarkdown content={selectedSession.last_report} />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No report available for this session.</p>
              )}
            </div>
          ) : selectedEmployee ? (
            // Employee sessions list
            <div className="space-y-1 p-2">
              {selectedEmployee.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sessions found</p>
              ) : (
                selectedEmployee.sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(session.created_at), "MMM d, yyyy – h:mm a")}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>
          ) : (
            // Employees list
            <div className="space-y-1 p-2">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No employee reports found
                </p>
              ) : (
                employees.map((emp) => (
                  <button
                    key={emp.user_id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={emp.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {emp.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.sessions.length} report{emp.sessions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
