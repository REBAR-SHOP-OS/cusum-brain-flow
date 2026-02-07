import { FileBox } from "lucide-react";

export function PackingSlipsView() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <FileBox className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-black italic text-foreground uppercase">Packing Slips</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Auto-generate packing slips grouped by delivery stop. This module will pull from the production queue and bundle assets.
      </p>
      <p className="text-xs text-muted-foreground/60 tracking-widest uppercase">Coming Soon</p>
    </div>
  );
}
