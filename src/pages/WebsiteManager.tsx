import { useState, useRef, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { WebsiteToolbar, DeviceMode } from "@/components/website/WebsiteToolbar";
import { WebsiteChat } from "@/components/website/WebsiteChat";
import { cn } from "@/lib/utils";

const SITE_ORIGIN = "https://rebar.shop";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export default function WebsiteManager() {
  const [currentPath, setCurrentPath] = useState("/");
  const [device, setDevice] = useState<DeviceMode>("desktop");
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
    // Auto-refresh after a confirmed write action
    setTimeout(() => refreshIframe(), 1500);
  }, [refreshIframe]);

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
        {/* Live Preview */}
        <ResizablePanel defaultSize={70} minSize={40}>
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
                title="Website Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* AI Chat Panel */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <WebsiteChat
            currentPagePath={currentPath}
            onWriteConfirmed={handleWriteConfirmed}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
