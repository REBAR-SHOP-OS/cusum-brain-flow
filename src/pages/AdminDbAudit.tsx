import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Database, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";

interface TableStat {
  table_name: string;
  approx_rows: number;
  size_pretty: string;
  size_bytes: number;
}

function useTableStats() {
  return useQuery({
    queryKey: ["db-audit-table-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_table_stats");
      if (error) throw new Error(error.message);
      return (data as TableStat[]) || [];
    },
    staleTime: 0,
  });
}

export default function AdminDbAudit() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: stats, isLoading, error, refetch, isFetching } = useTableStats();

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">This page is restricted to administrators only.</p>
        <Button variant="outline" onClick={() => navigate("/home")}>
          Go Home
        </Button>
      </div>
    );
  }

  const totalSize = stats?.reduce((sum, t) => sum + t.size_bytes, 0) || 0;
  const totalRows = stats?.reduce((sum, t) => sum + t.approx_rows, 0) || 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Database Audit</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary">{stats?.length ?? "—"}</p>
            <p className="text-sm text-muted-foreground">Tables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary">{totalRows.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Rows (approx)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {stats ? formatBytes(totalSize) : "—"}
            </p>
            <p className="text-sm text-muted-foreground">Total Size</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Top 20 Tables by Size</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-center py-8 text-destructive">
                <p>Error: {error.message}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            )}

            {isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}

            {stats && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Approx Rows</TableHead>
                    <TableHead className="text-right">Size (Pretty)</TableHead>
                    <TableHead className="text-right">Size (Bytes)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((row) => (
                    <TableRow key={row.table_name}>
                      <TableCell className="font-mono text-sm">{row.table_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.approx_rows.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.size_pretty}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.size_bytes.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "kB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
