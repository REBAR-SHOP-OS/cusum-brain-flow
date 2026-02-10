import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, User, Clock, FileText } from "lucide-react";

interface MeetingTranscriptViewProps {
  meetingId: string;
}

export function MeetingTranscriptView({ meetingId }: MeetingTranscriptViewProps) {
  const [search, setSearch] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["meeting-transcript", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meeting_transcript_entries")
        .select("*")
        .eq("meeting_id", meetingId)
        .eq("is_final", true)
        .order("timestamp_ms", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const speakers = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map((e: any) => e.speaker_name))];
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => {
      if (speakerFilter && e.speaker_name !== speakerFilter) return false;
      if (search && !e.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, speakerFilter, search]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading transcript...</div>;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No transcript available for this meeting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcript..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={speakerFilter === null ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setSpeakerFilter(null)}
          >
            All
          </Button>
          {speakers.map((s: string) => (
            <Button
              key={s}
              variant={speakerFilter === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setSpeakerFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filtered.map((entry: any) => (
            <div key={entry.id} className="flex gap-3 py-1.5 group hover:bg-muted/20 rounded-lg px-2 -mx-2 transition-colors">
              <div className="flex flex-col items-center shrink-0 w-10">
                <span className="text-[9px] font-mono text-muted-foreground">
                  {formatTime(entry.timestamp_ms)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-primary">{entry.speaker_name}</span>
                <p className="text-sm text-foreground/90 leading-relaxed">{entry.text}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        <span>{filtered.length} of {entries.length} entries</span>
        <span>{speakers.length} speakers</span>
      </div>
    </div>
  );
}
