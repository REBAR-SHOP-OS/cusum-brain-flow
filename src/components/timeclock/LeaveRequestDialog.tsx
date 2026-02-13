import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format, differenceInBusinessDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (data: {
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason?: string;
  }) => Promise<boolean>;
}

const leaveTypes = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Day" },
  { value: "personal", label: "Personal" },
  { value: "bereavement", label: "Bereavement" },
  { value: "unpaid", label: "Unpaid Leave" },
];

export function LeaveRequestDialog({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalDays = startDate && endDate
    ? Math.max(1, differenceInBusinessDays(endDate, startDate) + 1)
    : 0;

  const handleSubmit = async () => {
    if (!leaveType || !startDate || !endDate) return;
    setSubmitting(true);
    const ok = await onSubmit({
      leave_type: leaveType,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      total_days: totalDays,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (ok) {
      setOpen(false);
      setLeaveType("");
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Request Time Off
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => { setStartDate(d); if (!endDate || (d && endDate < d)) setEndDate(d); }}
                    disabled={(d) => d < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(d) => d < (startDate || new Date())}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {totalDays > 0 && (
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{totalDays} business day{totalDays !== 1 ? "s" : ""}</span>
            </p>
          )}

          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason..." rows={2} />
          </div>

          <Button onClick={handleSubmit} disabled={!leaveType || !startDate || !endDate || submitting} className="w-full">
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
