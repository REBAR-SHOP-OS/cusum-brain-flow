import { useState, useMemo, useEffect } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronDown, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfiles";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const deptColors: Record<string, string> = {
  admin: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  office: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  workshop: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  field: "bg-green-500/15 text-green-600 border-green-500/30",
};

interface TreeNode {
  profile: Profile;
  children: TreeNode[];
}

function buildTree(profiles: Profile[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  profiles.forEach((p) => map.set(p.id, { profile: p, children: [] }));

  profiles.forEach((p) => {
    const node = map.get(p.id)!;
    if (p.manager_id && map.has(p.manager_id)) {
      map.get(p.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children alphabetically
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

function OrgNode({
  node,
  profiles,
  searchTerm,
  expandedIds,
  toggleExpand,
}: {
  node: TreeNode;
  profiles: Profile[];
  searchTerm: string;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const { profile, children } = node;
  const isExpanded = expandedIds.has(profile.id);
  const hasChildren = children.length > 0;
  const matchesSearch =
    !searchTerm ||
    profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.email || "").toLowerCase().includes(searchTerm.toLowerCase());

  const manager = profile.manager_id
    ? profiles.find((p) => p.id === profile.manager_id)
    : null;

  const dept = profile.department || "office";

  return (
    <div className="flex flex-col items-center">
      <Card
        className={cn(
          "w-56 border-border/50 transition-all hover:shadow-md cursor-pointer",
          matchesSearch && searchTerm ? "ring-2 ring-primary" : "",
          !matchesSearch && searchTerm ? "opacity-30" : ""
        )}
      >
        <CardContent className="p-4 text-center space-y-2">
          <div className="flex justify-center">
            <Avatar className="w-12 h-12">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback className="text-sm font-bold bg-muted">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <p className="font-semibold text-sm">{profile.full_name}</p>
            {profile.title && (
              <p className="text-xs text-muted-foreground">{profile.title}</p>
            )}
          </div>
          <Badge variant="outline" className={cn("text-[10px]", deptColors[dept])}>
            {dept}
          </Badge>
          {manager && (
            <p className="text-[10px] text-muted-foreground">
              Reports to: {manager.full_name}
            </p>
          )}
          {hasChildren && (
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Users className="w-3 h-3" /> {children.length} direct report{children.length !== 1 ? "s" : ""}
            </p>
          )}
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(profile.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          )}
        </CardContent>
      </Card>

      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center mt-2">
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-4 relative">
            {children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: `calc(50% - ${(children.length - 1) * 60}px)`,
                  right: `calc(50% - ${(children.length - 1) * 60}px)`,
                }}
              />
            )}
            {children.map((child) => (
              <div key={child.profile.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <OrgNode
                  node={child}
                  profiles={profiles}
                  searchTerm={searchTerm}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgChart() {
  const { profiles, isLoading } = useProfiles();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => p.is_active !== false),
    [profiles]
  );

  const tree = useMemo(() => buildTree(activeProfiles), [activeProfiles]);

  const allIds = useMemo(() => new Set(activeProfiles.map((p) => p.id)), [activeProfiles]);

  // Auto-expand all on first load
  useEffect(() => {
    if (expandedIds === null && activeProfiles.length > 0) {
      setExpandedIds(allIds);
    }
  }, [activeProfiles, allIds, expandedIds]);

  const currentExpanded = expandedIds ?? new Set<string>();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev ?? new Set<string>());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(allIds);
  const collapseAll = () => setExpandedIds(new Set());

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic text-foreground uppercase tracking-tight">
            Org Chart
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Company reporting structure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-16">Loading...</div>
        ) : (
          <div className="flex justify-center gap-8">
            {tree.map((root) => (
              <OrgNode
                key={root.profile.id}
                node={root}
                profiles={activeProfiles}
                searchTerm={searchTerm}
                expandedIds={currentExpanded}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
