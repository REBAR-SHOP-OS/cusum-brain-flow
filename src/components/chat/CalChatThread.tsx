import { useRef, useEffect, useMemo } from "react";
import { Message } from "./ChatMessage";
import { CalChatMessage } from "./CalChatMessage";
import { CalStepProgress, detectStepFromMessage, getCompletedSteps } from "./CalStepProgress";
import { Ruler, FileSearch, Zap } from "lucide-react";

interface CalChatThreadProps {
  messages: Message[];
}

export function CalChatThread({ messages }: CalChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Calculate current step and completed steps
  const { currentStep, completedSteps } = useMemo(() => {
    let current: string | null = null;
    const completed = new Set<string>();
    const stepOrder = ["1", "2", "2.5", "3", "4", "5", "5.5", "6", "7", "8"];
    
    for (const msg of messages) {
      if (msg.role === "agent") {
        const step = detectStepFromMessage(msg.content);
        if (step) {
          // Mark previous steps as completed
          const stepIndex = stepOrder.indexOf(step);
          for (let i = 0; i < stepIndex; i++) {
            completed.add(stepOrder[i]);
          }
          current = step;
        }
      }
    }
    
    return {
      currentStep: current,
      completedSteps: Array.from(completed)
    };
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Step Progress Bar */}
        <CalStepProgress currentStep={null} completedSteps={[]} />
        
      {/* Empty State */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl">📐</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Gauge - Senior Estimator</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Using the <span className="font-semibold text-primary">Changy Method</span> for high-precision rebar & WWM takeoff
          </p>
            
          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-lg bg-card border border-border">
              <FileSearch className="w-5 h-5 text-primary mb-2" />
              <p className="text-xs font-medium">3+3 OCR Protocol</p>
              <p className="text-xs text-muted-foreground">6 scans for zero data loss</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <Ruler className="w-5 h-5 text-primary mb-2" />
              <p className="text-xs font-medium">8-Step Workflow</p>
              <p className="text-xs text-muted-foreground">From scope to final takeoff</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <Zap className="w-5 h-5 text-primary mb-2" />
              <p className="text-xs font-medium">Smart Estimate</p>
              <p className="text-xs text-muted-foreground">Full auto-takeoff mode</p>
            </div>
          </div>

            {/* Quick start prompts */}
            <div className="mt-6 space-y-2">
              <p className="text-xs text-muted-foreground">Try saying:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1.5 bg-muted rounded-full text-xs">
                  "Start estimation from this drawing"
                </span>
                <span className="px-3 py-1.5 bg-muted rounded-full text-xs">
                  "Smart Estimate (Full Auto)"
                </span>
                <span className="px-3 py-1.5 bg-muted rounded-full text-xs">
                  "Analyze rebar in foundation plan"
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Step Progress Bar */}
      <CalStepProgress currentStep={currentStep} completedSteps={completedSteps} />
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
        {messages.map((message) => (
          <CalChatMessage key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
