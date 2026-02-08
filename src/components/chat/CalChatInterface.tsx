import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  Send, 
  Paperclip, 
  X, 
  Loader2, 
  Pencil, 
  Check,
  Zap,
  ListOrdered,
  AlertTriangle,
  FileIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Message } from "./ChatMessage";
import { CalChatMessage } from "./CalChatMessage";
import { CalStepProgress } from "./CalStepProgress";
import { sendAgentMessage } from "@/lib/agent";
import { UploadedFile } from "./ChatInput";

type CalculationMode = "smart" | "step-by-step" | null;

interface CalChatInterfaceProps {
  onBack?: () => void;
}

export function CalChatInterface({ onBack }: CalChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [calculationMode, setCalculationMode] = useState<CalculationMode>(null);
  const [showModeSelection, setShowModeSelection] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
    }
  }, [inputValue]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to upload files",
          variant: "destructive",
        });
        return;
      }

      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop() || 'bin';
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('estimation-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { getSignedFileUrl } = await import("@/lib/storageUtils");
        const signedUrl = await getSignedFileUrl(filePath);

        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: signedUrl,
          path: filePath,
        });
      }

      if (newFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...newFiles]);
        
        // Auto-set project name from first file
        if (!projectName && newFiles.length > 0) {
          const firstFileName = newFiles[0].name;
          const nameWithoutExt = firstFileName.replace(/\.[^/.]+$/, "");
          setProjectName(nameWithoutExt);
        }
        
        // Show mode selection after files uploaded
        setShowModeSelection(true);
        
        toast({
          title: "Files uploaded",
          description: `${newFiles.length} file(s) ready for analysis`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = async (index: number) => {
    const file = uploadedFiles[index];
    try {
      await supabase.storage.from('estimation-files').remove([file.path]);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setShowModeSelection(false);
      setCalculationMode(null);
    }
  };

  const startCalculation = async (mode: CalculationMode) => {
    setCalculationMode(mode);
    setShowModeSelection(false);
    
    // Build initial message based on mode
    const modeText = mode === "smart" 
      ? "Smart Estimate - Full Auto-Takeoff" 
      : "Step-by-Step Estimation";
    
    const filesList = uploadedFiles.map(f => `- ${f.name}`).join('\n');
    const initialPrompt = mode === "smart"
      ? `Please perform a Smart Estimate (Full Auto-Takeoff) on the uploaded drawings. Execute all 8 steps automatically and provide a comprehensive summary with the final weight in TONS.\n\nProject: ${projectName}\nFiles:\n${filesList}`
      : `Please start a Step-by-Step Estimation on the uploaded drawings. Begin with Step 1 (Scope ID) and wait for my approval before proceeding to each next step.\n\nProject: ${projectName}\nFiles:\n${filesList}`;
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: `📐 Starting ${modeText}\n\n📁 Project: ${projectName}\n\n${uploadedFiles.length} file(s) attached`,
      timestamp: new Date(),
      status: "sent",
      files: uploadedFiles,
    };
    setMessages([userMessage]);
    setIsTyping(true);
    
    try {
      const attachedFiles = uploadedFiles.map(f => ({ name: f.name, url: f.url }));
      const response = await sendAgentMessage(
        "estimation",
        initialPrompt,
        [],
        { calculationMode: mode, projectName },
        attachedFiles
      );
      
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: response.reply,
        agent: "estimation",
        timestamp: new Date(),
        status: "sent",
      };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error("Agent error:", error);
      toast({
        title: "Calculation failed",
        description: error instanceof Error ? error.message : "Failed to start calculation",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
      status: "sent",
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    
    try {
      const history = messages.map(m => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      }));
      
      const response = await sendAgentMessage(
        "estimation",
        inputValue.trim(),
        history,
        { calculationMode, projectName }
      );
      
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: response.reply,
        agent: "estimation",
        timestamp: new Date(),
        status: "sent",
      };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error("Agent error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, isTyping, messages, calculationMode, projectName, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Calculate step progress
  const currentStep = messages.length > 0 
    ? messages.filter(m => m.role === "agent").slice(-1)[0]?.content 
    : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with project name */}
      {(uploadedFiles.length > 0 || messages.length > 0) && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
            <span className="text-lg">📐</span>
          </div>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="h-8 text-sm font-semibold"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingName(false)}>
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{projectName || "New Project"}</span>
                <button onClick={() => setIsEditingName(true)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {calculationMode === "smart" && "Smart Estimate Mode"}
              {calculationMode === "step-by-step" && "Step-by-Step Mode"}
              {!calculationMode && `${uploadedFiles.length} file(s) ready`}
            </p>
          </div>
        </div>
      )}

      {/* Step Progress */}
      {calculationMode && messages.length > 0 && (
        <CalStepProgress 
          currentStep={currentStep ? detectStep(currentStep) : null} 
          completedSteps={getCompletedSteps(messages)} 
        />
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !showModeSelection ? (
          // Welcome Screen
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center mb-6 shadow-xl">
              <span className="text-5xl">📐</span>
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Cal - Senior Estimator</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              High-precision rebar & WWM takeoff using the <span className="text-primary font-semibold">Changy Method</span>
            </p>
            
            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-xl mb-8 max-w-lg text-left">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">Important Notice</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI calculations may contain errors. Always verify results against your original drawings before use. This tool assists estimation but does not replace professional engineering review.
                </p>
              </div>
            </div>
            
            {/* Upload prompt */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">Upload your drawings to get started</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
                size="lg"
              >
                <Paperclip className="w-5 h-5" />
                Upload Drawings
              </Button>
              <p className="text-xs text-muted-foreground">
                Supports PDF, DWG, DXF, Images, and more
              </p>
            </div>
          </div>
        ) : showModeSelection ? (
          // Mode Selection Screen
          <div className="flex flex-col items-center justify-center h-full p-6">
            {/* Project name header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                <span className="text-2xl">📐</span>
              </div>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="h-9 text-lg font-bold"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{projectName}</h2>
                    <button onClick={() => setIsEditingName(true)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{uploadedFiles.length} file(s) uploaded</p>
              </div>
            </div>
            
            {/* Uploaded files list */}
            <div className="w-full max-w-md mb-8 space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                  <FileIcon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <button onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            
            {/* Mode selection */}
            <p className="text-sm font-medium mb-4">Choose calculation method:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
              <button
                onClick={() => startCalculation("smart")}
                className="flex flex-col items-center gap-3 p-6 bg-card border-2 border-primary/30 hover:border-primary rounded-xl transition-all hover:shadow-lg"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Smart Calculation</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatic 8-step analysis with final summary in tons
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => startCalculation("step-by-step")}
                className="flex flex-col items-center gap-3 p-6 bg-card border-2 border-border hover:border-primary/50 rounded-xl transition-all hover:shadow-lg"
              >
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                  <ListOrdered className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Step-by-Step</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review and approve each step with full control
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          // Chat Messages
          <div className="p-4 space-y-6">
            {messages.map((message) => (
              <CalChatMessage key={message.id} message={message} />
            ))}
            {isTyping && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                  <span className="text-lg">📐</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cal is analyzing...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4 bg-card/50">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "p-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all",
              isUploading && "opacity-50 cursor-not-allowed"
            )}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          <div className="flex-1 flex items-end gap-2 bg-card border border-border rounded-xl p-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={calculationMode ? "Ask Cal or provide corrections..." : "Upload drawings to start..."}
              disabled={isTyping || (!calculationMode && messages.length === 0)}
              rows={1}
              className={cn(
                "flex-1 bg-transparent resize-none text-sm py-2 px-2",
                "placeholder:text-muted-foreground",
                "focus:outline-none",
                "disabled:opacity-50"
              )}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="h-9 w-9 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI calculations require verification • Results in metric tons
        </p>
      </div>
    </div>
  );
}

// Helper functions
function detectStep(content: string): string | null {
  const patterns: { pattern: RegExp; step: string }[] = [
    { pattern: /step\s*1|scope\s*(id|identification)|3\+3\s*scan/i, step: "1" },
    { pattern: /step\s*2(?!\.5)|classification|new\s*(vs|or)\s*existing/i, step: "2" },
    { pattern: /step\s*2\.5|rebar\s*type|grades?\s*(and|,)\s*sizes?/i, step: "2.5" },
    { pattern: /step\s*3|measurement|scale\s*calculation/i, step: "3" },
    { pattern: /step\s*4|dimension|verification/i, step: "4" },
    { pattern: /step\s*5(?!\.5)|quantity|spacing|piece\s*count/i, step: "5" },
    { pattern: /step\s*5\.5|optimization|overlap/i, step: "5.5" },
    { pattern: /step\s*6|weight\s*calculation/i, step: "6" },
    { pattern: /step\s*7|final\s*summary|consolidate/i, step: "7" },
    { pattern: /step\s*8|wwm|wire\s*mesh/i, step: "8" },
  ];

  for (const { pattern, step } of patterns) {
    if (pattern.test(content)) return step;
  }
  return null;
}

function getCompletedSteps(messages: Message[]): string[] {
  const completed = new Set<string>();
  const stepOrder = ["1", "2", "2.5", "3", "4", "5", "5.5", "6", "7", "8"];
  
  for (const msg of messages) {
    if (msg.role === "agent") {
      const step = detectStep(msg.content);
      if (step) {
        const stepIndex = stepOrder.indexOf(step);
        for (let i = 0; i < stepIndex; i++) {
          completed.add(stepOrder[i]);
        }
      }
    }
  }
  return Array.from(completed);
}
