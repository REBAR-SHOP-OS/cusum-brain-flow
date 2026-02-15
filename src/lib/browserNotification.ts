import { supabase } from "@/integrations/supabase/client";

const PERMISSION_ASKED_KEY = "notification_permission_asked";

export async function requestNotificationPermission(): Promise<void> {
  try {
    if (!("Notification" in window)) return;

    // Already granted or denied — nothing to do
    if (Notification.permission !== "default") return;

    // Only prompt once per device (persisted across reloads)
    if (localStorage.getItem(PERMISSION_ASKED_KEY)) return;

    localStorage.setItem(PERMISSION_ASKED_KEY, "true");
    await Notification.requestPermission();
  } catch {
    // Silently fail
  }
}

export function showBrowserNotification(
  title: string,
  body?: string | null,
  linkTo?: string | null
): void {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const notification = new Notification(title, {
      body: body ?? undefined,
      icon: "/favicon.ico",
    });

    notification.onclick = () => {
      window.focus();
      if (linkTo) {
        window.location.href = linkTo;
      }
      notification.close();
    };
  } catch {
    // Silently fail
  }
}

// ── Web Push Registration ──

let pushRegistered = false;

export async function registerPushSubscription(): Promise<void> {
  if (pushRegistered) return;
  pushRegistered = true;

  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push notifications not supported");
      return;
    }

    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      console.warn("VAPID public key not available");
      return;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw-push.js");
    await navigator.serviceWorker.ready;

    // Check existing subscription
    const pm = (registration as any).pushManager;
    let subscription = await pm.getSubscription();

    if (!subscription) {
      // Subscribe
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // Save to database
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const p256dh = subJson.keys!.p256dh!;
    const auth = subJson.keys!.auth!;

    await supabase.from("push_subscriptions").upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint" }
    );

    console.log("Push subscription registered");
  } catch (err) {
    console.error("Push registration failed:", err);
    pushRegistered = false; // Allow retry
  }
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    // Call the edge function to get the public key
    const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
    if (error || !data?.publicKey) return null;
    return data.publicKey;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}
