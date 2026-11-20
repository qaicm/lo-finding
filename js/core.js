/* =========================================================
   LO Finding — core.js
   API client (timeout/retry/idempoten), SWR cache per pengguna, router SPA,
   mesin tema, komponen UI, halaman autentikasi.
   ========================================================= */
'use strict';

const CFG = window.APP_CONFIG || {};
const GAS_URL = String(CFG.GAS_URL || '');
const APP_VER = '2.0.1';   // versi aset (config.js tidak perlu diubah saat update)
const CONFIG_OK = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(GAS_URL) && !/GANTI|XXXX/.test(GAS_URL);

// ---------------------------------------------------------
// Store (localStorage, namespace per pengguna + versi skema)
// ---------------------------------------------------------
const LS_PREFIX = 'lof:v1:';
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(LS_PREFIX + k, s); }
    catch (e) {
      try { Object.keys(localStorage).filter(x => x.indexOf(LS_PREFIX + 'u:') === 0 && x.indexOf(LS_PREFIX + userKey('')) !== 0).forEach(x => localStorage.removeItem(x)); localStorage.setItem(LS_PREFIX + k, s); } catch (e2) { /* jalan tanpa cache */ }
    }
  },
  del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { } }
};
function userKey(k) { return 'u:' + ((AppState.me && AppState.me.id) || 'anon') + ':' + k; }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

const AppState = {
  token: Store.get('token', ''), me: Store.get('me', null), boot: null, publik: Store.get('publik', null),
  device: Store.get('device', '') || (function () { const d = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); Store.set('device', d); return d; })(),
  pages: {}, layout: '', page: '', hiddenAt: 0
};
const isAdmin = () => !!AppState.me && (AppState.me.role === 'admin' || AppState.me.role === 'superadmin');
const isSA = () => !!AppState.me && AppState.me.role === 'superadmin';
const isTamu = () => !!AppState.me && AppState.me.role === 'tamu';

// ---------------------------------------------------------
// Perf (Prinsip 0) — panggil Perf.table() di console
// ---------------------------------------------------------
const Perf = {
  rows: [],
  add(action, total, server, cached) { this.rows.push({ action, total, server: server ?? null, net: server != null ? total - server : null, cached: !!cached, at: new Date().toLocaleTimeString() }); if (this.rows.length > 200) this.rows.shift(); },
  table() { console.table(this.rows.slice(-30)); },
  /** Rata-rata per aksi: total, server, jaringan, berapa kali dari cache server */
  summary() {
    const g = {}; this.rows.forEach(r => { const x = g[r.action] = g[r.action] || { n: 0, total: 0, server: 0, cached: 0 }; x.n++; x.total += r.total; x.server += r.server || 0; if (r.cached) x.cached++; });
    console.table(Object.keys(g).map(a => ({ action: a, calls: g[a].n, avgTotal: Math.round(g[a].total / g[a].n), avgServer: Math.round(g[a].server / g[a].n), avgNet: Math.round((g[a].total - g[a].server) / g[a].n), serverCacheHits: g[a].cached })));
  }
};
window.Perf = Perf;

// ---------------------------------------------------------
// API client (Prinsip 8)
// ---------------------------------------------------------
const READ_ACTIONS = /^(ping|publik\.config|guru\.boot|lo\.detail|lo\.riwayat|lo\.pdf|sumber\.(cekTautan|tabelDariSheet|saya|status|hasil)|admin\.(boot|dashboard|antrean)|bank\.list|dokumen\.list|laporan\.\w+|guruAdm\.list|pengaturan\.get|akunAdmin\.list|tema\.riwayat|ekspor\.integrasi|batch|notif\.(config|queue)|wa\.(device|audience|blastList|validate)|crm\.(list|stats|detail|duplikat|export))$/;
const LONG = { 'lo.cari': 150000, 'sumber.unggah': 200000, 'sumber.imporTabel': 170000, 'lo.pdf': 90000, 'lo.email': 90000, 'ekspor.integrasi': 90000, 'migrasi.import': 330000, 'wa.blastProcess': 90000, 'notif.processNow': 90000 };

