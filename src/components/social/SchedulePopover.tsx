import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { type SocialPost } from "@/hooks/useSocialPosts";
import { useToast } from "@/hooks/use-toast";
import { schedulePost } from "@/lib/schedulePost";
import { useQueryClient } from "@tanstack/react-query";

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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handleConfirm = async () => {
    if (!selectedDate || selectedPlatforms.length === 0) return;

    if ((post.content || "").length < 20) {
      toast({ title: "Content too short", description: "Post content must be at least 20 characters to schedule.", variant: "destructive" });
      return;
    }

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
          // Verify DB state before showing success
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: verified } = await supabase
            .from("social_posts")
            .select("id, status, qa_status")
            .eq("id", post.id)
            .maybeSingle();

          if (!verified || verified.status !== "scheduled") {
            console.error("[SchedulePopover] Verification FAILED — post status after update:", verified?.status);
            toast({
              title: "Scheduling failed",
              description: "The post was not saved as scheduled. Please check permissions and try again.",
              variant: "destructive",
            });
            return;
          }

          if (selectedPlatforms.length > 1) {
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
            title: "Post scheduled ✅",
            description: `Scheduled for ${format(scheduledDateTime, "PPP")} at ${hour}:${minute} on ${selectedPlatforms.join(", ")}`,
          });
          setOpen(false);
          setStep("datetime");
          onScheduled?.();
        },
        onError: (err: Error) => {
          toast({
            title: "خطا در زمان‌بندی",
            description: err.message || "پست ذخیره نشد. دوباره تلاش کنید.",
            variant: "destructive",
          });
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
              <p className="text-amber-600 font-medium">🕐 Eastern Time (America/Toronto)</p>
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
