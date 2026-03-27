import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, ImageOff, Brain } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Enrollment {
  id: string;
  profile_id: string;
  photo_url: string;
  is_active: boolean;
  created_at: string;
}

interface ProfileGroup {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  enrollments: Enrollment[];
  signedUrls: Map<string, string>;
}

interface FaceMemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaceMemoryPanel({ open, onOpenChange }: FaceMemoryPanelProps) {
  const [groups, setGroups] = useState<ProfileGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      // Fetch active enrollments
      const { data: enrollments, error: eErr } = await supabase
        .from("face_enrollments")
        .select("id, profile_id, photo_url, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (eErr) {
        console.error("Failed to fetch enrollments:", eErr);
        setLoading(false);
        return;
      }

      // Get unique profile IDs
      const profileIds = [...new Set((enrollments || []).map((e: any) => e.profile_id))];
      if (profileIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", profileIds);

      const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
      (profilesData || []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url }));

      // Group enrollments by profile
      const groupMap = new Map<string, Enrollment[]>();
      (enrollments || []).forEach((e: any) => {
        const list = groupMap.get(e.profile_id) || [];
        list.push(e);
        groupMap.set(e.profile_id, list);
      });

      // Generate signed URLs for thumbnails (max 3 per person)
      const result: ProfileGroup[] = [];
      for (const [profileId, items] of groupMap.entries()) {
        const profile = profileMap.get(profileId);
        const limited = items.slice(0, 3);
        const signedUrls = new Map<string, string>();

        // Batch sign URLs
        for (const item of limited) {
          const { data } = await supabase.storage
            .from("face-enrollments")
            .createSignedUrl(item.storage_path, 600);
          if (data?.signedUrl) {
            signedUrls.set(item.id, data.signedUrl);
          }
        }

        result.push({
          profile_id: profileId,
          full_name: profile?.full_name || "Unknown",
          avatar_url: profile?.avatar_url || null,
          enrollments: items,
          signedUrls,
        });
      }

      // Sort by name
      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setGroups(result);
    } catch (err) {
      console.error("FaceMemoryPanel fetch error:", err);
    }
    setLoading(false);
  }, [open]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteAll = async (profileId: string, name: string) => {
    const { error } = await supabase
      .from("face_enrollments")
      .update({ is_active: false } as any)
      .eq("profile_id", profileId)
      .eq("is_active", true);

    if (error) {
      toast.error(`Failed to clear enrollments for ${name}`);
    } else {
      toast.success(`Cleared all face data for ${name}`);
      fetchData();
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg font-black italic tracking-tight">
            <Brain className="w-5 h-5 text-primary" />
            FACE MEMORY
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {groups.length} people enrolled · {groups.reduce((s, g) => s + g.enrollments.length, 0)} photos total
          </p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Brain className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No faces enrolled yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {groups.map((group) => (
                <div
                  key={group.profile_id}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  {/* Person header */}
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={group.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {getInitials(group.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{group.full_name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {group.enrollments.length} photo{group.enrollments.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteAll(group.profile_id, group.full_name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Enrollment thumbnails */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group.enrollments.slice(0, 5).map((enrollment) => {
                      const url = group.signedUrls.get(enrollment.id);
                      return (
                        <div
                          key={enrollment.id}
                          className={cn(
                            "w-16 h-16 rounded-lg border border-border overflow-hidden flex-shrink-0 bg-muted/30",
                            "flex items-center justify-center"
                          )}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={group.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