async function apiOnce(action, data, timeout, reqId) {
  if (window.MOCK_API) { const t0 = performance.now(); const r = await window.MOCK_API(action, data, AppState.token, reqId); Perf.add(action, Math.round(performance.now() - t0), r.ms, r.cached); return r; }
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: AppState.token || '', reqId, device: AppState.device, data: data || {} })
    });
    const text = await res.text();
    try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms, j.cached); return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 200, message: 'The server replied with an unexpected page (HTTP ' + res.status + '). Please try again.' }; }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'The server took too long to respond.' : 'Connection problem. Check your internet and try again.' };
  } finally { clearTimeout(timer); }
}
/* Turbo: baca identik yang sedang berjalan ditumpangi (dedupe); epoch tulis mencegah menumpang baca basi */
const _inflight = {}; let _writeEpoch = 0;
function api(action, data, opt = {}) {
  const isRead = READ_ACTIONS.test(action);
  if (!isRead) { _writeEpoch++; return apiRun(action, data, opt).then(afterWrite); }
  const k = _writeEpoch + '|' + action + '|' + AppState.token + '|' + JSON.stringify(data || {});
  if (_inflight[k]) return _inflight[k];
  const p = apiRun(action, data, opt); _inflight[k] = p;
  p.then(() => delete _inflight[k], () => delete _inflight[k]);
  return p;
}
/** Notifikasi antre (res.nq) → minta server mengirim sekarang di eksekusi terpisah (tidak menunda respons) */
function afterWrite(res) { if (res && res.nq > 0) scheduleDrain(); return res; }
let _drainT = null, _drainN = 0;
function scheduleDrain() {
  clearTimeout(_drainT);
  _drainT = setTimeout(async () => {
    const r = await apiRun('drain', {}, { tries: 1 });
    if (r && r.success && r.data && r.data.left > 0 && ++_drainN < 3) scheduleDrain(); else _drainN = 0;
  }, 400);
}
async function apiRun(action, data, opt = {}) {
  if (!CONFIG_OK && !window.MOCK_API) return { success: false, message: 'App configuration is incomplete: set GAS_URL in js/config.js.' };
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()));
  const tries = opt.tries || (isRead ? 3 : 2);
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await sleep(1200 * i); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, LONG[action] || (isRead ? (i ? 40000 : 25000) : 90000), reqId);
    if (res.success || !res.retryable) break;
  }
  if (!res.success && res.data && res.data.code === 'AUTH' && AppState.token) onSessionExpired();
  return res;
}
function idle(fn) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 3000 }); else setTimeout(fn, 1500); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function waitOnline(ms) { return new Promise(r => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
/** Warmup: membangunkan server + memanaskan cache (pub|admin), maks 1×/4 menit per lingkup */
function warmUpServer(scope) {
  scope = scope || 'pub';
  if (!CONFIG_OK || window.MOCK_API) return;
  try { const k = 'lof:warm:' + scope, t = +sessionStorage.getItem(k) || 0; if (Date.now() - t < 240000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) { }
  fetch(GAS_URL + '?w=' + scope + '&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => { });
}

/** Stale-while-revalidate: render(data, fromCache) dipanggil maks 2× dan hanya bila berubah. */
async function swr(key, action, payload, render, opt = {}) {
  const fresh = opt.fresh ?? 60000;
  const c = Store.get(userKey(key), null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
  const res = await api(action, payload);
  if (res.success) {
    const h = hashStr(JSON.stringify(res.data));
    Store.set(userKey(key), { t: Date.now(), h, data: res.data });
    if (!c || c.h !== h) render(res.data, false);
  } else if (!c && opt.onError) opt.onError(res);
  return res;
}
function cacheSet(key, data) { Store.set(userKey(key), { t: Date.now(), h: hashStr(JSON.stringify(data)), data }); }
function cacheGet(key) { const c = Store.get(userKey(key), null); return c ? c.data : null; }
function cacheDel(key) { Store.del(userKey(key)); }

// ---------------------------------------------------------
// Utilitas DOM
// ---------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ic(name, cls) { const b = (window.ICONS || {})[name]; if (!b) { console.warn('Icon missing:', name); return ''; } return '<svg class="ic ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>'; }
function debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
function initials(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?'; }
function fmtDate(v, withTime) {
  if (!v) return '—';
  const d = new Date(v); if (isNaN(d)) return esc(v);
  const o = { day: 'numeric', month: 'short', year: 'numeric' }; if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
  return d.toLocaleDateString('en-GB', o);
}
function fmtRel(v) {
  const d = new Date(v); if (isNaN(d)) return '—';
  const s = (Date.now() - d) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 7 * 86400) return Math.floor(s / 86400) + ' d ago'; return fmtDate(v);
}
function optionList(arr, sel, placeholder) { return (placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '') + (arr || []).map(x => { const v = typeof x === 'object' ? x.v : x, l = typeof x === 'object' ? x.l : x; return '<option value="' + esc(v) + '"' + (String(v) === String(sel ?? '') ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); }
function downloadBase64(b64, name, mime) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  downloadBlob(new Blob([u8], { type: mime || 'application/pdf' }), name);
}
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function fileToBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(file); }); }
const _scripts = {};
function loadScript(src) { if (_scripts[src]) return _scripts[src]; return (_scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.defer = true; s.onload = res; s.onerror = () => { delete _scripts[src]; rej(new Error('Failed to load ' + src)); }; document.head.appendChild(s); })); }
// SheetJS: versi terbaru dari CDN resmi; cadangan salinan lokal bila CDN tidak terjangkau
function loadXLSX() { if (window.XLSX) return Promise.resolve(); return loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js').catch(() => loadScript('js/vendor/xlsx.full.min.js')); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } }

// ---------------------------------------------------------
// Komponen UI: toast, modal, drawer, menu, loading tombol
// ---------------------------------------------------------
function toast(msg, type = 'ok', ms = 3600) {
  const box = $('#toasts'); if (!box) return;
  const icon = { ok: 'circle-check', err: 'circle-alert', warn: 'triangle-alert', info: 'info' }[type] || 'info';
  const t = document.createElement('div'); t.className = 'toast ' + type; t.setAttribute('role', type === 'err' ? 'alert' : 'status');
  t.innerHTML = ic(icon) + '<div class="grow">' + esc(msg) + '</div>';
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .2s'; setTimeout(() => t.remove(), 220); }, ms);
}
function btnBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.classList.add('is-loading'); btn.innerHTML = ic('loader-circle', 'spin') + (label ? '<span>' + esc(label) + '</span>' : ''); }
  else { btn.disabled = false; btn.classList.remove('is-loading'); if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}
let _layerStack = [];
function openLayer(kind, html, opt = {}) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  const el = document.createElement('div'); el.className = kind + (opt.wide ? ' wide' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = html;
  document.body.append(ov, el);
  requestAnimationFrame(() => { ov.classList.add('show'); el.classList.add('show'); });
  const close = (val) => { ov.classList.remove('show'); el.classList.remove('show'); setTimeout(() => { ov.remove(); el.remove(); }, 230); _layerStack = _layerStack.filter(x => x.el !== el); if (opt.onClose) opt.onClose(val); };
  ov.addEventListener('click', () => { if (!opt.sticky) close(); });
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  _layerStack.push({ el, close });
  setTimeout(() => { const f = el.querySelector('[autofocus], input:not([type=hidden]), textarea, select, button'); if (f && !opt.noFocus) f.focus(); }, 60);
  return { el, close };
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _layerStack.length) _layerStack[_layerStack.length - 1].close(); });
function modal(title, body, footer, opt) {
  return openLayer('modal', '<div class="modal-h"><h3>' + esc(title) + '</h3><button class="icon-btn btn-sm" data-close aria-label="Close" style="color:var(--muted)">' + ic('x') + '</button></div><div class="modal-b">' + body + '</div>' + (footer ? '<div class="modal-f">' + footer + '</div>' : ''), opt);
}
function drawer(title, body, opt) {
  return openLayer('drawer', '<div class="drawer-h"><h3>' + esc(title) + '</h3><button class="icon-btn" data-close aria-label="Close" style="color:var(--muted)">' + ic('x') + '</button></div><div class="drawer-b">' + body + '</div>', opt);
}
function confirmBox(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, '<p class="muted">' + esc(text) + '</p>', '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(okLabel) + '</button>', { onClose: () => { if (!done) resolve(false); } });
    m.el.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); m.close(); };
  });
}
function promptBox(title, label, opt = {}) {
  return new Promise((resolve) => {
    let done = false;
    const f = opt.textarea ? '<textarea class="textarea" id="pb-in" placeholder="' + esc(opt.placeholder || '') + '">' + esc(opt.value || '') + '</textarea>' : '<input class="input" id="pb-in" value="' + esc(opt.value || '') + '" placeholder="' + esc(opt.placeholder || '') + '">';
    const m = modal(title, '<div class="field"><label class="label' + (opt.required ? ' req' : '') + '" for="pb-in">' + esc(label) + '</label>' + f + '<div class="err-msg" id="pb-err" hidden></div></div>', '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn ' + (opt.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(opt.ok || 'OK') + '</button>', { onClose: () => { if (!done) resolve(null); } });
    m.el.querySelector('[data-ok]').onclick = () => {
      const v = m.el.querySelector('#pb-in').value.trim();
      if (opt.required && !v) { const e = m.el.querySelector('#pb-err'); e.hidden = false; e.innerHTML = ic('circle-alert', 'ic-s') + 'This field is required.'; return; }
      done = true; resolve(v); m.close();
    };
  });
}
function popMenu(anchor, items) {
  closeMenus();
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it === '-' ? '<div style="height:1px;background:var(--border);margin:4px 0"></div>' : '<button role="menuitem" data-i="' + i + '"' + (it.danger ? ' style="color:var(--err)"' : '') + '>' + (it.icon ? ic(it.icon) : '') + esc(it.label) + '</button>').join('');
  anchor.parentElement.classList.add('rel'); anchor.parentElement.appendChild(m);
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const it = items[+b.dataset.i]; closeMenus(); it.fn && it.fn(); });
  setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
}
function closeMenus() { $$('.menu').forEach(m => m.remove()); }

