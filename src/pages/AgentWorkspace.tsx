import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeftClose, PanelLeft, Brain, CalendarIcon, PhoneOff, MessageSquare, LayoutGrid, Menu } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { Message } from "@/components/chat/ChatMessage";
import { sendAgentMessage, AgentType, ChatMessage as AgentChatMessage, PixelPost, AttachedFile } from "@/lib/agent";
import { backgroundAgentService } from "@/lib/backgroundAgentService";
import { UploadedFile } from "@/components/chat/ChatInput";
import { AgentSuggestions } from "@/components/agent/AgentSuggestions";
import { agentSuggestions } from "@/components/agent/agentSuggestionsData";
import { AgentHistorySidebar } from "@/components/agent/AgentHistorySidebar";
import { useChatSessions } from "@/hooks/useChatSessions";
import { cn } from "@/lib/utils";
import { agentConfigs } from "@/components/agent/agentConfigs";
import { useAuth } from "@/lib/auth";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { PixelBrainDialog } from "@/components/social/PixelBrainDialog";
import { EisenhowerInstructionsDialog } from "@/components/agent/EisenhowerInstructionsDialog";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
// VizzyApprovalDialog removed — actions auto-execute
import { useWebPhone } from "@/hooks/useWebPhone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PurchasingListPanel } from "@/components/purchasing/PurchasingListPanel";
import { getEventsForMonth, type CalendarEvent } from "@/components/social/contentStrategyData";
import { PERSIAN_EVENT_INFO } from "@/components/social/ContentStrategyPanel";
import { Separator } from "@/components/ui/separator";
import { PurchasingConfirmedView } from "@/components/purchasing/PurchasingConfirmedView";
import { usePurchasingDates } from "@/hooks/usePurchasingDates";

// Agents restricted to specific roles (all others are open)
const RESTRICTED_AGENTS: Record<string, AppRole[]> = {
  accounting: ["admin", "accounting"],
};

// Pixel slot publish times (matches PIXEL_SLOTS 1-5)
const SLOT_TIMES = [
  { hour: 6, minute: 30 },   // slot 1
  { hour: 7, minute: 30 },   // slot 2
  { hour: 8, minute: 0 },    // slot 3
  { hour: 12, minute: 30 },  // slot 4
  { hour: 14, minute: 30 },  // slot 5
];

