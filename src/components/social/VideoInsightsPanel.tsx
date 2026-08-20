import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Copy, Shield, ShieldAlert, Tag, MessageSquare, Scissors, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Label {
  name: string;
  confidence: number;
  category: string | null;
}

interface ModerationFrame {
  timeOffset: number;
  pornographyLikelihood: string;
}

interface TranscriptSegment {
  transcript: string;
  confidence: number;
  words: { word: string; startTime: number; endTime: number }[];
}

interface Shot {
  startTime: number;
  endTime: number;
}

interface TextAnnotation {
  text: string;
  segments: { startTime: number; endTime: number; confidence: number }[];
}

export interface VideoAnalysisResults {
  labels: Label[];
  moderation: ModerationFrame[];
  transcript: TranscriptSegment[];
  shots: Shot[];
  textAnnotations: TextAnnotation[];
}

interface VideoInsightsPanelProps {
  results: VideoAnalysisResults;
  moderationStatus: "safe" | "flagged";
  suggestedHashtags: string[];
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const likelihoodColor: Record<string, string> = {
  VERY_UNLIKELY: "text-[hsl(var(--success))]",
  UNLIKELY: "text-[hsl(var(--success))]",
  POSSIBLE: "text-[hsl(var(--warning,45_93%_47%))]",
  LIKELY: "text-destructive",
  VERY_LIKELY: "text-destructive",
  UNKNOWN: "text-muted-foreground",
};

export function VideoInsightsPanel({ results, moderationStatus, suggestedHashtags, onClose }: VideoInsightsPanelProps) {
  const { toast } = useToast();

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Text copied to clipboard." });
  };

  return (
    <div className="border rounded-lg bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Video Insights</span>
          {moderationStatus === "safe" ? (
            <Badge variant="outline" className="gap-1 text-[hsl(var(--success))] border-[hsl(var(--success))]/30">
              <Shield className="w-3 h-3" /> Safe
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="w-3 h-3" /> Flagged
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-7">
          Close
        </Button>
      </div>

      {suggestedHashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Tag className="w-3 h-3 text-muted-foreground" />
          {suggestedHashtags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-primary/20" onClick={() => copyText(tag)}>
              {tag}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyText(suggestedHashtags.join(" "))}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      )}

      <Tabs defaultValue="labels" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-8">
          <TabsTrigger value="labels" className="text-xs gap-1"><Tag className="w-3 h-3" /> Labels</TabsTrigger>
          <TabsTrigger value="moderation" className="text-xs gap-1"><Shield className="w-3 h-3" /> Safety</TabsTrigger>
          <TabsTrigger value="captions" className="text-xs gap-1"><MessageSquare className="w-3 h-3" /> Captions</TabsTrigger>
          <TabsTrigger value="shots" className="text-xs gap-1"><Scissors className="w-3 h-3" /> Shots</TabsTrigger>
          <TabsTrigger value="ocr" className="text-xs gap-1"><Type className="w-3 h-3" /> OCR</TabsTrigger>
        </TabsList>

        {/* Labels */}
        <TabsContent value="labels" className="max-h-48 overflow-y-auto space-y-1.5 mt-2">
          {results.labels.length === 0 && <p className="text-xs text-muted-foreground">No labels detected.</p>}
          {results.labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-32 truncate" title={label.name}>{label.name}</span>
              <Progress value={label.confidence * 100} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(label.confidence * 100)}%</span>
            </div>
          ))}
        </TabsContent>

        {/* Moderation */}
        <TabsContent value="moderation" className="max-h-48 overflow-y-auto space-y-1.5 mt-2">
          {results.moderation.length === 0 && <p className="text-xs text-muted-foreground">No moderation data.</p>}
          {results.moderation.slice(0, 20).map((frame, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-12">{formatTime(frame.timeOffset)}</span>
              <span className={likelihoodColor[frame.pornographyLikelihood] || "text-muted-foreground"}>
                {frame.pornographyLikelihood.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </TabsContent>

        {/* Captions */}
        <TabsContent value="captions" className="max-h-48 overflow-y-auto space-y-2 mt-2">
          {results.transcript.length === 0 && <p className="text-xs text-muted-foreground">No speech detected.</p>}
          {results.transcript.map((seg, i) => (
            <div key={i} className="group flex gap-2 items-start text-xs">
              <span className="text-muted-foreground w-10 shrink-0">
                {seg.words[0] ? formatTime(seg.words[0].startTime) : "0:00"}
              </span>
              <p className="flex-1">{seg.transcript}</p>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100" onClick={() => copyText(seg.transcript)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {results.transcript.length > 0 && (
            <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-1"
              onClick={() => copyText(results.transcript.map((s) => s.transcript).join(" "))}>
              <Copy className="w-3 h-3 mr-1" /> Copy Full Transcript
            </Button>
          )}
        </TabsContent>

        {/* Shots */}
        <TabsContent value="shots" className="max-h-48 overflow-y-auto space-y-1 mt-2">
          {results.shots.length === 0 && <p className="text-xs text-muted-foreground">No shot changes detected.</p>}
          {results.shots.map((shot, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-xs">Shot {i + 1}</Badge>
              <span className="text-muted-foreground">{formatTime(shot.startTime)} → {formatTime(shot.endTime)}</span>
            </div>
          ))}
        </TabsContent>

        {/* OCR */}
        <TabsContent value="ocr" className="max-h-48 overflow-y-auto space-y-1.5 mt-2">
          {results.textAnnotations.length === 0 && <p className="text-xs text-muted-foreground">No text detected in video.</p>}
          {results.textAnnotations.map((text, i) => (
            <div key={i} className="group flex items-center gap-2 text-xs p-1.5 rounded border bg-background">
              <Type className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{text.text}</span>
              {text.segments[0] && (
                <span className="text-muted-foreground shrink-0">{formatTime(text.segments[0].startTime)}</span>
              )}
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100" onClick={() => copyText(text.text)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
