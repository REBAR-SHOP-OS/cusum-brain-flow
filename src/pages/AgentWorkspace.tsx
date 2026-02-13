import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeftClose, PanelLeft, Brain, ImageIcon, CalendarIcon, PhoneOff } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { sendAgentMessage, AgentType, ChatMessage as AgentChatMessage, PixelPost } from "@/lib/agent";
import { AgentSuggestions } from "@/components/agent/AgentSuggestions";
import { agentSuggestions } from "@/components/agent/agentSuggestionsData";
import { AgentHistorySidebar } from "@/components/agent/AgentHistorySidebar";
import { useChatSessions } from "@/hooks/useChatSessions";
import { cn } from "@/lib/utils";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { useAuth } from "@/lib/auth";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { PixelBrainDialog } from "@/components/social/PixelBrainDialog";
import { ImageGeneratorDialog } from "@/components/social/ImageGeneratorDialog";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { VizzyApprovalDialog, PendingAction } from "@/components/vizzy/VizzyApprovalDialog";
import { useWebPhone } from "@/hooks/useWebPhone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AgentWorkspace() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const config = agentConfigs[agentId || ""] || agentConfigs.sales;
  const { isSuperAdmin } = useSuperAdmin();
  const [webPhoneState, webPhoneActions] = useWebPhone();

  // Initialize WebPhone for Vizzy (super admin only)
  useEffect(() => {
    if (agentId === "assistant" && isSuperAdmin && webPhoneState.status === "idle") {
      webPhoneActions.initialize();
    }
    return () => {
      if (agentId === "assistant") webPhoneActions.dispose();
    };
  }, [agentId, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block non-super-admins from accessing Vizzy
  useEffect(() => {
    if (agentId === "assistant" && !isSuperAdmin) {
      navigate("/home", { replace: true });
    }
  }, [agentId, isSuperAdmin, navigate]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [autoBriefingSent, setAutoBriefingSent] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pendingPixelSlot, setPendingPixelSlot] = useState<number | null>(null);
  const [pixelDateMessage, setPixelDateMessage] = useState<string>("");
  const [lastPixelPost, setLastPixelPost] = useState<PixelPost | null>(null);
  

  const { sessions, loading: sessionsLoading, fetchSessions, createSession, addMessage, getSessionMessages, deleteSession } = useChatSessions();
  const hasConversation = messages.length > 0;
  const suggestions = agentSuggestions[agentId || "sales"] || agentSuggestions.sales;

  // Check if this user has a mapping to this agent for auto-briefing
  const mapping = getUserAgentMapping(user?.email);
  const isUsersPrimaryAgent = mapping?.agentKey === agentId;

  // Auto-briefing for mapped users on their primary agent
  useEffect(() => {
    if (isUsersPrimaryAgent && !autoBriefingSent && messages.length === 0 && !isLoading) {
      const state = location.state as { initialMessage?: string } | null;
      if (state?.initialMessage) return; // skip if coming from quick action
      
      setAutoBriefingSent(true);
      let briefingPrompt = "";
      if (mapping?.userRole === "ceo") {
        briefingPrompt = "Give me my daily executive briefing — business health, exceptions, and anything that needs my attention across all departments.";
      } else if (mapping?.userRole === "shop_supervisor") {
        briefingPrompt = "Give me my shop floor briefing — machine status, today's production queue, maintenance alerts, and anything that needs my attention.";
      } else if (mapping?.userRole === "estimator") {
        briefingPrompt = "Give me my estimating briefing — open takeoffs, QC flags, and drawing revisions needing review.";
      }
      if (briefingPrompt) {
        handleSend(briefingPrompt);
      }
    }
  }, [isUsersPrimaryAgent, autoBriefingSent, messages.length, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a session's messages
  const loadSession = useCallback(async (sessionId: string) => {
    const msgs = await getSessionMessages(sessionId);
    setMessages(
      msgs.map((m) => ({
        id: m.id,
        role: m.role as "user" | "agent",
        content: m.content,
        agent: m.agent_type as any,
        timestamp: new Date(m.created_at),
      }))
    );
    setActiveSessionId(sessionId);
    setAutoBriefingSent(true); // don't auto-brief when loading history
  }, [getSessionMessages]);

  // Start a new empty chat
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    setAutoBriefingSent(true); // don't auto-brief on manual new chat
  }, []);

  // Auto-send initial message from Quick Actions
  useEffect(() => {
    const state = location.state as { initialMessage?: string } | null;
    if (state?.initialMessage && messages.length === 0 && !isLoading) {
      window.history.replaceState({}, "");
      setAutoBriefingSent(true);
      handleSend(state.initialMessage);
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendInternal = useCallback(async (content: string, slotOverride?: number) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Create session on first message if none active
    let sessionId = activeSessionId;
    if (!sessionId) {
      const sessionTitle = agentId === "eisenhower"
        ? format(new Date(), "yyyy-MM-dd (EEE, MMM d)")
        : agentId === "social"
          ? format(selectedDate, "yyyy-MM-dd")
          : content;
      sessionId = await createSession(sessionTitle, config.name);
      setActiveSessionId(sessionId);
    }

    // Persist user message
    if (sessionId) {
      addMessage(sessionId, "user", content);
    }

    // Build context with user role info
    const extraContext: Record<string, unknown> = {};
    if (mapping) {
      extraContext.userRole = mapping.userRole;
      if (mapping.userRole === "ceo") extraContext.isCEO = true;
      if (mapping.userRole === "shop_supervisor") extraContext.isShopSupervisor = true;
    }

    try {
      const history: AgentChatMessage[] = messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

      const response = await sendAgentMessage(config.agentType, content, history, extraContext, undefined, slotOverride);

      // Track pixel sequential flow
      if (agentId === "social" && response.nextSlot) {
        setPendingPixelSlot(response.nextSlot);
        setPixelDateMessage(content);
      } else if (agentId === "social" && response.nextSlot === null) {
        setPendingPixelSlot(null);
      }

      // Store pixel post data for saving on approval
      if (agentId === "social" && response.pixelPost) {
        setLastPixelPost(response.pixelPost);
      }

      // Build reply with created notification badges
      let replyContent = response.reply;

      // Parse vizzy-action blocks for RingCentral actions (assistant only)
      if (agentId === "assistant" && isSuperAdmin) {
        const actionMatch = replyContent.match(/\[VIZZY-ACTION\]([\s\S]*?)\[\/VIZZY-ACTION\]/);
        if (actionMatch) {
          try {
            const actionData = JSON.parse(actionMatch[1]);
            const desc = actionData.type === "ringcentral_call"
              ? `Call ${actionData.contact_name || actionData.phone}`
              : `Send SMS to ${actionData.contact_name || actionData.phone}: "${actionData.message?.slice(0, 80)}..."`;
            
            setPendingAction({
              id: crypto.randomUUID(),
              action: actionData.type,
              description: desc,
              params: actionData,
                resolve: async (approved: boolean) => {
                setPendingAction(null);
                if (approved) {
                  try {
                    if (actionData.type === "ringcentral_call") {
                      const success = await webPhoneActions.call(actionData.phone, actionData.contact_name);
                      if (!success) throw new Error("WebPhone call failed");
                    } else {
                      const { data, error } = await supabase.functions.invoke("ringcentral-action", {
                        body: actionData,
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success("SMS sent!");
                    }
                  } catch (err) {
                    toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  }
                } else {
                  toast.info("Action cancelled");
                }
              },
            });
          } catch (e) {
            console.warn("Failed to parse vizzy-action:", e);
          }
          replyContent = replyContent.replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/, "").trim();
        }
      }

      if (response.createdNotifications && response.createdNotifications.length > 0) {
        const notifSummary = response.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }

      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: replyContent,
        agent: config.agentType as any,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Persist agent message
      if (sessionId) {
        addMessage(sessionId, "agent", response.reply, config.agentType);
      }
    } catch (error) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        content: `Sorry, I encountered an error. ${error instanceof Error ? error.message : ""}`,
        agent: config.agentType as any,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, config.agentType, config.name, activeSessionId, createSession, addMessage, mapping, selectedDate]);

  const handleSend = useCallback((content: string) => {
    handleSendInternal(content);
  }, [handleSendInternal]);

  const handleApprovePixelSlot = useCallback(async () => {
    // Save current post to social_posts as draft
    if (lastPixelPost && user) {
      try {
        const scheduledDate = new Date(selectedDate);
        // Parse slot time (e.g. "06:30 AM") and set on date
        const timeMatch = lastPixelPost.slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const ampm = timeMatch[3].toUpperCase();
          if (ampm === "PM" && hours !== 12) hours += 12;
          if (ampm === "AM" && hours === 12) hours = 0;
          scheduledDate.setHours(hours, minutes, 0, 0);
        }

        const { error } = await supabase.from("social_posts").insert({
          platform: lastPixelPost.platform || "instagram",
          status: "draft",
          title: lastPixelPost.theme || lastPixelPost.product || "Pixel Post",
          content: lastPixelPost.caption,
          image_url: lastPixelPost.imageUrl || null,
          hashtags: lastPixelPost.hashtags ? lastPixelPost.hashtags.split(/\s+/).filter(Boolean) : [],
          scheduled_date: scheduledDate.toISOString(),
          user_id: user.id,
        });
        if (error) {
          console.error("Failed to save pixel post:", error);
          toast.error("Failed to save post to calendar");
        } else {
          toast.success("Post saved to calendar as draft ✅");
        }
      } catch (err) {
        console.error("Error saving pixel post:", err);
        toast.error("Error saving post");
      }
    }

    // Continue to next slot or clear state for final post
    if (pendingPixelSlot && pixelDateMessage) {
      handleSendInternal(pixelDateMessage, pendingPixelSlot);
      setPendingPixelSlot(null);
      setLastPixelPost(null);
    } else {
      // Final post (slot 5) — just clear state
      setLastPixelPost(null);
    }
  }, [pendingPixelSlot, pixelDateMessage, handleSendInternal, lastPixelPost, user, selectedDate]);

  const handleRegenerateImage = useCallback((imageUrl: string, alt: string) => {
    const productName = alt || "this product";
    handleSendInternal(`Regenerate post for ${productName}`);
  }, [handleSendInternal]);

  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  

  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) setSelectedDate(date);
  }, []);

  return (
    <div className="flex h-full">
      {/* History Sidebar - Left (Desktop) */}
      {sidebarOpen && (
        <div className="w-64 border-r border-border flex-shrink-0 animate-fade-in hidden md:flex flex-col">
          <AgentHistorySidebar
            agentId={agentId || "sales"}
            agentName={config.name}
            agentRole={config.role}
            agentImage={config.image}
            activeSessionId={activeSessionId}
            onSelectSession={loadSession}
            onNewChat={handleNewChat}
            sessions={sessions.filter((s) => s.agent_name === config.name)}
            loading={sessionsLoading}
            deleteSession={deleteSession}
          />
        </div>
      )}

      {/* Mobile History Drawer */}
      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileHistoryOpen(false)}>
          <div
            className="absolute top-0 left-0 bottom-0 w-72 bg-card border-r border-border shadow-xl animate-fade-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <AgentHistorySidebar
              agentId={agentId || "sales"}
              agentName={config.name}
              agentRole={config.role}
              agentImage={config.image}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => { loadSession(id); setMobileHistoryOpen(false); }}
              onNewChat={() => { handleNewChat(); setMobileHistoryOpen(false); }}
              sessions={sessions.filter((s) => s.agent_name === config.name)}
              loading={sessionsLoading}
              deleteSession={deleteSession}
            />
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          {/* Desktop sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden md:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          {/* Mobile: always show agent identity + history toggle */}
          <button
            className="flex items-center gap-2 md:hidden"
            onClick={() => setMobileHistoryOpen(true)}
          >
            <img src={config.image} alt={config.name} className="w-7 h-7 rounded-full object-cover" />
            <div className="text-left">
              <span className="text-sm font-semibold leading-none">{config.name}</span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{config.role}</p>
            </div>
            <PanelLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          {/* Desktop: show agent when sidebar closed */}
          {!sidebarOpen && (
            <div className="items-center gap-2 hidden md:flex">
              <img src={config.image} alt={config.name} className="w-6 h-6 rounded-full object-cover" />
              <span className="text-sm font-medium">{config.name}</span>
            </div>
          )}
          <div className="flex-1" />
          {agentId === "assistant" && isSuperAdmin && (webPhoneState.status === "calling" || webPhoneState.status === "in_call") && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-destructive animate-pulse">
                {webPhoneState.status === "calling" ? "Dialing..." : "On Call"}
              </span>
              <Button variant="destructive" size="sm" className="h-7 gap-1" onClick={webPhoneActions.hangup}>
                <PhoneOff className="w-3 h-3" /> Hang up
              </Button>
            </div>
          )}
          {agentId === "social" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    title="Change date"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{format(selectedDate, "yyyy-MM-dd")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateChange}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setImageGenOpen(true)}
                title="AI Image Generator (ChatGPT)"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setBrainOpen(true)}
                title="Pixel Brain – Knowledge & Instructions"
              >
                <Brain className="w-4 h-4" />
              </Button>
            </>
          )}
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">thinking...</span>
          )}
        </div>

        {/* Content: hero or conversation */}
        {!hasConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-4">
            <div className="text-center mb-6">
              <h1 className="text-xl sm:text-3xl font-bold leading-tight">
                Hey, it's <span className="text-primary">{config.name}</span>.
              </h1>
              <p className="text-base sm:text-2xl font-semibold text-foreground mt-1">
                What can I help you with?
              </p>
              {agentId === "social" && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border inline-block">
                  <p className="text-sm text-muted-foreground">📅 Selected date:</p>
                  <p className="text-lg font-bold text-primary">{format(selectedDate, "yyyy-MM-dd (EEEE, MMMM d)")}</p>
                  
                </div>
              )}
            </div>

            <div className="w-full max-w-xl mb-4">
              <ChatInput
                onSend={handleSend}
                placeholder={config.placeholder}
                disabled={isLoading}
