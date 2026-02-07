import { useState } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserPlus, Crown, Shield, Briefcase, HardHat, Truck as TruckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const departmentConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Owner", icon: Crown, color: "bg-amber-500" },
  office: { label: "Office", icon: Briefcase, color: "bg-blue-500" },
  workshop: { label: "Workshop", icon: HardHat, color: "bg-orange-500" },
  field: { label: "Field", icon: TruckIcon, color: "bg-green-500" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = [
  "bg-violet-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-orange-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function SettingsPeople() {
  const { profiles, isLoading, createProfile, updateProfile, deleteProfile } = useProfiles();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({ full_name: "", email: "", title: "", department: "office" });

  const activeProfiles = profiles.filter((p) => p.is_active !== false);

  const handleAddMember = async () => {
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

  const handleRemoveMember = async (profileId: string) => {
    updateProfile.mutate({ id: profileId, is_active: false });
  };

  const handleRoleChange = async (profileId: string, department: string) => {
    updateProfile.mutate({ id: profileId, department });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">People</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your team members and their access levels.
        </p>
      </div>

      {/* Members Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Members</h3>
          <Badge variant="secondary" className="text-xs">{activeProfiles.length}</Badge>
        </div>

        {isAdmin && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <UserPlus className="w-4 h-4" />
                Add Members
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input
                    value={newMember.full_name}
                    onChange={(e) => setNewMember((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={newMember.email}
                    onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                    placeholder="john@rebar.shop"
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Job title</Label>
                  <Input
                    value={newMember.title}
                    onChange={(e) => setNewMember((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Sales Manager"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={newMember.department} onValueChange={(v) => setNewMember((p) => ({ ...p, department: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                {/* Avatar */}
                <Avatar className="w-10 h-10">
                  <AvatarImage src={profile.avatar_url || ""} />
                  <AvatarFallback className={cn("text-white text-sm font-medium", getAvatarColor(profile.full_name))}>
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{profile.full_name}</span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">you</Badge>
                    )}
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

                  {/* Actions dropdown - only for admin & not self */}
                  {isAdmin && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRoleChange(profile.id, "admin")}>
                          Set as Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(profile.id, "office")}>
                          Set as Office
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(profile.id, "workshop")}>
                          Set as Workshop
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(profile.id, "field")}>
                          Set as Field
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemoveMember(profile.id)}
                        >
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
