// Self-destroying service worker for the OLD address
// (https://deadalus5.github.io/knockout-or-not/). Published at the exact URL the
// app's original Workbox service worker used, so returning visitors' browsers pick
// it up as an update. On activation it removes only THIS site's caches, unregisters
// itself, and reloads the site's open tabs, which then reach the network, receive
// the forwarding page and land on knockoutornot.com. Other apps hosted on the same
// deadalus5.github.io origin keep their caches, registrations and tabs untouched.
const SCOPE_PATH = '/knockout-or-not/'
const OWN_RUNTIME_CACHES = ['ko-data-indexes', 'ko-data-events']

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // claim() must run BEFORE unregister(): it looks the registration up by scope.
      await self.clients.claim()

      const names = await caches.keys()
      await Promise.allSettled(
        names
          .filter((name) => name.includes(SCOPE_PATH) || OWN_RUNTIME_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      )

      await self.registration.unregister()

      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      await Promise.allSettled(
        windows
          .filter((client) => new URL(client.url).pathname.startsWith(SCOPE_PATH))
          .map((client) => client.navigate(client.url)),
      )
    })(),
  )
})
