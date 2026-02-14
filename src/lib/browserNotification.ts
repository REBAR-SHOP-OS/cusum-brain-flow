let permissionRequested = false;

export async function requestNotificationPermission(): Promise<void> {
  if (permissionRequested) return;
  permissionRequested = true;
  try {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
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
