import { useState } from "react";
import { useQuoteTemplates, useQuoteTemplateItems, QuoteTemplate } from "@/hooks/useQuoteTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Pencil, Trash2, ArrowLeft, Package, Star, Copy } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
  is_optional: boolean;
  notes: string;
}

const EMPTY_LINE: LineItemDraft = { description: "", quantity: 1, unit_price: 0, is_optional: false, notes: "" };

export function QuoteTemplateManager() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useQuoteTemplates();
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);

  const handleNew = () => { setEditingTemplate(null); setShowEditor(true); };
  const handleEdit = (t: QuoteTemplate) => { setEditingTemplate(t); setShowEditor(true); };
  const handleDuplicate = (t: QuoteTemplate) => {
    setEditingTemplate({ ...t, id: "", name: t.name + " (Copy)" });
    setShowEditor(true);
  };

  const activeTemplates = templates.filter(t => t.is_active);
  const inactiveTemplates = templates.filter(t => !t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Quotation Templates
          </h2>
          <p className="text-sm text-muted-foreground">Reusable quotation blueprints with predefined line items, terms, and conditions</p>
        </div>
        <Button onClick={handleNew} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Templates</p>
            <p className="text-2xl font-bold mt-1">{templates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold mt-1 text-primary">{activeTemplates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Inactive</p>
            <p className="text-2xl font-bold mt-1 text-muted-foreground">{inactiveTemplates.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-muted-foreground col-span-full text-center py-12">Loading templates...</p>
        ) : templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No quotation templates yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : templates.map(t => (
          <Card key={t.id} className={`hover:shadow-md transition-shadow ${!t.is_active ? "opacity-60" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">{t.name}</CardTitle>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                </div>
                <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {t.customer_type && (
                  <Badge variant="outline" className="text-[10px] capitalize">{t.customer_type}</Badge>
                )}
                <Badge variant="outline" className="text-[10px]">Tax: {(t.default_tax_rate * 100).toFixed(0)}%</Badge>
                <Badge variant="outline" className="text-[10px]">Valid: {t.default_valid_days}d</Badge>
              </div>
              {t.terms.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{t.terms.length} term(s)</p>
              )}
              <div className="flex gap-1 pt-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleEdit(t)}>
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleDuplicate(t)}>
                  <Copy className="w-3 h-3" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate(t.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => setShowEditor(false)}
          onCreate={createTemplate.mutate}
          onUpdate={updateTemplate.mutate}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, onClose, onCreate, onUpdate }: {
  template: QuoteTemplate | null;
  onClose: () => void;
  onCreate: (data: any) => void;
  onUpdate: (data: any) => void;
}) {
  const isEditing = template && template.id !== "";
  const { items: existingItems } = useQuoteTemplateItems(isEditing ? template?.id ?? null : null);
  const { upsertItems } = useQuoteTemplateItems(template?.id ?? null);

  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [customerType, setCustomerType] = useState(template?.customer_type || "");
  const [taxRate, setTaxRate] = useState(String((template?.default_tax_rate ?? 0.13) * 100));
  const [validDays, setValidDays] = useState(String(template?.default_valid_days ?? 30));
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [inclusions, setInclusions] = useState(template?.inclusions?.join("\n") || "");
  const [exclusions, setExclusions] = useState(template?.exclusions?.join("\n") || "");
  const [terms, setTerms] = useState(template?.terms?.join("\n") || "");
  const [lines, setLines] = useState<LineItemDraft[]>(() => {
    if (template && template.id === "") return []; // duplicate — items loaded async
    return [{ ...EMPTY_LINE }];
  });
  const [linesLoaded, setLinesLoaded] = useState(!isEditing);

  // Load existing items for editing
  useState(() => {
    if (isEditing && existingItems.length > 0 && !linesLoaded) {
      setLines(existingItems.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        is_optional: i.is_optional,
        notes: i.notes || "",
      })));
      setLinesLoaded(true);
    }
  });

  // Effect to load items when they arrive
  if (isEditing && existingItems.length > 0 && !linesLoaded) {
    setLines(existingItems.map(i => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      is_optional: i.is_optional,
      notes: i.notes || "",
    })));
    setLinesLoaded(true);
  }

  const addLine = () => setLines(prev => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof LineItemDraft, value: any) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const requiredTotal = lines.filter(l => !l.is_optional).reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const optionalTotal = lines.filter(l => l.is_optional).reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      customer_type: customerType || null,
      default_tax_rate: parseFloat(taxRate) / 100,
      default_valid_days: parseInt(validDays) || 30,
      is_active: isActive,
      inclusions: inclusions.split("\n").map(s => s.trim()).filter(Boolean),
      exclusions: exclusions.split("\n").map(s => s.trim()).filter(Boolean),
      terms: terms.split("\n").map(s => s.trim()).filter(Boolean),
    };

    const validLines = lines.filter(l => l.description.trim()).map((l, idx) => ({ ...l, sort_order: idx }));

    if (isEditing) {
      onUpdate({ id: template!.id, ...payload });
      upsertItems.mutate({ templateId: template!.id, items: validLines });
    } else {
      onCreate({ ...payload, items: validLines });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "New Quotation Template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Rebar Supply" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Customer Type</label>
              <Select value={customerType} onValueChange={setCustomerType}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this template" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Default Tax Rate (%)</label>
              <Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Validity (days)</label>
              <Input type="number" value={validDays} onChange={e => setValidDays(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">{isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-1">
                <Package className="w-4 h-4" /> Line Items
              </h3>
              <Button variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add Line
              </Button>
            </div>
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Unit Price</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    <TableHead className="w-20 text-center">Optional</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          value={line.description}
                          onChange={e => updateLine(idx, "description", e.target.value)}
                          placeholder="Item description"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} value={line.quantity}
                          onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                          className="h-8 w-16 text-right text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} step={0.01} value={line.unit_price}
                          onChange={e => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)}
                          className="h-8 w-24 text-right text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">
                        {fmt(line.quantity * line.unit_price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={line.is_optional}
                          onCheckedChange={v => updateLine(idx, "is_optional", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(idx)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex justify-end gap-4 mt-2 text-xs text-muted-foreground">
              <span>Required: <strong className="text-foreground">{fmt(requiredTotal)}</strong></span>
              {optionalTotal > 0 && <span>Optional: <strong className="text-foreground">{fmt(optionalTotal)}</strong></span>}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Inclusions (one per line)</label>
              <Textarea value={inclusions} onChange={e => setInclusions(e.target.value)} rows={4} placeholder="Delivery to site&#10;Unloading" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Exclusions (one per line)</label>
              <Textarea value={exclusions} onChange={e => setExclusions(e.target.value)} rows={4} placeholder="Crane hire&#10;Placing labor" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Terms & Conditions (one per line)</label>
              <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4} placeholder="Payment: Net 30&#10;Prices valid 30 days" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isEditing ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
