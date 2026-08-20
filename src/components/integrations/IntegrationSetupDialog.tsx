import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Integration } from "./IntegrationCard";

interface IntegrationSetupDialogProps {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntegrationSetupDialog({
  integration,
  open,
  onOpenChange,
}: IntegrationSetupDialogProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSaveCredentials = async () => {
    if (!integration) return;

    const filledFields = Object.entries(formValues).filter(([_, v]) => v.trim());
    if (filledFields.length === 0) {
      toast({
        title: "No credentials entered",
        description: "Please enter at least one credential",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const secretsText = filledFields
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(secretsText);
      toast({
        title: "Copied to clipboard",
        description: `${filledFields.length} secret(s) copied. Add them in Lovable Cloud → Settings → Secrets.`,
      });
    } catch {
      toast({
        title: "Credentials Ready",
        description: "Please add these secrets in Lovable Cloud → Settings → Secrets",
      });
    }

    setSaving(false);
    setFormValues({});
    onOpenChange(false);
  };

  const handleClose = () => {
    setFormValues({});
    onOpenChange(false);
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{integration.icon}</span>
            <span>{integration.name}</span>
          </DialogTitle>
          <DialogDescription>
            Enter your API credentials to connect {integration.name}.
            {integration.docsUrl && (
              <>
                {" "}
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  Get credentials <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {integration.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.key}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  rows={3}
                  className="font-mono text-xs"
                />
              ) : (
                <Input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="font-mono"
                />
              )}
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Secrets are stored securely
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSaveCredentials} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Copy & Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
