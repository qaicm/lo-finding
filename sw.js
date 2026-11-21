/* LO Finding — Service Worker
   - Kerangka aplikasi (HTML/CSS/JS/ikon) disimpan agar terbuka instan & tetap tampil saat sinyal lemah.
   - Permintaan ke Google Apps Script (data) TIDAK PERNAH di-cache: selalu langsung ke server.
   - Naikkan VERSI setiap kali file frontend diperbarui → cache lama otomatis dibuang. */
const VERSI = 'lof-2.1.0';
const SHELL = [
  './', './index.html', './manifest.json',
  './css/style.css?v=2.1.0', './js/config.js?v=2.1.0', './js/icons.js?v=2.1.0', './js/core.js?v=2.1.0', './js/guru.js?v=2.1.0',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSI).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   // POST ke API → langsung jaringan
  const url = new URL(req.url);
  if (/(^|\.)script\.google(usercontent)?\.com$/.test(url.hostname) || url.hostname.endsWith('googleapis.com') && url.pathname.indexOf('/css') !== 0) return;  // data GAS: jangan pernah di-cache
  // Halaman (navigasi): jaringan dulu supaya versi baru langsung terpakai; cadangan dari cache bila offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const cp = res.clone(); caches.open(VERSI).then(c => c.put('./index.html', cp)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Aset statis (milik sendiri, font, CDN SheetJS): cache dulu, segarkan di latar
  const same = url.origin === self.location.origin;
  if (!same && !/fonts\.(googleapis|gstatic)\.com$|cdn\.sheetjs\.com$/.test(url.hostname)) return;
  e.respondWith(caches.open(VERSI).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
