import { useState, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Upload, Globe, FileText, Loader2, Truck, Package, Brain,
  CheckCircle2, AlertCircle, Sparkles, X, ArrowRight,
  Shield, TriangleAlert, Clock, ChevronRight, History, XCircle,
  FolderOpen, Plus, GitBranch, Pencil, Save, RotateCcw, Trash2,
  Zap, Ruler, Scissors,
} from "lucide-react";
import { runOptimization, type CutItem, type OptimizationSummary, type OptimizerConfig } from "@/lib/cutOptimizer";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
import brainHero from "@/assets/brain-hero.png";

type ManifestType = "delivery" | "pickup";

const PIPELINE_STEPS = [
  { key: "uploaded", label: "Uploaded", icon: Upload },
  { key: "extracting", label: "Extracting", icon: Sparkles },
  { key: "extracted", label: "Extracted", icon: FileText },
  { key: "mapping", label: "Mapped", icon: Globe },
  { key: "validated", label: "Validated", icon: Shield },
  { key: "optimizing", label: "Optimized", icon: Zap },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
] as const;

function getStepIndex(status: string) {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

export function AIExtractView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [manifestName, setManifestName] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [siteAddress, setSiteAddress] = useState("");
  const [targetEta, setTargetEta] = useState("");
  const [manifestType, setManifestType] = useState<ManifestType>("delivery");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");

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
  const optimizationPanelRef = useRef<HTMLDivElement>(null);

  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: string; name: string } | null>(null);

  // Optimization state
  const [optimizerConfig, setOptimizerConfig] = useState<OptimizerConfig>({
    stockLengthMm: 12000,
    kerfMm: 5,
    minRemnantMm: 300,
    mode: "best-fit",
  });
  const [optimizationResult, setOptimizationResult] = useState<OptimizationSummary | null>(null);
  const [selectedOptMode, setSelectedOptMode] = useState<OptimizerConfig["mode"] | null>(null);
  const [allModeResults, setAllModeResults] = useState<Record<string, OptimizationSummary>>({});
  const [isOptimizing, setIsOptimizing] = useState(false); // local flag for optimization panel visibility

  // Inline editing state
  const [editingRows, setEditingRows] = useState<Record<string, Record<string, any>>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);

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

  // All ERP customers + contacts for combobox (RLS handles company filtering)
  const { data: erpContacts = [] } = useQuery({
    queryKey: ["erp-contacts-all"],
    enabled: !!user,
    queryFn: async () => {
      // Paginate customers to get ALL (beyond 1000-row default limit)
      const PAGE = 1000;
      let allCusts: Array<{ id: string; name: string }> = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("customers").select("id, name").order("name").range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        allCusts = allCusts.concat(data as Array<{ id: string; name: string }>);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const { data: contactData } = await supabase.from("contacts").select("id, first_name, last_name, email, customer_id").order("first_name").limit(500);

      const custs = allCusts.map(c => ({ id: c.id, name: c.name, type: "customer" as const }));
      const contacts = (contactData ?? []).map(c => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") + (c.email ? ` (${c.email})` : ""),
        type: "contact" as const,
      }));
      return [...custs, ...contacts];
    },
  });
  

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

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim() || !profile?.company_id) return;
    setAddingCustomer(true);
    try {
      const { error } = await supabase.from("customers").insert({
        name: newCustomerName.trim(),
        company_id: profile.company_id,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["erp-contacts-all"] });
      setCustomer(newCustomerName.trim());
      setNewCustomerName("");
      setShowAddCustomer(false);
      toast({ title: "Customer added", description: newCustomerName.trim() });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingCustomer(false);
    }
  };

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
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
        invoiceNumber,
        invoiceDate,
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
      const result = await approveExtract(activeSessionId, {
        stockLengthMm: optimizerConfig.stockLengthMm,
        kerfMm: optimizerConfig.kerfMm,
        selectedMode: selectedOptMode || "best-fit",
      });
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

  const handleStartOptimize = async () => {
    if (!activeSessionId) return;
    setProcessing(true);
    setProcessingStep("Starting optimization...");
    try {
      // Set local flag immediately for UI visibility (DB update may fail due to RLS)
      setIsOptimizing(true);

      // Best-effort DB status update
      try {
        await supabase
          .from("extract_sessions")
          .update({ status: "optimizing" } as any)
          .eq("id", activeSessionId);
      } catch (_) { /* RLS may block — local flag handles UI */ }
      
      // Run all three modes for comparison
      const cutItems: CutItem[] = rows
        .filter(r => r.bar_size_mapped || r.bar_size)
        .map((r, i) => ({
          id: r.id,
          mark: r.mark || `Item ${i + 1}`,
          barSize: (r.bar_size_mapped || r.bar_size || "20M"),
          lengthMm: r.total_length_mm || 0,
          quantity: r.quantity || 1,
          shapeType: r.shape_code_mapped || r.shape_type || undefined,
        }));

      // Pre-compute all three modes for comparison
      const modes: OptimizerConfig["mode"][] = ["standard", "optimized", "best-fit"];
      const modeResults: Record<string, OptimizationSummary> = {};
      for (const mode of modes) {
        modeResults[mode] = runOptimization(cutItems, { ...optimizerConfig, mode });
      }
      setAllModeResults(modeResults);

      // Auto-select best-fit
      setOptimizationResult(modeResults["best-fit"]);
      setSelectedOptMode("best-fit");

      await refreshSessions();
      toast({ title: "Optimization ready", description: "Select your preferred cutting plan below." });
      // Auto-scroll to the optimization panel
      setTimeout(() => {
        optimizationPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  const runOptimizationForMode = (mode: OptimizerConfig["mode"]) => {
    const cutItems: CutItem[] = rows
      .filter(r => r.bar_size_mapped || r.bar_size)
      .map((r, i) => ({
        id: r.id,
        mark: r.mark || `Item ${i + 1}`,
        barSize: (r.bar_size_mapped || r.bar_size || "20M"),
        lengthMm: r.total_length_mm || 0,
        quantity: r.quantity || 1,
        shapeType: r.shape_code_mapped || r.shape_type || undefined,
      }));
    const config = { ...optimizerConfig, mode };
    const result = runOptimization(cutItems, config);
    setOptimizationResult(result);
    setSelectedOptMode(mode);
    setOptimizerConfig(config);
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
    setInvoiceNumber(session.invoice_number || "");
    setInvoiceDate(session.invoice_date || "");
    setShowHistory(false);
    setIsOptimizing(session.status === "optimizing");
    if (session.status !== "optimizing") {
      setOptimizationResult(null);
      setSelectedOptMode(null);
      setAllModeResults({});
    }
  };

  const startNew = () => {
    setActiveSessionId(null);
    setUploadedFile(null);
    setManifestName("");
    setCustomer("");
    setSiteAddress("");
    setTargetEta("");
    setInvoiceNumber("");
    setInvoiceDate("");
    setSelectedProjectId("");
    setSelectedBarlistId("");
    setCreateNewProject(false);
    setCreateNewBarlist(false);
    setNewRevision(false);
    setIsOptimizing(false);
    setOptimizationResult(null);
    setSelectedOptMode(null);
    setAllModeResults({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dimCols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

  // ─── Inline Editing Helpers ──────────────────────────────
  const startEditing = useCallback(() => {
    const edits: Record<string, Record<string, any>> = {};
    rows.forEach((row) => {
      edits[row.id] = {
        dwg: row.dwg ?? "",
        grade: row.grade_mapped || row.grade || "",
        mark: row.mark ?? "",
        quantity: row.quantity ?? 0,
        bar_size: row.bar_size_mapped || row.bar_size || "",
        shape_type: row.shape_code_mapped || row.shape_type || "",
        total_length_mm: row.total_length_mm ?? 0,
        ...Object.fromEntries(dimCols.map(d => [`dim_${d.toLowerCase()}`, (row as any)[`dim_${d.toLowerCase()}`] ?? ""])),
      };
    });
    setEditingRows(edits);
    setIsEditing(true);
  }, [rows]);

  const cancelEditing = () => {
    setEditingRows({});
    setIsEditing(false);
  };

  const updateEditField = (rowId: string, field: string, value: any) => {
    setEditingRows(prev => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: value },
    }));
  };

  const saveEdits = async () => {
    setSavingEdits(true);
    try {
      const updates = Object.entries(editingRows).map(([rowId, fields]) => {
        const updateData: Record<string, any> = {};
        // Map editable fields to DB columns
        if (fields.dwg !== undefined) updateData.dwg = fields.dwg || null;
        if (fields.grade !== undefined) updateData.grade = fields.grade || null;
        if (fields.mark !== undefined) updateData.mark = fields.mark || null;
        if (fields.quantity !== undefined) updateData.quantity = Number(fields.quantity) || 0;
        if (fields.bar_size !== undefined) updateData.bar_size = fields.bar_size || null;
        if (fields.shape_type !== undefined) updateData.shape_type = fields.shape_type || null;
        if (fields.total_length_mm !== undefined) updateData.total_length_mm = Number(fields.total_length_mm) || null;
        dimCols.forEach(d => {
          const key = `dim_${d.toLowerCase()}`;
          if (fields[key] !== undefined) updateData[key] = fields[key] !== "" ? Number(fields[key]) : null;
        });
        return supabase.from("extract_rows").update(updateData).eq("id", rowId);
      });
      await Promise.all(updates);
      await refreshRows();
      setIsEditing(false);
      setEditingRows({});
      toast({ title: "Changes saved", description: `${Object.keys(editingRows).length} rows updated` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdits(false);
    }
  };

  return (
    <div className="relative h-full">
      {/* Brain processing overlay */}
      {processing && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          {/* Dark backdrop */}
          <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
          
          {/* Outer glow */}
          <div
            className="absolute w-[80vw] h-[80vh] rounded-full opacity-20 blur-[80px]"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.6), hsl(var(--accent) / 0.2) 50%, transparent 70%)",
              animation: "brain-extract-pulse 3s ease-in-out infinite",
            }}
          />
          
          {/* Brain image */}
          <img
            src={brainHero}
            alt=""
            className="relative w-[35vh] h-[35vh] max-w-[400px] max-h-[400px] object-contain opacity-80 select-none"
            draggable={false}
            style={{
              mixBlendMode: "screen",
              filter: "drop-shadow(0 0 60px hsl(var(--primary) / 0.5))",
              animation: "brain-extract-float 4s ease-in-out infinite",
              maskImage: "radial-gradient(circle, white 15%, transparent 55%)",
              WebkitMaskImage: "radial-gradient(circle, white 15%, transparent 55%)",
            }}
          />
          
          {/* Processing step text */}
          <div className="relative mt-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20">
              <Brain className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary animate-pulse" style={{ animationDuration: '2s' }}>
                {processingStep}
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes brain-extract-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }
        @keyframes brain-extract-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.65; }
          50% { transform: translateY(-10px) scale(1.03); opacity: 0.8; }
        }
      `}</style>

      <ScrollArea className="h-full">
        <div className="p-6 space-y-6 w-full max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black italic text-foreground uppercase">
                {activeSession ? "Extract Session" : "Initialize Scope"}
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
          <div className="flex flex-wrap items-center gap-1">
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
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="flex-1 justify-between bg-card border-border text-left font-normal h-10">
                              {selectedProjectId
                                ? projects.find(p => p.id === selectedProjectId)?.name || "Select project..."
                                : "Select project..."}
                              <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0 z-50" align="start">
                            <Command>
                              <CommandInput placeholder="Search projects & customers..." />
                              <CommandList className="max-h-[300px]">
                                <CommandEmpty>No results found.</CommandEmpty>
                                {(() => {
                                  const customerMap = new Map(erpContacts.filter(c => c.type === "customer").map(c => [c.id, c.name]));
                                  const grouped = new Map<string, typeof projects>();
                                  const ungrouped: typeof projects = [];
                                  projects.forEach(p => {
                                    if (p.customer_id && customerMap.has(p.customer_id)) {
                                      const name = customerMap.get(p.customer_id)!;
                                      if (!grouped.has(name)) grouped.set(name, []);
                                      grouped.get(name)!.push(p);
                                    } else {
                                      ungrouped.push(p);
                                    }
                                  });
                                  return (
                                    <>
                                      {Array.from(grouped.entries()).map(([custName, custProjects]) => (
                                        <CommandGroup key={custName} heading={custName}>
                                          {custProjects.map((p) => (
                                            <CommandItem key={p.id} value={`${custName} ${p.name}`} onSelect={() => {
                                              setSelectedProjectId(p.id);
                                              setSelectedBarlistId("");
                                              setCustomer(custName);
                                              if (!manifestName) setManifestName(p.name);
                                            }} className="flex items-center justify-between">
                                              <span>{p.name}</span>
                                              <button
                                                className="ml-2 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDeleteProjectConfirm({ id: p.id, name: p.name });
                                                }}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      ))}
                                      {ungrouped.length > 0 && (
                                        <CommandGroup heading="Other Projects">
                                          {ungrouped.map((p) => (
                                            <CommandItem key={p.id} value={p.name} onSelect={() => {
                                              setSelectedProjectId(p.id);
                                              setSelectedBarlistId("");
                                              if (!manifestName) setManifestName(p.name);
                                            }} className="flex items-center justify-between">
                                              <span>{p.name}</span>
                                              <button
                                                className="ml-2 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDeleteProjectConfirm({ id: p.id, name: p.name });
                                                }}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      )}
                                    </>
                                  );
                                })()}
                                <CommandGroup heading="Customers">
                                  {erpContacts.filter(c => c.type === "customer").map((c) => (
                                    <CommandItem key={`cust-${c.id}`} value={c.name} onSelect={() => {
                                      setCreateNewProject(true);
                                      setNewProjectName(c.name);
                                      setCustomer(c.name);
                                      if (!manifestName) setManifestName(c.name);
                                      setSelectedBarlistId("");
                                    }}>
                                      + {c.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Scope <span className="text-destructive">*</span>
                </label>
                <Input value={manifestName} onChange={(e) => setManifestName(e.target.value)}
                  className="bg-card border-border" placeholder="e.g. 23 HALFORD ROAD - HAB (3)" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Customer
                </label>
                <div className="flex gap-1.5">
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between bg-card border-border font-normal">
                        {customer || "Select customer..."}
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Search customers & contacts..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>No results found.</CommandEmpty>
                          {erpContacts.filter(c => c.type === "customer").length > 0 && (
                            <CommandGroup heading="Customers">
                              {erpContacts.filter(c => c.type === "customer").map((c) => (
                                <CommandItem key={c.id} value={c.name} onSelect={() => {
                                  setCustomer(c.name);
                                  setCustomerOpen(false);
                                }}>
                                  <span>{c.name}</span>
                                  <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">Customer</Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                          {erpContacts.filter(c => c.type === "contact").length > 0 && (
                            <CommandGroup heading="Contacts">
                              {erpContacts.filter(c => c.type === "contact").map((c) => (
                                <CommandItem key={c.id} value={c.name} onSelect={() => {
                                  setCustomer(c.name);
                                  setCustomerOpen(false);
                                }}>
                                  <span>{c.name}</span>
                                  <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">Contact</Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => setShowAddCustomer(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Add New Customer</DialogTitle>
                    </DialogHeader>
                    <Input
                      placeholder="Customer name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCustomer()}
                      autoFocus
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                      <Button onClick={handleAddCustomer} disabled={!newCustomerName.trim() || addingCustomer}>
                        {addingCustomer ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        Add
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Invoice Number
                </label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="bg-card border-border" placeholder="e.g. INV-2026-001" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
                  Invoice Date
                </label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
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
                        <Button onClick={handleExtract} className="gap-1.5" disabled={!uploadedFile || !profile?.company_id || !manifestName.trim() || (!selectedProjectId && !(createNewProject && newProjectName.trim()))}>
                          <Sparkles className="w-4 h-4" /> Extract & Map
                        </Button>
                      )}
                      {processing && (
                        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                          <div className="relative flex items-center justify-center w-6 h-6">
                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                            <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                            <Brain className="w-4 h-4 text-primary relative z-10 animate-pulse" style={{ animationDuration: '1.5s' }} />
                          </div>
                          <span className="text-xs font-medium text-primary animate-pulse" style={{ animationDuration: '2s' }}>
                            {processingStep}
                          </span>
                        </div>
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
            {currentStepIndex === 4 && blockerCount === 0 && !isOptimizing && (
              <Button onClick={handleStartOptimize} className="gap-1.5">
                <Zap className="w-4 h-4" /> Optimize
              </Button>
            )}
            {(currentStepIndex >= 5 || isOptimizing) && (
              <>
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40 bg-amber-500/10 py-1 px-2.5">
                  <Zap className="w-3 h-3 mr-1" /> Select a cutting plan below, then click Approve
                </Badge>
                <Button onClick={handleApprove} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Approve & Create WO
                </Button>
              </>
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

        {/* Optimization Panel — rendered above the table for visibility */}
        {(activeSession?.status === "optimizing" || isOptimizing) && (
          <Card ref={optimizationPanelRef} className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold tracking-widest text-foreground uppercase">Cut Optimization</h3>
              </div>

              {/* Config row */}
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1 block">Stock Length</label>
                  <Select
                    value={String(optimizerConfig.stockLengthMm)}
                    onValueChange={(v) => {
                      setOptimizerConfig(prev => ({ ...prev, stockLengthMm: Number(v) }));
                    }}
                  >
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6000">6M (6,000mm)</SelectItem>
                      <SelectItem value="12000">12M (12,000mm)</SelectItem>
                      <SelectItem value="18000">18M (18,000mm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1 block">Kerf (mm)</label>
                  <Input
                    type="number"
                    className="w-20 h-9 text-xs"
                    value={optimizerConfig.kerfMm}
                    onChange={(e) => setOptimizerConfig(prev => ({ ...prev, kerfMm: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1 block">Min Remnant (mm)</label>
                  <Input
                    type="number"
                    className="w-24 h-9 text-xs"
                    value={optimizerConfig.minRemnantMm}
                    onChange={(e) => setOptimizerConfig(prev => ({ ...prev, minRemnantMm: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Mode cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { mode: "standard" as const, label: "Standard", desc: "Sequential, fewer stopper moves" },
                  { mode: "optimized" as const, label: "Optimized (FFD)", desc: "First Fit Decreasing bin-pack" },
                  { mode: "best-fit" as const, label: "Best Fit (BFD)", desc: "Tightest fit, least waste" },
                ]).map(({ mode, label, desc }) => {
                  const isSelected = selectedOptMode === mode;
                  const modeResult = allModeResults[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => runOptimizationForMode(mode)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Scissors className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3">{desc}</p>
                      {modeResult && (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Stock Bars:</span>
                            <span className="font-bold text-foreground">{modeResult.totalStockBars}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Efficiency:</span>
                            <span className="font-bold text-foreground">{modeResult.overallEfficiency.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Waste:</span>
                            <span className="font-bold text-foreground">{modeResult.totalWasteKg.toFixed(1)} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Stopper Moves:</span>
                            <span className="font-bold text-foreground">{modeResult.totalStopperMoves}</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {optimizationResult && selectedOptMode && (
                <div className="flex items-center gap-3 pt-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs py-1 px-3">
                    {optimizationResult.totalCuts} cuts · {optimizationResult.totalStockBars} bars · {optimizationResult.overallEfficiency.toFixed(1)}% efficiency
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeSession && activeSession.status === "extracting" && !processing && (
          <div className="relative flex flex-col items-center justify-center py-24 gap-6 overflow-hidden rounded-xl">
            {/* Pulsing glow rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            </div>

            {/* Brain icon with pulse */}
            <div className="relative z-10">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center animate-pulse" style={{ animationDuration: '1.5s' }}>
                <svg viewBox="0 0 24 24" className="w-14 h-14 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a5 5 0 0 1 4.5 2.8A4 4 0 0 1 20 9a4 4 0 0 1-1.5 3.1A5 5 0 0 1 17 17H7a5 5 0 0 1-1.5-4.9A4 4 0 0 1 4 9a4 4 0 0 1 3.5-4.2A5 5 0 0 1 12 2z" />
                  <path d="M12 2v20" opacity="0.4" />
                  <path d="M8 8h.01M16 8h.01M9 13a3 3 0 0 0 6 0" opacity="0.4" />
                </svg>
              </div>
              {/* Blinking dots around the brain */}
              {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                <span
                  key={deg}
                  className="absolute w-2 h-2 rounded-full bg-primary"
                  style={{
                    top: `${50 - 46 * Math.cos((deg * Math.PI) / 180)}%`,
                    left: `${50 + 46 * Math.sin((deg * Math.PI) / 180)}%`,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10 text-center space-y-1.5">
              <h3 className="text-sm font-bold text-foreground tracking-wide">AI Brain is Thinking…</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Analyzing your manifest. This may take up to 2 minutes for large files.
              </p>
            </div>
            <Button variant="outline" size="sm" className="relative z-10 gap-1.5 text-xs" onClick={() => { refreshSessions(); refreshRows(); }}>
              <Clock className="w-3.5 h-3.5" /> Refresh Status
            </Button>
          </div>
        )}

        {/* (Optimization panel moved above the table) */}

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
              {/* Edit toolbar */}
              {activeSession && activeSession.status !== "approved" && activeSession.status !== "rejected" && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                  <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    {rows.length} Line Items
                  </span>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={startEditing}>
                        <Pencil className="w-3 h-3" /> Edit Rows
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={cancelEditing} disabled={savingEdits}>
                          <RotateCcw className="w-3 h-3" /> Cancel
                        </Button>
                        <Button size="sm" className="gap-1.5 text-xs h-8" onClick={saveEdits} disabled={savingEdits}>
                          {savingEdits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          {savingEdits ? "Saving..." : "Save & Confirm"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="h-[55vh] overflow-auto max-w-full">
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
                      {rows.map((row) => {
                        const edit = isEditing ? editingRows[row.id] : null;
                        return (
                          <TableRow key={row.id} className={`hover:bg-muted/30 ${isEditing ? "bg-primary/[0.02]" : ""}`}>
                            <TableCell className="text-xs font-mono p-1">
                              {edit ? (
                                <input className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-mono" value={edit.dwg} onChange={e => updateEditField(row.id, "dwg", e.target.value)} />
                              ) : (row.dwg || "—")}
                            </TableCell>
                            <TableCell className="text-xs p-1">{row.row_index}</TableCell>
                            <TableCell className="text-xs p-1">
                              {edit ? (
                                <input className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs" value={edit.grade} onChange={e => updateEditField(row.id, "grade", e.target.value)} />
                              ) : (row.grade_mapped || row.grade || "—")}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-primary p-1">
                              {edit ? (
                                <input className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs font-bold" value={edit.mark} onChange={e => updateEditField(row.id, "mark", e.target.value)} />
                              ) : (row.mark || "—")}
                            </TableCell>
                            <TableCell className="text-xs text-center font-bold p-1">
                              {edit ? (
                                <input type="number" className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-center font-bold" value={edit.quantity} onChange={e => updateEditField(row.id, "quantity", e.target.value)} />
                              ) : (row.quantity ?? "—")}
                            </TableCell>
                            <TableCell className="text-xs p-1">
                              {edit ? (
                                <input className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs" value={edit.bar_size} onChange={e => updateEditField(row.id, "bar_size", e.target.value)} />
                              ) : (
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                  {row.bar_size_mapped || row.bar_size || "—"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs p-1">
                              {edit ? (
                                <input className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs" value={edit.shape_type} onChange={e => updateEditField(row.id, "shape_type", e.target.value)} />
                              ) : (
                                (row.shape_code_mapped || row.shape_type) ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    {row.shape_code_mapped || row.shape_type}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">STR</span>
                                )
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono p-1">
                              {edit ? (
                                <input type="number" className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-mono" value={edit.total_length_mm} onChange={e => updateEditField(row.id, "total_length_mm", e.target.value)} />
                              ) : (row.total_length_mm ?? "—")}
                            </TableCell>
                            {dimCols.map((d) => {
                              const key = `dim_${d.toLowerCase()}`;
                              return (
                                <TableCell key={d} className="text-xs text-right font-mono text-muted-foreground p-1">
                                  {edit ? (
                                    <input type="number" className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-right font-mono" value={edit[key] ?? ""} onChange={e => updateEditField(row.id, key, e.target.value)} />
                                  ) : (
                                    (row as any)[key] != null ? String((row as any)[key]) : ""
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>

    {/* Delete project confirmation dialog */}
    <AlertDialog open={!!deleteProjectConfirm} onOpenChange={(open) => { if (!open) setDeleteProjectConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{deleteProjectConfirm?.name}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={async () => {
              if (!deleteProjectConfirm) return;
              const { error } = await supabase.from("projects").delete().eq("id", deleteProjectConfirm.id);
              if (error) {
                toast({ title: "Error deleting project", description: error.message, variant: "destructive" });
                setDeleteProjectConfirm(null);
                return;
              }
              if (selectedProjectId === deleteProjectConfirm.id) { setSelectedProjectId(""); setSelectedBarlistId(""); }
              setDeleteProjectConfirm(null);
              toast({ title: "Project deleted" });
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    uploaded: { label: "UPLOADED", className: "bg-muted text-muted-foreground" },
    extracting: { label: "EXTRACTING", className: "bg-yellow-500/20 text-yellow-500" },
    extracted: { label: "EXTRACTED", className: "bg-blue-500/20 text-blue-500" },
    mapping: { label: "MAPPED", className: "bg-purple-500/20 text-purple-500" },
    validated: { label: "VALIDATED", className: "bg-emerald-500/20 text-emerald-500" },
    optimizing: { label: "OPTIMIZED", className: "bg-amber-500/20 text-amber-500" },
    approved: { label: "APPROVED", className: "bg-emerald-600/20 text-emerald-400" },
    rejected: { label: "REJECTED", className: "bg-destructive/20 text-destructive" },
  };
  const s = map[status] || map.uploaded;
  return <Badge className={`${s.className} text-[10px] tracking-wider border-0`}>{s.label}</Badge>;
}
