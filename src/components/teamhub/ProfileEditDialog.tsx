import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera } from "lucide-react";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function ProfileEditDialog({ open, onClose, profile }: ProfileEditDialogProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadSingle } = useAvatarUpload();
  const { updateProfile } = useProfiles();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadSingle(profile.id, file);
  };

  const handleSave = () => {
    if (fullName.trim() && fullName.trim() !== profile.full_name) {
      updateProfile.mutate({ id: profile.id, full_name: fullName.trim() });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <button
            type="button"
            className="relative group cursor-pointer rounded-full"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Avatar className="w-20 h-20 border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity",
              uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <Camera className="w-6 h-6 text-white" />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <span className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "Click to change photo"}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-name">Full Name</Label>
          <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={uploading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
