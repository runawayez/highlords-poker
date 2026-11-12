/* Service worker mínimo: torna o site instalável. Não guarda nada em cache de propósito:
   as mesas são em tempo real e o jogo sempre precisa da versão mais nova do servidor. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