showFileUpload={true}
                showSmartMode
                onLiveChatClick={isSuperAdmin ? () => navigate("/vizzy") : undefined}
              />
            </div>

            <div className="flex justify-center mb-3">
              <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
            </div>

            <AgentSuggestions
              suggestions={suggestions}
              agentName={config.name}
              agentImage={config.image}
              onSelect={handleSend}
            />
          </div>
        ) : (
          <>
            <ChatThread
              messages={messages}
              isLoading={isLoading}
              onRegenerateImage={handleRegenerateImage}
              
              agentImage={config.image}
              agentName={config.name}
              isPixelAgent={agentId === "social"}
              pendingPixelSlot={pendingPixelSlot}
              hasUnsavedPixelPost={!!lastPixelPost && !pendingPixelSlot}
              onApprovePixelSlot={handleApprovePixelSlot}
            />
            <ChatInput
              onSend={handleSend}
              placeholder={config.placeholder}
              disabled={isLoading}
              showFileUpload={true}
              showSmartMode
              onLiveChatClick={isSuperAdmin ? () => navigate("/vizzy") : undefined}
            />
          </>
        )}
      </div>


      <PixelBrainDialog open={brainOpen} onOpenChange={setBrainOpen} />
      <ImageGeneratorDialog open={imageGenOpen} onOpenChange={setImageGenOpen} />
      {agentId === "assistant" && isSuperAdmin && (
        <VizzyApprovalDialog pendingAction={pendingAction} />
      )}
    </div>
  );
}
