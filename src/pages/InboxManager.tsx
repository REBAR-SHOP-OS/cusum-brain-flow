import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Loader2, Mail, Tag, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = "intro" | "labels" | "drafts" | "connect" | "setup";

interface EmailPreview {
  sender: string;
  label: string;
  labelColor: string;
  subject: string;
}

const sampleEmails: EmailPreview[] = [
  { sender: "Sophie Tran", label: "To Respond", labelColor: "bg-red-400", subject: "Follow-up on the product mockups" },
  { sender: "Daily Digest", label: "Notification", labelColor: "bg-cyan-400", subject: "☕ Morning insights and headlines" },
  { sender: "Marta Li", label: "FYI", labelColor: "bg-amber-400", subject: "Team lunch schedule — Friday at 1 PM" },
  { sender: "Ethan Cole", label: "To Respond", labelColor: "bg-red-400", subject: "Need approval: marketing budget" },
  { sender: "Hang Mill", label: "Cold outreach", labelColor: "bg-emerald-400", subject: "Automate your business..." },
  { sender: "TechMart", label: "Notification", labelColor: "bg-cyan-400", subject: "Your invoice #48291" },
];

const labelTypes = [
  { name: "To Respond", color: "bg-red-400" },
  { name: "FYI", color: "bg-blue-400" },
  { name: "Cold Email", color: "bg-emerald-400" },
  { name: "Awaiting Reply", color: "bg-amber-400" },
  { name: "Marketing", color: "bg-pink-400" },
  { name: "Meeting Update", color: "bg-violet-400" },
  { name: "Actioned", color: "bg-green-500" },
];

const setupSteps = [
  { id: "connect", label: "Connecting to your inbox", status: "done" as const },
  { id: "labels", label: "Adding smart labels...", status: "loading" as const },
  { id: "scan", label: "Scanning for important emails...", status: "pending" as const },
  { id: "drafts", label: "Preparing first draft replies...", status: "pending" as const },
];