// Ilustrasi kosong (garis sederhana biru/hijau)
function illu(kind) {
  const p = 'stroke="var(--primary)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"', g = 'stroke="var(--accent)" stroke-width="2.4" fill="none" stroke-linecap="round"';
  const art = {
    book: '<path ' + p + ' d="M20 20h30a8 8 0 0 1 8 8v48a6 6 0 0 0-6-6H20zM100 20H70a8 8 0 0 0-8 8v48a6 6 0 0 1 6-6h32z"/><circle ' + g + ' cx="86" cy="56" r="11"/><path ' + g + ' d="M94 64l10 10"/>',
    folder: '<path ' + p + ' d="M16 30h28l8 8h52v44H16z"/><path ' + g + ' d="M88 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
    check: '<rect ' + p + ' x="30" y="14" width="60" height="70" rx="8"/><path ' + p + ' d="M48 14v-4h24v4"/><path ' + g + ' d="M44 50l10 10 22-22"/>',
    chart: '<path ' + p + ' d="M18 80h86M28 70V44M48 70V30M68 70V52M88 70V22"/><path ' + g + ' d="M28 40l20-14 20 22 20-30"/>'
  };
  return '<svg class="illu" viewBox="0 0 120 96" aria-hidden="true">' + (art[kind] || art.book) + '</svg>';
}
function emptyState(kind, title, text, cta) { return '<div class="empty">' + illu(kind) + '<h4>' + esc(title) + '</h4><p class="small">' + esc(text) + '</p>' + (cta || '') + '</div>'; }
function skeletonRows(n = 4) { return Array.from({ length: n }, () => '<div class="sk sk-line" style="width:' + (60 + Math.random() * 35) + '%"></div>').join(''); }
function errorBox(res, retryAct) { return '<div class="empty">' + illu('chart') + '<h4>Could not load data</h4><p class="small">' + esc(res && res.message || 'Please try again.') + '</p><button class="btn btn-outline" data-act="' + (retryAct || 'retry') + '">' + ic('refresh-cw') + 'Try again</button></div>'; }

function aktPill(a) { a = String(a || ''); if (!/^[FCPM]C[1-6]$/.test(a)) return a ? '<span class="pill akt">' + esc(a) + '</span>' : ''; return '<span class="pill akt c' + a[2] + '" title="' + esc(aktLabel(a)) + '">' + esc(a) + '</span>'; }
function aktLabel(a) { const K = { F: 'Factual', C: 'Conceptual', P: 'Procedural', M: 'Metacognitive' }, C = ['', 'Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create']; return (K[a[0]] || '') + ' + ' + (C[+a[2]] || ''); }
const STATUS = {
  'Terverifikasi': ['ok', 'Verified'], 'Belum terverifikasi': ['wait', 'Unverified'], 'Menunggu': ['wait', 'Pending'], 'Ditolak': ['bad', 'Rejected'],
  'Pribadi': ['', 'Private'], 'Draf': ['', 'Draft'], 'Antre': ['info', 'Queued'], 'Diproses': ['info', 'Processing'], 'Selesai': ['ok', 'Done'], 'Gagal': ['bad', 'Failed'],
  'Aktif': ['ok', 'Active'], 'Nonaktif': ['', 'Inactive'], 'Bersama': ['ok', 'Shared'], 'Digabung': ['', 'Merged']
};
function statusPill(s) { const x = STATUS[s] || ['', s || '—']; const spin = s === 'Diproses' ? ic('loader-circle', 'ic-s spin') : ''; return '<span class="pill ' + x[0] + '">' + spin + esc(x[1]) + '</span>'; }
const JENIS_EN = { 'Silabus': 'Syllabus', 'Ebook': 'Ebook', 'Past Paper': 'Past Paper', 'Mark Scheme': 'Mark Scheme' };
function fileIcon(fmt) {
  const f = String(fmt || '').replace('TAUTAN:', '');
  const m = { PDF: ['f-pdf', 'PDF'], DOCX: ['f-docx', 'DOC'], GDOC: ['f-docx', 'GDOC'], PPTX: ['f-pptx', 'PPT'], GSLIDES: ['f-pptx', 'SLIDE'], XLSX: ['f-xlsx', 'XLS'], CSV: ['f-xlsx', 'CSV'], GSHEET: ['f-xlsx', 'SHEET'], JPG: ['f-img', 'IMG'], PNG: ['f-img', 'IMG'] }[f] || ['f-link', 'FILE'];
  return '<span class="fileicon ' + m[0] + '">' + m[1] + '</span>';
}

