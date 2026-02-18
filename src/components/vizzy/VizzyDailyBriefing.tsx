import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import assistantHelper from "@/assets/helpers/assistant-helper.png";

const DISMISS_KEY = "vizzy-brief-dismissed";
const CACHE_KEY = "vizzy-brief-cache";

function getCachedBriefing(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { date, briefing } = JSON.parse(raw);
    if (date === new Date().toISOString().split("T")[0]) return briefing;
  } catch {}
  return null;
}

function cacheBriefing(briefing: string) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    date: new Date().toISOString().split("T")[0],
    briefing,
  }));
}

export function VizzyDailyBriefing() {
  const { user } = useAuth();
  const agent = getUserPrimaryAgent(user?.email);
  const avatarImg = agent?.image || assistantHelper;
  const navigate = useNavigate();

  const [briefing, setBriefing] = useState<string | null>(() => getCachedBriefing());
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const key = `${DISMISS_KEY}-${today}`;
    if (localStorage.getItem(key)) {
      setDismissed(true);
      return;
    }

    // Already have today's cached briefing — skip fetch
    if (getCachedBriefing()) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const res = await supabase.functions.invoke("vizzy-daily-brief", {});
        if (cancelled) return;
        if (res.error || !res.data?.briefing) {
          setError(true);
        } else {
          setBriefing(res.data.briefing);
          cacheBriefing(res.data.briefing);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(`${DISMISS_KEY}-${today}`, "1");
  };

  if (dismissed || error) return null;

  return (
    <AnimatePresence>
      {(loading || briefing) && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full mb-6"
        >
          <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg">
            {/* Gradient accent */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-primary to-emerald-400" />

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 z-10"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>

            <div className="p-4 pt-5">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-teal-400 shrink-0">
                  <img src={avatarImg} alt="Vizzy" className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Daily Briefing</span>
                  </div>

                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Preparing your briefing...
                    </div>
                  ) : briefing ? (
                    <div className="text-sm">
                      <RichMarkdown content={briefing} className="text-sm [&_p]:text-sm [&_li]:text-sm" />
                    </div>
                  ) : null}

                  {briefing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate("/chat")}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                      Ask Vizzy more
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
