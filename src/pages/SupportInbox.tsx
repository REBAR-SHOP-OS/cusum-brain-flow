import { useState, useEffect } from "react";
import { SupportSidebar } from "@/components/support/SupportSidebar";
import { SupportConversationList } from "@/components/support/SupportConversationList";
import { SupportChatView } from "@/components/support/SupportChatView";
import { SupportWidgetSettings } from "@/components/support/SupportWidgetSettings";
import { KnowledgeBase } from "@/components/support/KnowledgeBase";
import { requestNotificationPermission, registerPushSubscription } from "@/lib/browserNotification";
import { BookOpen, Bot, MessageSquareMore, Palette } from "lucide-react";

export type SupportSection = "inbox" | "knowledge-base" | "settings";

const sectionMeta: Record<SupportSection, { eyebrow: string; title: string; description: string }> = {
  inbox: {
    eyebrow: "ERP Support",
    title: "Live support command center",
    description: "Monitor website conversations, triage visitors quickly, and respond with AI-assisted workflows from one premium workspace.",
  },
  "knowledge-base": {
    eyebrow: "Knowledge AI",
    title: "Knowledge base operations",
    description: "Curate help content, publish trusted answers, and strengthen every automated or human response with reusable context.",
  },
  settings: {
    eyebrow: "Website widget",
    title: "Modern chat experience controls",
    description: "Configure branding, automation, AI behavior, and embed settings for the website support experience.",
  },
};

const inboxHighlights = [
  {
    title: "Omnichannel queue",
    description: "Open, assigned, and resolved conversations stay organized with a faster triage flow.",
    icon: MessageSquareMore,
  },
  {
    title: "AI copilots",
    description: "Suggested replies and knowledge grounding help the team respond with more consistency.",
    icon: Bot,
  },
  {
    title: "Website control",
    description: "Branding and widget settings stay connected to the same support workspace.",
    icon: Palette,
  },
  {
    title: "Knowledge sync",
    description: "Published articles become live support context for both agents and visitors.",
    icon: BookOpen,
  },
];

export default function SupportInbox() {
  const [section, setSection] = useState<SupportSection>("inbox");
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

  useEffect(() => {
    requestNotificationPermission();
    registerPushSubscription();
  }, []);

  return (
    <div className="flex h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.09),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_32%),hsl(var(--background))]">
      <SupportSidebar active={section} onNavigate={setSection} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-border/60 bg-background/75 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                {sectionMeta[section].eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground xl:text-3xl">
                {sectionMeta[section].title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {sectionMeta[section].description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[32rem]">
              {inboxHighlights.slice(section === "inbox" ? 0 : 2, section === "inbox" ? 4 : 4).map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden p-4 lg:p-5">
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-[28px] border border-border/60 bg-background/80 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            {section === "inbox" && (
              <>
                <SupportConversationList
                  selectedId={selectedConvoId}
                  onSelect={setSelectedConvoId}
                />
                <SupportChatView conversationId={selectedConvoId} />
              </>
            )}
            {section === "knowledge-base" && <KnowledgeBase />}
            {section === "settings" && (
              <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <SupportWidgetSettings />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
