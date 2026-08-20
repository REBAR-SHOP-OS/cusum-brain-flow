import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

interface EstimationProject {
  id: string;
  name: string;
  status: string;
  total_weight_kg: number;
  total_cost: number;
  created_at: string;
  estimator_id?: string;
  customer_id?: string;
}

interface ProjectListProps {
  projects: EstimationProject[];
  onSelectProject: (id: string) => void;
  onNewTakeoff: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  processing: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  qa_review: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  quoted: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
};

export default function ProjectList({ projects, onSelectProject, onNewTakeoff }: ProjectListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = projects.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="qa_review">QA Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onNewTakeoff}>
          <Plus className="h-4 w-4 mr-1" /> New Takeoff
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Weight (kg)</TableHead>
              <TableHead className="text-right">Cost ($)</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No projects found. Create your first takeoff!
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => onSelectProject(p.id)}
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[p.status] || "bg-muted text-muted-foreground"} variant="secondary">
                      {p.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{(p.total_weight_kg ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">${(p.total_cost ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
