import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, File, HardDrive, Cpu, MemoryStick, Download, ChevronRight, RefreshCw, Server } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { useToast } from "@/hooks/use-toast";

interface NasFile {
  isdir: boolean;
  name: string;
  path: string;
  additional?: {
    size?: number;
    time?: { mtime?: number; crtime?: number };
    type?: string;
  };
}

interface NasShare {
  isdir: boolean;
  name: string;
  path: string;
  additional?: { size?: number };
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function SynologyNAS() {
  const { toast } = useToast();
  const [tab, setTab] = useState("files");

  // Files state
  const [shares, setShares] = useState<NasShare[]>([]);
  const [files, setFiles] = useState<NasFile[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Status state
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const loadShares = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const data = await invokeEdgeFunction("synology-proxy", { action: "list-shares" });
      setShares(data.shares || []);
      setFiles([]);
      setBreadcrumb([]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingFiles(false);
    }
  }, [toast]);

  const openFolder = useCallback(async (folderPath: string) => {
    setLoadingFiles(true);
    try {
      const data = await invokeEdgeFunction("synology-proxy", { action: "list-files", folderPath });
      setFiles(data.files || []);
      const parts = folderPath.split("/").filter(Boolean);
      setBreadcrumb(parts);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingFiles(false);
    }
  }, [toast]);

  const downloadFile = useCallback(async (filePath: string) => {
    try {
      toast({ title: "Downloading...", description: filePath.split("/").pop() });
      // For download we need a direct URL approach via edge function
      const data = await invokeEdgeFunction("synology-proxy", { action: "download", path: filePath });
      toast({ title: "Download initiated" });
    } catch (e: any) {
      toast({ title: "Download error", description: e.message, variant: "destructive" });
    }
  }, [toast]);

  const loadSystemInfo = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await invokeEdgeFunction("synology-proxy", { action: "system-info" });
      setSystemInfo(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingStatus(false);
    }
  }, [toast]);

  const currentPath = breadcrumb.length > 0 ? "/" + breadcrumb.join("/") : "";

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-[#4B9FD5]" />
          <div>
            <h1 className="text-xl font-semibold">Synology NAS</h1>
            <p className="text-sm text-muted-foreground">RSIC.synology.me — File Storage & Monitoring</p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="files">📁 Files</TabsTrigger>
            <TabsTrigger value="status">📊 Status</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="files" className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" onClick={loadShares} className="text-muted-foreground">
              <HardDrive className="w-4 h-4 mr-1" /> NAS
            </Button>
            {breadcrumb.map((part, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openFolder("/" + breadcrumb.slice(0, idx + 1).join("/"))}
                  className="text-muted-foreground"
                >
                  {part}
                </Button>
              </span>
            ))}
          </div>

          {/* Content */}
          {loadingFiles ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : breadcrumb.length === 0 && shares.length === 0 && files.length === 0 ? (
            <div className="text-center py-12">
              <HardDrive className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Click below to browse your NAS files</p>
              <Button onClick={loadShares}>
                <FolderOpen className="w-4 h-4 mr-2" /> Browse NAS
              </Button>
            </div>
          ) : breadcrumb.length === 0 ? (
            // Show shares
            <div className="grid gap-2">
              {shares.map((share) => (
                <button
                  key={share.path}
                  onClick={() => openFolder(share.path)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                >
                  <FolderOpen className="w-5 h-5 text-[#4B9FD5]" />
                  <span className="font-medium">{share.name}</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            // Show files
            <div className="grid gap-1">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                >
                  {file.isdir ? (
                    <button
                      onClick={() => openFolder(file.path)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <FolderOpen className="w-5 h-5 text-[#4B9FD5]" />
                      <span className="font-medium">{file.name}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 flex-1">
                      <File className="w-5 h-5 text-muted-foreground" />
                      <span>{file.name}</span>
                      {file.additional?.size != null && (
                        <span className="text-xs text-muted-foreground ml-auto mr-2">
                          {formatBytes(file.additional.size)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => downloadFile(file.path)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">This folder is empty</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="status" className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">System Status</h2>
            <Button variant="outline" size="sm" onClick={loadSystemInfo} disabled={loadingStatus}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingStatus ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loadingStatus ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !systemInfo ? (
            <div className="text-center py-12">
              <Cpu className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Click Refresh to load system status</p>
              <Button onClick={loadSystemInfo}>
                <RefreshCw className="w-4 h-4 mr-2" /> Load Status
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* System Info */}
              {systemInfo.system && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Server className="w-4 h-4" /> System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Model: <span className="text-muted-foreground">{systemInfo.system.model || "N/A"}</span></p>
                    <p>DSM: <span className="text-muted-foreground">{systemInfo.system.version_string || "N/A"}</span></p>
                    <p>Uptime: <span className="text-muted-foreground">{systemInfo.system.up_time || "N/A"}</span></p>
                    <p>Temperature: <span className="text-muted-foreground">{systemInfo.system.temperature}°C</span></p>
                  </CardContent>
                </Card>
              )}

              {/* CPU */}
              {systemInfo.utilization?.cpu && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Cpu className="w-4 h-4" /> CPU
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Usage</span>
                        <span className="font-mono">{systemInfo.utilization.cpu.user_load || 0}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4B9FD5] rounded-full transition-all"
                          style={{ width: `${systemInfo.utilization.cpu.user_load || 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Memory */}
              {systemInfo.utilization?.memory && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MemoryStick className="w-4 h-4" /> Memory
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Usage</span>
                        <span className="font-mono">{systemInfo.utilization.memory.real_usage || 0}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${systemInfo.utilization.memory.real_usage || 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disks */}
              {systemInfo.storage?.disks?.map((disk: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <HardDrive className="w-4 h-4" /> {disk.name || `Disk ${idx + 1}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Model: <span className="text-muted-foreground">{disk.model || "N/A"}</span></p>
                    <p>Size: <span className="text-muted-foreground">{disk.size_total ? formatBytes(disk.size_total) : "N/A"}</span></p>
                    <p>Temperature: <span className="text-muted-foreground">{disk.temp}°C</span></p>
                    <Badge variant={disk.status === "normal" ? "default" : "destructive"} className="mt-1">
                      {disk.status || "Unknown"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}

              {/* Volumes */}
              {systemInfo.storage?.volumes?.map((vol: any, idx: number) => (
                <Card key={`vol-${idx}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <HardDrive className="w-4 h-4" /> {vol.display_name || vol.id || `Volume ${idx + 1}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {vol.size?.total && vol.size?.used && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>{formatBytes(Number(vol.size.used))}</span>
                            <span className="text-muted-foreground">/ {formatBytes(Number(vol.size.total))}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${(Number(vol.size.used) / Number(vol.size.total) * 100).toFixed(0)}%` }}
                            />
                          </div>
                        </>
                      )}
                      <Badge variant={vol.status === "normal" ? "default" : "destructive"}>
                        {vol.status || "Unknown"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
