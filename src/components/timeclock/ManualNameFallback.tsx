import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, UserCheck } from "lucide-react";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface EnrolledProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ManualNameFallbackProps {
  onSelect: (profileId: string, name: string) => void;
  onBack: () => void;
}

export function ManualNameFallback({ onSelect, onBack }: ManualNameFallbackProps) {
  const [query, setQuery] = useState("");
  const [enrolled, setEnrolled] = useState<EnrolledProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Get distinct profile_ids from face_enrollments
      const { data: enrollments, error: eErr } = await supabase
        .from("face_enrollments" as any)
        .select("profile_id");
      if (eErr || !enrollments || cancelled) {
        setEnrolled([]);
        setLoading(false);
        return;
      }
      const profileIds = Array.from(
        new Set((enrollments as any[]).map((e) => e.profile_id).filter(Boolean))
      );
      if (profileIds.length === 0) {
        setEnrolled([]);
        setLoading(false);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles_safe" as any)
        .select("id, full_name, avatar_url")
        .in("id", profileIds)
        .order("full_name");
      if (cancelled) return;
      setEnrolled(((profiles as any) || []) as EnrolledProfile[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return enrolled.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [query, enrolled]);

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="font-bold text-lg">Type Your Name</h3>
            <p className="text-xs text-muted-foreground">
              Enter at least 2 letters of your name
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Kourosh"
            className="pl-9 h-12 text-base"
          />
        </div>

        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
          )}
          {!loading && query.trim().length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Start typing to search enrolled employees
            </p>
          )}
          {!loading && query.trim().length >= 2 && matches.length === 0 && (
            <p className="text-sm text-destructive text-center py-6">
              No enrolled employee found
            </p>
          )}
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id, p.full_name)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={p.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  {getInitials(p.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">Tap to select</p>
              </div>
              <UserCheck className="w-4 h-4 text-primary" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