export default function AgentWorkspace() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const config = agentConfigs[agentId || ""] || agentConfigs.sales;
  const { isSuperAdmin } = useSuperAdmin();
  const { hasRole, isLoading: rolesLoading } = useUserRole();
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

  // Vizzy now open to all @rebar.shop employees (admin-chat handles role-based context scoping)

  // Block users without required roles from restricted agents
  useEffect(() => {
    if (rolesLoading) return;
    const required = RESTRICTED_AGENTS[agentId || ""];
    if (required && !required.some((r) => hasRole(r))) {
      navigate("/home", { replace: true });
      toast.error("Access restricted");
    }
  }, [agentId, rolesLoading, hasRole, navigate]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [autoBriefingSent, setAutoBriefingSent] = useState(false);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pendingPixelSlot, setPendingPixelSlot] = useState<number | null>(null);
  const [pixelDateMessage, setPixelDateMessage] = useState<string>("");
  const [lastPixelPost, setLastPixelPost] = useState<PixelPost | null>(null);
  const [aiModel, setAiModel] = useState<string>("gemini");
  const [imageStyles, setImageStyles] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [imageAspectRatio, setImageAspectRatio] = useState<string>("1:1");
  const [showRecipeTable, setShowRecipeTable] = useState(false);
  const [purchasingDate, setPurchasingDate] = useState<Date | undefined>();
  const [activePurchasingDateStr, setActivePurchasingDateStr] = useState<string | null>(null);
  const [purchasingKey, setPurchasingKey] = useState(0);

  const { dates: purchasingDates, getConfirmedSnapshot, deleteConfirmedList } = usePurchasingDates();

  const handleDeletePurchasingDate = useCallback((dateStr: string) => {
    deleteConfirmedList(dateStr);
    if (activePurchasingDateStr === dateStr) {
      setActivePurchasingDateStr(null);
    }
  }, [deleteConfirmedList, activePurchasingDateStr]);

  const { sessions, loading: sessionsLoading, fetchSessions, createSession, addMessage, getSessionMessages, deleteSession, updateSessionTitle } = useChatSessions();
  const hasConversation = messages.length > 0;
  const suggestions = agentSuggestions[agentId || "sales"] || agentSuggestions.sales;

  // Check if this user has a mapping to this agent for auto-briefing
  const mapping = getUserAgentMapping(user?.email);
  const isUsersPrimaryAgent = mapping?.agentKey === agentId;

  // Ref to avoid temporal dead zone — keeps latest handleSendInternal accessible
  const sendRef = useRef<(content: string, slotOverride?: number) => Promise<void>>();

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
        // Use ref to safely call send without temporal dead zone
        setTimeout(() => sendRef.current?.(briefingPrompt), 0);
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

  // Background service: subscribe/unsubscribe on session changes, check for undelivered
  useEffect(() => {
    if (!activeSessionId) return;
    // Check if there's an undelivered result from a previous navigation
    const undelivered = backgroundAgentService.consumeUndelivered(activeSessionId);
    if (undelivered) {
      let replyContent = undelivered.reply;
      if (undelivered.createdNotifications?.length) {
        const notifSummary = undelivered.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${undelivered.createdNotifications.length} item(s):**\n${notifSummary}`;
      }
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "agent",
        content: replyContent,
        agent: config.agentType as any,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    }
    // If still processing, show loading
    if (backgroundAgentService.isProcessing(activeSessionId)) {
      setIsLoading(true);
    }
    // Subscribe for live delivery
    backgroundAgentService.subscribe(activeSessionId, (response) => {
      let replyContent = response.reply;
      if (response.createdNotifications?.length) {
        const notifSummary = response.createdNotifications
          .map((n) => `${n.type === "todo" ? "✅" : n.type === "idea" ? "💡" : "🔔"} **${n.title}**${n.assigned_to_name ? ` → ${n.assigned_to_name}` : ""}`)
          .join("\n");
        replyContent += `\n\n---\n📋 **Created ${response.createdNotifications.length} item(s):**\n${notifSummary}`;
      }
      if (agentId === "social" && response.nextSlot) {
        setPendingPixelSlot(response.nextSlot);
      }
      if (agentId === "social" && response.pixelPost) {
        setLastPixelPost(response.pixelPost);
      }
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "agent",
        content: replyContent,
        agent: config.agentType as any,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    });
    return () => { backgroundAgentService.unsubscribe(activeSessionId); };
  }, [activeSessionId, config.agentType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start a new empty chat
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    setAutoBriefingSent(true); // don't auto-brief on manual new chat
    setShowRecipeTable(false);
    // Pixel agent: no longer auto-send; user picks mode from empty state
    // Reset purchasing state so user sees fresh default list
    if (agentId === "purchasing") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setPurchasingDate(today);
      setActivePurchasingDateStr(today.toISOString().split("T")[0]);
      setPurchasingKey((k) => k + 1);
    }
  }, [agentId]);

  // Auto-send initial message from Quick Actions
  useEffect(() => {
    const state = location.state as { initialMessage?: string } | null;
    if (state?.initialMessage && messages.length === 0 && !isLoading) {
      window.history.replaceState({}, "");
      setAutoBriefingSent(true);
      handleSend(state.initialMessage);
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendInternal = useCallback(async (content: string, slotOverride?: number, files?: UploadedFile[]) => {
    // Guard: prevent double-enqueue if already loading
    if (isLoading) return;

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
        ? format(selectedDate, "yyyy-MM-dd (EEE, MMM d)")
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
    if (agentId === "social") {
      extraContext.selectedDate = format(selectedDate, "yyyy-MM-dd");
      if (imageStyles.length > 0) extraContext.imageStyles = imageStyles;
      if (selectedProducts.length > 0) extraContext.selectedProducts = selectedProducts;
      extraContext.imageAspectRatio = imageAspectRatio;
    }
    if (agentId === "eisenhower") {
      extraContext.selectedDate = format(selectedDate, "yyyy-MM-dd");
    }
    if (mapping) {
      extraContext.userRole = mapping.userRole;
      if (mapping.userRole === "ceo") extraContext.isCEO = true;
      if (mapping.userRole === "shop_supervisor") extraContext.isShopSupervisor = true;
    }

    const history: AgentChatMessage[] = messages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const attachedFiles = files?.map(f => ({ name: f.name, url: f.url }));

    if (sessionId) {
      // Unsubscribe previous listener to prevent duplicate message appends
      backgroundAgentService.unsubscribe(sessionId);
      // Subscribe so we can handle special UI logic (vizzy-actions, pixel flow)
      backgroundAgentService.subscribe(sessionId, (response) => {
        // Track pixel sequential flow
        if (agentId === "social" && response.nextSlot) {
          setPendingPixelSlot(response.nextSlot);
          setPixelDateMessage(content);
        } else if (agentId === "social" && response.nextSlot === null) {
          setPendingPixelSlot(null);
        }
        if (agentId === "social" && response.pixelPost) {
          setLastPixelPost(response.pixelPost);
        }

        let replyContent = response.reply;

        // Parse vizzy-action blocks for actions (assistant only)
        if (agentId === "assistant" && isSuperAdmin) {
          const actionMatch = replyContent.match(/\[VIZZY-ACTION\]([\s\S]*?)\[\/VIZZY-ACTION\]/);
          if (actionMatch) {
            try {
              const actionData = JSON.parse(actionMatch[1]);
              
              if (actionData.type === "ringcentral_call" || actionData.type === "sms") {
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
              } else if (actionData.type === "create_task" || actionData.type === "send_email") {
                // Auto-execute task creation and email sending via vizzy-erp-action
                (async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke("vizzy-erp-action", {
                      body: { action: actionData.type, params: actionData },
                    });
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    
                    if (actionData.type === "create_task") {
                      toast.success(`Task created: "${actionData.title}"${actionData.assigned_to_name ? ` → ${actionData.assigned_to_name}` : ""}`);
                    } else if (actionData.type === "send_email") {
                      toast.success(`Email sent to ${actionData.to}`);
                    }
                  } catch (err) {
                    toast.error(`Action failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  }
                })();
              }
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
        setIsLoading(false);
      });

      // Enqueue via background service — survives navigation
      backgroundAgentService.enqueue(
        sessionId,
        config.agentType as AgentType,
        config.name,
        content,
        history,
        extraContext,
        attachedFiles,
        slotOverride,
        aiModel,
      );
    }
  }, [messages, config.agentType, config.name, activeSessionId, createSession, addMessage, mapping, selectedDate, aiModel, agentId, isSuperAdmin, imageStyles, selectedProducts, imageAspectRatio, isLoading]);

  // Keep ref in sync
  useEffect(() => { sendRef.current = handleSendInternal; }, [handleSendInternal]);

  const handleSend = useCallback((content: string, files?: UploadedFile[]) => {
    handleSendInternal(content, undefined, files);
  }, [handleSendInternal]);

  const handleApprovePixelSlot = useCallback(async () => {
    // Save current post to social_posts as draft
    if (lastPixelPost && user) {
      try {
        const scheduledDate = new Date(selectedDate);
        // Use SLOT_TIMES mapping for accurate scheduling
        const slotIdx = (lastPixelPost.slotNumber || 1) - 1;
        const slotTime = SLOT_TIMES[slotIdx] || SLOT_TIMES[0];
        scheduledDate.setHours(slotTime.hour, slotTime.minute, 0, 0);

        const { error } = await supabase.from("social_posts").insert({
          platform: lastPixelPost.platform || "instagram",
          status: "pending_approval",
          qa_status: "needs_review",
          neel_approved: false,
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
          toast.success("Post saved to calendar for approval ✅");
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
    // Try to extract slot number from the alt text (product name matches PIXEL_SLOTS)
    const slotProducts = ["Rebar Bundles", "Stirrups", "Rebar Cages", "Wire Mesh", "Rebar Dowels"];
    const idx = slotProducts.findIndex(p => alt.toLowerCase().includes(p.toLowerCase()));
    const slotNum = idx >= 0 ? idx + 1 : 1;
    handleSendInternal(`regenerate slot ${slotNum}`);
  }, [handleSendInternal]);

  const handleApprovePost = useCallback(async (post: import("@/components/social/PixelPostCard").PixelPostData) => {
    if (!user) return;
    try {
      const hashtags = post.hashtags ? post.hashtags.split(/\s+/).filter((h: string) => h.startsWith("#")) : [];
      // Clean caption: remove all non-advertising content before saving
      let rawCaption = post.caption || "";
      // 1. Remove Persian translation block
      const persianIdx = rawCaption.indexOf("---PERSIAN---");
      if (persianIdx !== -1) rawCaption = rawCaption.slice(0, persianIdx);
      // Also remove fallback Persian markers
      rawCaption = rawCaption.replace(/🖼️\s*متن روی عکس:[\s\S]*/m, "");
      // 2. Remove slot headers (with or without time)
      rawCaption = rawCaption.replace(/^#{1,4}\s*Slot\s*\d+\s*[—\-]\s*(\d{1,2}:\d{2}\s*(AM|PM)\s*\|?\s*)?.*/gm, "");
      // 3. Remove image markdown
      rawCaption = rawCaption.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
      // 4. Remove download/regen links
      rawCaption = rawCaption.replace(/\[⬇️ Download\]\([^)]*\)/g, "");
      rawCaption = rawCaption.replace(/🔄\s*Regenerate/g, "");
      // 5. Remove labels
      rawCaption = rawCaption.replace(/\*\*Caption:\*\*/g, "");
      rawCaption = rawCaption.replace(/\*\*Hashtags:\*\*/g, "");
      // 6. Remove lines that are only hashtags
      rawCaption = rawCaption.replace(/^[\s]*#[a-zA-Z]\w*(\s+#[a-zA-Z]\w*)*[\s]*$/gm, "");
      // 7. Remove contact info lines (address, phone, website)
      rawCaption = rawCaption.replace(/^.*📍.*$/gm, "");
      rawCaption = rawCaption.replace(/^.*📞.*$/gm, "");
      rawCaption = rawCaption.replace(/^.*🌐.*$/gm, "");
      rawCaption = rawCaption.replace(/^.*9 Cedar Ave.*$/gim, "");
      rawCaption = rawCaption.replace(/^.*647[-.\s]?260[-.\s]?9403.*$/gm, "");
      // 8. Clean up whitespace
      const cleanCaption = rawCaption.replace(/\n{3,}/g, "\n\n").trim();
      const lines = cleanCaption.split("\n").filter(l => l.trim().length > 0);
      const titleLine = lines[0] || "Pixel Post";
      const title = titleLine.replace(/^[\p{Emoji}\s]+/u, "").slice(0, 50) || "Pixel Post";
      const content = cleanCaption;
      // Extract slot index from post id (format: "post-{index}-{hash}")
      const scheduledDate = new Date(selectedDate);
      const idMatch = post.id?.match(/^post-(\d+)/);
      const slotIdx = idMatch ? parseInt(idMatch[1]) : 0;
      const slotTime = SLOT_TIMES[slotIdx] || SLOT_TIMES[0];
      scheduledDate.setHours(slotTime.hour, slotTime.minute, 0, 0);

      // Create a single unassigned card — platform/page chosen later in Social Media Manager
      const { error } = await supabase.from("social_posts").insert({
        platform: "unassigned",
        status: "pending_approval",
        qa_status: "needs_review",
        neel_approved: false,
        title,
        content,
        image_url: post.imageUrl || null,
        hashtags,
        scheduled_date: scheduledDate.toISOString(),
        user_id: user.id,
        page_name: null,
      });
      if (error) {
        console.error("Failed to save post:", error);
        toast.error("Failed to save post to calendar");
      } else {
        toast.success("Post saved to calendar ✅");
      }
    } catch (err) {
      console.error("Error saving post:", err);
      toast.error("Error saving post");
    }
  }, [user, selectedDate]);

  const handleRegeneratePost = useCallback((post: import("@/components/social/PixelPostCard").PixelPostData) => {
    // Extract slot number from post id (format: post-0-...) or caption
    const idMatch = post.id?.match(/^post-(\d+)/);
    const slotProducts = ["Rebar Bundles", "Stirrups", "Rebar Cages", "Wire Mesh", "Rebar Dowels"];
    const captionIdx = slotProducts.findIndex(p => (post.caption || "").toLowerCase().includes(p.toLowerCase()));
    const slotNum = captionIdx >= 0 ? captionIdx + 1 : (idMatch ? parseInt(idMatch[1]) + 1 : 1);
    handleSendInternal(`regenerate slot ${slotNum}`);
  }, [handleSendInternal]);

  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [eisenhowerInstrOpen, setEisenhowerInstrOpen] = useState(false);
  

  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      if (agentId === "social" && activeSessionId) {
        updateSessionTitle(activeSessionId, format(date, "yyyy-MM-dd"));
      }
    }
  }, [agentId, activeSessionId, updateSessionTitle]);

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
            purchasingDates={agentId === "purchasing" ? purchasingDates : undefined}
            activePurchasingDate={agentId === "purchasing" ? activePurchasingDateStr : undefined}
            onSelectPurchasingDate={agentId === "purchasing" ? (dateStr) => {
              setActivePurchasingDateStr(dateStr);
              if (dateStr) {
                setPurchasingDate(new Date(dateStr + "T00:00:00"));
              } else {
                setPurchasingDate(undefined);
              }
            } : undefined}
            onDeletePurchasingDate={agentId === "purchasing" ? handleDeletePurchasingDate : undefined}
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
              purchasingDates={agentId === "purchasing" ? purchasingDates : undefined}
              activePurchasingDate={agentId === "purchasing" ? activePurchasingDateStr : undefined}
              onSelectPurchasingDate={agentId === "purchasing" ? (dateStr) => {
                setActivePurchasingDateStr(dateStr);
                if (dateStr) {
                  setPurchasingDate(new Date(dateStr + "T00:00:00"));
                } else {
                  setPurchasingDate(undefined);
                }
                setMobileHistoryOpen(false);
              } : undefined}
              onDeletePurchasingDate={agentId === "purchasing" ? handleDeletePurchasingDate : undefined}
            />
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      {agentId === "purchasing" ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar for purchasing */}
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </Button>
            <img src={config.image} alt={config.name} className="w-6 h-6 rounded-full object-cover" />
            <span className="text-sm font-medium">{config.name}</span>
            <span className="text-xs text-muted-foreground">— {config.role}</span>
            <div className="flex-1" />
          </div>
          {activePurchasingDateStr && getConfirmedSnapshot(activePurchasingDateStr) ? (
            <PurchasingConfirmedView record={getConfirmedSnapshot(activePurchasingDateStr)!} />
          ) : (
            <PurchasingListPanel
              key={purchasingKey}
              filterDate={purchasingDate}
              onFilterDateChange={(d) => {
                setPurchasingDate(d);
                setActivePurchasingDateStr(d ? d.toISOString().split("T")[0] : null);
              }}
            />
          )}
        </div>
      ) : (
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
          {(agentId === "social" || agentId === "eisenhower") && (
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
              {agentId === "social" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setBrainOpen(true)}
                  title="Pixel Brain – Knowledge & Instructions"
                >
                  <Brain className="w-4 h-4" />
                </Button>
              )}
              {agentId === "eisenhower" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEisenhowerInstrOpen(true)}
                  title="Agent Instructions"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              )}
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
              {(agentId === "social" || agentId === "eisenhower") && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border inline-block">
                  <p className="text-sm text-muted-foreground">📅 Selected date:</p>
                  <p className="text-lg font-bold text-primary">{format(selectedDate, "yyyy-MM-dd (EEEE, MMMM d)")}</p>
                </div>
              )}
            </div>

            {/* Pixel agent: two mode cards OR recipe table */}
            {agentId === "social" ? (
              showRecipeTable ? (
                /* ── Recipe Schedule Table ── */
                <div className="w-full max-w-2xl mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-foreground">📋 Content Generation Recipe</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowRecipeTable(false)}>
                      ← Back
                    </Button>
                  </div>
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Theme</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Product</th>
                          <th className="px-4 py-3 text-center font-semibold text-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { time: "06:30", theme: "Motivational / Power", product: "Stirrups", slot: 1 },
                          { time: "07:30", theme: "Creative Promo", product: "Cages", slot: 2 },
                          { time: "08:00", theme: "Strength & Scale", product: "GFRP", slot: 3 },
                          { time: "12:30", theme: "Innovation", product: "Wire Mesh", slot: 4 },
                          { time: "14:00", theme: "Product Promo", product: "Dowels", slot: 5 },
                        ].map((row) => (
                          <tr key={row.slot} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-left font-mono font-medium text-foreground">{row.time}</td>
                            <td className="px-4 py-3 text-left text-muted-foreground">{row.theme}</td>
                            <td className="px-4 py-3 text-left text-foreground font-medium">{row.product}</td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setShowRecipeTable(false);
                                  handleSendInternal(`Generate slot ${row.slot} now`, row.slot);
                                }}
                              >
                                Generate
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button
                      className="gap-2"
                      onClick={() => {
                        setShowRecipeTable(false);
                        handleSend("Generate all 5 slots now");
                      }}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      Generate All Slots
                    </Button>
                  </div>

                  {/* ── Event Calendar Section ── */}
                  <EventCalendarSection
                    onGenerate={(event) => {
                      setShowRecipeTable(false);
                      handleSend(`Generate a post for ${event.name} — theme: ${event.contentTheme}`);
                    }}
                  />
                </div>
              ) : (
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl mb-6">
                {/* Card 1: Free chat mode */}
                <button
                  onClick={() => handleSend("Ready to create images via chat. What should I make?")}
                  className="flex-1 bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer text-center group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">💬 Create Images via Chat</h3>
                  <p className="text-sm text-muted-foreground">Describe anything and get an image generated</p>
                </button>

                {/* Card 2: Recipe / 5-slot schedule mode */}
                <button
                  onClick={() => setShowRecipeTable(true)}
                  className="flex-1 bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer text-center group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <LayoutGrid className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">📋 Create Images from Recipe</h3>
                  <p className="text-sm text-muted-foreground">5 ready-made posts for different products</p>
                </button>
              </div>
              )
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
                </div>
                <AgentSuggestions
                  suggestions={suggestions}
                  agentName={config.name}
                  agentImage={config.image}
                  onSelect={handleSend}
                />
              </>
            )}

            <div className="w-full max-w-xl mb-4">
              <ChatInput
                onSend={handleSend}
                placeholder={config.placeholder}
                disabled={isLoading}
                showFileUpload={true}
                showSmartMode={agentId !== "social"}
                minimalToolbar={agentId === "social"}
                selectedModel={aiModel}
                onModelChange={setAiModel}
                imageStyles={imageStyles}
                onImageStylesChange={setImageStyles}
                selectedProducts={selectedProducts}
                onSelectedProductsChange={setSelectedProducts}
                imageAspectRatio={imageAspectRatio}
                onImageAspectRatioChange={setImageAspectRatio}
              />
            </div>
          </div>
        ) : (
          <>
            <ChatThread
              messages={messages}
              isLoading={isLoading}
              onRegenerateImage={handleRegenerateImage}
              onApprovePost={agentId === "social" ? handleApprovePost : undefined}
              onRegeneratePost={agentId === "social" ? handleRegeneratePost : undefined}
              agentImage={config.image}
              agentName={config.name}
              isPixelAgent={agentId === "social"}
            />
            <ChatInput
              onSend={handleSend}
              placeholder={config.placeholder}
              disabled={isLoading}
              showFileUpload={true}
              showSmartMode={agentId !== "social"}
              minimalToolbar={agentId === "social"}
              selectedModel={aiModel}
              onModelChange={setAiModel}
                imageStyles={imageStyles}
                onImageStylesChange={setImageStyles}
                selectedProducts={selectedProducts}
                onSelectedProductsChange={setSelectedProducts}
                imageAspectRatio={imageAspectRatio}
                onImageAspectRatioChange={setImageAspectRatio}
            />
          </>
        )}
      </div>
      )}


      <PixelBrainDialog open={brainOpen} onOpenChange={setBrainOpen} />
      <EisenhowerInstructionsDialog open={eisenhowerInstrOpen} onOpenChange={setEisenhowerInstrOpen} />
      
      {/* VizzyApprovalDialog removed — actions auto-execute */}
    </div>
  );
}

