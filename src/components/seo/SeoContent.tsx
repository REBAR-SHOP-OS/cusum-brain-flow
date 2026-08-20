import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Wand2, Loader2, BookOpen, Target, PenTool } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SeoContent() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentPlan, setContentPlan] = useState<string | null>(null);

  const generateContentPlan = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic or keyword first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generic", {
        body: {
          prompt: `Create a comprehensive SEO content plan for the topic: "${topic}" for rebar.shop (a rebar fabrication company). Include: 1) 5 blog post ideas with title, target keyword, search intent, and word count recommendation, 2) Content cluster strategy, 3) Internal linking opportunities, 4) Featured snippet optimization tips, 5) Content calendar suggestion (weekly cadence). Focus on construction industry relevance.`,
          systemPrompt: "You are an SEO content strategist specializing in B2B construction and manufacturing. Create data-driven content plans that target high-intent keywords and build topical authority."
        },
      });
      if (error) throw error;
      setContentPlan(data?.result || data?.content || "No results.");
    } catch (err: any) {
      toast.error("Failed to generate content plan", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Content</h1>
        <p className="text-muted-foreground mt-1">Create SEO-friendly content with AI and competitive data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-500" />
              Content Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Audit content quality</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-500" />
              Content Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">vs. competitors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PenTool className="w-4 h-4 text-indigo-500" />
              Writing Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">AI-Powered</p>
            <p className="text-xs text-muted-foreground">Generate optimized content</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-teal-500" />
            AI Content Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a topic or keyword to generate a full SEO content plan with blog ideas, cluster strategy, and calendar.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. rebar fabrication, concrete reinforcement..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateContentPlan()}
              className="flex-1"
            />
            <Button onClick={generateContentPlan} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              Generate Plan
            </Button>
          </div>
          {contentPlan && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap text-foreground">
              {contentPlan}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
