import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmartSearchInput } from "@/components/ui/SmartSearchInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Archive, Search, Package, CheckCircle2, Camera, Image,
  ChevronRight, ChevronLeft, FolderOpen, ShieldCheck, Truck,
  Upload, Loader2, FileSignature,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────
interface EvidenceRecord {
  id: string;
  material_photo_url: string | null;
  tag_scan_url: string | null;
  status: string;
  verified_at: string | null;
  verified_by: string | null;
}

interface CompletedItem {
  id: string;
  bar_code: string;
  mark_number: string | null;
  drawing_ref: string | null;
  cut_length_mm: number;
  total_pieces: number;
  cut_plan_id: string;
  clearance_evidence: EvidenceRecord[];
  cut_plans: { id: string; name: string; project_name: string | null } | null;
}

interface ProjectGroup {
  name: string;
  items: CompletedItem[];
  evidenceCount: number;
  clearedCount: number;
  totalItems: number;
}

interface LoadingPhoto {
  id: string;
  photo_url: string;
  notes: string | null;
  created_at: string;
}

// ─── Component ─────────────────────────────────────────────
export function PackingSlipsView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectGroup | null>(null);
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [podUrls, setPodUrls] = useState<{ signature?: string; photo?: string }>({});
  const [podLoading, setPodLoading] = useState(false);
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Query completed items grouped by project ──
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["archive-completed-projects"],
    enabled: !!user,
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("cut_plan_items")
        .select("id, bar_code, mark_number, drawing_ref, cut_length_mm, total_pieces, cut_plan_id, clearance_evidence(id, material_photo_url, tag_scan_url, status, verified_at, verified_by), cut_plans!inner(id, name, project_name)")
        .eq("phase", "complete");

      if (error) throw error;

      const byProject = new Map<string, ProjectGroup>();
      for (const item of (items || []) as any[]) {
        const key = item.cut_plans?.project_name || item.cut_plans?.name || "Unassigned";
        if (!byProject.has(key)) {
          byProject.set(key, { name: key, items: [], evidenceCount: 0, clearedCount: 0, totalItems: 0 });
        }
        const proj = byProject.get(key)!;
        proj.items.push(item);
        proj.totalItems++;
        const ev = item.clearance_evidence?.[0];
        if (ev) {
          proj.evidenceCount++;
          if (ev.status === "cleared") proj.clearedCount++;
        }
      }
      return [...byProject.values()].sort((a, b) => b.totalItems - a.totalItems);
    },
  });

  // ── Query signed deliveries (POD) ──
  const { data: signedDeliveries = [] } = useQuery({
    queryKey: ["archive-signed-deliveries"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_stops")
        .select("id, address, pod_signature, pod_photo_url, status, stop_sequence, notes, customers(name), deliveries!inner(id, delivery_number, scheduled_date, driver_name)")
        .or("pod_signature.not.is.null,pod_photo_url.not.is.null")
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Query loading evidence for selected project ──
  const { data: loadingPhotos = [] } = useQuery({
    queryKey: ["loading-evidence", selectedProject?.name],
    enabled: !!selectedProject,
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data, error } = await supabase
        .from("loading_evidence")
        .select("id, photo_url, notes, created_at")
        .eq("project_name", selectedProject.name)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LoadingPhoto[];
    },
  });

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.items.some((i) => (i.mark_number || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Resolve signed URLs when a stop is selected ──
  const handleStopClick = async (stop: any) => {
    setSelectedStop(stop);
    setPodUrls({});
    setPodLoading(true);
    try {
      const resolved: { signature?: string; photo?: string } = {};
      for (const [key, rawPath] of [["signature", stop.pod_signature], ["photo", stop.pod_photo_url]] as const) {
        if (!rawPath) continue;
        // If it's already a full signed URL, use directly
        if (rawPath.includes("token=") || rawPath.startsWith("data:")) {
          resolved[key] = rawPath;
          continue;
        }
        let storagePath = rawPath;
        const marker = "/object/public/clearance-photos/";
        const idx = rawPath.indexOf(marker);
        if (idx !== -1) storagePath = rawPath.substring(idx + marker.length);
        const { data } = await supabase.storage.from("clearance-photos").createSignedUrl(storagePath, 3600);
        if (data?.signedUrl) resolved[key] = data.signedUrl;
      }
      setPodUrls(resolved);
    } catch (err) {
      console.error("Failed to resolve POD URLs", err);
    } finally {
      setPodLoading(false);
    }
  };


  if (selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        loadingPhotos={loadingPhotos}
        companyId={companyId}
        userId={user?.id}
        onBack={() => setSelectedProject(null)}
        onUploadDone={() => queryClient.invalidateQueries({ queryKey: ["loading-evidence", selectedProject.name] })}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Archive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">Digital Archives</h1>
            <p className="text-[10px] tracking-[0.2em] text-primary/70 uppercase">Evidence, Loading Photos & Signed Packing Slips</p>
          </div>
        </div>
        <SmartSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search: today, pending, shipped..."
          hints={[
            { category: "Date", suggestions: ["today", "this week"] },
            { category: "Status", suggestions: ["pending", "shipped", "cleared"] },
          ]}
          className="w-64"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 space-y-8">
          <Tabs defaultValue="evidence">
            <TabsList>
              <TabsTrigger value="evidence" className="gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> QC Evidence ({projects.length})
              </TabsTrigger>
              <TabsTrigger value="signed" className="gap-1.5">
                <FileSignature className="w-3.5 h-3.5" /> Signed Deliveries ({signedDeliveries.length})
              </TabsTrigger>
            </TabsList>

            {/* ── QC Evidence Tab ── */}
            <TabsContent value="evidence">
              <div className="flex items-center justify-between mb-4 mt-4">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">Completed Projects</h2>
                </div>
                <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  {filteredProjects.length} Projects
                </span>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No completed projects found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredProjects.map((proj) => (
                    <Card key={proj.name} className="group hover:shadow-lg transition-all border-border hover:border-primary/30">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] tracking-widest text-muted-foreground/60 uppercase">Items</p>
                            <p className="text-lg font-black text-foreground">{proj.totalItems}</p>
                          </div>
                        </div>

                        <h3 className="text-base font-black uppercase text-foreground tracking-tight leading-tight">
                          {proj.name}
                        </h3>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Image className="w-3 h-3 text-primary" />
                            <span className="uppercase">{proj.evidenceCount} Evidence Photos</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <span className="uppercase">{proj.clearedCount} / {proj.totalItems} Cleared</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${proj.totalItems > 0 ? (proj.clearedCount / proj.totalItems) * 100 : 0}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-end pt-2 border-t border-border/30">
                          <button
                            onClick={() => setSelectedProject(proj)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                          >
                            View Details <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Signed Deliveries Tab ── */}
            <TabsContent value="signed">
              <div className="mt-4">
                {signedDeliveries.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No signed deliveries yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">POD signatures will appear here when deliveries are completed</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {signedDeliveries.map((stop: any) => (
                        <Card
                          key={stop.id}
                          className="border-border cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
                          onClick={() => handleStopClick(stop)}
                        >
                          <CardContent className="p-5 space-y-3">
                            <div className="flex items-center gap-2">
                              <FileSignature className="w-5 h-5 text-primary" />
                              <h3 className="text-sm font-black uppercase text-foreground">
                                {stop.deliveries?.delivery_number || "Delivery"}
                              </h3>
                            </div>
                            <p className="text-xs text-muted-foreground">{stop.address || "No address"}</p>
                            <p className="text-xs text-muted-foreground">Customer: {stop.customers?.name || "—"}</p>
                            <div className="flex gap-2">
                              {stop.pod_signature && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-semibold">Signed</span>
                              )}
                              {stop.pod_photo_url && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-semibold">Photo</span>
                              )}
                            </div>
                            <div className="flex items-center justify-end pt-2 border-t border-border/30">
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-primary uppercase tracking-widest">
                                View Details <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Dialog open={!!selectedStop} onOpenChange={(open: boolean) => { if (!open) setSelectedStop(null); }}>
                      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase">
                            <FileSignature className="w-5 h-5 text-primary" />
                            {selectedStop?.deliveries?.delivery_number || "Delivery"}
                          </DialogTitle>
                          <DialogDescription>
                            Proof of delivery details
                          </DialogDescription>
                        </DialogHeader>

                        {selectedStop && (
                          <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">Address</p>
                                <p className="font-medium text-foreground">{selectedStop.address || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">Customer</p>
                                <p className="font-medium text-foreground">{selectedStop.customers?.name || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">Driver</p>
                                <p className="font-medium text-foreground">{selectedStop.deliveries?.driver_name || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">Date</p>
                                <p className="font-medium text-foreground">
                                  {selectedStop.deliveries?.scheduled_date
                                    ? new Date(selectedStop.deliveries.scheduled_date).toLocaleDateString()
                                    : "—"}
                                </p>
                              </div>
                            </div>

                            {selectedStop.pod_signature && (
                              <div className="space-y-2">
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">POD Signature</p>
                                {podLoading ? (
                                  <div className="h-40 rounded-lg bg-muted flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                  </div>
                                ) : podUrls.signature ? (
                                  <div className="border border-border rounded-lg p-3 bg-background">
                                    <img src={podUrls.signature} alt="POD Signature" className="max-h-48 w-auto mx-auto object-contain" />
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">Unable to load signature</p>
                                )}
                              </div>
                            )}

                            {selectedStop.pod_photo_url && (
                              <div className="space-y-2">
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">Site Drop Photo</p>
                                {podLoading ? (
                                  <div className="h-48 rounded-lg bg-muted flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                  </div>
                                ) : podUrls.photo ? (
                                  <div className="border border-border rounded-lg overflow-hidden">
                                    <img src={podUrls.photo} alt="Site drop photo" className="max-h-72 w-full object-contain bg-muted" />
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">Unable to load photo</p>
                                )}
                              </div>
                            )}

                            {selectedStop.notes && (
                              <div className="space-y-1">
                                <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">Notes</p>
                                <p className="text-sm text-foreground">{selectedStop.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Project Detail View ───────────────────────────────────
interface ProjectDetailViewProps {
  project: ProjectGroup;
  loadingPhotos: LoadingPhoto[];
  companyId: string | null;
  userId?: string;
  onBack: () => void;
  onUploadDone: () => void;
}

function ProjectDetailView({ project, loadingPhotos, companyId, userId, onBack, onUploadDone }: ProjectDetailViewProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, { material?: string; tag?: string }>>({});

  // Resolve signed URLs for evidence photos
  useEffect(() => {
    async function resolveAll() {
      const urls: Record<string, { material?: string; tag?: string }> = {};
      for (const item of project.items) {
        const ev = item.clearance_evidence?.[0];
        if (!ev) continue;
        const resolved: { material?: string; tag?: string } = {};
        for (const [key, rawUrl] of [["material", ev.material_photo_url], ["tag", ev.tag_scan_url]] as const) {
          if (!rawUrl) continue;
          if (rawUrl.includes("token=") || rawUrl.includes("/object/sign/")) {
            resolved[key] = rawUrl;
            continue;
          }
          let storagePath = rawUrl;
          const marker = "/object/public/clearance-photos/";
          const idx = rawUrl.indexOf(marker);
          if (idx !== -1) storagePath = rawUrl.substring(idx + marker.length);
          const { data } = await supabase.storage.from("clearance-photos").createSignedUrl(storagePath, 3600);
          if (data?.signedUrl) resolved[key] = data.signedUrl;
        }
        urls[item.id] = resolved;
      }
      setSignedUrls(urls);
    }
    resolveAll();
  }, [project.items]);

  // Resolve loading photo signed URLs
  const [loadingSignedUrls, setLoadingSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    async function resolve() {
      const urls: Record<string, string> = {};
      for (const lp of loadingPhotos) {
        if (lp.photo_url.includes("token=")) {
          urls[lp.id] = lp.photo_url;
          continue;
        }
        const { data } = await supabase.storage.from("clearance-photos").createSignedUrl(lp.photo_url, 3600);
        if (data?.signedUrl) urls[lp.id] = data.signedUrl;
      }
      setLoadingSignedUrls(urls);
    }
    resolve();
  }, [loadingPhotos]);

  const handleLoadingUpload = async (file: File) => {
    if (!companyId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `loading/${project.name.replace(/\s+/g, "_")}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("clearance-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("loading_evidence").insert({
        project_name: project.name,
        company_id: companyId,
        photo_url: path,
        captured_by: userId,
        cut_plan_id: project.items[0]?.cut_plan_id || null,
      } as any);
      if (dbErr) throw dbErr;

      toast({ title: "Loading photo uploaded" });
      onUploadDone();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-black italic text-foreground uppercase tracking-tight">{project.name}</h1>
            <p className="text-[10px] tracking-[0.2em] text-primary/70 uppercase">
              {project.totalItems} Items · {project.clearedCount} Cleared · {project.evidenceCount} Evidence
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Loading Photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLoadingUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 space-y-8">
          {/* Loading Evidence Section */}
          {loadingPhotos.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">Loading Evidence</h2>
                <span className="text-[10px] tracking-widest text-muted-foreground ml-auto uppercase">{loadingPhotos.length} Photos</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {loadingPhotos.map((lp) => (
                  <div key={lp.id} className="aspect-[4/3] rounded-lg border border-border overflow-hidden bg-muted/30">
                    {loadingSignedUrls[lp.id] ? (
                      <img src={loadingSignedUrls[lp.id]} alt="Loading" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* QC Evidence Grid */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">Clearance Evidence</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {project.items.map((item) => {
                const ev = item.clearance_evidence?.[0];
                const urls = signedUrls[item.id] || {};
                const isCleared = ev?.status === "cleared";
                return (
                  <Card key={item.id} className={`border ${isCleared ? "border-primary/30" : "border-border"}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-black text-foreground">{item.mark_number || "—"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            {item.bar_code} · {item.cut_length_mm}mm · {item.total_pieces} pcs
                          </p>
                        </div>
                        {isCleared && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      </div>

                      {/* Photos */}
                      <div className="grid grid-cols-2 gap-2">
                        <PhotoThumb label="Material" url={urls.material} />
                        <PhotoThumb label="Tag Scan" url={urls.tag} />
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {ev?.verified_at && (
                          <span className="uppercase">
                            Verified {new Date(ev.verified_at).toLocaleDateString()}
                          </span>
                        )}
                        {!ev && <span className="uppercase text-muted-foreground/50">No evidence</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Photo Thumbnail ───────────────────────────────────────
function PhotoThumb({ label, url }: { label: string; url?: string }) {
  return (
    <div className="aspect-[4/3] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
      {url ? (
        <img src={url} alt={label} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
          <Camera className="w-5 h-5" />
          <span className="text-[8px] tracking-wider uppercase">{label}</span>
        </div>
      )}
    </div>
  );
}
