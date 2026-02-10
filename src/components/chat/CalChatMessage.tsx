import { cn } from "@/lib/utils";
import { User, FileIcon, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ContentActions } from "@/components/shared/ContentActions";
import { Message } from "./ChatMessage";
import { CalStepCard, CHANGY_STEPS, detectStepFromMessage } from "./CalStepProgress";
import ReactMarkdown from "react-markdown";

interface CalChatMessageProps {
  message: Message;
}

export function CalChatMessage({ message }: CalChatMessageProps) {
  const isUser = message.role === "user";
  const currentStep = !isUser ? detectStepFromMessage(message.content) : null;
  const stepInfo = currentStep ? CHANGY_STEPS.find(s => s.id === currentStep) : null;

  // Parse uncertainties (items with !) from the message
  const uncertainties = extractUncertainties(message.content);
  const hasFinalResult = message.content.includes("[FINAL_RESULT]");

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          isUser ? "bg-primary/20" : "bg-gradient-to-br from-primary/80 to-primary"
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-primary" />
        ) : (
          <span className="text-lg">📐</span>
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex flex-col gap-2 max-w-[85%]", isUser ? "items-end" : "items-start")}>
        {/* Agent badge for Cal */}
        {!isUser && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary">Cal</span>
            <span className="text-xs text-muted-foreground">• Senior Estimator</span>
          </div>
        )}

        {/* Step indicator card */}
        {stepInfo && (
          <CalStepCard step={stepInfo} isActive={true} />
        )}

        {/* Files attached */}
        {message.files && message.files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.files.map((file, index) => (
              <a
                key={index}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-secondary/70 hover:bg-secondary rounded-lg px-3 py-2 text-xs transition-colors"
              >
                <FileIcon className="w-4 h-4" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <Download className="w-3 h-3 opacity-60" />
              </a>
            ))}
          </div>
        )}

        {/* Main message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser 
              ? "bg-primary text-primary-foreground" 
              : "bg-card border border-border shadow-sm"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content || (message.files?.length ? "📎 Files attached" : "")}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  strong: ({ children }) => (
                    <strong className="text-primary font-bold">{children}</strong>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1">{children}</td>
                  ),
                  code: ({ children }) => (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                      {children}
                    </code>
                  ),
                }}
              >
                {formatCalMessage(message.content)}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Final Result highlight */}
        {hasFinalResult && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Final Result Available</span>
          </div>
        )}

        {/* Uncertainties warning */}
        {uncertainties.length > 0 && (
          <div className="flex flex-col gap-1 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold text-warning">Uncertainties Detected</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
              {uncertainties.slice(0, 5).map((u, i) => (
                <li key={i}>• {u}</li>
              ))}
              {uncertainties.length > 5 && (
                <li className="text-warning">+ {uncertainties.length - 5} more...</li>
              )}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.status === "draft" && (
            <span className="text-warning">Draft — needs approval</span>
          )}
        </div>

        {/* Content Actions for agent messages */}
        {!isUser && message.content && (
          <ContentActions content={message.content} title={message.content.slice(0, 80)} source="estimation-chat" />
        )}
      </div>
    </div>
  );
}

// Extract items marked with ! for uncertainty
function extractUncertainties(content: string): string[] {
  const uncertainties: string[] = [];
  const regex = /([^.!?\n]{5,50})!/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && !text.includes("http") && !text.startsWith("!")) {
      uncertainties.push(text);
    }
  }
  return uncertainties;
}

// Format message for better display
function formatCalMessage(content: string): string {
  let formatted = content.replace(
    /\[FINAL_RESULT\]/g,
    "**✅ FINAL RESULT:**"
  );
  
  formatted = formatted.replace(
    /^(Step\s+\d+(?:\.\d+)?)\s*[-:]/gim,
    "### $1:"
  );
  
  return formatted;
}
