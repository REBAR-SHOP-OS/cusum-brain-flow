import React, { useState } from "react";
import { Phone, MessageSquare, Mail, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AISuggestButton } from "@/components/ui/AISuggestButton";

export interface TableRowActionCallbacks {
  onCall: (rowText: string) => void;
  onText: (rowText: string) => void;
  onEmail: (rowText: string, subject: string, body: string) => void;
  onReschedule: (rowText: string, date: Date, reason: string) => void;
}

interface TableRowActionsProps {
  rowText: string;
  callbacks: TableRowActionCallbacks;
}

export function TableRowActions({ rowText, callbacks }: TableRowActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleReason, setRescheduleReason] = useState("");

  const btnClass = "inline-flex items-center justify-center w-6 h-6 rounded hover:bg-accent text-muted-foreground transition-colors";

  return (
    <td className="px-1 py-2 whitespace-nowrap">
      <span className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Call */}
        <button
          title="Call"
          onClick={() => callbacks.onCall(rowText)}
          className={cn(btnClass, "hover:text-emerald-500")}
        >
          <Phone className="w-3 h-3" />
        </button>

        {/* Text / SMS */}
        <button
          title="Text"
          onClick={() => callbacks.onText(rowText)}
          className={cn(btnClass, "hover:text-sky-500")}
        >
          <MessageSquare className="w-3 h-3" />
        </button>

        {/* Email with subject + body */}
        <Popover open={emailOpen} onOpenChange={setEmailOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Email"
              className={cn("w-6 h-6 text-muted-foreground hover:text-primary")}
            >
              <Mail className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" side="top" align="start">
            <p className="text-xs font-medium mb-2">Compose email</p>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject line"
              className="h-8 text-xs mb-2"
            />
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Body</span>
              <AISuggestButton
                contextType="email"
                context={`Row context: ${rowText}\nSubject: ${emailSubject}`}
                currentText={emailBody}
                onSuggestion={(text) => setEmailBody(text)}
                compact={true}
              />
            </div>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Message body..."
              className="text-xs mb-2 min-h-[60px] resize-none"
              rows={3}
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              disabled={!emailSubject.trim()}
              onClick={() => {
                callbacks.onEmail(rowText, emailSubject.trim(), emailBody.trim());
                setEmailSubject("");
                setEmailBody("");
                setEmailOpen(false);
              }}
            >
              Send Email
            </Button>
          </PopoverContent>
        </Popover>

        {/* Reschedule with reason */}
        <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Reschedule"
              className={cn("w-6 h-6 text-muted-foreground hover:text-amber-500")}
            >
              <CalendarClock className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" side="top" align="start">
            <p className="text-xs font-medium mb-2">Reschedule activity</p>
            <Input
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="Reason (e.g. Customer unavailable)"
              className="h-8 text-xs mb-2"
            />
            <Calendar
              mode="single"
              selected={rescheduleDate}
              onSelect={setRescheduleDate}
              disabled={(date) => date < new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs mt-2"
              disabled={!rescheduleDate || !rescheduleReason.trim()}
              onClick={() => {
                if (rescheduleDate) {
                  callbacks.onReschedule(rowText, rescheduleDate, rescheduleReason.trim());
                  setRescheduleDate(undefined);
                  setRescheduleReason("");
                  setRescheduleOpen(false);
                }
              }}
            >
              Confirm Reschedule
            </Button>
          </PopoverContent>
        </Popover>
      </span>
    </td>
  );
}
