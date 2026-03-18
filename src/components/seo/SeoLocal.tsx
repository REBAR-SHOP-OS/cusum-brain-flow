import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Users, Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SeoLocal() {
  const [loading, setLoading] = useState(false);
  const [localAudit, setLocalAudit] = useState<string | null>(null);

  const runLocalAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generic", {
        body: {
          prompt: "Perform a Local SEO audit for rebar.shop (located in Toronto/GTA, Ontario, Canada — a rebar fabrication and delivery company). Analyze: 1) Google Business Profile optimization checklist, 2) Local keyword opportunities (e.g., 'rebar supplier near me', 'rebar fabrication Toronto'), 3) Review management strategy, 4) Local competitor analysis approach, 5) NAP consistency recommendations. Be specific to the rebar/construction industry in the GTA market.",
          systemPrompt: "You are a Local SEO specialist focused on construction and manufacturing businesses. Provide actionable local search optimization strategies."
        },
      });
      if (error) throw error;
      setLocalAudit(data?.result || data?.content || "No results.");
    } catch (err: any) {
      toast.error("Failed to run local audit", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Local SEO</h1>
        <p className="text-muted-foreground mt-1">Manage reviews, boost local search visibility, track local competitors.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              GBP Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Connect Google Business</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Review monitoring</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Local Pack
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Position tracking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-500" />
              Competitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground">Local competitor tracking</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            Local SEO Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Get a comprehensive local SEO analysis for the GTA market with actionable recommendations.
          </p>
          <Button onClick={runLocalAudit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
            Run Local SEO Audit
          </Button>
          {localAudit && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap text-foreground">
              {localAudit}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
