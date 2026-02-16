import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (v: { name: string; vertical: string; problem_statement: string }) => void;
  isLoading: boolean;
}

export const NewVentureDialog: React.FC<Props> = ({ open, onClose, onCreate, isLoading }) => {
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState("");
  const [problem, setProblem] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), vertical: vertical.trim(), problem_statement: problem.trim() });
    setName("");
    setVertical("");
    setProblem("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Venture</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Venture Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI Rebar Estimator" />
          </div>
          <div className="space-y-1">
            <Label>Vertical / Industry</Label>
            <Input value={vertical} onChange={(e) => setVertical(e.target.value)} placeholder="e.g. Construction Tech" />
          </div>
          <div className="space-y-1">
            <Label>Problem Statement</Label>
            <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="What problem does this solve?" className="min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || isLoading}>
            {isLoading ? "Creating…" : "Create Venture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