export default function InboxManager() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("intro");
  const [setupProgress, setSetupProgress] = useState(setupSteps);

  const handleGetStarted = () => setCurrentStep("labels");
  const handleContinueToLabels = () => setCurrentStep("drafts");
  const handleContinueToDrafts = () => setCurrentStep("connect");
  
  const handleConnect = (provider: "gmail" | "outlook") => {
    setCurrentStep("setup");
    // Simulate setup progress
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= setupSteps.length) {
        clearInterval(interval);
        // Navigate to inbox after setup
        setTimeout(() => navigate("/"), 1500);
        return;
      }
      setSetupProgress(prev => 
        prev.map((s, i) => ({
          ...s,
          status: i < step ? "done" : i === step ? "loading" : "pending"
        }))
      );
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Beta Banner */}
      <div className="bg-[#4FC3F7] text-white py-2 px-4 flex items-center justify-center gap-2 text-sm">
        <span className="text-lg">🎉</span>
        <span>Cassie Inbox Manager is free while in beta - no credits used. We'll let you know before that changes.</span>
        <button className="ml-auto">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center">
          
          {/* Step: Intro */}
          {currentStep === "intro" && (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold">Turn on Inbox Manager</h1>
              <p className="text-muted-foreground">
                Cassie helps handle your inbox smarter — labels what matters, marks what's done, and drafts replies ready for your review.
              </p>

              <div className="flex gap-8 justify-center items-start">
                {/* Category Labels */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-sm">To Respond (2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm">FYI (1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm">Cold outreach</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-400" />
                    <span className="text-sm">Notification</span>
                  </div>
                </div>

                {/* Email Preview */}
                <div className="space-y-2 text-left">
                  {sampleEmails.slice(0, 6).map((email, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-24 truncate text-muted-foreground">{email.sender}</span>
                      <span className={cn("px-2 py-0.5 rounded text-xs text-white", email.labelColor)}>
                        {email.label}
                      </span>
                      <span className="truncate max-w-48">{email.subject}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleGetStarted} className="bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white px-8">
                Get started
              </Button>
            </div>
          )}

          {/* Step: Organize with Labels */}
          {currentStep === "labels" && (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold">Organize your Inbox</h1>
              <p className="text-muted-foreground">
                Cassie adds labels so you instantly can see what needs your attention — without digging through clutter.
              </p>

              {/* Label chips */}
              <div className="flex flex-wrap justify-center gap-3">
                {labelTypes.map((label) => (
                  <div key={label.name} className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded", label.color)} />
                    <span className="text-sm">{label.name}</span>
                  </div>
                ))}
              </div>

              {/* Sample emails with labels */}
              <div className="space-y-2 max-w-md mx-auto">
                {sampleEmails.slice(0, 3).map((email, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm opacity-70">
                    <span className="w-24 truncate text-muted-foreground">{email.sender}</span>
                    <span className={cn("px-2 py-0.5 rounded text-xs text-white", email.labelColor)}>
                      {email.label}
                    </span>
                    <span className="truncate">{email.subject}</span>
                  </div>
                ))}
              </div>

              {/* Feature callout */}
              <div className="flex items-center gap-3 justify-center text-left">
                <Tag className="w-5 h-5 text-[#4FC3F7]" />
                <div>
                  <p className="font-medium">Smart labels</p>
                  <p className="text-sm text-muted-foreground">Cassie will automatically categorize incoming emails</p>
                </div>
              </div>

              <Button onClick={handleContinueToLabels} className="bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white px-8">
                Continue
              </Button>
            </div>
          )}

          {/* Step: Smart Drafts */}
          {currentStep === "drafts" && (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold">Reply faster to emails</h1>
              <p className="text-muted-foreground">
                Cassie uses your Brain AI context to write draft replies in your tone. You'll review and send them — nothing leaves your inbox without your approval.
              </p>

              {/* Email compose preview */}
              <div className="border rounded-lg p-4 max-w-lg mx-auto text-left bg-card">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span>To: carles@sintra.ai</span>
                  <span className="ml-auto text-xs">Cc Bcc</span>
                </div>
                <div className="space-y-3 text-sm">
                  <p>Hi Carles,</p>
                  <p className="text-muted-foreground">
                    Thanks for putting this together so clearly. Let's move forward with option 2 - the 1,000/M events plan + 1M replays ($1,500). Please go ahead and prepare the DocuSign and we'll get it signed before the break.
                  </p>
                  <p>Best,<br />Rokas</p>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <Button size="sm" className="bg-[#4FC3F7] hover:bg-[#4FC3F7]/90">Send</Button>
                  <span className="text-xs text-muted-foreground">Aa</span>
                </div>
              </div>

              {/* Feature callout */}
              <div className="flex items-center gap-3 justify-center text-left">
                <Edit3 className="w-5 h-5 text-[#4FC3F7]" />
                <div>
                  <p className="font-medium">Smart drafts</p>
                  <p className="text-sm text-muted-foreground">Draft replies appear in both Sintra and your inbox</p>
                </div>
              </div>

              <Button onClick={handleContinueToDrafts} className="bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white px-8">
                Continue
              </Button>
            </div>
          )}

          {/* Step: Connect Account */}
          {currentStep === "connect" && (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold">Connect your account</h1>
              <p className="text-muted-foreground">
                Choose your email provider to get started
              </p>

              <div className="space-y-3 max-w-sm mx-auto">
                <button
                  onClick={() => handleConnect("gmail")}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                    </svg>
                    <span className="font-medium">Connect with Gmail</span>
                  </div>
                  <span className="text-muted-foreground">Connect</span>
                </button>

                <button
                  onClick={() => handleConnect("outlook")}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576-.159.152-.362.228-.61.228h-8.456V6.545h8.456c.248 0 .451.076.61.228.158.152.238.345.238.576zm-9.304-1.3v12.074L0 15.876V3.49l14.696 2.597zm-.912 9.063V8.65l-3.435.356v6.788l3.435-.644zm-4.347.85V8.15L6.545 8.5v7.15l2.892-.65zm-3.804.85V7.8l-2.741.3v8.45l2.741-.6z"/>
                    </svg>
                    <span className="font-medium">Connect with Outlook</span>
                  </div>
                  <span className="text-muted-foreground">Connect</span>
                </button>
              </div>
            </div>
          )}

          {/* Step: Setup Progress */}
          {currentStep === "setup" && (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold">Cassie is setting up<br />your inbox</h1>

              <div className="space-y-4 max-w-sm mx-auto text-left">
                {setupProgress.map((step) => (
                  <div key={step.id} className="flex items-center justify-between">
                    <span className={cn(
                      step.status === "pending" && "text-muted-foreground",
                      step.status === "done" && "text-foreground"
                    )}>
                      {step.label}
                    </span>
                    {step.status === "done" && (
                      <Check className="w-5 h-5 text-[#4FC3F7]" />
                    )}
                    {step.status === "loading" && (
                      <Loader2 className="w-5 h-5 text-[#4FC3F7] animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close button */}
      <button 
        onClick={() => navigate("/integrations")}
        className="absolute top-16 left-6"
      >
        <X className="w-6 h-6 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}
