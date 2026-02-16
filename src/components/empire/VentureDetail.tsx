import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIStressTest } from "./AIStressTest";
import { PHASES } from "@/types/venture";
import type { Venture } from "@/types/venture";

interface Props {
  venture: Venture;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Venture>) => void;
}

export const VentureDetail: React.FC<Props> = ({ venture, open, onClose, onUpdate }) => {
  const [tab, setTab] = useState("details");

  const field = (label: string, key: keyof Venture, multiline = false) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea
          defaultValue={(venture[key] as string) ?? ""}
          onBlur={(e) => onUpdate({ [key]: e.target.value } as any)}
          className="text-sm min-h-[80px]"
        />
      ) : (
        <Input
          defaultValue={(venture[key] as string) ?? ""}
          onBlur={(e) => onUpdate({ [key]: e.target.value } as any)}
          className="text-sm"
        />
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{venture.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Phase</Label>
              <Select value={venture.phase} onValueChange={(v) => onUpdate({ phase: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.emoji} {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={venture.status} onValueChange={(v) => onUpdate({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="killed">Killed</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">AI Architect</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 mt-3">
              {field("Vertical", "vertical")}
              {field("Problem Statement", "problem_statement", true)}
              {field("Target Customer", "target_customer")}
              {field("Value Multiplier", "value_multiplier", true)}
              {field("Competitive Notes", "competitive_notes", true)}
              {field("MVP Scope", "mvp_scope", true)}
              {field("Distribution Plan", "distribution_plan", true)}
              {field("Revenue Model", "revenue_model")}
              {field("Notes", "notes", true)}
            </TabsContent>

            <TabsContent value="ai" className="mt-3">
              <AIStressTest venture={venture} onAnalysis={(a) => onUpdate({ ai_analysis: a })} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
