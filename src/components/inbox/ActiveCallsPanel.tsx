import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw, Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ActiveCall {
  id: string;
  sessionId: string;
  direction: string;
  from: string;
  to: string;
  status: string;
  startTime: string;
  duration: number;
}

export function ActiveCallsPanel() {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ringcentral-active-calls", { body: {} });
      if (!error && data?.activeCalls) {
        setCalls(data.activeCalls);
      }
    } catch (err) {
      console.error("Active calls fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchCalls]);

  const formatDuration = (startTime: string) => {
    const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-500" />
            Live Calls
            {calls.length > 0 && (
              <Badge variant="secondary" className="text-xs">{calls.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchCalls} disabled={loading}>
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && calls.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : calls.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active calls</p>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div key={call.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                {call.direction?.toLowerCase() === "inbound" ? (
                  <PhoneIncoming className="w-4 h-4 text-blue-500 shrink-0" />
                ) : (
                  <PhoneOutgoing className="w-4 h-4 text-green-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{call.from}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm truncate">{call.to}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] h-4">
                      {call.status}
                    </Badge>
                    {call.startTime && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDuration(call.startTime)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
