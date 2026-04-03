import { useEffect, useState } from "react";
import { Bot, MessageSquareText, Settings2, Sparkles, TimerReset } from "lucide-react";
import { SupportSidebar } from "@/components/support/SupportSidebar";
import { SupportConversationList } from "@/components/support/SupportConversationList";
import { SupportChatView } from "@/components/support/SupportChatView";
import { SupportWidgetSettings } from "@/components/support/SupportWidgetSettings";
import { KnowledgeBase } from "@/components/support/KnowledgeBase";
import { requestNotificationPermission, registerPushSubscription } from "@/lib/browserNotification";

export type SupportSection = "inbox" | "knowledge-base" | "settings";

export default function SupportInbox() {
  const [section, setSection] = useState<SupportSection>("inbox");
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

  useEffect(() => {
    requestNotificationPermission();
    registerPushSubscription();
  }, []);

  return (
    <div className="flex h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_28%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.12),transparent_24%)]">
      <SupportSidebar active={section} onNavigate={setSection} />
      <div className="flex flex-1 overflow-hidden">
        {section === "inbox" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 md:px-5 md:py-5">
            <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1.55fr),repeat(3,minmax(0,1fr))]">
              <div className="rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/5 backdrop-blur">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Next-gen support
                </div>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                      Modern support operations for ERP teams
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      Handle live visitor conversations, route work faster, and respond with AI-assisted context from one premium support workspace.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-left sm:min-w-[280px]">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Routing</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">Smart queues</div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Experience</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">Realtime chat</div>
                    </div>
                  </div>
                </div>
              </div>

              {[
                {
                  icon: MessageSquareText,
                  eyebrow: "Inbox",
                  title: "Fast triage",
                  body: "Keep every visitor in one clean queue with visible status, presence, and follow-up priority.",
                },
                {
                  icon: Bot,
                  eyebrow: "AI",
                  title: "Reply assist",
                  body: "Draft more polished responses and reduce handle time with built-in reply suggestions.",
                },
                {
                  icon: Settings2,
                  eyebrow: "Widget",
                  title: "Website-ready",
                  body: "Match the ERP workflow with a premium front-end chat widget customers trust instantly.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-lg shadow-black/5 backdrop-blur">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(320px,390px),minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,430px),minmax(0,1fr)]">
              <div className="min-h-[420px] overflow-hidden rounded-[32px] border border-border/70 bg-background/85 shadow-2xl shadow-black/10 backdrop-blur">
                <SupportConversationList
                  selectedId={selectedConvoId}
                  onSelect={setSelectedConvoId}
                />
              </div>
              <div className="min-h-[520px] min-w-0 overflow-hidden rounded-[32px] border border-border/70 bg-background/85 shadow-2xl shadow-black/10 backdrop-blur">
                <SupportChatView conversationId={selectedConvoId} />
              </div>
            </div>
          </div>
        )}
        {section === "knowledge-base" && <KnowledgeBase />}
        {section === "settings" && (
          <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3 md:px-5 md:py-5">
            <div className="mb-4 rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/5 backdrop-blur">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
                <TimerReset className="h-3.5 w-3.5" />
                Widget studio
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Tune the website chat experience</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Control widget branding, behavior, and support defaults so the public website experience stays aligned with the internal ERP inbox.
              </p>
            </div>
            <div className="overflow-hidden rounded-[32px] border border-border/70 bg-background/85 p-6 shadow-2xl shadow-black/10 backdrop-blur">
              <SupportWidgetSettings />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
