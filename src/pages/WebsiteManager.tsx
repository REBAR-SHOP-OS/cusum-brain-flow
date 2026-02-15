import { useState, useRef, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { WebsiteToolbar, DeviceMode } from "@/components/website/WebsiteToolbar";
import { WebsiteChat } from "@/components/website/WebsiteChat";
import { SpeedDashboard } from "@/components/website/SpeedDashboard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Gauge, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SITE_ORIGIN = "https://rebar.shop";

type ChatMode = "normal" | "fullscreen" | "minimized";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export default function WebsiteManager() {
  const [currentPath, setCurrentPath] = useState("/");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [rightPanel, setRightPanel] = useState<"chat" | "speed">("chat");
  const [chatMode, setChatMode] = useState<ChatMode>("normal");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = `${SITE_ORIGIN}${currentPath}`;
    }
  }, [currentPath]);

  const handlePageChange = useCallback((path: string) => {
    setCurrentPath(path);
    if (iframeRef.current) {
      iframeRef.current.src = `${SITE_ORIGIN}${path}`;
    }
  }, []);

  const handleWriteConfirmed = useCallback(() => {
    setTimeout(() => refreshIframe(), 1500);
  }, [refreshIframe]);

  const previewPanel = (
    <div className="h-full bg-muted/30 flex items-start justify-center overflow-auto p-0">
      <div
        className={cn(
          "h-full transition-all duration-300 bg-white",
          device !== "desktop" && "shadow-xl rounded-lg border border-border mt-4 mb-4"
        )}
        style={{
          width: DEVICE_WIDTHS[device],
          maxWidth: "100%",
          height: device !== "desktop" ? "calc(100% - 2rem)" : "100%",
        }}
      >
        <iframe
          ref={iframeRef}
          src={`${SITE_ORIGIN}${currentPath}`}
          className="w-full h-full border-0"
          title="Job Site Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );

  const rightPanelContent = (
    <div className="flex flex-col h-full">
      <Tabs value={rightPanel} onValueChange={(v) => setRightPanel(v as "chat" | "speed")} className="shrink-0">
        <TabsList className="w-full rounded-none border-b border-border bg-card h-9">
          <TabsTrigger value="chat" className="text-xs gap-1 flex-1">
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </TabsTrigger>
          <TabsTrigger value="speed" className="text-xs gap-1 flex-1">
            <Gauge className="w-3.5 h-3.5" /> Speed
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex-1 overflow-hidden">
        {rightPanel === "chat" ? (
          <WebsiteChat
            currentPagePath={currentPath}
            onWriteConfirmed={handleWriteConfirmed}
            chatMode={chatMode}
            onChatModeChange={setChatMode}
          />
        ) : (
          <SpeedDashboard />
        )}
      </div>
    </div>
  );

  // Minimized: thin vertical strip with expand button
  if (chatMode === "minimized") {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <WebsiteToolbar
          currentPath={currentPath}
          onPageChange={handlePageChange}
          device={device}
          onDeviceChange={setDevice}
          onRefresh={refreshIframe}
        />
        <div className="flex-1 flex">
          <div className="flex-1">{previewPanel}</div>
          <div className="w-10 border-l border-border bg-card flex flex-col items-center pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setChatMode("normal")}
              title="Expand chat"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen: chat only, no preview
  if (chatMode === "fullscreen") {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <WebsiteToolbar
          currentPath={currentPath}
          onPageChange={handlePageChange}
          device={device}
          onDeviceChange={setDevice}
          onRefresh={refreshIframe}
        />
        <div className="flex-1 overflow-hidden min-h-0">{rightPanelContent}</div>
      </div>
    );
  }

  // Normal: resizable split
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <WebsiteToolbar
        currentPath={currentPath}
        onPageChange={handlePageChange}
        device={device}
        onDeviceChange={setDevice}
        onRefresh={refreshIframe}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={70} minSize={40}>
          {previewPanel}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          {rightPanelContent}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
