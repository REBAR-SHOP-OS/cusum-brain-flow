import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  User, Users, Settings, Upload, CheckCircle2, 
  Sparkles, Tag, LayoutGrid 
} from "lucide-react";
import { AsaShapeDiagram } from "@/components/shopfloor/AsaShapeDiagram";
import brandLogo from "@/assets/brand-logo.png";

// ASA Standard Renderings data
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

// All shape codes in the full grid
const allShapeCodes = [
  "1", "2", "3", "4", "5", "6", "7", "8",
  "9", "10", "11", "12", "13", "14", "15", "16",
  "17", "18", "19", "20", "21", "22", "23", "24",
  "25", "26", "27", "28", "29", "30", "31", "32",
  "S2", "S12", "S11", "S14", "S4", "S13", "T9", "T8",
  "T3", "T4", "S6", "T17", "S8", "S3", "T8", "T16",
  "COIL", "X", "T2", "Y", "T7", "S7", "T12", "S15",
  "T14", "S9", "T5", "T15", "T10", "T1", "S1", "S5",
  "T13", "T11", "S",
];

export function MemberAreaView() {
  const [mainTab, setMainTab] = useState("system-config");
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

        {/* Main tabs */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={mainTab === "my-profile" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setMainTab("my-profile")}
          >
            <User className="w-3.5 h-3.5" /> My Profile
          </Button>
          <Button
            variant={mainTab === "team-access" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setMainTab("team-access")}
          >
            <Users className="w-3.5 h-3.5" /> Team Access
          </Button>
          <Button
            variant={mainTab === "system-config" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setMainTab("system-config")}
          >
            <Settings className="w-3.5 h-3.5" /> System Config
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {mainTab === "system-config" && (
          <div className="p-8 max-w-4xl mx-auto space-y-6">
            {/* Config sub-tabs */}
            <div className="flex bg-card border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setConfigTab("general")}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${
                  configTab === "general"
                    ? "bg-background text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings className="w-4 h-4" /> General Setup
              </button>
              <button
                onClick={() => setConfigTab("asa-shapes")}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${
                  configTab === "asa-shapes"
                    ? "bg-background text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> aSa Shape Engine
              </button>
            </div>

            {configTab === "general" && (
              <Card>
                <CardContent className="p-6 space-y-8">
                  {/* Organizational Identity */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                        Organizational Identity
                      </h3>
                    </div>

                    <div className="flex items-start gap-8">
                      {/* Logo + Company Name */}
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-[hsl(220,25%,12%)] border border-border/30 flex items-center justify-center overflow-hidden">
                          <img src={brandLogo} alt="Corporate Seal" className="w-16 h-16 object-contain" />
                        </div>
                        <div>
                          <label className="text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Company Name</label>
                          <Input
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            className="w-56 h-10 font-bold text-sm"
                          />
                          <button className="text-[11px] text-primary font-semibold uppercase tracking-widest mt-2 hover:text-primary/80">
                            Update Corporate Seal
                          </button>
                        </div>
                      </div>

                      {/* Login Architecture */}
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-900 to-amber-600 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                          <div className="w-14 h-14 rounded-full bg-amber-500/30 border border-amber-400/50" />
                        </div>
                        <div>
                          <label className="text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Login Architecture</label>
                          <p className="text-xs text-muted-foreground mb-2">Upload a high-fidelity image for the cinematic entry portal.</p>
                          <Button variant="default" size="sm" className="gap-1.5 text-xs">
                            Assign New Visual
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Standard Logic */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                        Standard Logic
                      </h3>
                    </div>

                    <Card className="border-border">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-foreground uppercase">System of Measurement</p>
                          <p className="text-xs text-muted-foreground">Determines the authoritative length calculations and export formats.</p>
                        </div>
                        <div className="flex items-center bg-muted rounded-lg p-0.5">
                          <Button
                            variant={measurement === "metric" ? "default" : "ghost"}
                            size="sm"
                            className="h-9 px-5 text-xs font-bold"
                            onClick={() => setMeasurement("metric")}
                          >
                            METRIC (MM)
                          </Button>
                          <Button
                            variant={measurement === "imperial" ? "default" : "ghost"}
                            size="sm"
                            className="h-9 px-5 text-xs font-bold"
                            onClick={() => setMeasurement("imperial")}
                          >
                            IMPERIAL (FT-IN)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Save Button */}
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
                {/* ASA Standard Renderings Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black italic text-foreground uppercase">ASA Standard Renderings</h2>
                    <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                      Cross-Reference Mappings for Machine Routing
                    </p>
                  </div>
                  <Button className="gap-1.5">
                    <Sparkles className="w-4 h-4" /> AI Vision Assign
                  </Button>
                </div>

                {/* Featured shapes */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {asaStandardShapes.map((shape) => (
                    <Card key={shape.code} className="border-border hover:border-primary/40 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="flex items-start justify-between w-full">
                          <span className="w-7 h-7 rounded-full border-2 border-foreground flex items-center justify-center text-xs font-bold">
                            {shape.num}
                          </span>
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

                {/* Custom Mapping Override */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                      Custom Mapping Override
                    </h3>
                  </div>

                  <div className="flex gap-3">
                    <Input
                      placeholder="Type Code (E.G. S1)"
                      value={customCode}
                      onChange={e => setCustomCode(e.target.value)}
                      className="flex-1 h-11"
                    />
                    <Button className="gap-1.5 h-11 px-5">
                      <Upload className="w-4 h-4" /> Upload Schematic
                    </Button>
                  </div>
                </section>

                {/* Full shape grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {allShapeCodes.map((code, i) => (
                    <div
                      key={`${code}-${i}`}
                      className="aspect-square rounded-lg border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 p-2"
                    >
                      <div className="flex-1 flex items-center justify-center w-full">
                        <AsaShapeDiagram shapeCode={code} size="sm" />
                      </div>
                      <span className="text-[10px] font-bold text-primary">{code}</span>
                    </div>
                  ))}
                </div>

                {/* Authorize button */}
                <div className="flex justify-center pt-4">
                  <Button size="lg" className="gap-2 px-12 h-12 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Authorize System Global Change
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {mainTab === "my-profile" && (
          <div className="p-8 max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-xl font-bold">
                    S
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Sattar</h2>
                    <Badge className="text-[9px] uppercase tracking-widest">Admin</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Full Name</label>
                    <Input defaultValue="Sattar" className="h-10" />
                  </div>
                  <div>
                    <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Email</label>
                    <Input defaultValue="sattar@rebar.shop" className="h-10" />
                  </div>
                  <div>
                    <label className="text-[10px] tracking-widest text-muted-foreground uppercase mb-1 block">Role</label>
                    <Input defaultValue="Administrator" className="h-10" disabled />
                  </div>
                </div>
                <Button className="w-full">Save Changes</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {mainTab === "team-access" && (
          <div className="p-8 max-w-3xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <Users className="w-12 h-12 text-muted-foreground mx-auto" />
                <h2 className="text-lg font-bold text-foreground">Team Access Control</h2>
                <p className="text-sm text-muted-foreground">
                  Manage team member roles, permissions, and station access rights.
                </p>
                <Button variant="outline">Manage in Settings</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
