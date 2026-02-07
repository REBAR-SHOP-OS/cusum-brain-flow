import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Archive, Search, FolderPlus, Package, MapPin, UserCheck, 
  ChevronRight, Pencil, Move, Trash2, LayoutGrid, FolderOpen 
} from "lucide-react";

// Mock vaults
const companyVaults = [
  { name: "GLOBAL POOL", icon: LayoutGrid, count: 6, active: true },
  { name: "CONSTRUCTION POINT", icon: FolderOpen, count: 2 },
  { name: "GENERAL", icon: FolderOpen, count: 0 },
  { name: "STRUKON", icon: FolderOpen, count: 4 },
];

// Mock archived documents
const archivedDocs = [
  { name: "DOWEL AND STRAIGHT", date: "1/22/2026 10:54 AM", method: "DIRECT PICKUP", signoff: true },
  { name: "10 MM STRAIGHTS", date: "1/22/2026 10:54 AM", method: "PICKUP", signoff: true },
  { name: "STANDIES", date: "1/22/2026 10:54 AM", method: "PICKUP", signoff: true },
  { name: "23 HALFORD ROAD - HAB (3)", date: "1/22/2026 10:54 AM", method: "21 ZERMAT WAY", signoff: true },
  { name: "23 HALFORD AVENUE", date: "1/22/2026 10:53 AM", method: "PICKUP", signoff: true },
  { name: "TSU", date: null, method: "DIRECT PICKUP", signoff: true },
];

export function PackingSlipsView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeVault, setActiveVault] = useState("GLOBAL POOL");

  const filteredDocs = archivedDocs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <p className="text-[10px] tracking-[0.2em] text-primary/70 uppercase">Finalized Packing Slips & Evidence Repository</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search job or destination..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button size="sm" className="gap-1.5">
            <FolderPlus className="w-4 h-4" /> New Folder
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 space-y-8">
          {/* Company Vaults */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">Company Vaults</h2>
            </div>

            <div className="flex gap-4">
              {companyVaults.map((vault) => (
                <button
                  key={vault.name}
                  onClick={() => setActiveVault(vault.name)}
                  className={`relative w-[160px] h-[100px] rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                    activeVault === vault.name
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  {vault.count > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {vault.count}
                    </span>
                  )}
                  <vault.icon className={`w-6 h-6 ${activeVault === vault.name ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-foreground">{vault.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* All Archived Documents */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">All Archived Documents</h2>
              </div>
              <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                {filteredDocs.length} Items Found
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredDocs.map((doc) => (
                <Card key={doc.name} className="group hover:shadow-lg transition-all border-border hover:border-primary/30">
                  <CardContent className="p-5 space-y-4">
                    {/* Icon + Date */}
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-[hsl(220,25%,12%)] flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] tracking-widest text-muted-foreground/60 uppercase">Finalized At</p>
                        <p className="text-[11px] text-muted-foreground font-medium">{doc.date || "N/A"}</p>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-black uppercase text-foreground tracking-tight leading-tight">
                      {doc.name}
                    </h3>

                    {/* Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="w-3 h-3 text-green-500" />
                        <span className="uppercase">{doc.method}</span>
                      </div>
                      {doc.signoff && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <UserCheck className="w-3 h-3 text-primary" />
                          <span className="uppercase">Customer Sign-Off Confirmed</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
                          <Move className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <button className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">
                        View Details <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
