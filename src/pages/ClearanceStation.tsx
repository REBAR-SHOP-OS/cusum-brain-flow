import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClearanceData } from "@/hooks/useClearanceData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { ClearanceCard } from "@/components/clearance/ClearanceCard";

export default function ClearanceStation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { byProject, clearedCount, totalCount, isLoading, error } = useClearanceData();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-destructive">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60" />
        <p className="text-sm">Failed to load clearance data</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const projectEntries = [...byProject.entries()];
  const activeItems = selectedProject ? byProject.get(selectedProject) ?? [] : [];
  const activeClearedCount = activeItems.filter((i) => i.evidence_status === "cleared").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (selectedProject) {
                setSelectedProject(null);
              } else {
                navigate("/shop-floor");
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-wider uppercase text-foreground">
              Clearance Station
            </h1>
            <p className="text-[10px] text-primary tracking-wider uppercase">
              QC Audit & Evidence Collection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
            <ShieldCheck className="w-4 h-4" />
            {clearedCount} / {totalCount} Cleared
          </Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {totalCount === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No items awaiting clearance</p>
          </div>
        ) : !selectedProject ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              Select a project to view its clearance items.
            </p>
            {projectEntries.map(([projectName, items]) => {
              const cleared = items.filter((i) => i.evidence_status === "cleared").length;
              return (
                <button
                  key={projectName}
                  onClick={() => setSelectedProject(projectName)}
                  className="w-full rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <span className="font-bold text-sm tracking-wide uppercase text-foreground truncate">
                      {projectName}
                    </span>
                    <Badge
                      variant={cleared === items.length ? "default" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {cleared === items.length ? "complete" : `${cleared}/${items.length}`}
                    </Badge>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold tracking-wider uppercase text-foreground truncate">
                Manifest: {selectedProject}
              </h2>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {activeClearedCount} / {activeItems.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeItems.map((item) => (
                <ClearanceCard
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
                  userId={user?.id}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
