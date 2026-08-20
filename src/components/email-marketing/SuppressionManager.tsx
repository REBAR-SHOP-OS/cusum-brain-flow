import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, ShieldOff } from "lucide-react";
import { useSuppressions } from "@/hooks/useEmailCampaigns";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SuppressionManager({ open, onOpenChange }: Props) {
  const { suppressions, isLoading, addSuppression } = useSuppressions();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const filtered = suppressions.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user!.id)
      .single();
    if (!profile) return;

    addSuppression.mutate({
      email: newEmail.trim().toLowerCase(),
      reason: "manual",
      source: "manual",
      company_id: profile.company_id,
    });
    setNewEmail("");
  };

  const reasonColors: Record<string, string> = {
    unsubscribe: "bg-amber-500/20 text-amber-400",
    bounce: "bg-red-500/20 text-red-400",
    complaint: "bg-destructive/20 text-destructive",
    manual: "bg-muted text-muted-foreground",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5" /> Suppression List
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mt-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Add email to suppress..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} className="gap-1 shrink-0">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppressions..."
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] mt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No suppressions found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium">{s.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.suppressed_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge className={reasonColors[s.reason] || "bg-muted"}>
                    {s.reason}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          {suppressions.length} total suppressed emails
        </p>
      </DialogContent>
    </Dialog>
  );
}
