import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Calculator, ChevronRight, Loader2, MessageCircle, Phone, Send, Sparkles,
  ShieldCheck, X, User, Mail, Building2, FileText, ArrowRight, Package, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const CONCIERGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-concierge`;

type Mode = "quote" | "chat" | "contact";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: any[];
}

// ─── Quick Quote Wizard ───
const BAR_SIZES = [
  { id: "10M", label: "10M", diameter: "11.3mm", icon: "┃" },
  { id: "15M", label: "15M", diameter: "16.0mm", icon: "┃" },
  { id: "20M", label: "20M", diameter: "19.5mm", icon: "┃" },
  { id: "25M", label: "25M", diameter: "25.2mm", icon: "┃" },
  { id: "30M", label: "30M", diameter: "29.9mm", icon: "┃" },
  { id: "35M", label: "35M", diameter: "35.7mm", icon: "┃" },
];

const BENDING_OPTIONS = [
  { id: "straight", label: "Straight", icon: "━━━" },
  { id: "L-shape", label: "L-Shape", icon: "━━┛" },
  { id: "U-shape", label: "Stirrup", icon: "┗━━┛" },
  { id: "custom", label: "Custom", icon: "~━~" },
];

const STARTER_CHIPS = [
  "I need a quote for a project",
  "Show me your products",
  "Custom bending options?",
  "Talk to a salesperson",
];

function QuickQuoteWizard({ onEstimate, onSwitchToChat }: { onEstimate: (data: any) => void; onSwitchToChat: (msg: string) => void }) {
  const [step, setStep] = useState(0);
  const [barSize, setBarSize] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [bending, setBending] = useState("straight");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleEstimate = async () => {
    setLoading(true);
    try {
      const resp = await fetch(CONCIERGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "quick-quote",
          messages: [{ role: "user", content: `Estimate quote for ${quantity} tonnes of ${barSize} rebar, bending type: ${bending}` }],
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setResult(data);
      onEstimate(data);
    } catch {
      toast.error("Could not calculate estimate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Select Bar Size</p>
            <div className="grid grid-cols-3 gap-2">
              {BAR_SIZES.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setBarSize(b.id); setStep(1); }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all hover:scale-105",
                    barSize === b.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span className="text-lg font-bold text-primary">{b.label}</span>
                  <span className="text-[10px] text-muted-foreground">{b.diameter}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <button onClick={() => setStep(0)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <p className="text-sm font-semibold text-foreground">Quantity (tonnes)</p>
            <div className="px-2">
              <Slider
                value={[quantity]}
                onValueChange={([v]) => setQuantity(v)}
                min={1}
                max={50}
                step={1}
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>1t</span>
                <span className="text-lg font-bold text-primary">{quantity}t</span>
                <span>50t</span>
              </div>
            </div>
            <Button onClick={() => setStep(2)} className="w-full">Next: Bending Type <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <p className="text-sm font-semibold text-foreground">Bending Type</p>
            <div className="grid grid-cols-2 gap-2">
              {BENDING_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setBending(opt.id); setStep(3); }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all hover:scale-105",
                    bending === opt.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span className="text-xl font-mono">{opt.icon}</span>
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && !result && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <button onClick={() => setStep(2)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Your Selection</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-card rounded-lg"><p className="text-muted-foreground">Size</p><p className="font-bold text-primary">{barSize}</p></div>
                <div className="text-center p-2 bg-card rounded-lg"><p className="text-muted-foreground">Qty</p><p className="font-bold text-primary">{quantity}t</p></div>
                <div className="text-center p-2 bg-card rounded-lg"><p className="text-muted-foreground">Bend</p><p className="font-bold text-primary capitalize">{bending}</p></div>
              </div>
            </div>
            <Button onClick={handleEstimate} disabled={loading} className="w-full bg-gradient-to-r from-[#E97F0F] to-[#F59E0B] hover:opacity-90">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
              Get Instant Estimate
            </Button>
          </motion.div>
        )}

        {result && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <p className="text-sm font-bold text-foreground">Ballpark Estimate</p>
              </div>
              <p className="text-2xl font-extrabold text-primary">{result.reply?.match(/\$[\d,]+ - \$[\d,]+ CAD/)?.[0] || "Contact for pricing"}</p>
              <p className="text-xs text-muted-foreground">{barSize} • {quantity}t • {bending}</p>
              <p className="text-xs text-muted-foreground italic">Estimate only. Market rates fluctuate daily.</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-gradient-to-r from-[#E97F0F] to-[#F59E0B]"
                onClick={() => onSwitchToChat(`I'd like a formal quote for ${quantity} tonnes of ${barSize}, ${bending} bending.`)}
              >
                Get Exact Quote
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => { setResult(null); setStep(0); }}
              >
                New Estimate
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step indicators */}
      {!result && (
        <div className="flex justify-center gap-1.5 pt-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-border")} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Contact Form ───
