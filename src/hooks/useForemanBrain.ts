import { useMemo, useEffect, useRef } from "react";
import { computeForemanDecision, type ForemanContext, type ForemanDecision } from "@/lib/foremanBrain";
import { getPlaybookEntry, type PlaybookEntry } from "@/lib/foremanPlaybook";
import { recordBlocker, recordSuggestionInteraction } from "@/lib/foremanLearningService";
import { useSuggestions } from "@/hooks/useSuggestions";

interface UseForemanBrainOpts {
  context: ForemanContext | null;
}

export interface ForemanResult {
  decision: ForemanDecision | null;
  playbook: PlaybookEntry | null;
  suggestions: ReturnType<typeof useSuggestions>;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;
}

export function useForemanBrain({ context }: UseForemanBrainOpts): ForemanResult {
  const suggestions = useSuggestions(context?.module);
  const prevBlockerRef = useRef<string | null>(null);

  const decision = useMemo<ForemanDecision | null>(() => {
    if (!context) return null;
    return computeForemanDecision(context);
  }, [context]);

  const playbook = useMemo<PlaybookEntry | null>(() => {
    if (!decision?.edgeCaseId) return null;
    return getPlaybookEntry(decision.edgeCaseId) || null;
  }, [decision?.edgeCaseId]);

  // Auto-record blockers when they first appear
  useEffect(() => {
    if (!decision || !context) return;
    const topBlocker = decision.blockers[0];
    if (topBlocker && topBlocker.code !== prevBlockerRef.current) {
      prevBlockerRef.current = topBlocker.code;
      recordBlocker(context.module, topBlocker.code, context.machineId, {
        item_id: context.currentItem?.id,
        bar_code: context.currentItem?.bar_code,
        machine_status: context.machineStatus,
      });
    } else if (!topBlocker) {
      prevBlockerRef.current = null;
    }
  }, [decision, context]);

  const acceptSuggestion = (id: string) => {
    suggestions.acceptSuggestion(id);
    if (context) {
      recordSuggestionInteraction(id, "accepted", context.module);
    }
  };

  const dismissSuggestion = (id: string) => {
    suggestions.dismissSuggestion(id);
    if (context) {
      recordSuggestionInteraction(id, "dismissed", context.module);
    }
  };

  return {
    decision,
    playbook,
    suggestions,
    acceptSuggestion,
    dismissSuggestion,
  };
}
