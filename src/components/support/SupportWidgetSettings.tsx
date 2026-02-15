import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Check, Code } from "lucide-react";

interface WidgetConfig {
  id: string;
  widget_key: string;
  brand_name: string;
  brand_color: string;
  welcome_message: string;
  offline_message: string;
  enabled: boolean;
  allowed_domains: string[];
}

export function SupportWidgetSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;
      setCompanyId(profile.company_id);

      const { data } = await supabase
        .from("support_widget_configs")
        .select("*")
        .eq("company_id", profile.company_id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setConfig(data as WidgetConfig);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const createWidget = async () => {
    if (!companyId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("support_widget_configs")
      .insert({ company_id: companyId })
      .select("*")
      .single();

    if (error) toast.error("Failed to create widget config");
    else {
      setConfig(data as WidgetConfig);
      toast.success("Widget created!");
    }
    setSaving(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);

    const { error } = await supabase
      .from("support_widget_configs")
      .update({
        brand_name: config.brand_name,
        brand_color: config.brand_color,
        welcome_message: config.welcome_message,
        offline_message: config.offline_message,
        enabled: config.enabled,
      })
      .eq("id", config.id);

    if (error) toast.error("Failed to save");
    else toast.success("Settings saved");
    setSaving(false);
  };

  const embedCode = config
    ? `<script src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat?action=widget.js&key=${config.widget_key}" async></script>`
    : "";

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  if (!config) {
    return (
      <div className="max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Chat Widget</CardTitle>
            <CardDescription>Create an embeddable chat widget for your website</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={createWidget} disabled={saving}>
              {saving ? "Creating..." : "Create Widget"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Widget Settings</h2>
        <p className="text-sm text-muted-foreground">Configure your embeddable support chat widget</p>
      </div>

      {/* Embed Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Code className="w-4 h-4" /> Embed Code
          </CardTitle>
          <CardDescription>Paste this script tag into your website's HTML, just before the closing &lt;/body&gt; tag</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {embedCode}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 h-7 gap-1 text-xs"
              onClick={copyEmbed}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Widget Name</Label>
              <Input
                value={config.brand_name}
                onChange={(e) => setConfig({ ...config, brand_name: e.target.value })}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Brand Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.brand_color}
                  onChange={(e) => setConfig({ ...config, brand_color: e.target.value })}
                  className="w-10 h-9 rounded cursor-pointer border border-border"
                />
                <Input
                  value={config.brand_color}
                  onChange={(e) => setConfig({ ...config, brand_color: e.target.value })}
                  maxLength={7}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Welcome Message</Label>
            <Input
              value={config.welcome_message}
              onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Offline Message</Label>
            <Input
              value={config.offline_message}
              onChange={(e) => setConfig({ ...config, offline_message: e.target.value })}
              maxLength={200}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
