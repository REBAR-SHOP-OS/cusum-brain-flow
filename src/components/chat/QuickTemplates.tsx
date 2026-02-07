import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const templates = [
  { label: "Follow up on quote", text: "Please follow up on the pending quote for {customer}. Check if they have any questions or need adjustments." },
  { label: "Request ETA", text: "What's the current ETA for order #{order_number}? The customer is asking for an update." },
  { label: "Schedule delivery", text: "Please schedule a delivery for {customer} at {address}. Preferred time: {time}." },
  { label: "Payment reminder", text: "Draft a polite payment reminder for invoice #{invoice} which is {days} days overdue." },
  { label: "New lead intake", text: "We have a new lead: {name} from {company}. They're interested in {product/service}. Please add to pipeline." },
  { label: "Daily summary", text: "Give me a summary of today's key activities, pending tasks, and any items that need attention." },
];

interface QuickTemplatesProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function QuickTemplates({ onSelect, disabled }: QuickTemplatesProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <LayoutTemplate className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Quick templates</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" side="top" className="w-[280px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Quick Templates</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.map((t) => (
          <DropdownMenuItem
            key={t.label}
            onClick={() => onSelect(t.text)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="text-sm font-medium">{t.label}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{t.text}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
