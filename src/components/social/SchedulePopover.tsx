import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
];

interface SchedulePopoverProps {
  post: SocialPost;
  onScheduled?: () => void;
}

export function SchedulePopover({ post, onScheduled }: SchedulePopoverProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"datetime" | "platforms">("datetime");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    post.scheduled_date ? new Date(post.scheduled_date) : undefined
  );
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([post.platform]);

  const { updatePost } = useSocialPosts();
  const { toast } = useToast();

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handleConfirm = async () => {
    if (!selectedDate || selectedPlatforms.length === 0) return;

    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

    const primaryPlatform = selectedPlatforms[0] as SocialPost["platform"];

    // Update the original post with the first platform
    updatePost.mutate(
      {
        id: post.id,
        qa_status: "scheduled",
        status: "scheduled",
        scheduled_date: scheduledDateTime.toISOString(),
        platform: primaryPlatform,
        page_name: post.page_name,
      },
      {
        onSuccess: async () => {
          // Create duplicate posts for additional platforms
          if (selectedPlatforms.length > 1) {
            const { supabase } = await import("@/integrations/supabase/client");
            for (let i = 1; i < selectedPlatforms.length; i++) {
              await supabase.from("social_posts").insert({
                user_id: post.user_id,
                platform: selectedPlatforms[i],
                status: "scheduled",
                qa_status: "scheduled",
                title: post.title,
                content: post.content,
                image_url: post.image_url,
                scheduled_date: scheduledDateTime.toISOString(),
                hashtags: post.hashtags,
                page_name: post.page_name,
                content_type: post.content_type,
              });
            }
          }

          toast({
            title: "Post scheduled",
            description: `Scheduled for ${format(scheduledDateTime, "PPP")} at ${hour}:${minute} on ${selectedPlatforms.join(", ")}`,
          });
          setOpen(false);
          setStep("datetime");
          onScheduled?.();
        },
      }
    );
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setStep("datetime"); }}>
      <PopoverTrigger asChild>
        <Button className="flex-1">
          <CalendarDays className="w-4 h-4 mr-1" />
          {post.status === "scheduled" ? "Reschedule" : "Schedule"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" side="top">
        {step === "datetime" ? (
          <div className="p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Select date & time</p>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex items-center gap-2">
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground font-bold">:</span>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!selectedDate}
              onClick={() => setStep("platforms")}
            >
              Next — Select platforms
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-3 min-w-[240px]">
            <p className="text-sm font-medium text-foreground">Select platforms</p>
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-3 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={selectedPlatforms.includes(p.value)}
                    onCheckedChange={() => togglePlatform(p.value)}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              {selectedDate && (
                <p>
                  📅 {format(selectedDate, "PPP")} at {hour}:{minute}
                </p>
              )}
              <p>📢 {selectedPlatforms.length} platform(s) selected</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("datetime")}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={selectedPlatforms.length === 0}
                onClick={handleConfirm}
              >
                <Check className="w-4 h-4 mr-1" />
                Confirm
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
