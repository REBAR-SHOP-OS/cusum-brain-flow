import { Download, Mic, FileText } from "lucide-react";
import { downloadFile } from "@/lib/downloadUtils";
import { useResolvedChatUrl } from "@/hooks/useResolvedChatUrl";

interface Att { name: string; url: string }

export function ChatAttachmentImage({ att }: { att: Att }) {
  const url = useResolvedChatUrl(att.url);
  return (
    <div className="mt-1">
      <img
        src={url}
        alt={att.name}
        className="rounded-lg border border-border max-w-[260px] max-h-[220px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(url, "_blank")}
      />
      <button
        onClick={() => downloadFile(url, att.name)}
        className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        title="Download"
      >
        <Download className="w-3 h-3" />
      </button>
    </div>
  );
}

export function ChatAttachmentAudio({ att }: { att: Att }) {
  const url = useResolvedChatUrl(att.url);
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl border border-border bg-gradient-to-r from-muted/30 to-muted/10 mt-1 max-w-full backdrop-blur-sm">
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Mic className="w-3 h-3 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-muted-foreground mb-0.5 truncate">{att.name || "Voice message"}</p>
        <audio controls preload="metadata" className="h-6 w-full min-w-0" src={url} />
      </div>
      <button
        onClick={() => downloadFile(url, att.name || "voice-message.webm")}
        className="shrink-0 p-1 rounded-lg hover:bg-muted/60 transition-colors"
        title="Download"
      >
        <Download className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

export function ChatAttachmentFile({ att }: { att: Att }) {
  const url = useResolvedChatUrl(att.url);
  const ext = att.name?.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <div
      onClick={() => downloadFile(url, att.name)}
      className="flex items-center gap-2 p-2 rounded-xl border border-border bg-gradient-to-r from-muted/30 to-muted/10 mt-1 max-w-full cursor-pointer hover:bg-muted/40 transition-colors"
    >
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate">{att.name}</p>
        <p className="text-[9px] text-muted-foreground">{ext} file</p>
      </div>
      <Download className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}
