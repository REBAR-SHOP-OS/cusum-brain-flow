import { useState, useRef, useMemo } from "react";
import {
  Upload, Globe, FileText, Loader2, Truck, Package,
  CheckCircle2, AlertCircle, Sparkles, X, ArrowRight,
  Shield, TriangleAlert, Clock, ChevronRight, History, XCircle,
  FolderOpen, Plus, GitBranch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useExtractSessions, useExtractRows, useExtractErrors } from "@/hooks/useExtractSessions";
import {
  createExtractSession,
  uploadExtractFile,
  runExtract,
  applyMapping,
  validateExtract,
  approveExtract,
  rejectExtract,
} from "@/lib/extractService";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { useBarlists } from "@/hooks/useBarlists";
import { createProject, createBarlist } from "@/lib/barlistService";

type ManifestType = "delivery" | "pickup";

const PIPELINE_STEPS = [
  { key: "uploaded", label: "Uploaded", icon: Upload },
  { key: "extracting", label: "Extracting", icon: Sparkles },
  { key: "extracted", label: "Extracted", icon: FileText },
  { key: "mapping", label: "Mapped", icon: Globe },
  { key: "validated", label: "Validated", icon: Shield },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
] as const;

function getStepIndex(status: string) {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

export function AIExtractView() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [manifestName, setManifestName] = useState("");
  const [customer, setCustomer] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [targetEta, setTargetEta] = useState("");
  const [manifestType, setManifestType] = useState<ManifestType>("delivery");

  // Project & Barlist selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedBarlistId, setSelectedBarlistId] = useState<string>("");
  const [createNewProject, setCreateNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [createNewBarlist, setCreateNewBarlist] = useState(false);
  const [newRevision, setNewRevision] = useState(false);

  // File & processing
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Data hooks
  const { sessions, refresh: refreshSessions } = useExtractSessions();
  const { rows, refresh: refreshRows } = useExtractRows(activeSessionId);
  const { errors, refresh: refreshErrors } = useExtractErrors(activeSessionId);

  // Get company_id
  const { data: profile } = useQuery({
    queryKey: ["profile_company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Project & Barlist data
  const { projects } = useProjects(profile?.company_id || undefined);
  const { barlists } = useBarlists(selectedProjectId || undefined);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const currentStepIndex = activeSession ? getStepIndex(activeSession.status) : -1;

  // Stats
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const totalPieces = rows.reduce((s, r) => s + (r.quantity || 0), 0);
    const barSizes = [...new Set(rows.map((r) => r.bar_size_mapped || r.bar_size).filter(Boolean))];
    const shapeTypes = [...new Set(rows.map((r) => r.shape_code_mapped || r.shape_type).filter(Boolean))];
    return { totalItems: rows.length, totalPieces, barSizes, shapeTypes };
  }, [rows]);

  const blockerCount = errors.filter((e) => e.error_type === "blocker").length;
  const warningCount = errors.filter((e) => e.error_type === "warning").length;

  // ─── Handlers ────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadedFile(file);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExtract = async () => {
    if (!uploadedFile || !profile?.company_id) return;
    setProcessing(true);

    try {
      // Resolve project
      let projectId = selectedProjectId;
      if (createNewProject && newProjectName) {
        setProcessingStep("Creating project...");
        const project = await createProject({
          companyId: profile.company_id,
          name: newProjectName,
          siteAddress,
          createdBy: user?.id,
        });
        projectId = project.id;
        setSelectedProjectId(project.id);
        setCreateNewProject(false);
      }

      // Resolve barlist
      let barlistId: string | null = null;
      if (projectId) {
        if (createNewBarlist || !selectedBarlistId) {
          setProcessingStep("Creating barlist...");
          const parentId = newRevision && selectedBarlistId ? selectedBarlistId : undefined;
          const barlist = await createBarlist({
            companyId: profile.company_id,
            projectId,
            name: manifestName || uploadedFile.name,
            sourceType: "ai_extract",
            parentBarlistId: parentId,
            createdBy: user?.id,
          });
          barlistId = barlist.id;
          setSelectedBarlistId(barlist.id);
          setCreateNewBarlist(false);
          setNewRevision(false);
        } else {
          barlistId = selectedBarlistId;
        }
      }

      // 1. Create session
      setProcessingStep("Creating session...");
      const session = await createExtractSession({
        companyId: profile.company_id,
        name: manifestName || uploadedFile.name,
        customer,
        siteAddress,
        manifestType,
        targetEta,
        createdBy: user?.id,
      });
      setActiveSessionId(session.id);

      // Link barlist to session
      if (barlistId) {
        await supabase
          .from("barlists")
          .update({ extract_session_id: session.id } as any)
          .eq("id", barlistId);
      }

      // 2. Upload file
      setProcessingStep("Uploading file...");
      const { fileUrl } = await uploadExtractFile({
        sessionId: session.id,
        companyId: profile.company_id,
        file: uploadedFile,
      });

      // 3. Run AI extraction
      setProcessingStep("AI extracting...");
      const result = await runExtract({
        sessionId: session.id,
        fileUrl,
        fileName: uploadedFile.name,
        manifestContext: { name: manifestName, customer, address: siteAddress, type: manifestType },
      });

      if (result.summary) {
        if (!customer && result.summary.customer) setCustomer(result.summary.customer);
        if (!manifestName && result.summary.project) setManifestName(result.summary.project);
      }

      await refreshRows();
      await refreshSessions();

      toast({
        title: "Extraction complete",
        description: `Found ${result.items.length} items`,
      });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const handleApplyMapping = async () => {
    if (!activeSessionId) return;
    setProcessing(true);
    setProcessingStep("Applying mapping...");
    try {
      const result = await applyMapping(activeSessionId);
      await refreshRows();
      await refreshSessions();
      toast({ title: "Mapping applied", description: `${result.mapped_count} rows mapped, ${result.auto_mappings_created} auto-rules created` });
    } catch (err: any) {
      toast({ title: "Mapping failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const handleValidate = async () => {
    if (!activeSessionId) return;
    setProcessing(true);
    setProcessingStep("Validating...");
    try {
      const result = await validateExtract(activeSessionId);
      await refreshErrors();
      await refreshSessions();
      toast({
        title: result.can_approve ? "Validation passed" : "Validation found issues",
        description: `${result.blockers} blockers, ${result.warnings} warnings`,
        variant: result.can_approve ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Validation failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const handleApprove = async () => {
    if (!activeSessionId) return;
    setProcessing(true);
    setProcessingStep("Approving & creating work orders...");
    try {
      const result = await approveExtract(activeSessionId);
      await refreshSessions();
      toast({
        title: "Approved!",
        description: `Created WO ${result.work_order_number} with ${result.items_approved} items`,
      });
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const handleReject = async () => {
    if (!activeSessionId) return;
    setProcessing(true);
    setProcessingStep("Declining session...");
    setShowRejectDialog(false);
    try {
      await rejectExtract(activeSessionId, rejectReason || undefined);
      await refreshSessions();
      toast({ title: "Session declined", description: rejectReason || "Session has been rejected." });
      setRejectReason("");
    } catch (err: any) {
      toast({ title: "Decline failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const loadSession = (session: any) => {
    setActiveSessionId(session.id);
    setManifestName(session.name);
    setCustomer(session.customer || "");
    setSiteAddress(session.site_address || "");
    setShowHistory(false);
  };

  const startNew = () => {
    setActiveSessionId(null);
    setUploadedFile(null);
    setManifestName("");
    setCustomer("");
    setSiteAddress("");
    setTargetEta("");
    setSelectedProjectId("");
    setSelectedBarlistId("");
    setCreateNewProject(false);
    setCreateNewBarlist(false);
    setNewRevision(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dimCols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-[95vw] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black italic text-foreground uppercase">
                {activeSession ? "Extract Session" : "Initialize Manifest"}
              </h1>
              <p className="text-xs tracking-widest text-primary/70 uppercase">
                {activeSession ? activeSession.name : "Identity Registration"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-3.5 h-3.5" />
              {showHistory ? "Hide" : "History"}
            </Button>

            {activeSession && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={startNew}>
                + New
              </Button>
            )}

            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <Button
                variant={manifestType === "delivery" ? "default" : "ghost"}
                size="sm" className="h-9 px-4 text-xs gap-1.5 font-bold"
                onClick={() => setManifestType("delivery")}
              >
                <Truck className="w-3.5 h-3.5" /> DELIVERY
              </Button>
              <Button
                variant={manifestType === "pickup" ? "default" : "ghost"}
                size="sm" className="h-9 px-4 text-xs gap-1.5 font-bold"
                onClick={() => setManifestType("pickup")}
              >
                <Package className="w-3.5 h-3.5" /> PICKUP
              </Button>
            </div>
          </div>
        </div>

        {/* Session History */}
        {showHistory && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Recent Sessions</h3>
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sessions yet.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {sessions.slice(0, 20).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors ${
                        s.id === activeSessionId
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{s.customer}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s.status} />
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pipeline Status */}
        {activeSession && (
          <div className="flex items-center gap-1">
            {PIPELINE_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStepIndex;
              const isDone = idx < currentStepIndex;
              const isFuture = idx > currentStepIndex;
              return (
                <div key={step.key} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      isActive ? "bg-primary text-primary-foreground"
                        : isDone ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <StepIcon className="w-3.5 h-3.5" />
                    {step.label}
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ArrowRight className={`w-3.5 h-3.5 ${isFuture ? "text-muted-foreground/30" : "text-primary/50"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Form fields (only when no active session) */}
        {!activeSession && (
          <>
            {/* ── Project & Barlist Selection ── */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold tracking-widest text-primary uppercase">
                    Project & Barlist Assignment
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Project selector */}
                  <div>
                    <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                      Project
                    </label>
                    {!createNewProject ? (
                      <div className="flex items-center gap-2">
                        <Select value={selectedProjectId} onValueChange={(v) => {
                          setSelectedProjectId(v);
                          setSelectedBarlistId("");
                        }}>
                          <SelectTrigger className="bg-card border-border flex-1">
                            <SelectValue placeholder="Select project..." />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                          onClick={() => setCreateNewProject(true)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="New project name..."
                          className="bg-card border-border"
                        />
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                          onClick={() => { setCreateNewProject(false); setNewProjectName(""); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Barlist selector */}
                  <div>
                    <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                      Barlist
                    </label>
                    {!createNewBarlist ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedBarlistId}
                          onValueChange={setSelectedBarlistId}
                          disabled={!selectedProjectId && !createNewProject}
                        >
                          <SelectTrigger className="bg-card border-border flex-1">
                            <SelectValue placeholder={selectedProjectId ? "Select barlist..." : "Pick project first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {barlists.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name} (Rev {b.revision_no})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                          onClick={() => setCreateNewBarlist(true)}
                          disabled={!selectedProjectId && !createNewProject}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        {selectedBarlistId && (
                          <Button
                            variant="outline" size="sm" className="h-9 gap-1 text-xs shrink-0"
                            onClick={() => { setNewRevision(true); setCreateNewBarlist(true); }}
                          >
                            <GitBranch className="w-3 h-3" /> New Rev
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {newRevision ? "New Revision" : "New Barlist"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Will be created from manifest name
                        </span>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                          onClick={() => { setCreateNewBarlist(false); setNewRevision(false); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Manifest Name
                </label>
                <Input value={manifestName} onChange={(e) => setManifestName(e.target.value)}
                  className="bg-card border-border" placeholder="e.g. 23 HALFORD ROAD - HAB (3)" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Customer
                </label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)}
                  className="bg-card border-border" placeholder="e.g. ACME CONCRETE" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Site Address
                </label>
                <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)}
                  className="bg-card border-border" placeholder="e.g. 123 MAIN ST" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Target ETA
                </label>
                <Input type="date" value={targetEta} onChange={(e) => setTargetEta(e.target.value)}
                  className="bg-card border-border" />
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileSelect} />

            {!uploadedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-xl p-16 flex flex-col items-center justify-center gap-4 bg-muted/20 hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-7 h-7 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-black italic text-foreground uppercase">Upload Drawing Ledger</h2>
                <p className="text-xs text-muted-foreground tracking-widest uppercase">
                  PDF · Spreadsheet (XLSX/CSV) · Image (PNG/JPG) · Any File
                </p>
              </div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!processing && (
                        <Button onClick={handleExtract} className="gap-1.5" disabled={!profile?.company_id}>
                          <Sparkles className="w-4 h-4" /> Extract & Map
                        </Button>
                      )}
                      {processing && (
                        <Badge variant="secondary" className="gap-1.5 text-xs py-1.5 px-3">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {processingStep}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={removeFile} disabled={processing}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Action Bar for active session */}
        {activeSession && !processing && activeSession.status !== "approved" && activeSession.status !== "rejected" && (
          <div className="flex items-center gap-2">
            {currentStepIndex >= 2 && currentStepIndex < 3 && (
              <Button onClick={handleApplyMapping} className="gap-1.5">
                <Globe className="w-4 h-4" /> Apply Mapping
              </Button>
            )}
            {currentStepIndex >= 3 && currentStepIndex < 4 && (
              <Button onClick={handleValidate} className="gap-1.5">
                <Shield className="w-4 h-4" /> Validate
              </Button>
            )}
            {currentStepIndex >= 4 && blockerCount === 0 && (
              <Button onClick={handleApprove} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> Approve & Create WO
              </Button>
            )}
            {processing && (
              <Badge variant="secondary" className="gap-1.5 text-xs py-1.5 px-3">
                <Loader2 className="w-3 h-3 animate-spin" />
                {processingStep}
              </Badge>
            )}

            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-1.5 ml-auto border-destructive/40 text-destructive hover:bg-destructive/10">
                  <XCircle className="w-4 h-4" /> Decline
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Decline this session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reject the extraction session. You can optionally provide a reason.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Reason for declining (optional)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[80px]"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setRejectReason("")}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReject}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirm Decline
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {activeSession?.status === "approved" && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-500">
              Session approved — work orders and cut plans have been created.
            </span>
          </div>
        )}

        {activeSession?.status === "rejected" && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <XCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm font-bold text-destructive">
              Session declined — no work orders were created.
            </span>
          </div>
        )}

        {/* Errors Panel */}
        {errors.length > 0 && (
          <Card className="border-destructive/30">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 text-destructive" />
                <span className="text-sm font-bold text-foreground">
                  {blockerCount} Blockers · {warningCount} Warnings
                </span>
              </div>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {errors.map((e) => (
                    <div
                      key={e.id}
                      className={`text-xs p-2 rounded ${
                        e.error_type === "blocker"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      <span className="font-bold uppercase mr-1">[{e.field}]</span>
                      {e.message}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black text-foreground">{stats.totalItems}</p>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Line Items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black text-foreground">{stats.totalPieces}</p>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Total Pieces</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {stats.barSizes.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mt-1">Bar Sizes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {stats.shapeTypes.slice(0, 6).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t || "straight"}</Badge>
                  ))}
                  {stats.shapeTypes.length > 6 && (
                    <Badge variant="outline" className="text-[10px]">+{stats.shapeTypes.length - 6}</Badge>
                  )}
                </div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mt-1">Shape Types</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {rows.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[55vh]">
                <div className="min-w-[1400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-bold tracking-wider w-[60px] sticky top-0 bg-muted/95 z-10">DWG#</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[40px] sticky top-0 bg-muted/95 z-10">#</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[60px] sticky top-0 bg-muted/95 z-10">GRADE</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[80px] sticky top-0 bg-muted/95 z-10">MARK</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[40px] text-center sticky top-0 bg-muted/95 z-10">QTY</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[50px] sticky top-0 bg-muted/95 z-10">SIZE</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[50px] sticky top-0 bg-muted/95 z-10">TYPE</TableHead>
                        <TableHead className="text-[10px] font-bold tracking-wider w-[70px] text-right sticky top-0 bg-muted/95 z-10">LENGTH</TableHead>
                        {dimCols.map((d) => (
                          <TableHead key={d} className="text-[10px] font-bold tracking-wider w-[50px] text-right sticky top-0 bg-muted/95 z-10">{d}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-mono">{row.dwg || "—"}</TableCell>
                          <TableCell className="text-xs">{row.row_index}</TableCell>
                          <TableCell className="text-xs">{row.grade_mapped || row.grade || "—"}</TableCell>
                          <TableCell className="text-xs font-bold text-primary">{row.mark || "—"}</TableCell>
                          <TableCell className="text-xs text-center font-bold">{row.quantity ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {row.bar_size_mapped || row.bar_size || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {(row.shape_code_mapped || row.shape_type) ? (
                              <Badge variant="outline" className="text-[10px]">
                                {row.shape_code_mapped || row.shape_type}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">STR</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">{row.total_length_mm ?? "—"}</TableCell>
                          {dimCols.map((d) => {
                            const key = `dim_${d.toLowerCase()}` as keyof typeof row;
                            return (
                              <TableCell key={d} className="text-xs text-right font-mono text-muted-foreground">
                                {row[key] != null ? String(row[key]) : ""}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    uploaded: { label: "UPLOADED", className: "bg-muted text-muted-foreground" },
    extracting: { label: "EXTRACTING", className: "bg-yellow-500/20 text-yellow-500" },
    extracted: { label: "EXTRACTED", className: "bg-blue-500/20 text-blue-500" },
    mapping: { label: "MAPPED", className: "bg-purple-500/20 text-purple-500" },
    validated: { label: "VALIDATED", className: "bg-emerald-500/20 text-emerald-500" },
    approved: { label: "APPROVED", className: "bg-emerald-600/20 text-emerald-400" },
    rejected: { label: "REJECTED", className: "bg-destructive/20 text-destructive" },
  };
  const s = map[status] || map.uploaded;
  return <Badge className={`${s.className} text-[10px] tracking-wider border-0`}>{s.label}</Badge>;
}
