import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Shield } from "lucide-react";

export interface PendingAction {
  id: string;
  action: string;
  description: string;
  params: Record<string, any>;
  resolve: (approved: boolean) => void;
}

interface VizzyApprovalDialogProps {
  pendingAction: PendingAction | null;
}

export function VizzyApprovalDialog({ pendingAction }: VizzyApprovalDialogProps) {
  const [responding, setResponding] = useState(false);

  if (!pendingAction) return null;

  const handleResponse = (approved: boolean) => {
    setResponding(true);
    pendingAction.resolve(approved);
    setTimeout(() => setResponding(false), 300);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-10"
      >
        <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-semibold">Vizzy needs your approval</span>
          </div>

          <p className="text-sm text-white/80">{pendingAction.description}</p>

          <div className="text-xs text-white/40 bg-white/5 rounded-lg p-2 font-mono">
            {pendingAction.action}: {JSON.stringify(pendingAction.params, null, 1).slice(0, 200)}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleResponse(true)}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => handleResponse(false)}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
              Deny
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