function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setSubmitting(true);
    try {
      await fetch(CONCIERGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "quick-quote",
          messages: [{ role: "user", content: `Save my contact info: name=${form.name}, email=${form.email}, phone=${form.phone}, company=${form.company}, project=${form.description}` }],
        }),
      });
      setDone(true);
      toast.success("Request submitted! We'll be in touch shortly.");
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-green-500" />
        </div>
        <p className="text-sm font-semibold text-foreground">Request Received!</p>
        <p className="text-xs text-muted-foreground">Our sales team will contact you within 2 hours during business hours.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Request a Callback</p>
      <p className="text-xs text-muted-foreground">Fill in your details and our team will reach out.</p>
      <div className="space-y-2">
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Your name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="pl-9 h-9 text-sm" />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="pl-9 h-9 text-sm" />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="pl-9 h-9 text-sm" />
        </div>
        <div className="relative">
          <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="pl-9 h-9 text-sm" />
        </div>
        <div className="relative">
          <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <textarea
            placeholder="Describe your project..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px] resize-none"
          />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-gradient-to-r from-[#E97F0F] to-[#F59E0B]">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
        Request Callback
      </Button>
    </div>
  );
}

// ─── Main Component ───
export function InteractiveSalesConcierge() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("quote");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { if (!open) setShowTeaser(true); }, 6000);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const switchToChat = useCallback((initialMsg?: string) => {
    setMode("chat");
    if (initialMsg) {
      setTimeout(() => sendMessage(initialMsg), 100);
    }
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;
    setInput("");

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    const assistantId = crypto.randomUUID();

    try {
      const resp = await fetch(CONCIERGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!resp.ok || !resp.body) {
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "Sorry, I'm unable to respond right now." }]);
        setIsStreaming(false);
        return;
      }

      let content = "";
      let toolResults: any[] = [];
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            // Check for tool results
            if (parsed.toolResults) {
              toolResults = parsed.toolResults;
              continue;
            }
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              content += chunk;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return prev.map(m => m.id === assistantId ? { ...m, content, toolResults } : m);
                }
                return [...prev, { id: assistantId, role: "assistant", content, toolResults }];
              });
            }
          } catch { break; }
        }
      }

      if (!content) {
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "How can I help you with your rebar needs?", toolResults }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "quote", label: "Quick Quote", icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: "chat", label: "AI Chat", icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: "contact", label: "Contact", icon: <Phone className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      {/* Teaser */}
      <AnimatePresence>
        {showTeaser && !open && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-24 right-6 z-50 max-w-[220px] cursor-pointer rounded-2xl rounded-br-sm border border-border bg-card p-3 shadow-xl"
            onClick={() => { setShowTeaser(false); setOpen(true); }}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-foreground">Need a rebar quote? We're online!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-4 z-50 w-[380px] max-h-[600px] flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_28px_80px_rgba(0,0,0,0.25)] sm:right-6"
            style={{ maxWidth: "calc(100vw - 32px)" }}
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#E97F0F] to-[#F59E0B] px-4 py-3">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">Rebar Shop</p>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white animate-pulse">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-white/80">Sales concierge • Instant quotes</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-border bg-muted/30">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all",
                    mode === tab.id
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {mode === "quote" && (
                <ScrollArea className="h-full max-h-[380px]">
                  <QuickQuoteWizard
                    onEstimate={() => {}}
                    onSwitchToChat={(msg) => switchToChat(msg)}
                  />
                </ScrollArea>
              )}

              {mode === "chat" && (
                <div className="flex flex-col h-full max-h-[380px]">
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                      {messages.length === 0 && (
                        <div className="text-center py-4 space-y-3">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Bot className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">AI Sales Assistant</p>
                          <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                            Ask about products, pricing, custom fabrication, or delivery.
                          </p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {STARTER_CHIPS.map(chip => (
                              <button
                                key={chip}
                                onClick={() => sendMessage(chip)}
                                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                              >
                                {chip} <ChevronRight className="h-2.5 w-2.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {messages.map(msg => (
                        <div key={msg.id} className={cn("max-w-[85%]", msg.role === "user" ? "ml-auto" : "mr-auto")}>
                          {/* Tool result cards */}
                          {msg.toolResults?.map((tr, i) => (
                            <div key={i} className="mb-2">
                              {tr.type === "products" && (
                                <div className="space-y-1.5">
                                  {tr.data.products?.slice(0, 3).map((p: any) => (
                                    <div key={p.id} className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">{p.id}</div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground">{p.name}</p>
                                        <p className="text-muted-foreground">{p.diameter} • {p.priceRange}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {tr.type === "quote" && (
                                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                                  <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" /><span className="font-bold">Estimate</span></div>
                                  <p className="text-lg font-extrabold text-primary">{tr.data.estimated_total}</p>
                                  <p className="text-muted-foreground">{tr.data.bar_size} • {tr.data.total_weight_tonnes}t • {tr.data.bending}</p>
                                </div>
                              )}
                            </div>
                          ))}
                          <div className={cn(
                            "rounded-2xl border px-3 py-2 text-[13px] leading-relaxed",
                            msg.role === "user"
                              ? "rounded-br-sm border-primary/20 bg-gradient-to-r from-[#E97F0F] to-[#F59E0B] text-white"
                              : "rounded-bl-sm border-border/60 bg-background text-foreground"
                          )}>
                            {msg.role === "assistant" ? (
                              <RichMarkdown content={msg.content} className="text-[13px] [&_p]:text-[13px]" />
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                        <div className="mr-auto">
                          <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border/60 bg-background px-3 py-2 text-[13px]">
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground text-xs">Thinking...</span>
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>
                  </ScrollArea>

                  {/* Chat input */}
                  <div className="border-t border-border p-3">
                    <div className="flex gap-2 items-end">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about pricing, products..."
                        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[36px] max-h-[80px]"
                        rows={1}
                        disabled={isStreaming}
                      />
                      <Button
                        size="sm"
                        className="h-9 px-3 rounded-xl bg-gradient-to-r from-[#E97F0F] to-[#F59E0B]"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isStreaming}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {mode === "contact" && (
                <ScrollArea className="h-full max-h-[380px]">
                  <ContactForm />
                </ScrollArea>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-3 py-2 text-center">
              <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                Powered by Rebar Shop AI
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button
        onClick={() => { setOpen(prev => !prev); setShowTeaser(false); }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          open
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-gradient-to-br from-[#E97F0F] to-[#F59E0B] text-white hover:scale-110 shadow-[0_8px_24px_rgba(233,127,15,0.4)] animate-pulse"
        )}
        style={{ animationDuration: open ? "0s" : "3s" }}
        aria-label="Sales concierge"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
