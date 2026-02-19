import { useState } from "react";
import { X, HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { cn } from "@/lib/utils";

interface InboxManagerSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedEmail?: string;
}

export function InboxManagerSettings({ 
  open, 
  onOpenChange, 
  connectedEmail = "ai@rebar.shop" 
}: InboxManagerSettingsProps) {
  const [instructions, setInstructions] = useState(
    "I am concise in my communication, polite but direct. I prefer shorter emails. If asked for help or guidance, I prefer to respond with bullet points for ease of reading. Always sign-off with Best, Cassie"
  );

  const handleSave = () => {
    // TODO: Save instructions to backend
    onOpenChange(false);
  };

  const handleReset = () => {
    setInstructions("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[#1a2332] text-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="font-semibold">Connected account</h2>
        <button 
          onClick={() => onOpenChange(false)}
          className="text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Connected Account */}
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
          </svg>
          <span className="text-sm">{connectedEmail}</span>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-3">
          <h3 className="font-medium">Custom Instructions</h3>
          <SmartTextarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
            placeholder="Add custom instructions for how Cassie should handle your emails..."
          />
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left">
            <HelpCircle className="w-5 h-5 text-[#4FC3F7]" />
            <span>Get Help</span>
          </button>
          <button 
            onClick={handleReset}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
          >
            <RotateCcw className="w-5 h-5 text-red-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <Button 
          onClick={handleSave}
          className="w-full bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
