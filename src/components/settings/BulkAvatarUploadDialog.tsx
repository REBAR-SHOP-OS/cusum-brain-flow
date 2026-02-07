import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, ImagePlus, Check, X, Loader2 } from "lucide-react";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import type { Profile } from "@/hooks/useProfiles";

interface BulkAvatarUploadDialogProps {
  profiles: Profile[];
  trigger?: React.ReactNode;
}

interface FilePreview {
  file: File;
  preview: string;
  matchedProfile: Profile | null;
}

function matchFileToProfile(file: File, profiles: Profile[]): Profile | null {
  const baseName = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[_-]/g, " ").trim();
  return profiles.find((p) => {
    const profileName = p.full_name.toLowerCase().trim();
    return (
      profileName === baseName ||
      profileName.replace(/\s+/g, "") === baseName.replace(/\s+/g, "") ||
      profileName.split(" ").every((part) => baseName.includes(part.toLowerCase()) && part.length > 2)
    );
  }) ?? null;
}

export function BulkAvatarUploadDialog({ profiles, trigger }: BulkAvatarUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadBulk } = useAvatarUpload();

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      matchedProfile: matchFileToProfile(file, profiles),
    }));
    setPreviews(newPreviews);
  };

  const handleUpload = async () => {
    const filesToUpload = previews.filter((p) => p.matchedProfile);
    if (!filesToUpload.length) return;

    await uploadBulk(
      filesToUpload.map((p) => p.file),
      profiles.map((p) => ({ id: p.id, full_name: p.full_name }))
    );
    setPreviews([]);
    setOpen(false);
  };

  const matchedCount = previews.filter((p) => p.matchedProfile).length;
  const unmatchedCount = previews.length - matchedCount;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPreviews([]); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <ImagePlus className="w-4 h-4" /> Bulk Upload Photos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Profile Photos</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Name files after team members (e.g. <code>john_doe.jpg</code>) for auto-matching.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />

        {previews.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer"
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to select images</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1">
                <Check className="w-3 h-3" /> {matchedCount} matched
              </Badge>
              {unmatchedCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <X className="w-3 h-3" /> {unmatchedCount} unmatched
                </Badge>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {previews.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                  <img src={p.preview} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.file.name}</p>
                    {p.matchedProfile ? (
                      <p className="text-xs text-primary">→ {p.matchedProfile.full_name}</p>
                    ) : (
                      <p className="text-xs text-destructive">No match found</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
                Re-select
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={!matchedCount || uploading} className="flex-1 gap-1.5">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload {matchedCount}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
