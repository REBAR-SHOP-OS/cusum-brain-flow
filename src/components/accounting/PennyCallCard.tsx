import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface PennyCallData {
  phone: string;
  contact_name: string;
  reason: string;
}

interface PennyCallCardProps {
  data: PennyCallData;
  callStatus: "idle" | "registering" | "ready" | "calling" | "in_call" | "error";
  onCall: (phone: string, contactName: string) => void;
  onHangup: () => void;
}

export function PennyCallCard({ data, callStatus, onCall, onHangup }: PennyCallCardProps) {
  const isActive = callStatus === "calling" || callStatus === "in_call";
  const isDialing = callStatus === "calling";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm">{data.contact_name}</p>
            <p className="text-xs text-muted-foreground">
              {data.phone.startsWith("ext:") ? `Ext. ${data.phone.slice(4)}` : data.phone}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{data.reason}</p>
          </div>
          {isActive ? (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 shrink-0"
              onClick={onHangup}
            >
              <PhoneOff className="w-3.5 h-3.5" />
              {isDialing ? "Cancel" : "Hang up"}
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => onCall(data.phone, data.contact_name)}
              disabled={callStatus === "registering"}
            >
              {callStatus === "registering" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Phone className="w-3.5 h-3.5" />
              )}
              Call Now
            </Button>
          )}
        </div>
        {isActive && (
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-muted-foreground">
              {isDialing ? "Dialing..." : "On call"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Parse [PENNY-CALL]{...}[/PENNY-CALL] tags from agent response text */
export function parsePennyCalls(text: string): { cleanText: string; calls: PennyCallData[] } {
  const calls: PennyCallData[] = [];
  const cleanText = text.replace(
    /\[PENNY-CALL\]([\s\S]*?)\[\/PENNY-CALL\]/g,
    (_, json) => {
      try {
        const data = JSON.parse(json.trim());
        if (data.phone && data.contact_name) {
          calls.push({
            phone: data.phone,
            contact_name: data.contact_name,
            reason: data.reason || "",
          });
        }
      } catch (e) {
        console.warn("Failed to parse PENNY-CALL:", e);
      }
      return "";
    }
  );
  return { cleanText: cleanText.trim(), calls };
}
