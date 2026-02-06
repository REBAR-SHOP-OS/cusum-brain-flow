import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, Apple, Chrome } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">App Installed!</CardTitle>
            <CardDescription>
              CUSUM is now installed on your device. You can access it from your home screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Open App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 mb-4">
            <img 
              src="/pwa-icon-192.png" 
              alt="CUSUM" 
              className="w-full h-full rounded-2xl shadow-lg"
            />
          </div>
          <CardTitle className="text-2xl">Install CUSUM</CardTitle>
          <CardDescription>
            Get quick access to AI-powered operations management from your home screen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Android / Chrome install button */}
          {deferredPrompt && (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Install App
            </Button>
          )}

          {/* iOS instructions */}
          {isIOS && !deferredPrompt && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Apple className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Install on iPhone/iPad</p>
                  <ol className="text-muted-foreground mt-1 space-y-1">
                    <li>1. Tap the <strong>Share</strong> button in Safari</li>
                    <li>2. Scroll down and tap <strong>Add to Home Screen</strong></li>
                    <li>3. Tap <strong>Add</strong> to confirm</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Android fallback instructions */}
          {isAndroid && !deferredPrompt && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Chrome className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Install on Android</p>
                  <ol className="text-muted-foreground mt-1 space-y-1">
                    <li>1. Tap the <strong>menu</strong> (⋮) in Chrome</li>
                    <li>2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></li>
                    <li>3. Tap <strong>Install</strong> to confirm</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Desktop instructions */}
          {!isIOS && !isAndroid && !deferredPrompt && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Smartphone className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Install on Desktop</p>
                  <p className="text-muted-foreground mt-1">
                    Look for the install icon in your browser's address bar, or use the browser menu to install this app.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="pt-4 border-t space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Benefits:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Quick access from home screen
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Works offline
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Faster loading times
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Full-screen experience
              </li>
            </ul>
          </div>

          <Button 
            variant="outline" 
            onClick={() => window.location.href = "/"} 
            className="w-full"
          >
            Continue in Browser
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