// ---------------------------------------------------------
// Mesin tema (sekolah + mode + preset), tanpa kedip
// ---------------------------------------------------------
const Theme = {
  DEFAULT: { light: { primary: '#1E5AA8', primaryDark: '#143F78', accent: '#2E9E5B', accentSoft: '#E6F4EC', bg: '#FFFFFF', surface: '#F4F7FB', text: '#1F2937', warn: '#F59E0B', err: '#DC2626' }, dark: { auto: true, bg: '#0F172A', surface: '#1E293B', text: '#E5E7EB', primary: '#4C8DF0', accent: '#3FBF77' } },
  PRESETS: {
    default: { nama: 'Blue-White (default)' },
    hijau: { nama: 'Fresh Green', light: { primary: '#1B7A43', primaryDark: '#14603A', accent: '#1E5AA8', accentSoft: '#E6EEF8', surface: '#F3F8F5' }, dark: { primary: '#3FBF77', accent: '#4C8DF0' } },
    malam: { nama: 'Night Blue', forceDark: true, dark: { bg: '#0B1220', surface: '#16213A', text: '#E5E7EB', primary: '#5B9BF5', accent: '#3FBF77' } },
    kontras: { nama: 'High Contrast', forceLight: true, light: { primary: '#0B3D91', primaryDark: '#062A66', accent: '#0B6B32', accentSoft: '#E6F4EC', bg: '#FFFFFF', surface: '#FFFFFF', text: '#000000', border: '#000000', muted: '#1F2937' } }
  },
  pref() { return Store.get('pref', { mode: 'auto', preset: 'default' }); },
  setPref(p) { Store.set('pref', Object.assign(this.pref(), p)); this.apply(true); },
  school() { const t = (AppState.boot && AppState.boot.tema) || (AppState.publik && AppState.publik.tema) || Store.get('tema', null); return t || Object.assign({ versi: 0 }, this.DEFAULT); },
  isDark(pref) { const p = this.PRESETS[pref.preset] || {}; if (p.forceLight) return false; if (p.forceDark) return true; return pref.mode === 'dark' || (pref.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); },
  /** Hitung variabel CSS dari palet terang & gelap */
  compute(light, dark, isDark, extra) {
    const L = Object.assign({}, this.DEFAULT.light, light || {}), D0 = Object.assign({}, this.DEFAULT.dark, dark || {});
    if (!isDark) {
      return Object.assign({
        '--primary': L.primary, '--primary-dark': L.primaryDark, '--accent': L.accent, '--accent-soft': L.accentSoft, '--bg': L.bg, '--surface': L.surface, '--card': L.bg,
        '--text': L.text, '--muted': L.muted || '#6B7280', '--border': L.border || '#E2E8F0', '--border-strong': L.border || '#CBD5E1', '--warn': L.warn, '--err': L.err,
        '--primary-soft': C.mix(L.primary, L.bg, .9), '--hover': C.mix(L.primary, L.bg, .97), '--on-primary': C.onColor(L.primary), '--on-accent': C.onColor(L.accent, 3),
        '--nav-bg': L.primary, '--nav-fg': '#FFFFFF', '--side-bg': L.primaryDark
      }, extra || {});
    }
    const D = D0.auto ? Object.assign({}, D0, { primary: C.lighten(L.primary, .32), accent: C.lighten(L.accent, .18) }) : D0;
    return Object.assign({
      '--primary': D.primary, '--primary-dark': C.lighten(D.primary, .15), '--accent': D.accent, '--accent-soft': C.mix(D.accent, D.surface, .82), '--bg': D.surface, '--surface': D.bg, '--card': D.surface,
      '--text': D.text, '--muted': '#94A3B8', '--border': C.mix(D.text, D.surface, .82), '--border-strong': C.mix(D.text, D.surface, .7), '--warn': '#FBBF24', '--err': '#F87171',
      '--primary-soft': C.mix(D.primary, D.surface, .8), '--hover': C.mix(D.text, D.surface, .94), '--on-primary': C.onColor(D.primary), '--on-accent': C.onColor(D.accent, 3),
      '--nav-bg': C.mix('#000000', D.surface, .25), '--nav-fg': D.text, '--side-bg': D.bg
    }, extra || {});
  },
  current() {
    const pref = this.pref(), sch = this.school(), pr = this.PRESETS[pref.preset] || {};
    const dark = this.isDark(pref);
    const light = Object.assign({}, sch.light, pr.light || {}), darkP = Object.assign({}, sch.dark, pr.dark || {});
    if (pr.dark) darkP.auto = false;
    if (pref.preset === 'hijau' && dark) Object.assign(darkP, this.DEFAULT.dark, pr.dark, { auto: false });
    return { vars: this.compute(light, darkP, dark), dark, preset: pref.preset };
  },
  apply(anim) {
    const t = this.current(), root = document.documentElement;
    if (anim) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 300); }
    Object.keys(t.vars).forEach(k => root.style.setProperty(k, t.vars[k]));
    root.dataset.mode = t.dark ? 'dark' : 'light'; root.dataset.preset = t.preset;
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.vars['--nav-bg'];
    try { localStorage.setItem('lof:theme', JSON.stringify(t)); } catch (e) { }
    $$('[data-theme-icon]').forEach(el => { el.innerHTML = ic(t.dark ? 'sun' : 'moon'); el.setAttribute('aria-label', t.dark ? 'Switch to light mode' : 'Switch to dark mode'); });
    document.dispatchEvent(new Event('themechange'));
  },
  setSchool(tema) { if (!tema) return; const cur = this.school(); Store.set('tema', tema); if (!cur || cur.versi !== tema.versi || JSON.stringify(cur.light) !== JSON.stringify(tema.light)) this.apply(true); },
  toggle() { const d = this.isDark(this.pref()); const pr = this.pref().preset; this.setPref({ mode: d ? 'light' : 'dark', preset: (pr === 'malam' || pr === 'kontras') ? 'default' : pr }); }
};
// Warna: campur, cerahkan, kontras
const C = {
  rgb(h) { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); },
  hex(r) { return '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase(); },
  mix(a, b, t) { const x = this.rgb(a), y = this.rgb(b); return this.hex(x.map((v, i) => v * (1 - t) + y[i] * t)); },
  lighten(a, t) { return this.mix(a, '#FFFFFF', t); },
  lum(h) { return this.rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0); },
  ratio(a, b) { const x = this.lum(a), y = this.lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); },
  onColor(bg, min = 4.5) { return this.ratio('#FFFFFF', bg) >= min ? '#FFFFFF' : '#0B1220'; }
};
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (Theme.pref().mode === 'auto') Theme.apply(true); });

// ---------------------------------------------------------
// Router SPA (halaman hidup, tidak dibuang — Prinsip 1)
// ---------------------------------------------------------
const Pages = {};
function registerPage(name, def) { Pages[name] = Object.assign({ layout: 'guru', auth: 'user' }, def); }
function go(name, param) { const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) route(); else location.hash = h; }
function defaultPage() { if (!AppState.token || !AppState.me) return 'masuk'; return isAdmin() ? 'a-dash' : 'cari'; }

async function route() {
  closeMenus();
  const raw = location.hash.replace(/^#\/?/, '');
  let [name, ...rest] = raw.split('/');
  let param = rest.length ? decodeURIComponent(rest.join('/')) : '';
  if (!name) name = defaultPage();
  if (!Pages[name] && name.indexOf('a-') === 0 && isAdmin()) {
    try { await loadAdmin(); } catch (e) { toast('Could not load the admin panel. Check your connection.', 'err'); return; }
  }
  let def = Pages[name];
  if (!def) { name = defaultPage(); def = Pages[name]; param = ''; }
  // penjaga akses
  if (def.auth === 'guest' && AppState.token && AppState.me) { return go(defaultPage()); }
  if (def.auth !== 'guest' && (!AppState.token || !AppState.me)) { Store.set('afterLogin', raw); return go(def.layout === 'admin' ? 'admin' : 'masuk'); }
  if (def.auth === 'admin' && !isAdmin()) return go('cari');
  if (def.auth === 'sa' && !isSA()) return go('a-dash');
  if (def.noTamu && isTamu()) { toast('Guest access cannot use this page.', 'warn'); return go('cari'); }
  const shell = ensureShell(def.layout);
  let el = shell.view.querySelector('.page[data-page="' + name + '"]');
  if (!el) {
    el = document.createElement('section'); el.className = 'page'; el.dataset.page = name;
    el.innerHTML = def.template ? def.template() : '';
    shell.view.appendChild(el);
    if (def.mount) def.mount(el);
    el.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a && el.contains(a) && def.acts && def.acts[a.dataset.act]) { e.preventDefault(); def.acts[a.dataset.act].call(def, a, e, el); } });
  }
  $$('.page', shell.view).forEach(p => { p.hidden = p !== el; });
  AppState.page = name;
  highlightNav(def.nav || name);
  document.title = (def.title ? (typeof def.title === 'function' ? def.title(param) : def.title) + ' · ' : '') + appName();
  if (def.show) def.show(el, param);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------------------------------------------------------
// Shell (auth / guru / admin)
// ---------------------------------------------------------
const Shells = {};
function appName() { const s = (AppState.boot && AppState.boot.settings) || (AppState.publik && AppState.publik.settings) || {}; return s.NAMA_APLIKASI || 'LO Finding'; }
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h11v14H6a2 2 0 0 0-2 2.5z"/><path d="M17 17h3V5"/><circle cx="11" cy="9" r="2.6"/><path d="m13 11 2 2"/></svg>';

