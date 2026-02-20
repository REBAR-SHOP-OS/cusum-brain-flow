
export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface AgentRequest {
  agent: "sales" | "accounting" | "support" | "collections" | "estimation" | "social" | "eisenhower" | "bizdev" | "webbuilder" | "assistant" | "copywriting" | "talent" | "seo" | "growth" | "legal" | "shopfloor" | "delivery" | "email" | "data" | "commander" | "empire";
  message: string;
  history?: ChatMessage[];
  context?: Record<string, unknown>;
  attachedFiles?: { name: string; url: string }[];
  pixelSlot?: number;
}

export interface RebarStandard {
  bar_size: string;
  bar_size_mm: number;
  weight_per_meter: number;
  area_mm2: number;
  standard_code: string;
  grade: string;
  lap_tension_mult: number;
  lap_compression_mult: number;
}

export interface ValidationRule {
  rule_name: string;
  rule_type: string;
  element_type: string | null;
  min_value: number | null;
  max_value: number | null;
  unit: string;
  error_message: string;
  warning_message: string | null;
  severity: string;
}
