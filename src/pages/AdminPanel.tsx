import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Shield, Plus, Pencil, Trash2, DollarSign, Users, Building2, Loader2,
  Activity, Lock,
} from "lucide-react";
import { useProfiles, useSalaries, type Profile, type EmployeeSalary } from "@/hooks/useProfiles";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { CEODashboardView } from "@/components/office/CEODashboardView";

const ADMIN_PIN = "7671";

const departments = [
  { value: "admin", label: "Administration" },
  { value: "office", label: "Office" },
  { value: "workshop", label: "Workshop" },
  { value: "field", label: "Field" },
];

const departmentColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500",
  office: "bg-blue-500/10 text-blue-500",
  workshop: "bg-amber-500/10 text-amber-500",
  field: "bg-green-500/10 text-green-500",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatSalary(salary: EmployeeSalary) {
  if (salary.salary_type === "hourly") {
    return `$${salary.salary_amount}/hr (~$${Math.round(salary.salary_amount * 2080).toLocaleString()}/yr)`;
  }
  return `$${salary.salary_amount.toLocaleString()}/yr`;
}

export default function AdminPanel() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { profiles, isLoading, createProfile, updateProfile, deleteProfile } = useProfiles();
  const { salaries, upsertSalary } = useSalaries();
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("employees");
  const [panelUnlocked, setPanelUnlocked] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);

  // Check PIN on complete
  useEffect(() => {
    if (pinValue.length === 4) {
      if (pinValue === ADMIN_PIN) {
        setPanelUnlocked(true);
        setPinError(false);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinValue("");
          setPinError(false);
        }, 800);
      }
    }
  }, [pinValue]);

  if (roleLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only administrators can access this panel.</p>
        </div>
      </div>
    );
  }

  if (!panelUnlocked) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">Admin Panel Locked</h2>
            <p className="text-sm text-muted-foreground">Enter the 4-digit PIN to access</p>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={4} value={pinValue} onChange={setPinValue}>
              <InputOTPGroup>
                <InputOTPSlot index={0} className={pinError ? "border-destructive" : ""} />
                <InputOTPSlot index={1} className={pinError ? "border-destructive" : ""} />
                <InputOTPSlot index={2} className={pinError ? "border-destructive" : ""} />
                <InputOTPSlot index={3} className={pinError ? "border-destructive" : ""} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {pinError && <p className="text-xs text-destructive">Incorrect PIN</p>}
        </div>
      </div>
    );
  }

  const getSalary = (profileId: string) => salaries.find((s) => s.profile_id === profileId);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await deleteProfile.mutateAsync(id);
    setDeleting(null);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="border-b border-border px-6 pt-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="employees" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="ceo-dashboard" className="gap-1.5 text-xs">
            <Activity className="w-3.5 h-3.5" />
            CEO Dashboard
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="employees" className="flex-1 mt-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Admin Panel
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Manage employees, roles, and compensation
                </p>
              </div>
              <Button onClick={() => setShowAdd(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Employee
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {departments.map((dept) => {
                const count = profiles.filter((p) => p.department === dept.value && p.is_active).length;
                return (
                  <Card key={dept.value} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${departmentColors[dept.value]}`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{dept.label}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Employee List */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((member) => {
                  const salary = getSalary(member.id);
                  return (
                    <Card key={member.id} className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="font-semibold bg-primary/10 text-primary">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{member.full_name}</h3>
                            {!member.is_active && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{member.title || "—"}</p>
                        </div>

                        <Badge variant="outline" className={`${departmentColors[member.department || "office"]} text-[10px]`}>
                          {departments.find((d) => d.value === member.department)?.label || member.department}
                        </Badge>

                        {salary && (
                          <div className="hidden sm:flex items-center gap-1 text-sm font-medium text-emerald-500">
                            <DollarSign className="w-4 h-4" />
                            {formatSalary(salary)}
                          </div>
                        )}

                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditingProfile(member)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(member.id)}
                            disabled={deleting === member.id}
                          >
                            {deleting === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Add/Edit Dialog */}
            <EmployeeDialog
              open={showAdd || !!editingProfile}
              profile={editingProfile}
              salary={editingProfile ? getSalary(editingProfile.id) : undefined}
              onClose={() => {
                setShowAdd(false);
                setEditingProfile(null);
              }}
              onSave={async (data, salaryData) => {
                if (editingProfile) {
                  await updateProfile.mutateAsync({ id: editingProfile.id, ...data });
                  if (salaryData) {
                    await upsertSalary.mutateAsync({ profile_id: editingProfile.id, ...salaryData });
                  }
                } else {
                  const result = await createProfile.mutateAsync(data as any);
                  if (salaryData && result) {
                    await upsertSalary.mutateAsync({ profile_id: result.id, ...salaryData });
                  }
                }
                setShowAdd(false);
                setEditingProfile(null);
              }}
            />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="ceo-dashboard" className="flex-1 mt-0 overflow-hidden">
        <ScrollArea className="h-full">
          <CEODashboardView />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

interface EmployeeDialogProps {
  open: boolean;
  profile: Profile | null;
  salary?: EmployeeSalary;
  onClose: () => void;
  onSave: (data: Partial<Profile>, salary?: { salary_amount: number; salary_type: string; notes: string | null }) => Promise<void>;
}

function EmployeeDialog({ open, profile, salary, onClose, onSave }: EmployeeDialogProps) {
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("office");
  const [duties, setDuties] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryType, setSalaryType] = useState("yearly");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(profile?.full_name || "");
      setTitle(profile?.title || "");
      setDepartment(profile?.department || "office");
      setDuties(profile?.duties?.join(", ") || "");
      setEmail(profile?.email || "");
      setPhone(profile?.phone || "");
      setIsActive(profile?.is_active ?? true);
      setSalaryAmount(salary?.salary_amount?.toString() || "");
      setSalaryType(salary?.salary_type || "yearly");
    }
  }, [open, profile, salary]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      const dutyArray = duties.split(",").map((d) => d.trim()).filter((d) => d.length > 0);
      const salaryData = salaryAmount
        ? { salary_amount: parseFloat(salaryAmount), salary_type: salaryType, notes: null }
        : undefined;
      await onSave(
        { full_name: fullName, title: title || null, department, duties: dutyArray, email: email || null, phone: phone || null, is_active: isActive, user_id: profile?.user_id || null },
        salaryData
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sales Manager" />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Duties (comma separated)</Label>
            <Textarea value={duties} onChange={(e) => setDuties(e.target.value)} placeholder="Sales management, Project management..." className="resize-none min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
          </div>
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <Label className="text-sm font-medium">Compensation</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} type="number" placeholder="65000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={salaryType} onValueChange={setSalaryType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Label>Active Employee</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!fullName.trim() || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {profile ? "Save Changes" : "Add Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
