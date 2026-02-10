import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, AlertTriangle, Info, TrendingUp, TrendingDown,
  Minus, ArrowRight
} from "lucide-react";

interface RichMarkdownProps {
  content: string;
  className?: string;
}

/** Detects status keywords and returns icon + color */
function statusBadge(text: string) {
  const t = (text || "").toLowerCase().trim();
  if (["active", "good", "healthy", "low", "complete", "yes", "done", "emerging"].includes(t))
    return { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-400/10" };
  if (["warning", "medium", "needs optimization", "needs work", "pending"].includes(t))
    return { icon: AlertTriangle, color: "text-amber-400 bg-amber-400/10" };
  if (["error", "critical", "high", "blocked", "no", "overdue"].includes(t))
    return { icon: AlertTriangle, color: "text-red-400 bg-red-400/10" };
  if (["info", "basic", "new"].includes(t))
    return { icon: Info, color: "text-sky-400 bg-sky-400/10" };
  return null;
}

export function RichMarkdown({ content, className }: RichMarkdownProps) {
  return (
    <div className={cn("text-sm leading-relaxed break-words overflow-hidden", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Headings ──
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-foreground mt-4 mb-2 pb-1 border-b border-primary/20">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-foreground mt-4 mb-2 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary inline-block" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-foreground mt-3 mb-1.5 flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              {children}
            </h3>
          ),

          // ── Paragraphs ──
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-foreground/90 mb-2">{children}</p>
          ),

          // ── Bold / Strong — auto-highlight keywords ──
          strong: ({ children }) => {
            const text = String(children);
            const badge = statusBadge(text);
            if (badge) {
              const Icon = badge.icon;
              return (
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold", badge.color)}>
                  <Icon className="w-3 h-3" />
                  {children}
                </span>
              );
            }
            return <strong className="font-bold text-primary">{children}</strong>;
          },

          // ── Italic ──
          em: ({ children }) => (
            <em className="text-muted-foreground italic">{children}</em>
          ),

          // ── Tables — fully styled ──
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-border/50">
              <table className="min-w-full text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-primary/10 border-b border-border/50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/30">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-bold text-primary text-xs uppercase tracking-wider whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => {
            const text = String(children).trim();
            const badge = statusBadge(text);
            if (badge) {
              const Icon = badge.icon;
              return (
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold", badge.color)}>
                    <Icon className="w-3 h-3" />
                    {text}
                  </span>
                </td>
              );
            }
            return (
              <td className="px-3 py-2 text-foreground/80 min-w-[80px] max-w-[320px] break-words">{children}</td>
            );
          },

          // ── Lists ──
          ul: ({ children }) => (
            <ul className="space-y-1 my-2 ml-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-1 my-2 ml-1 list-decimal list-inside">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-sm text-foreground/90 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span className="flex-1">{children}</span>
            </li>
          ),

          // ── Code blocks ──
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = codeClassName?.includes("language-");
            if (isBlock) {
              return (
                <div className="my-3 rounded-lg overflow-hidden border border-border/50">
                  <div className="bg-muted/80 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border/50">
                    {codeClassName?.replace("language-", "") || "code"}
                  </div>
                  <pre className="bg-muted/40 p-3 overflow-x-auto">
                    <code className="text-xs font-mono text-foreground/90">{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono font-semibold">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,

          // ── Blockquote ──
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          ),

          // ── Horizontal rule ──
          hr: () => (
            <hr className="my-3 border-border/30" />
          ),

          // ── Links ──
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
