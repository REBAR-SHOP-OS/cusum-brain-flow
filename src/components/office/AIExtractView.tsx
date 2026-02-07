import { useState } from "react";
import { Upload, Globe, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AIExtractView() {
  const [manifestName, setManifestName] = useState("23 HALFORD ROAD - HAB (3)");
  const [customer, setCustomer] = useState("ACME CONCRETE");
  const [siteAddress, setSiteAddress] = useState("123 MAIN ST");
  const [targetEta, setTargetEta] = useState("");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black italic text-foreground uppercase">Initialize Manifest</h1>
          <p className="text-xs tracking-widest text-primary/70 uppercase">Identity Registration</p>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Manifest Name
          </label>
          <Input
            value={manifestName}
            onChange={(e) => setManifestName(e.target.value)}
            className="bg-card border-border"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Customer
          </label>
          <Input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="bg-card border-border"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Site Address
          </label>
          <Input
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            className="bg-card border-border"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
            Target ETA
          </label>
          <Input
            type="date"
            value={targetEta}
            onChange={(e) => setTargetEta(e.target.value)}
            className="bg-card border-border"
            placeholder="yyyy-mm-dd"
          />
        </div>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-border rounded-xl p-16 flex flex-col items-center justify-center gap-4 bg-muted/20">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Upload className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-black italic text-foreground uppercase">Upload Drawing Ledger</h2>
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          Spreadsheet (XLSX/CSV) · Drawing Log (PDF)
        </p>
        <div className="flex items-center gap-6 mt-2">
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="w-4 h-4" />
            <span className="tracking-widest uppercase">Identity Mapping</span>
          </button>
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <FileText className="w-4 h-4" />
            <span className="tracking-widest uppercase">Raw Integrity</span>
          </button>
        </div>
      </div>
    </div>
  );
}
