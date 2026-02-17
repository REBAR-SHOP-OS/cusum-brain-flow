import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  User, Users, Settings,
  Sparkles, Tag, LayoutGrid, UserPlus, MoreHorizontal,
  Crown, Briefcase, HardHat, Truck as TruckIcon, Camera, ImagePlus, Loader2, CheckCircle2, Globe,
} from "lucide-react";

import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { BulkAvatarUploadDialog } from "@/components/settings/BulkAvatarUploadDialog";
import { AiVisionUploadDialog, type UploadedSchematic } from "@/components/office/AiVisionUploadDialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/brand-logo.png";

// ── Language options ──
const languageOptions = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "fa", label: "فارسی", flag: "🇮🇷" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
];

function getLangLabel(code: string) {
  return languageOptions.find((l) => l.value === code) || { value: code, label: code, flag: "🌐" };
}

// (ASA shape data removed – real shapes come from DB)

// ── Helpers ──
const departmentConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Owner", icon: Crown, color: "bg-amber-500" },
  office: { label: "Office", icon: Briefcase, color: "bg-blue-500" },
  workshop: { label: "Workshop", icon: HardHat, color: "bg-orange-500" },
  field: { label: "Field", icon: TruckIcon, color: "bg-green-500" },
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const avatarColors = [
  "bg-violet-500","bg-amber-500","bg-pink-500","bg-teal-500","bg-blue-500",
  "bg-red-500","bg-emerald-500","bg-indigo-500","bg-orange-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ── Main Component ──
export function MemberAreaView() {
  const [mainTab, setMainTab] = useState<"my-profile" | "team-access" | "system-config">("team-access");
  const [configTab, setConfigTab] = useState("general");
  const [companyName, setCompanyName] = useState("REBAR.SHOP AI");
  const [measurement, setMeasurement] = useState<"metric" | "imperial">("metric");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">Member Area</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your profile, organization team members, and system configuration.
          </p>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {([
            { id: "my-profile" as const, label: "My Profile", icon: User },
            { id: "team-access" as const, label: "Team Access", icon: Users },
            { id: "system-config" as const, label: "System Config", icon: Settings },
          ]).map((tab) => (
            <Button
              key={tab.id}
              variant={mainTab === tab.id ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setMainTab(tab.id)}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {mainTab === "my-profile" && <MyProfileTab />}
        {mainTab === "team-access" && <TeamAccessTab />}
        {mainTab === "system-config" && (
          <SystemConfigTab
            configTab={configTab}
            setConfigTab={setConfigTab}
            companyName={companyName}
            setCompanyName={setCompanyName}
            measurement={measurement}
            setMeasurement={setMeasurement}
          />
        )}
      </ScrollArea>
    </div>
  );
}

// ── My Profile Tab ──
function MyProfileTab() {
  const { user } = useAuth();
  const { profiles, updateProfile } = useProfiles();
  const { uploading, uploadSingle } = useAvatarUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const myProfile = profiles.find((p) => p.user_id === user?.id);

  const [fullName, setFullName] = useState(myProfile?.full_name || "");
  const [title, setTitle] = useState(myProfile?.title || "");

  useEffect(() => {
    if (myProfile) {
      setFullName(myProfile.full_name);
      setTitle(myProfile.title || "");
    }
  }, [myProfile]);

  const handleSave = () => {
    if (!myProfile || updateProfile.isPending) return;
    updateProfile.mutate({
      id: myProfile.id,
      full_name: fullName.trim(),
      title: title.trim() || null,
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfile) return;
    await uploadSingle(myProfile.id, file);
  };

  const handleLanguageChange = (lang: string) => {
    if (!myProfile) return;
    updateProfile.mutate({ id: myProfile.id, preferred_language: lang });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-16 h-16">
                <AvatarImage src={myProfile?.avatar_url || ""} />
                <AvatarFallback className={cn("text-white text-xl font-bold", getAvatarColor(myProfile?.full_name || "U"))}>
                  {getInitials(myProfile?.full_name || user?.email || "U")}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" /> : <Camera className="w-3.5 h-3.5 text-primary-foreground" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{myProfile?.full_name || user?.email}</h2>
              <Badge className="text-[9px] uppercase tracking-widest">{myProfile?.department || "Member"}</Badge>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Email</label>
              <Input defaultValue={myProfile?.email || user?.email || ""} className="h-10" disabled />
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Job Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Preferred Language</label>
              <Select value={myProfile?.preferred_language || "en"} onValueChange={handleLanguageChange}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Team Hub messages will be translated to this language for you.</p>
            </div>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Team Access Tab (merged from SettingsPeople) ──
function TeamAccessTab() {
  const { profiles, isLoading, createProfile, updateProfile } = useProfiles();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { uploading, uploadSingle } = useAvatarUpload();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({ full_name: "", email: "", title: "", department: "office", preferred_language: "en" });

  const activeProfiles = profiles.filter((p) => p.is_active !== false);

  const handleAddMember = () => {
    if (!newMember.full_name.trim()) return;
    createProfile.mutate({
      full_name: newMember.full_name.trim(),
      email: newMember.email.trim() || null,
      title: newMember.title.trim() || null,
      department: newMember.department,
      duties: [],
      user_id: null,
      phone: null,
      avatar_url: null,
      is_active: true,
      preferred_language: newMember.preferred_language,
    }, {
      onSuccess: () => {
        setNewMember({ full_name: "", email: "", title: "", department: "office", preferred_language: "en" });
        setAddDialogOpen(false);
      },
    });
  };

  const handleAvatarUpload = (profileId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadSingle(profileId, file);
    };
    input.click();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Team Members</h3>
          <Badge variant="secondary" className="text-xs">{activeProfiles.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <BulkAvatarUploadDialog profiles={activeProfiles} />
          {isAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <UserPlus className="w-4 h-4" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Full name</Label>
                    <Input value={newMember.full_name} onChange={(e) => setNewMember((p) => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={newMember.email} onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))} placeholder="john@rebar.shop" type="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Job title</Label>
                    <Input value={newMember.title} onChange={(e) => setNewMember((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Sales Manager" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Select value={newMember.department} onValueChange={(v) => setNewMember((p) => ({ ...p, department: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="workshop">Workshop</SelectItem>
                        <SelectItem value="field">Field</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Language</Label>
                    <Select value={newMember.preferred_language} onValueChange={(v) => setNewMember((p) => ({ ...p, preferred_language: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {languageOptions.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            <span className="flex items-center gap-2">
                              <span>{lang.flag}</span>
                              <span>{lang.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddMember} className="w-full" disabled={!newMember.full_name.trim()}>
                    Add Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-1">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading members...</div>
        ) : (
          activeProfiles.map((profile) => {
            const dept = departmentConfig[profile.department || "office"] || departmentConfig.office;
            const isCurrentUser = profile.user_id === user?.id;
            const isOwner = profile.department === "admin";

            return (
              <div
                key={profile.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group"
              >
                {/* Avatar with upload on click */}
                <div className="relative cursor-pointer" onClick={() => handleAvatarUpload(profile.id)}>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={profile.avatar_url || ""} />
                    <AvatarFallback className={cn("text-white text-sm font-medium", getAvatarColor(profile.full_name))}>
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{profile.full_name}</span>
                    {isCurrentUser && <Badge variant="outline" className="text-[10px] px-1.5 py-0">you</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">
                    {profile.email || profile.title || "No email"}
                  </span>
                </div>

                {/* Role & Language badges */}
                <div className="flex items-center gap-2">
                  {/* Language badge */}
                  <Badge variant="outline" className="text-[10px] gap-1 font-normal">
                    <Globe className="w-3 h-3" />
                    {getLangLabel(profile.preferred_language || "en").flag} {getLangLabel(profile.preferred_language || "en").label}
                  </Badge>

                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-medium gap-1",
                      isOwner && "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    <dept.icon className="w-3 h-3" />
                    {isOwner ? "Owner" : dept.label}
                  </Badge>

                  {isAdmin && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleAvatarUpload(profile.id)}>
                          <Camera className="w-3.5 h-3.5 mr-2" /> Upload Photo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "admin" })}>Set as Admin</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "office" })}>Set as Office</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "workshop" })}>Set as Workshop</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "field" })}>Set as Field</DropdownMenuItem>
                        <div className="px-2 py-1.5">
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">Language</p>
                          <Select
                            value={profile.preferred_language || "en"}
                            onValueChange={(lang) => updateProfile.mutate({ id: profile.id, preferred_language: lang })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {languageOptions.map((lang) => (
                                <SelectItem key={lang.value} value={lang.value}>
                                  {lang.flag} {lang.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <DropdownMenuItem className="text-destructive" onClick={() => updateProfile.mutate({ id: profile.id, is_active: false })}>
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── System Config Tab ──
interface SystemConfigProps {
  configTab: string;
  setConfigTab: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  measurement: "metric" | "imperial";
  setMeasurement: (v: "metric" | "imperial") => void;
}

function SystemConfigTab({
  configTab, setConfigTab, companyName, setCompanyName,
  measurement, setMeasurement,
}: SystemConfigProps) {
  const [aiVisionOpen, setAiVisionOpen] = useState(false);
  const [savedSchematics, setSavedSchematics] = useState<UploadedSchematic[]>([]);
  const [loadingSchematics, setLoadingSchematics] = useState(false);

  // Load existing schematics from DB
  const loadSchematics = async () => {
    setLoadingSchematics(true);
    try {
      const { data, error } = await supabase
        .from("custom_shape_schematics")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setSavedSchematics(data as UploadedSchematic[]);
      }
    } catch {
      // silent
    } finally {
      setLoadingSchematics(false);
    }
  };

  useEffect(() => {
    if (configTab === "asa-shapes") {
      loadSchematics();
    }
  }, [configTab]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* Config sub-tabs */}
      <div className="flex bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setConfigTab("general")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${
            configTab === "general" ? "bg-background text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="w-4 h-4" /> General Setup
        </button>
        <button
          onClick={() => setConfigTab("asa-shapes")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${
            configTab === "asa-shapes" ? "bg-background text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> aSa Shape Engine
        </button>
      </div>

      {configTab === "general" && (
        <Card>
          <CardContent className="p-6 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Organizational Identity</h3>
              </div>
              <div className="flex items-start gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-muted border border-border/30 flex items-center justify-center overflow-hidden">
                    <img src={brandLogo} alt="Corporate Seal" className="w-16 h-16 object-contain" />
                  </div>
                  <div>
                    <label className="text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Company Name</label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-56 h-10 font-bold text-sm" />
                    <button className="text-[11px] text-primary font-semibold uppercase tracking-widest mt-2 hover:text-primary/80">
                      Update Corporate Seal
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Standard Logic</h3>
              </div>
              <Card className="border-border">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground uppercase">System of Measurement</p>
                    <p className="text-xs text-muted-foreground">Determines the authoritative length calculations and export formats.</p>
                  </div>
                  <div className="flex items-center bg-muted rounded-lg p-0.5">
                    <Button variant={measurement === "metric" ? "default" : "ghost"} size="sm" className="h-9 px-5 text-xs font-bold" onClick={() => setMeasurement("metric")}>METRIC (MM)</Button>
                    <Button variant={measurement === "imperial" ? "default" : "ghost"} size="sm" className="h-9 px-5 text-xs font-bold" onClick={() => setMeasurement("imperial")}>IMPERIAL (FT-IN)</Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <div className="flex justify-center">
              <Button size="lg" className="gap-2 px-12 h-12 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" /> Authorize System Global Change
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {configTab === "asa-shapes" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black italic text-foreground uppercase">ASA Standard Renderings</h2>
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Cross-Reference Mappings for Machine Routing</p>
            </div>
            <Button
              className="gap-1.5"
              onClick={() => setAiVisionOpen(true)}
            >
              <Sparkles className="w-4 h-4" />
              AI Vision Assign
            </Button>
          </div>

          {/* AI Vision Upload Dialog */}
          <AiVisionUploadDialog
            open={aiVisionOpen}
            onOpenChange={setAiVisionOpen}
            onUploadsComplete={loadSchematics}
          />

          {/* Uploaded shapes from DB — or empty state */}
          {!loadingSchematics && savedSchematics.length === 0 && (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="p-10 flex flex-col items-center gap-3 text-center">
                <ImagePlus className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No shapes uploaded yet</p>
                <p className="text-xs text-muted-foreground">Click "AI Vision Assign" to upload and tag your shape schematics</p>
              </CardContent>
            </Card>
          )}

          {/* Saved schematics from DB */}
          {savedSchematics.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                  Uploaded Shapes ({savedSchematics.length})
                </h3>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {savedSchematics.map((s) => {
                  let analysisInfo: string | undefined;
                  try {
                    const parsed = s.ai_analysis ? JSON.parse(s.ai_analysis) : null;
                    analysisInfo = parsed?.description || parsed?.shape_code;
                  } catch { /* ignore */ }

                  return (
                    <div key={s.id} className="rounded-lg border border-primary/30 bg-primary/5 p-2 flex flex-col items-center gap-1">
                      <img src={s.image_url} alt={s.shape_code} className="w-full aspect-square object-contain rounded" />
                      <span className="text-[10px] font-bold text-primary">{s.shape_code}</span>
                      {analysisInfo && <span className="text-[8px] text-muted-foreground truncate w-full text-center">{analysisInfo}</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {loadingSchematics && (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
