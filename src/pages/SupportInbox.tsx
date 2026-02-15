import { useState } from "react";
import { SupportSidebar } from "@/components/support/SupportSidebar";
import { SupportConversationList } from "@/components/support/SupportConversationList";
import { SupportChatView } from "@/components/support/SupportChatView";
import { SupportWidgetSettings } from "@/components/support/SupportWidgetSettings";
import { KnowledgeBase } from "@/components/support/KnowledgeBase";

export type SupportSection = "inbox" | "knowledge-base" | "settings";

export default function SupportInbox() {
  const [section, setSection] = useState<SupportSection>("inbox");
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

  return (
    <div className="flex h-full overflow-hidden">
      <SupportSidebar active={section} onNavigate={setSection} />
      <div className="flex-1 flex overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-6">
            <SupportWidgetSettings />
          </div>
        )}
      </div>
    </div>
  );
}