function ensureShell(layout) {
  if (AppState.layout !== layout) {
    Object.keys(Shells).forEach(k => { Shells[k].root.hidden = k !== layout; });
    AppState.layout = layout; document.body.dataset.layout = layout;
  }
  if (Shells[layout]) return Shells[layout];
  const root = document.createElement('div'); root.className = 'shell shell-' + layout;
  if (layout === 'auth') root.innerHTML = '<div class="view"></div>';
  if (layout === 'guru') {
    const nav = [['cari', 'search', 'Find LO'], ['unggah', 'upload', 'Upload Source'], ['dokumen', 'folder-open', 'My Documents'], ['riwayat', 'history', 'History']];
    root.innerHTML = '<header class="topnav"><a class="brand" href="#/cari"><span class="logo">' + LOGO + '</span><span data-appname>' + esc(appName()) + '</span></a><nav aria-label="Main">' +
      nav.map(n => '<a href="#/' + n[0] + '" data-nav="' + n[0] + '">' + ic(n[1]) + n[2] + (n[0] === 'dokumen' ? '<span class="badge" data-badge="dok" hidden></span>' : '') + '</a>').join('') +
      '</nav><div class="spacer"></div><a class="icon-btn" href="#/a-dash" data-adminlink title="Admin panel" aria-label="Admin panel" hidden>' + ic('layout-dashboard') + '</a><button class="icon-btn" data-theme-icon data-act-global="theme"></button>' +
      '<div><button class="user-btn" data-act-global="user"><span class="avatar" data-avatar>?</span><span class="name" data-username></span>' + ic('chevron-down', 'ic-s') + '</button></div></header>' +
      '<main class="main"><div class="view"></div></main>' +
      '<nav class="bottomnav" aria-label="Main">' + nav.map(n => '<a href="#/' + n[0] + '" data-nav="' + n[0] + '">' + ic(n[1]) + '<span>' + n[2].replace(' Source', '').replace('My ', '') + '</span>' + (n[0] === 'dokumen' ? '<span class="badge" data-badge="dok" hidden></span>' : '') + '</a>').join('') + '</nav>';
  }
  if (layout === 'admin') {
    const S = (k, i, l, b) => '<a class="nav" href="#/' + k + '" data-nav="' + k + '">' + ic(i) + '<span>' + l + '</span>' + (b ? '<span class="badge" data-badge="' + b + '" hidden></span>' : '') + '</a>';
    root.innerHTML = '<div class="adm"><aside class="sidebar"><a class="brand" href="#/a-dash"><span class="logo">' + LOGO + '</span><span>' + esc(appName()) + ' · Admin</span></a>' +
      '<div class="sec">Dashboard</div>' + S('a-dash', 'layout-dashboard', 'Dashboard') +
      '<div class="sec">LO Bank</div>' + S('a-antrean', 'clipboard-check', 'Verification Queue', 'pending') + S('a-bank', 'book-open', 'LO Bank') + S('a-dokumen', 'file-text', 'Source Documents') +
      '<div class="sec">Reports</div>' + S('a-cakupan', 'target', 'LO Coverage') + S('a-kelengkapan', 'layers', 'Bank Completeness') + S('a-pemakaian', 'history', 'Usage Log') +
      '<div class="sec">Communication</div>' + S('a-wa', 'message-circle', 'WhatsApp & Notifications') + S('a-crm', 'book-user', 'CRM Contacts') +
      '<div class="sec">Admin</div>' + S('a-guru', 'users', 'Teachers') + S('a-set', 'settings', 'Settings') + '<span data-saonly>' + S('a-migrasi', 'database', 'Data Migration') + '</span>' +
      '<div class="foot">' + S('cari', 'search', 'Teacher Portal') + '<a class="nav" href="#" data-act-global="logout">' + ic('log-out') + '<span>Logout</span></a></div></aside>' +
      '<div class="adm-main"><header class="topbar"><h1 data-adm-title>Dashboard</h1><div class="spacer" style="flex:1"></div><select class="select term-sel" data-termsel aria-label="Term"></select>' +
      '<button class="icon-btn" data-theme-icon data-act-global="theme"></button><div><button class="user-btn" data-act-global="user" style="color:var(--text)"><span class="avatar" data-avatar>?</span><span class="name" data-username></span>' + ic('chevron-down', 'ic-s') + '</button></div></header>' +
      '<main class="main"><div class="view"></div></main></div>' +
      '<nav class="bottomnav" aria-label="Admin">' + [['a-dash', 'layout-dashboard', 'Dashboard'], ['a-antrean', 'clipboard-check', 'Verify', 'pending'], ['a-cakupan', 'chart-column', 'Reports'], ['a-more', 'ellipsis', 'More']]
        .map(n => '<a href="#/' + n[0] + '" data-nav="' + n[0] + '"' + (n[0] === 'a-more' ? ' data-act-global="more"' : '') + '>' + ic(n[1]) + '<span>' + n[2] + '</span>' + (n[3] ? '<span class="badge" data-badge="pending" hidden></span>' : '') + '</a>').join('') + '</nav></div>';
  }
  $('#app').appendChild(root);
  Shells[layout] = { root, view: $('.view', root) };
  refreshShellUser();
  Theme.apply();
  return Shells[layout];
}
function refreshShellUser() {
  const me = AppState.me || {};
  $$('[data-username]').forEach(e => e.textContent = me.nama || '');
  $$('[data-avatar]').forEach(e => e.textContent = initials(me.nama));
  $$('[data-appname]').forEach(e => e.textContent = appName());
  $$('[data-adminlink]').forEach(e => e.hidden = !isAdmin());
  $$('a[data-nav="unggah"], a[data-nav="dokumen"]').forEach(e => e.hidden = isTamu());
  $$('[data-saonly]').forEach(e => e.hidden = !isSA());
  $$('[data-install]').forEach(e => e.hidden = !PWA.can());
}
function highlightNav(key) { $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === key)); }
function setBadge(name, n) { $$('[data-badge="' + name + '"]').forEach(b => { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }); }

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-act-global]'); if (!g) return;
  const act = g.dataset.actGlobal;
  if (act === 'theme') { e.preventDefault(); Theme.toggle(); }
  if (act === 'user') { e.preventDefault(); e.stopPropagation(); userMenu(g); }
  if (act === 'logout') { e.preventDefault(); logout(false); }
  if (act === 'install') { e.preventDefault(); PWA.install(); }
  if (act === 'more') { e.preventDefault(); e.stopPropagation(); popMenu(g, [
    { label: 'LO Bank', icon: 'book-open', fn: () => go('a-bank') }, { label: 'Source Documents', icon: 'file-text', fn: () => go('a-dokumen') },
    { label: 'Bank Completeness', icon: 'layers', fn: () => go('a-kelengkapan') }, { label: 'Usage Log', icon: 'history', fn: () => go('a-pemakaian') },
    { label: 'WhatsApp & Notifications', icon: 'message-circle', fn: () => go('a-wa') }, { label: 'CRM Contacts', icon: 'book-user', fn: () => go('a-crm') },
    { label: 'Teachers', icon: 'users', fn: () => go('a-guru') }, { label: 'Settings', icon: 'settings', fn: () => go('a-set') }].concat(isSA() ? [{ label: 'Data Migration', icon: 'database', fn: () => go('a-migrasi') }] : []).concat(['-',
    { label: 'Teacher Portal', icon: 'search', fn: () => go('cari') }, { label: 'Logout', icon: 'log-out', danger: true, fn: () => logout(false) }])); }
});

