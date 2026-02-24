import * as React from "react";
import { Loader2, SpellCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, value, ...props }, ref) => {
    const [checking, setChecking] = React.useState(false);
    const { toast } = useToast();

    const currentValue = typeof value === "string" ? value : "";
    const showCheck = typeof value === "string" && currentValue.trim().length > 2;

    const handleCheck = async () => {
      if (!currentValue || currentValue.trim().length < 3) return;
      setChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke("grammar-check", {
          body: { text: currentValue },
        });

        if (error) throw error;

        if (data?.changed && onChange) {
          const syntheticEvent = {
            target: { value: data.corrected } as HTMLTextAreaElement,
            currentTarget: { value: data.corrected } as HTMLTextAreaElement,
            nativeEvent: new Event("input"),
            isDefaultPrevented: () => false,
            isPropagationStopped: () => false,
            persist: () => {},
            bubbles: true,
            cancelable: false,
            defaultPrevented: false,
            eventPhase: 0,
            isTrusted: true,
            preventDefault: () => {},
            stopPropagation: () => {},
            stopImmediatePropagation: () => {},
            type: "change",
            timeStamp: Date.now(),
          } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
          onChange(syntheticEvent);
          toast({ title: "✅ Text corrected", description: "Grammar and spelling have been fixed." });
        } else {
          toast({ title: "✨ Looks good!", description: "No issues found." });
        }
      } catch (err) {
        console.error("grammar-check error:", err);
        toast({
          title: "Check failed",
          description: "Could not reach grammar checker. Try again.",
          variant: "destructive",
        });
      } finally {
        setChecking(false);
      }
    };

    return (
      <div className="relative">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          ref={ref}
          onChange={onChange}
          value={value}
          {...props}
        />
        {showCheck && (
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            title="Check grammar & spelling"
            className={cn(
              "absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
              "bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {checking ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <SpellCheck className="w-3 h-3" />
            )}
            {checking ? "Checking..." : "Check"}
          </button>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
