import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, Building2, Mail, Phone } from "lucide-react";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import { Skeleton } from "@/components/ui/skeleton";

const departmentColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  office: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  workshop: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  field: "bg-green-500/10 text-green-500 border-green-500/20",
};

const departmentLabels: Record<string, string> = {
  admin: "Administration",
  office: "Office",
  workshop: "Workshop",
  field: "Field",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Team() {
  const { profiles, isLoading } = useProfiles();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const filtered = profiles.filter((p) => {
    if (!p.is_active) return false;
    if (deptFilter !== "all" && p.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.title?.toLowerCase().includes(q) ?? false) ||
        (p.email?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const deptCounts = profiles.reduce<Record<string, number>>((acc, p) => {
    if (p.is_active && p.department) {
      acc[p.department] = (acc[p.department] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Team Directory
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {profiles.filter((p) => p.is_active).length} active members
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5 flex-1 max-w-xs">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team..."
              className="border-0 h-7 bg-transparent p-0 text-sm focus-visible:ring-0"
            />
          </div>

          <Button
            variant={deptFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setDeptFilter("all")}
          >
            All ({profiles.filter((p) => p.is_active).length})
          </Button>
          {Object.entries(departmentLabels).map(([key, label]) => (
            <Button
              key={key}
              variant={deptFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setDeptFilter(key)}
            >
              {label} ({deptCounts[key] || 0})
            </Button>
          ))}
        </div>

        {/* Team Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No team members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function MemberCard({ member }: { member: Profile }) {
  const dept = member.department || "office";
  const colorClass = departmentColors[dept] || departmentColors.office;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <Avatar className="w-14 h-14">
          <AvatarImage src={member.avatar_url || undefined} />
          <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
            {getInitials(member.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{member.full_name}</h3>
          <p className="text-sm text-muted-foreground truncate">{member.title || "Team member"}</p>
          <Badge variant="outline" className={`mt-1.5 text-[10px] ${colorClass}`}>
            <Building2 className="w-3 h-3 mr-1" />
            {departmentLabels[dept] || dept}
          </Badge>
        </div>
      </div>

      {/* Duties */}
      {member.duties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {member.duties.slice(0, 3).map((duty, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {duty}
            </Badge>
          ))}
          {member.duties.length > 3 && (
            <Badge variant="secondary" className="text-[10px]">
              +{member.duties.length - 3} more
            </Badge>
          )}
        </div>
      )}

      {/* Contact */}
      <div className="mt-3 space-y-1">
        {member.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{member.email}</span>
          </div>
        )}
        {member.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            <span>{member.phone}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
