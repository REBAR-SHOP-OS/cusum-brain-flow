import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, Search, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SeoAiVisibility() {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  const runAiVisibilityAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generic", {
        body: {
          prompt: "Perform an AI Visibility audit for rebar.shop (a rebar fabrication company). Check: 1) How likely is this brand to appear in ChatGPT, Google AI Overviews, Perplexity, and other AI search tools? 2) What content gaps exist? 3) What structured data / schema markup would help? 4) Suggest 5 specific actions to improve AI visibility. Be specific and actionable.",
          systemPrompt: "You are an AI Visibility specialist who helps brands optimize their presence in AI-powered search tools (ChatGPT, Google AI Mode, Perplexity, Claude). Focus on practical, implementable recommendations."
        },
      });
      if (error) throw error;
      setAuditResult(data?.result || data?.content || "No results.");
    } catch (err: any) {
      toast.error("Failed to run audit", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Visibility</h1>
        <p className="text-muted-foreground mt-1">Grow your visibility in AI search tools like ChatGPT and Google's AI Mode.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-500" />
              ChatGPT Visibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Run audit to check</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              Google AI Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Monitoring coming soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-500" />
              Perplexity Presence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Run audit to check</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI Visibility Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Analyze how your brand appears across AI-powered search tools and get actionable recommendations.
          </p>
          <Button onClick={runAiVisibilityAudit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Run AI Visibility Audit
          </Button>
          {auditResult && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap text-foreground">
              {auditResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