function userMenu(anchor) {
  const items = [{ label: 'Profile & appearance', icon: 'palette', fn: profilePanel }];
  if (isAdmin()) items.push(AppState.layout === 'admin' ? { label: 'Teacher Portal', icon: 'search', fn: () => go('cari') } : { label: 'Admin Panel', icon: 'layout-dashboard', fn: () => go('a-dash') });
  if (isAdmin()) items.push({ label: 'Change password', icon: 'key-round', fn: changePassword });
  if (PWA.can()) items.push({ label: 'Install app on this device', icon: 'smartphone', fn: () => PWA.install() });
  items.push('-', { label: 'Sign out of this device', icon: 'log-out', danger: true, fn: () => logout(false) });
  if (!isTamu()) items.push({ label: 'Sign out of all devices', icon: 'shield-check', danger: true, fn: () => logout(true) });
  popMenu(anchor, items);
}

function profilePanel() {
  const me = AppState.me || {}, pref = Theme.pref(), sch = Theme.school();
  const sw = Object.keys(Theme.PRESETS).map(k => {
    const p = Theme.PRESETS[k], L = Object.assign({}, sch.light, p.light || {}), D = Object.assign({}, Theme.DEFAULT.dark, p.dark || {});
    const cols = p.forceDark ? [D.bg, D.surface, D.primary, D.accent] : [L.primary, L.accent, L.surface, L.text];
    return '<button class="swatch' + (pref.preset === k ? ' on' : '') + '" data-preset="' + k + '"><span class="tick">' + ic('check', 'ic-s') + '</span><div class="strip">' + cols.map(c => '<i style="background:' + c + '"></i>').join('') + '</div><div class="nm">' + esc(p.nama) + '</div></button>';
  }).join('');
  const body = '<div class="row" style="gap:14px;margin-bottom:18px"><span class="avatar" style="width:52px;height:52px;font-size:18px">' + esc(initials(me.nama)) + '</span><div><div class="bold">' + esc(me.nama) + '</div><div class="small muted">' + esc(me.email || (isTamu() ? 'Guest access' : '')) + '</div>' +
    '<div class="small muted">' + esc([me.unit, me.mapel].filter(Boolean).join(' · ') || (me.role === 'superadmin' ? 'Superadmin' : me.role === 'admin' ? 'Admin' : '')) + '</div></div></div>' +
    '<h4>Appearance</h4><div class="seg mt-s" data-modes>' + ['light', 'dark', 'auto'].map(m => '<button data-mode="' + m + '" class="' + (pref.mode === m ? 'on' : '') + '">' + m[0].toUpperCase() + m.slice(1) + '</button>').join('') + '</div>' +
    '<h4 class="mt-l">Theme</h4><div class="swatches mt-s">' + sw + '</div>' +
    '<p class="tiny muted mt">Your choice is saved on this device only. The school colors are managed by the superadmin.</p>' +
    '<button class="btn btn-ghost-danger mt" data-out>' + ic('log-out') + 'Sign out of this device</button>';
  const d = drawer('Profile & appearance', body);
  d.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]'); if (m) { Theme.setPref({ mode: m.dataset.mode, preset: ['malam', 'kontras'].includes(Theme.pref().preset) ? 'default' : Theme.pref().preset }); $$('[data-mode]', d.el).forEach(b => b.classList.toggle('on', b === m)); $$('[data-preset]', d.el).forEach(b => b.classList.toggle('on', b.dataset.preset === Theme.pref().preset)); }
    const p = e.target.closest('[data-preset]'); if (p) { Theme.setPref({ preset: p.dataset.preset }); $$('[data-preset]', d.el).forEach(b => b.classList.toggle('on', b === p)); }
    if (e.target.closest('[data-out]')) { d.close(); logout(false); }
  });
}

async function changePassword(forced) {
  const m = modal(forced ? 'Set a new password' : 'Change password',
    (forced ? '<div class="alert warn mb">' + ic('triangle-alert') + '<div>You are using a temporary password. Please set your own password now.</div></div>' : '') +
    '<div class="col"><div class="field"><label class="label req">Current password</label><input class="input" type="password" id="cp-old" autocomplete="current-password"></div>' +
    '<div class="field"><label class="label req">New password</label><input class="input" type="password" id="cp-new" autocomplete="new-password"><div class="help">At least 10 characters with letters and numbers.</div></div>' +
    '<div class="err-msg" id="cp-err" hidden></div></div>',
    (forced ? '' : '<button class="btn btn-ghost" data-close>Cancel</button>') + '<button class="btn btn-primary" id="cp-ok">Save password</button>', { sticky: !!forced });
  $('#cp-ok', m.el).onclick = async (e) => {
    const b = e.currentTarget; btnBusy(b, true, 'Saving');
    const r = await api('auth.gantiSandi', { lama: $('#cp-old', m.el).value, baru: $('#cp-new', m.el).value });
    btnBusy(b, false);
    if (!r.success) { const er = $('#cp-err', m.el); er.hidden = false; er.innerHTML = ic('circle-alert', 'ic-s') + esc(r.message); return; }
    AppState.me.wajibGanti = false; Store.set('me', AppState.me); toast('Password updated.'); m.close();
  };
}

// ---------------------------------------------------------
// Sesi
// ---------------------------------------------------------
function setSession(token, me, boot, bootKey) {
  AppState.token = token; AppState.me = me; Store.set('token', token); Store.set('me', me);
  if (boot) { AppState.boot = boot; cacheSet(bootKey || 'boot', boot); if (boot.tema) Theme.setSchool(boot.tema); }
  refreshShellUser();
}
function clearSession() {
  AppState.token = ''; AppState.me = null; AppState.boot = null; Store.del('token'); Store.del('me');
  Object.keys(Shells).forEach(k => { if (k !== 'auth') { Shells[k].root.remove(); delete Shells[k]; } });
  AppState.layout = '';
}
async function logout(all) {
  if (all && !(await confirmBox('Sign out of all devices?', 'You will need to sign in again on every device, including this one.', 'Sign out everywhere', true))) return;
  const wasAdmin = isAdmin();
  api('auth.keluar', { semua: !!all }, { tries: 1 });
  clearSession();
  go(wasAdmin ? 'admin' : 'masuk');
}
function onSessionExpired() { const wasAdmin = isAdmin(); clearSession(); toast('Your session has ended. Please sign in again.', 'warn'); go(wasAdmin ? 'admin' : 'masuk'); }
function afterLoginRoute() { const t = Store.get('afterLogin', ''); Store.del('afterLogin'); if (t && !/^(masuk|otp|admin)/.test(t)) location.hash = '#/' + t; else go(defaultPage()); }

