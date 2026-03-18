import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, ExternalLink, TrendingUp, Newspaper, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SeoAiPr() {
  const [loading, setLoading] = useState(false);
  const [prIdeas, setPrIdeas] = useState<string | null>(null);

  const generatePrIdeas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generic", {
        body: {
          prompt: "Generate 5 press release / PR pitch ideas for a rebar fabrication and steel construction company (rebar.shop). Focus on industry innovation, sustainability, technology adoption, and community impact. Format each with a headline, 2-sentence pitch, and suggested media targets.",
          systemPrompt: "You are an AI PR strategist specializing in construction and manufacturing industries. Generate actionable PR ideas that can improve brand visibility in both traditional media and AI/LLM search results."
        },
      });
      if (error) throw error;
      setPrIdeas(data?.result || data?.content || "No ideas generated.");
    } catch (err: any) {
      toast.error("Failed to generate PR ideas", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI PR</h1>
        <p className="text-muted-foreground mt-1">Get press coverage that shapes your brand's visibility in LLMs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-rose-500" />
              PR Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Monitoring not yet active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Brand Mentions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Set up monitoring to track</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-500" />
              LLM Citations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Track AI model references</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-rose-500" />
            AI PR Idea Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate PR pitch ideas tailored for construction & manufacturing, optimized for AI search visibility.
          </p>
          <Button onClick={generatePrIdeas} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
            Generate PR Ideas
          </Button>
          {prIdeas && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap text-foreground">
              {prIdeas}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
