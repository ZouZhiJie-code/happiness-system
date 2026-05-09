// Service Worker for reminder notifications

let checkInterval = null;

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_REMINDER') {
    const { title, body, link } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/brand/happiness-logo.png',
      data: { link },
      tag: `reminder-${Date.now()}`
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(link);
          return client.focus();
        }
      }
      return clients.openWindow(link);
    })
  );
});

// Start periodic check on activate
self.addEventListener('activate', () => {
  startPeriodicCheck();
});

function startPeriodicCheck() {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/settings/reminders/check');
      if (!res.ok) return;
      const due = await res.json();
      for (const r of due) {
        const tag = `reminder-${r.type}-${new Date().toISOString().split('T')[0]}`;
        // Check if already shown today
        const existing = await self.registration.getNotifications({ tag });
        if (existing.length > 0) continue;
        self.registration.showNotification(r.title, {
          body: r.body,
          icon: '/brand/happiness-logo.png',
          data: { link: r.link },
          tag
        });
      }
    } catch {
      // silent
    }
  }, 60_000);
}