// ---------------------------------------------------------
// Halaman autentikasi
// ---------------------------------------------------------
function authCard(inner, opt = {}) {
  return '<div class="auth' + (opt.dark ? ' dark-bg' : '') + '"><div class="corner"><button class="icon-btn" data-install data-act-global="install" title="Install app" aria-label="Install app" hidden>' + ic('smartphone') + '</button><button class="icon-btn" data-theme-icon data-act-global="theme" aria-label="Switch theme">' + ic(Theme.current().dark ? 'sun' : 'moon') + '</button></div><div class="auth-card">' + inner + '</div></div>';
}
registerPage('masuk', {
  layout: 'auth', auth: 'guest', title: 'Sign in',
  template() {
    return authCard('<div class="logo-box">' + LOGO + '</div><h2 data-appname-full>Learning Objective Finding</h2><p class="sub" data-sub>Sign in with your registered school email</p>' +
      '<form id="f-email" novalidate><div class="field"><label class="label" for="in-email">Email</label><div class="input-icon">' + ic('mail') + '<input class="input" id="in-email" type="email" autocomplete="email" inputmode="email" placeholder="name@school.sch.id" required></div><div class="err-msg" id="email-err" hidden></div></div>' +
      '<button class="btn btn-primary btn-block btn-lg mt" type="submit" id="btn-otp">Send Login Code</button></form>' +
      '<p class="help mt">No password needed. A 6-digit code will be sent to your email.</p>' +
      '<div data-guest hidden><div class="divider">or</div><button class="btn btn-ghost btn-block" data-act="guest">' + ic('key-round') + 'I have a guest access code</button></div>' +
      '<div class="divider"></div><div class="row between small"><a href="#/admin">' + ic('shield-check', 'ic-s') + ' Admin login</a><span class="muted" data-school></span></div>' +
      (CONFIG_OK || window.MOCK_API ? '' : '<div class="alert bad mt">' + ic('circle-alert') + '<div>App configuration is incomplete. Set <b>GAS_URL</b> in <code>js/config.js</code>.</div></div>'));
  },
  mount(el) {
    $('#f-email', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#in-email', el).value.trim(), err = $('#email-err', el), b = $('#btn-otp', el);
      err.hidden = true; $('#in-email', el).classList.remove('is-error');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.hidden = false; err.innerHTML = ic('circle-alert', 'ic-s') + 'Please enter a valid email address.'; $('#in-email', el).classList.add('is-error'); return; }
      btnBusy(b, true, 'Sending code');
      const r = await api('auth.mintaOtp', { email });
      btnBusy(b, false);
      if (!r.success) { err.hidden = false; err.innerHTML = ic('circle-alert', 'ic-s') + esc(r.message); $('#in-email', el).classList.add('is-error'); return; }
      Store.set('otp', { email, masked: r.data.email, at: Date.now() });
      go('otp');
    });
  },
  show(el) {
    const p = AppState.publik || {}, s = p.settings || {};
    $('[data-appname-full]', el).textContent = s.NAMA_APLIKASI && s.NAMA_APLIKASI !== 'LO Finding' ? s.NAMA_APLIKASI : 'Learning Objective Finding';
    $('[data-school]', el).textContent = s.NAMA_SEKOLAH || '';
    $('[data-guest]', el).hidden = s.KODE_AKSES_AKTIF !== 'Y';
    const o = Store.get('otp', null); if (o && o.email) $('#in-email', el).value = o.email;
    setTimeout(() => $('#in-email', el).focus(), 50);
  },
  acts: {
    guest() {
      const m = modal('Guest access', '<p class="small muted">For trainings and guests. Guests can search LOs but cannot upload sources.</p><div class="col"><div class="field"><label class="label req">Access code</label><input class="input mono" id="g-code" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px"></div><div class="field"><label class="label">Your name</label><input class="input" id="g-name" placeholder="e.g. Workshop participant"></div><div class="err-msg" id="g-err" hidden></div></div>',
        '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="g-ok">Continue</button>');
      $('#g-ok', m.el).onclick = async (e) => {
        const b = e.currentTarget; btnBusy(b, true, 'Checking');
        const r = await api('auth.kodeAkses', { kode: $('#g-code', m.el).value, nama: $('#g-name', m.el).value });
        btnBusy(b, false);
        if (!r.success) { const er = $('#g-err', m.el); er.hidden = false; er.innerHTML = ic('circle-alert', 'ic-s') + esc(r.message); return; }
        m.close(); setSession(r.data.token, r.data.me, r.data.boot); go('cari');
      };
    }
  }
});

registerPage('otp', {
  layout: 'auth', auth: 'guest', title: 'Enter code',
  template() {
    return authCard('<a href="#/masuk" class="small">' + ic('arrow-left', 'ic-s') + ' Change email</a><h2 class="mt">Enter Login Code</h2><p class="sub" data-to></p>' +
      '<form id="f-otp" novalidate><div class="otp" id="otp-boxes">' + Array.from({ length: 6 }, (_, i) => '<input inputmode="numeric" autocomplete="' + (i ? 'off' : 'one-time-code') + '" maxlength="1" aria-label="Digit ' + (i + 1) + '">').join('') + '</div>' +
      '<div class="row between small mt-s"><span class="muted" data-timer></span><button type="button" class="btn btn-ghost btn-sm" data-act="resend" disabled>Resend code</button></div>' +
      '<label class="check mt"><input type="checkbox" id="otp-remember" checked> Remember this device for 30 days</label>' +
      '<div class="err-msg mt-s" id="otp-err" hidden></div><button class="btn btn-primary btn-block btn-lg mt" type="submit" id="btn-in">Sign In</button></form>');
  },
  mount(el) {
    const boxes = $$('#otp-boxes input', el);
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); if (boxes.every(x => x.value)) $('#f-otp', el).requestSubmit(); });
      b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
      b.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (t.length) { e.preventDefault(); t.split('').forEach((c, j) => { if (boxes[j]) boxes[j].value = c; }); (boxes[t.length] || boxes[5]).focus(); if (t.length === 6) $('#f-otp', el).requestSubmit(); } });
    });
    $('#f-otp', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const o = Store.get('otp', {}), kode = boxes.map(x => x.value).join(''), err = $('#otp-err', el), b = $('#btn-in', el);
      if (kode.length < 6) return;
      err.hidden = true; btnBusy(b, true, 'Signing in');
      const r = await api('auth.verifikasiOtp', { email: o.email, kode, ingat: $('#otp-remember', el).checked });
      btnBusy(b, false);
      if (!r.success) {
        err.hidden = false; err.innerHTML = ic('circle-alert', 'ic-s') + esc(r.message);
        const box = $('#otp-boxes', el); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        boxes.forEach(x => x.value = ''); boxes[0].focus();
        if (r.data && r.data.code === 'EXPIRED') setTimeout(() => go('masuk'), 1800);
        return;
      }
      Store.del('otp');
      setSession(r.data.token, r.data.me, r.data.boot);
      toast('Welcome, ' + r.data.me.nama.split(' ')[0] + '!');
      afterLoginRoute();
    });
  },
  show(el) {
    const o = Store.get('otp', null);
    if (!o) return go('masuk');
    $('[data-to]', el).textContent = 'Code sent to ' + o.masked;
    $$('#otp-boxes input', el).forEach(x => x.value = ''); $('#otp-err', el).hidden = true;
    setTimeout(() => $('#otp-boxes input', el).focus(), 60);
    clearInterval(this._t);
    const tick = () => {
      const left = Math.max(0, 600 - Math.floor((Date.now() - o.at) / 1000)), rs = Math.max(0, 45 - Math.floor((Date.now() - o.at) / 1000));
      $('[data-timer]', el).textContent = left ? 'Code expires in ' + String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0') : 'Code expired';
      const btn = $('[data-act=resend]', el); btn.disabled = rs > 0; btn.textContent = rs > 0 ? 'Resend in ' + rs + 's' : 'Resend code';
      if (AppState.page !== 'otp') clearInterval(this._t);
    };
    tick(); this._t = setInterval(tick, 1000);
  },
  acts: {
    async resend(btn) {
      const o = Store.get('otp', {}); btnBusy(btn, true);
      const r = await api('auth.mintaOtp', { email: o.email }); btnBusy(btn, false);
      if (!r.success) return toast(r.message, 'err');
      Store.set('otp', Object.assign(o, { at: Date.now() })); toast('A new code has been sent.'); this.show($('.page[data-page=otp]'));
    }
  }
});

