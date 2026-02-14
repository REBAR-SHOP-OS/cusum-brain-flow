// Service Worker for Web Push Notifications
self.addEventListener("push", (event) => {
  let data = { title: "New Notification", body: "", linkTo: null };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data ? event.data.text() : "";
  }

  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { linkTo: data.linkTo || "/" },
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const linkTo = event.notification.data?.linkTo || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(linkTo);
          return;
        }
      }
      return clients.openWindow(linkTo);
    })
  );
});
