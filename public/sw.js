// Brooklyn CDJR: this small worker is what lets the app be installed on a phone.
// It never stores pages or data, so every launch loads the latest version from the server.
const OFFLINE = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0F172A;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><h2 style="margin:0 0 8px">No connection</h2><p style="margin:0;color:#93C5FD">Reconnect to the internet, then reopen the app.</p></div></body>'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
  }
})
