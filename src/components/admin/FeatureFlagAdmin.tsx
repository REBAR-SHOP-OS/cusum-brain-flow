import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFlagCache } from "@/lib/featureFlagService";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Flag } from "lucide-react";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  flag_key: string;
  enabled: boolean;
  description: string | null;
  allowed_roles: string[];
  allowed_user_ids: string[];
  allowed_emails: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Simple feature flag admin panel.
 * Read-only display with toggle to enable/disable flags.
 * Only usable by admins via role gating in the parent route.
 */
export function FeatureFlagAdmin() {
  const queryClient = useQueryClient();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("feature_flags")
        .select("*")
        .order("flag_key");
      if (error) throw error;
      return (data ?? []) as FeatureFlag[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await (supabase as any)
        .from("feature_flags")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      invalidateFlagCache();
      toast.success("Flag updated");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update flag: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Feature Flags
        </CardTitle>
      </CardHeader>
      <CardContent>
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feature flags configured.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Targeting</TableHead>
                <TableHead className="w-[80px]">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm">{flag.flag_key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {flag.description || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {flag.allowed_roles.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {flag.allowed_roles.length} role{flag.allowed_roles.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {flag.allowed_user_ids.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {flag.allowed_user_ids.length} user{flag.allowed_user_ids.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {flag.allowed_emails.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {flag.allowed_emails.length} email{flag.allowed_emails.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {flag.allowed_roles.length === 0 && flag.allowed_user_ids.length === 0 && flag.allowed_emails.length === 0 && (
                        <span className="text-xs text-muted-foreground">Global</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: flag.id, enabled: checked })
                      }
                      disabled={toggleMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
