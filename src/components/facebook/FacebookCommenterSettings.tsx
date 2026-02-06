import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FacebookCommenterSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
}

export function FacebookCommenterSettings({ open, onOpenChange, onBack }: FacebookCommenterSettingsProps) {
  const [selectedPage, setSelectedPage] = useState("rebar-shop");
  const [instructions, setInstructions] = useState("");

  const handleSave = () => {
    // TODO: Save settings to backend
    onBack();
  };

  if (!open) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-8">Manage your Facebook Commenter</h1>

        {/* Platforms */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-3 block">Platforms to comment on:</label>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/50">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="text-sm">Facebook</span>
            </button>
          </div>
        </div>

        {/* Facebook Page Selection */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-3 block">Facebook Page:</label>
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger className="bg-muted/30">
              <SelectValue placeholder="Select a page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rebar-shop">Rebar.shop</SelectItem>
              <SelectItem value="ontario-steel">Ontario Steel Services</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Additional Instructions */}
        <div className="mb-8">
          <label className="text-sm font-medium mb-3 block">Additional instructions:</label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Add additional context"
            className="min-h-[120px] bg-muted/30 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 max-w-2xl mx-auto w-full">
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