/* ── Event Calendar sub-component for Pixel recipe view ── */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const REGION_BADGE: Record<string, { label: string; cls: string }> = {
  CA: { label: "🇨🇦 Canada", cls: "bg-red-500/10 text-red-600 border-red-200" },
  global: { label: "🌍 Global", cls: "bg-blue-500/10 text-blue-600 border-blue-200" },
  industry: { label: "🏗️ Industry", cls: "bg-amber-500/10 text-amber-600 border-amber-200" },
};

function EventCalendarSection({ onGenerate }: { onGenerate: (event: CalendarEvent) => void }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const events = useMemo(() => getEventsForMonth(selectedMonth + 1), [selectedMonth]);

  const formatFullDate = (month: number, day: number) => {
    const date = new Date(new Date().getFullYear(), month - 1, day);
    return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm text-foreground">Event Calendar</h3>
        <span className="text-xs text-muted-foreground ml-auto">Click an event for details · Generate content for upcoming events</span>
      </div>

      {/* Month selector */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => { setSelectedMonth(i); setExpandedIdx(null); }}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
              selectedMonth === i
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No events in {MONTHS[selectedMonth]}</p>
        ) : (
          events.map((event, i) => {
            const badge = REGION_BADGE[event.region];
            const isExpanded = expandedIdx === i;
            return (
              <div key={`${event.month}-${event.day}-${i}`} className="rounded-lg border border-border overflow-hidden transition-colors">
                <div
                  className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold leading-none">{event.day}</span>
                    <span className="text-[10px] text-muted-foreground">{MONTHS[event.month - 1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      {badge && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", badge.cls)}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{event.contentTheme}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    onClick={(e) => { e.stopPropagation(); onGenerate(event); }}
                  >
                    Generate
                  </Button>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (event.description || PERSIAN_EVENT_INFO[event.name]) && (
                  <div className="px-4 pb-3 pt-1 bg-muted/30 border-t border-border">
                    <p className="text-xs font-semibold text-primary mb-1">
                      📅 {formatFullDate(event.month, event.day)}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {event.description}
                      </p>
                    )}
                    {PERSIAN_EVENT_INFO[event.name] && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-xs font-semibold text-primary mb-1" dir="rtl">
                          🇮🇷 {PERSIAN_EVENT_INFO[event.name].summary}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed" dir="rtl">
                          {PERSIAN_EVENT_INFO[event.name].details}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
