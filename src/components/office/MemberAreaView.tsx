import { useState, useRef } from "react";
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
  User, Users, Settings, Upload, CheckCircle2,
  Sparkles, Tag, LayoutGrid, UserPlus, MoreHorizontal,
  Crown, Briefcase, HardHat, Truck as TruckIcon, Camera, ImagePlus, Loader2,
} from "lucide-react";
import { AsaShapeDiagram } from "@/components/shopfloor/AsaShapeDiagram";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { BulkAvatarUploadDialog } from "@/components/settings/BulkAvatarUploadDialog";
import { cn } from "@/lib/utils";
import brandLogo from "@/assets/brand-logo.png";

// ── ASA Shape data ──
const asaStandardShapes = [
  { code: "STR", num: "S", name: "STRAIGHT BAR" },
  { code: "1", num: "1", name: "HOOKED (ONE END)" },
  { code: "2", num: "2", name: "U-SHAPE (ASA TYPE 2)" },
  { code: "3", num: "3", name: "OFFSET / CRANE" },
  { code: "4", num: "4", name: "T1 STIRRUP / TIE" },
  { code: "5", num: "5", name: "DOUBLE CRANE" },
  { code: "17", num: "17", name: "L-SHAPE (ASA 17)" },
  { code: "T3", num: "T3", name: "HOOP / SPIRAL" },
];

const allShapeCodes = [
  "1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16",
  "17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32",
  "S2","S12","S11","S14","S4","S13","T9","T8","T3","T4","S6","T17","S8","S3","T8","T16",
  "COIL","X","T2","Y","T7","S7","T12","S15","T14","S9","T5","T15","T10","T1","S1","S5",
  "T13","T11","S",
];

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
  const [customCode, setCustomCode] = useState("");

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
            customCode={customCode}
            setCustomCode={setCustomCode}
          />
        )}
      </ScrollArea>
    </div>
  );
}

// ── My Profile Tab ──
function MyProfileTab() {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const { uploading, uploadSingle } = useAvatarUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const myProfile = profiles.find((p) => p.user_id === user?.id);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfile) return;
    await uploadSingle(myProfile.id, file);
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
              <Input defaultValue={myProfile?.full_name || ""} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Email</label>
              <Input defaultValue={myProfile?.email || user?.email || ""} className="h-10" disabled />
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Job Title</label>
              <Input defaultValue={myProfile?.title || ""} className="h-10" />
            </div>
          </div>
          <Button className="w-full">Save Changes</Button>
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
  const [newMember, setNewMember] = useState({ full_name: "", email: "", title: "", department: "office" });

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
    }, {
      onSuccess: () => {
        setNewMember({ full_name: "", email: "", title: "", department: "office" });
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

                {/* Role badge */}
                <div className="flex items-center gap-2">
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
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAvatarUpload(profile.id)}>
                          <Camera className="w-3.5 h-3.5 mr-2" /> Upload Photo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "admin" })}>Set as Admin</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "office" })}>Set as Office</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "workshop" })}>Set as Workshop</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProfile.mutate({ id: profile.id, department: "field" })}>Set as Field</DropdownMenuItem>
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
  customCode: string;
  setCustomCode: (v: string) => void;
}

function SystemConfigTab({
  configTab, setConfigTab, companyName, setCompanyName,
  measurement, setMeasurement, customCode, setCustomCode,
}: SystemConfigProps) {
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
            <Button className="gap-1.5"><Sparkles className="w-4 h-4" /> AI Vision Assign</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {asaStandardShapes.map((shape) => (
              <Card key={shape.code} className="border-border hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="flex items-start justify-between w-full">
                    <span className="w-7 h-7 rounded-full border-2 border-foreground flex items-center justify-center text-xs font-bold">{shape.num}</span>
                  </div>
                  <AsaShapeDiagram shapeCode={shape.code === "STR" ? "1" : shape.code} size="sm" />
                  <div className="text-center">
                    <p className="text-sm font-black text-primary">{shape.code}</p>
                    <p className="text-[9px] tracking-widest text-muted-foreground uppercase">{shape.name}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Custom Mapping Override</h3>
            </div>
            <div className="flex gap-3">
              <Input placeholder="Type Code (E.G. S1)" value={customCode} onChange={(e) => setCustomCode(e.target.value)} className="flex-1 h-11" />
              <Button className="gap-1.5 h-11 px-5"><Upload className="w-4 h-4" /> Upload Schematic</Button>
            </div>
          </section>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {allShapeCodes.map((code, i) => (
              <div key={`${code}-${i}`} className="aspect-square rounded-lg border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 p-2">
                <div className="flex-1 flex items-center justify-center w-full">
                  <AsaShapeDiagram shapeCode={code} size="sm" />
                </div>
                <span className="text-[10px] font-bold text-primary">{code}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <Button size="lg" className="gap-2 px-12 h-12 text-sm font-bold">
              <CheckCircle2 className="w-4 h-4" /> Authorize System Global Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
