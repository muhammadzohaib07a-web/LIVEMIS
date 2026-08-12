// Web Push service worker. Runs independently of any open tab, so this is
// what lets a notification arrive even after the app/browser is closed.

self.addEventListener("push", (event) => {
  let payload = { title: "MIS Support Hub", body: "You have a new update.", url: "/dashboard" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // A PNG at notification size — Android and Windows scale the .ico badly.
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
