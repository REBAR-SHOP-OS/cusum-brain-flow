import { useState, useCallback } from "react";
import { SAMPLE_PROJECT, EMPTY_PROJECT, type AppBuilderProject } from "@/data/appBuilderMockData";
import { sendAgentMessage, type ChatMessage, type AgentResponse, type AttachedFile } from "@/lib/agent";

export type SidebarSection =
  | "overview"
  | "plan"
  | "pages"
  | "data-model"
  | "preview"
  | "versions"
  | "export"
  | "settings"
  | "chat"
  | "connectors"
  | "knowledge";

export type WorkspaceMode = "build" | "chat";

export interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
  uploadedUrl?: string;
}

export function useAppBuilderProject(projectId: string | undefined) {
  const [project, setProject] = useState<AppBuilderProject>(
    projectId === "contractor-crm" ? SAMPLE_PROJECT : { ...EMPTY_PROJECT, id: projectId ?? "new" }
  );
  const [activeSection, setActiveSection] = useState<SidebarSection>("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPreviewPage, setSelectedPreviewPage] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>("build");

  // File attachment state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const addFiles = useCallback((files: File[]) => {
    const newFiles: PendingFile[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const generatePlan = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 2000));
    setProject((prev) => ({
      ...prev,
      ...SAMPLE_PROJECT,
      id: prev.id,
      name: prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt,
      status: "ready",
    }));
    setIsGenerating(false);
    setActiveSection("plan");
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMsg: ChatMessage = { role: "user", content };
      setMessages((prev) => [...prev, userMsg]);
      setIsChatLoading(true);

      // Build attached files list
      const attachedFiles: AttachedFile[] = pendingFiles
        .filter((f) => f.uploadedUrl)
        .map((f) => ({ name: f.file.name, url: f.uploadedUrl! }));

      // Clear pending files after sending
      setPendingFiles([]);

      try {
        const history = [...messages, userMsg];
        const context: Record<string, unknown> = {
          projectPlan: project.plan,
          projectName: project.name,
          mode,
        };

        const response: AgentResponse = await sendAgentMessage(
          "empire",
          content,
          history,
          context,
          attachedFiles.length > 0 ? attachedFiles : undefined
        );

        setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Failed to get response";
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${errMsg}` }]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [messages, pendingFiles, project.plan, project.name, mode]
  );

  return {
    project,
    activeSection,
    setActiveSection,
    isGenerating,
    generatePlan,
    selectedPreviewPage,
    setSelectedPreviewPage,
    // Chat
    messages,
    isChatLoading,
    sendMessage,
    // Mode
    mode,
    setMode,
    // Files
    pendingFiles,
    addFiles,
    removeFile,
  };
}
