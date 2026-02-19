import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";

const CATEGORIES = ["pipeline", "hr", "finance", "production", "system", "support"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPreferences({ open, onOpenChange }: Props) {
  const { prefs, upsert } = useNotificationPreferences();
  const [email, setEmail] = useState(prefs.email_enabled);
  const [push, setPush] = useState(prefs.push_enabled);
  const [sound, setSound] = useState(prefs.sound_enabled);
  const [qhStart, setQhStart] = useState(prefs.quiet_hours_start?.slice(0, 5) ?? "");
  const [qhEnd, setQhEnd] = useState(prefs.quiet_hours_end?.slice(0, 5) ?? "");
  const [muted, setMuted] = useState<string[]>(prefs.muted_categories ?? []);

  const toggleCategory = (cat: string) => {
    setMuted((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  };

  const handleSave = () => {
    upsert.mutate({
      email_enabled: email,
      push_enabled: push,
      sound_enabled: sound,
      quiet_hours_start: qhStart || null,
      quiet_hours_end: qhEnd || null,
      muted_categories: muted,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label>Email notifications</Label>
            <Switch checked={email} onCheckedChange={setEmail} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Push notifications</Label>
            <Switch checked={push} onCheckedChange={setPush} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Sound</Label>
            <Switch checked={sound} onCheckedChange={setSound} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quiet Hours</Label>
            <div className="flex items-center gap-2">
              <Input type="time" value={qhStart} onChange={(e) => setQhStart(e.target.value)} className="h-8 text-xs w-28" placeholder="Start" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="time" value={qhEnd} onChange={(e) => setQhEnd(e.target.value)} className="h-8 text-xs w-28" placeholder="End" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Muted Categories</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat}
                  variant={muted.includes(cat) ? "destructive" : "secondary"}
                  className="cursor-pointer text-[11px] capitalize"
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                  {muted.includes(cat) && <X className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