registerPage('admin', {
  layout: 'auth', auth: 'guest', title: 'Admin sign in',
  template() {
    return authCard('<div class="logo-box">' + ic('shield-check') + '</div><h2>Admin Sign In</h2><p class="sub">QA & academic team only</p>' +
      '<form id="f-adm" novalidate class="col"><div class="field"><label class="label" for="a-email">Email</label><input class="input" id="a-email" type="email" autocomplete="username"></div>' +
      '<div class="field"><label class="label" for="a-pass">Password</label><div class="rel"><input class="input" id="a-pass" type="password" autocomplete="current-password" style="padding-right:48px"><button type="button" class="icon-btn" data-act="peek" aria-label="Show password" style="position:absolute;right:2px;top:2px;color:var(--muted)">' + ic('eye') + '</button></div></div>' +
      '<div class="err-msg" id="a-err" hidden></div><button class="btn btn-primary btn-block btn-lg" type="submit" id="btn-adm">Sign In</button></form>' +
      '<div class="divider"></div><a href="#/masuk" class="small">' + ic('arrow-left', 'ic-s') + ' Back to teacher login</a>', { dark: true });
  },
  mount(el) {
    $('#f-adm', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('#btn-adm', el), err = $('#a-err', el); err.hidden = true;
      btnBusy(b, true, 'Signing in');
      const r = await api('auth.admin', { email: $('#a-email', el).value.trim(), password: $('#a-pass', el).value, appUrl: location.href.split('#')[0] });
      btnBusy(b, false);
      if (!r.success) { err.hidden = false; err.innerHTML = ic('circle-alert', 'ic-s') + esc(r.message); return; }
      $('#a-pass', el).value = '';
      setSession(r.data.token, r.data.me, null);
      cacheSet('a:boot', r.data.boot); AppState.adminBoot = r.data.boot; if (r.data.boot.tema) Theme.setSchool(r.data.boot.tema);
      await loadAdmin();
      afterLoginRoute();
      if (r.data.me.wajibGanti) setTimeout(() => changePassword(true), 400);
    });
  },
  show(el) { warmUpServer('admin'); setTimeout(() => $('#a-email', el).focus(), 50); },
  acts: { peek(b, e, el) { const i = $('#a-pass', el); i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = ic(i.type === 'password' ? 'eye' : 'eye-off'); } }
});

// ---------------------------------------------------------
// Admin bundle (lazy) & boot
// ---------------------------------------------------------
let _adminLoading = null;
function loadAdmin() {
  if (window.ADMIN_READY) return Promise.resolve();
  if (!_adminLoading) _adminLoading = Promise.all([loadScript('js/charts.js?v=' + APP_VER), loadScript('js/admin.js?v=' + APP_VER).then(() => loadScript('js/admin-ext.js?v=' + APP_VER))]).catch(e => { _adminLoading = null; throw e; });
  return _adminLoading;
}

/** Boot guru: render dari cache dulu, segarkan di latar. */
function guruBoot(force) {
  return swr('boot', 'guru.boot', {}, (b) => {
    AppState.boot = b;
    if (b.tema) Theme.setSchool(b.tema);
    if (b.me) { AppState.me = Object.assign({}, AppState.me, b.me); Store.set('me', AppState.me); refreshShellUser(); }
    setBadge('dok', (b.dokumen && b.dokumen.proses) || 0);
    document.dispatchEvent(new CustomEvent('boot', { detail: b }));
  }, { fresh: force ? 0 : 45000 });
}

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
async function init() {
  Theme.apply();
  warmUpServer();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') AppState.hiddenAt = Date.now();
    else if (AppState.hiddenAt && Date.now() - AppState.hiddenAt > 120000) { warmUpServer(isAdmin() ? 'admin' : 'pub'); if (AppState.token && !isAdmin()) guruBoot(); }
  });
  // konfigurasi publik (nama app & tema) — SWR global
  const cachedPub = Store.get('publik', null);
  if (cachedPub) AppState.publik = cachedPub;
  api('publik.config', {}).then(r => { if (r.success) { AppState.publik = r.data; Store.set('publik', r.data); Theme.setSchool(r.data.tema); refreshShellUser(); if (AppState.page === 'masuk') Pages.masuk.show($('.page[data-page=masuk]')); } });
  if (AppState.token && AppState.me) {
    if (isAdmin()) { AppState.adminBoot = cacheGet('a:boot'); warmUpServer('admin'); loadAdmin().catch(() => { }); }
    else guruBoot();
  }
  const sk = $('#boot-skeleton'); if (sk) sk.remove();
  route();
  PWA.init();
}
// ---------------------------------------------------------
// PWA: pasang di HP/laptop (Android/desktop: prompt asli · iOS: petunjuk Share → Add to Home Screen)
// ---------------------------------------------------------
const PWA = {
  evt: null,
  standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; },
  ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  can() { return !this.standalone() && (!!this.evt || this.ios()); },
  init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.MOCK_API) navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e.message));
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.evt = e; refreshShellUser(); });
    window.addEventListener('appinstalled', () => { this.evt = null; refreshShellUser(); toast('App installed. Open it from your home screen.'); });
    refreshShellUser();
  },
  async install() {
    if (this.evt) { this.evt.prompt(); const c = await this.evt.userChoice; if (c.outcome === 'accepted') this.evt = null; refreshShellUser(); return; }
    if (this.ios()) modal('Install on iPhone / iPad', '<ol class="small" style="padding-left:18px;line-height:2"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol><p class="tiny muted">The app opens full-screen from your home screen and remembers your sign-in.</p>', '<button class="btn btn-primary" data-close>Got it</button>');
  }
};
document.addEventListener('DOMContentLoaded', init);
