import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Venture } from "@/types/venture";

interface Props {
  venture: Venture;
  onAnalysis: (a: Record<string, unknown>) => void;
}

export const AIStressTest: React.FC<Props> = ({ venture, onAnalysis }) => {
  const [loading, setLoading] = useState(false);
  const analysis = venture.ai_analysis as any;

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("empire-architect", {
        body: { venture },
      });
      if (error) throw error;
      onAnalysis(data);
      toast.success("AI analysis complete");
    } catch (e: any) {
      toast.error(e.message || "AI analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
        {loading ? "Analyzing…" : "Run AI Stress Test"}
      </Button>

      {analysis && (
        <div className="space-y-3 rounded-lg border border-border p-4 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Viability Score</span>
            <Badge variant={analysis.viability_score >= 7 ? "default" : "destructive"} className="text-lg px-3">
              {analysis.viability_score}/10
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Recommendation</span>
            <Badge variant={analysis.recommendation === "continue" ? "default" : "destructive"}>
              {analysis.recommendation === "continue" ? "✅ Continue" : "⛔ Kill"}
            </Badge>
          </div>

          {analysis.problem_clarity && (
            <Section title="Problem Clarity" content={analysis.problem_clarity} />
          )}
          {analysis.market_size && (
            <Section title="Market Size" content={analysis.market_size} />
          )}
          {analysis.risks?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Risks</p>
              <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                {analysis.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {analysis.next_actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Next Actions</p>
              <ol className="list-decimal list-inside text-sm text-foreground space-y-1">
                {analysis.next_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Section = ({ title, content }: { title: string; content: string }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground mb-0.5">{title}</p>
    <p className="text-sm text-foreground">{content}</p>
  </div>
);
