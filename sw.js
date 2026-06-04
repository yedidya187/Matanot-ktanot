const CACHE_NAME = 'matanot-ktanot-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  clients.claim();
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'מתנות קטנות', {
      body: data.body || '',
      icon: '/Matanot-ktanot/logo.gif',
      dir: 'rtl',
      badge: '/Matanot-ktanot/logo.gif',
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/Matanot-ktanot/'));
});
