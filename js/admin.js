/* =========================================================
   LO Finding — admin.js : Panel Admin (dimuat lazy setelah login admin)
   Dashboard · Antrean & Verifikasi · Bank LO · Dokumen · Laporan · Guru · Pengaturan & Tema
   (v2: WhatsApp/CRM/Migrasi ada di admin-ext.js)
   ========================================================= */
'use strict';

function admTitle(t) { const h = $('[data-adm-title]'); if (h) h.textContent = t; }
function aboot() { return AppState.adminBoot || cacheGet('a:boot') || { settings: {}, opsi: { program: [], mapel: [], unit: [], term: [] }, dashboard: null }; }
function admTerm() { return AppState.admTerm || (aboot().settings || {}).TERM_AKTIF || ''; }
function fillTermSel() {
  const s = $('[data-termsel]'); if (!s || s.dataset.ready) return;
  s.innerHTML = optionList(aboot().opsi.term || [], admTerm()); s.dataset.ready = '1';
  s.addEventListener('change', () => { AppState.admTerm = s.value; document.dispatchEvent(new Event('termchange')); });
}
function adminBoot(force) {
  return swr('a:boot', 'admin.boot', {}, (b) => {
    AppState.adminBoot = b; if (b.tema) Theme.setSchool(b.tema);
    if (b.dashboard) setBadge('pending', b.dashboard.kpi.menunggu);
    fillTermSel();
    document.dispatchEvent(new CustomEvent('aboot', { detail: b }));
  }, { fresh: force ? 0 : 60000 });
}
let _prefetched = false;
function prefetchAdmin() {
  if (_prefetched) return; _prefetched = true;
  idle(() => {
    api('batch', { calls: [{ action: 'admin.antrean' }, { action: 'dokumen.list' }, { action: 'guruAdm.list' }, { action: 'bank.list', data: { tab: 'lo' } }, { action: 'crm.stats' }] }).then(r => {
      if (!r.success) return;
      const map = { 'admin.antrean': 'a:antrean', 'dokumen.list': 'a:dok', 'guruAdm.list': 'a:guru', 'bank.list': 'a:bank:lo', 'crm.stats': 'a:crmstats' };
      Object.keys(r.data).forEach(a => { if (r.data[a].success && !cacheGet(map[a])) cacheSet(map[a], r.data[a].data); });
    });
  });
}
/** Paginasi lokal */
function paged(rows, page, size) { const pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.min(Math.max(1, page), pages); return { rows: rows.slice((page - 1) * size, page * size), page, pages, total: rows.length, from: rows.length ? (page - 1) * size + 1 : 0, to: Math.min(page * size, rows.length) }; }
function pagerHtml(p) {
  if (p.pages <= 1) return '<div class="pager"><span>Showing ' + p.total + ' result' + (p.total === 1 ? '' : 's') + '</span></div>';
  const nums = []; for (let i = 1; i <= p.pages; i++) if (i === 1 || i === p.pages || Math.abs(i - p.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  return '<div class="pager"><span>Showing ' + p.from + '–' + p.to + ' of ' + p.total + '</span><div class="pages"><button data-act="pg" data-p="' + (p.page - 1) + '"' + (p.page === 1 ? ' disabled' : '') + ' aria-label="Previous">‹</button>' +
    nums.map(n => n === '…' ? '<span style="padding:6px">…</span>' : '<button data-act="pg" data-p="' + n + '" class="' + (n === p.page ? 'on' : '') + '">' + n + '</button>').join('') + '<button data-act="pg" data-p="' + (p.page + 1) + '"' + (p.page === p.pages ? ' disabled' : '') + ' aria-label="Next">›</button></div></div>';
}
async function exportXlsx(name, header, rows) {
  try { await loadXLSX(); } catch (e) { return toast('Could not load the Excel library.', 'err'); }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header].concat(rows)), 'Data'); XLSX.writeFile(wb, name + '.xlsx');
}
function exportBtns() { return '<button class="btn btn-outline btn-sm" data-act="xlsx">' + ic('file-spreadsheet', 'ic-s') + 'Export Excel</button><button class="btn btn-outline btn-sm" data-act="print">' + ic('download', 'ic-s') + 'Export PDF</button>'; }
function selFilter(name, list, ph) { return '<select class="select" data-f="' + name + '">' + optionList(list, '', ph) + '</select>'; }

// =========================================================
// DASHBOARD
// =========================================================
registerPage('a-dash', {
  layout: 'admin', auth: 'admin', title: 'Dashboard', nav: 'a-dash',
  template() {
    return '<div data-kpi class="grid grid-kpi">' + '<div class="card sk sk-card"></div>'.repeat(5) + '</div>' +
      '<div class="grid grid-2 mt"><div class="card"><div class="card-h"><h4>Usage per unit per week</h4><a href="#/a-pemakaian" class="small">View report</a></div><div data-c="use"></div></div><div class="card"><div class="card-h"><h4>LO coverage by subject (%)</h4><a href="#/a-cakupan" class="small">View report</a></div><div data-c="cov"></div></div></div>' +
      '<div class="grid grid-3 mt"><div class="card"><div class="card-h"><h4>Cognitive levels C1–C6 by subject</h4></div><div data-c="akt"></div></div><div class="card"><div class="card-h"><h4>Knowledge dimension F/C/P/M</h4></div><div data-c="dim"></div></div><div class="card"><div class="card-h"><h4>Differentiation types chosen</h4></div><div data-c="di"></div></div></div>' +
      '<div class="grid grid-2 mt"><div class="card"><div class="card-h"><h4>LO Bank completeness</h4><a href="#/a-kelengkapan" class="small">View report</a></div><div data-c="leng"></div></div><div class="card"><div class="card-h"><h4>Uploads by unit</h4></div><div data-c="up"></div></div></div>' +
      '<div class="grid grid-2 mt"><div class="card"><div class="card-h"><h4>Latest pending documents</h4><a href="#/a-antrean" class="small">Open queue</a></div><div data-pend></div></div><div class="card"><div class="card-h"><h4>Teachers not yet active</h4><a href="#/a-guru" class="small">All teachers</a></div><div data-idle></div></div></div>';
  },
  mount(el) {
    document.addEventListener('themechange', () => { if (!el.hidden && this.d) this.render(el, this.d); });
    window.addEventListener('resize', debounce(() => { if (!el.hidden && this.d) this.render(el, this.d); }, 300));
    document.addEventListener('aboot', (e) => { if (e.detail.dashboard) { cacheSet('a:dash', e.detail.dashboard); if (!el.hidden) this.render(el, e.detail.dashboard); } });
  },
  show(el) {
    admTitle('Dashboard'); fillTermSel();
    const b = aboot(); if (b.dashboard && !cacheGet('a:dash')) cacheSet('a:dash', b.dashboard);
    swr('a:dash', 'admin.dashboard', {}, (d) => { this.render(el, d); setBadge('pending', d.kpi.menunggu); }, { fresh: 60000, onError: (r) => { $('[data-kpi]', el).innerHTML = '<div class="card" style="grid-column:1/-1">' + errorBox(r, 'retry') + '</div>'; } });
    if (!AppState.adminBoot) adminBoot();
    prefetchAdmin();
  },
  render(el, d) {
    this.d = d; const k = d.kpi;
    const tr = k.cariMingguLalu ? Math.round((k.cariMinggu - k.cariMingguLalu) / k.cariMingguLalu * 100) : (k.cariMinggu ? 100 : 0);
    const card = (cls, icon, v, l, extra) => '<div class="card kpi ' + cls + '"><div class="row between"><span class="ki">' + ic(icon) + '</span>' + (extra || '') + '</div><div class="kv">' + v + '</div><div class="kl">' + l + '</div></div>';
    $('[data-kpi]', el).innerHTML =
      card('', 'users', k.guruAktif, 'Active teachers') +
      card('', 'search', k.cariMinggu, 'Searches this week', '<span class="trend ' + (tr >= 0 ? 'up' : 'down') + '">' + (tr >= 0 ? '▲' : '▼') + ' ' + Math.abs(tr) + '%</span>') +
      card('green', 'target', k.cakupan + '%', 'LO coverage · ' + esc(d.term || ''), '<span class="ring" style="--p:' + k.cakupan + '"></span>') +
      '<a href="#/a-antrean" style="text-decoration:none;color:inherit">' + card('amber', 'clipboard-check', k.menunggu, 'Pending verification') + '</a>' +
      card('', 'sparkles', k.aiHariIni + '<span class="small muted">/' + k.aiMaks + '</span>', 'AI searches today', '') ;
    const aiCard = $$('.kpi', el)[4]; if (aiCard) aiCard.insertAdjacentHTML('beforeend', '<div class="progress"><i style="width:' + Math.min(100, k.aiHariIni / Math.max(1, k.aiMaks) * 100) + '%"></i></div>');
    Charts.line($('[data-c=use]', el), d.pemakaian.labels, d.pemakaian.series, { label: 'Usage per unit per week', empty: 'No searches yet' });
    Charts.bar($('[data-c=cov]', el), d.cakupanMapel.map(m => ({ label: m.mapel, value: m.pct, title: m.mapel + ': ' + m.plan + '/' + m.total + ' LOs (' + m.pct + '%)' })), { suffix: '%', max: 100, empty: 'No verified LOs yet' });
    const am = d.aktMapel || {};
    Charts.hstack($('[data-c=akt]', el), Object.keys(am).map(m => ({ label: m, values: am[m] })), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((n, i) => ({ name: n, color: Charts.AKT[i] })), { empty: 'No planned LOs yet' });
    const dim = d.dimensi || {}, pal = Charts.palette();
    Charts.donut($('[data-c=dim]', el), [['Factual', 'F'], ['Conceptual', 'C'], ['Procedural', 'P'], ['Metacognitive', 'M']].map((x, i) => ({ label: x[0], value: dim[x[1]] || 0, color: pal[i] })), { center: 'LOs', empty: 'No planned LOs yet' });
    Charts.heat3($('[data-c=di]', el), d.diferensiasi || []);
    const L = d.kelengkapan || {};
    Charts.hstack($('[data-c=leng]', el), Object.keys(L).map(m => ({ label: m, values: [L[m].Silabus, L[m].Ebook, L[m]['Past Paper']] })), [{ name: 'Syllabus', color: pal[0] }, { name: 'Ebook', color: pal[1] }, { name: 'Past paper', color: pal[4] }], { empty: 'No verified sources yet' });
    const U = d.unggahUnit || {};
    Charts.bar($('[data-c=up]', el), Object.keys(U).map(u => ({ label: u, value: U[u] })), { color: Charts.palette()[0], empty: 'No uploads yet' });
    $('[data-pend]', el).innerHTML = d.pending.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + d.pending.map(p => '<tr><td>' + fileIcon(p.format_file) + '</td><td><div class="bold">' + esc(p.judul) + '</div><div class="tiny muted">' + esc(p.nama_pengunggah) + ' · ' + esc(p.mapel) + '</div></td><td class="actions"><a class="btn btn-success btn-sm" href="#/a-verif/' + encodeURIComponent(p.dokumen_id) + '">Review</a></td></tr>').join('') + '</tbody></table></div>' : emptyState('check', 'All caught up!', 'No documents waiting for verification.');
    $('[data-idle]', el).innerHTML = d.belumAktif.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + d.belumAktif.map(g => '<tr><td><span class="avatar" style="width:30px;height:30px;font-size:11px">' + esc(initials(g.nama)) + '</span></td><td><div class="bold">' + esc(g.nama) + '</div><div class="tiny muted">' + esc([g.unit, g.mapel].filter(Boolean).join(' · ')) + '</div></td><td class="actions"><a class="btn btn-ghost btn-sm" href="mailto:' + esc(g.email) + '?subject=' + encodeURIComponent('Try LO Finding') + '&body=' + encodeURIComponent('Hi ' + g.nama + ',\n\nPlease try LO Finding to find Cambridge learning objectives for your lessons: ' + location.origin + location.pathname + '\n\nThank you!') + '">' + ic('mail', 'ic-s') + 'Send reminder</a></td></tr>').join('') + '</tbody></table></div>'
      + (d.topGuru.length ? '<h4 class="mt">Most active (30 days)</h4><div class="col gap-s mt-s">' + d.topGuru.map(t => '<div class="row between small"><span>' + esc(t.nama) + ' <span class="muted">' + esc(t.unit) + '</span></span><b>' + t.n + '</b></div>').join('') + '</div>' : '')
      : emptyState('check', 'Everyone has started', 'All active teachers have used the app.');
  },
  acts: { retry(b, e, el) { this.show(el); } }
});

// =========================================================
// ANTREAN VERIFIKASI
// =========================================================
registerPage('a-antrean', {
  layout: 'admin', auth: 'admin', title: 'Verification Queue', nav: 'a-antrean',
  template() {
    return '<div class="page-h"><div><h2>Verification Queue <span class="pill wait" data-n></span></h2><div class="sub">Sources submitted by teachers, oldest first.</div></div></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search title or uploader"></div>' + selFilter('jenis', [{ v: 'Silabus', l: 'Syllabus' }, { v: 'Ebook', l: 'Ebook' }, { v: 'Past Paper', l: 'Past Paper' }], 'All types') + selFilter('program', aboot().opsi.program, 'All programs') + selFilter('mapel', aboot().opsi.mapel, 'All subjects') + '</div><div data-list>' + skeletonRows(6) + '</div>';
  },
  mount(el) { $('[data-q]', el).addEventListener('input', debounce(() => this.draw(el), 250)); $$('[data-f]', el).forEach(s => s.addEventListener('change', () => this.draw(el))); },
  show(el) { admTitle('Verification Queue'); swr('a:antrean', 'admin.antrean', {}, (l) => { this.list = l; setBadge('pending', l.length); this.draw(el); }, { fresh: 15000, onError: (r) => $('[data-list]', el).innerHTML = errorBox(r, 'retry') }); },
  draw(el) {
    const q = $('[data-q]', el).value.toLowerCase(), f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value);
    const L = (this.list || []).filter(d => (!q || (d.judul + ' ' + d.nama_pengunggah).toLowerCase().includes(q)) && (!f.jenis || d.jenis === f.jenis) && (!f.program || d.program === f.program) && (!f.mapel || d.mapel === f.mapel));
    $('[data-n]', el).textContent = (this.list || []).length + ' pending';
    if (!(this.list || []).length) { $('[data-list]', el).innerHTML = '<div class="card">' + emptyState('check', 'All caught up!', 'No documents waiting for verification.') + '</div>'; return; }
    $('[data-list]', el).innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Title</th><th>Type</th><th>Program · Subject · Stage</th><th>Uploader</th><th>Items extracted</th><th>Flags</th><th>Submitted</th><th></th></tr></thead><tbody>' +
      L.map(d => '<tr><td>' + fileIcon(d.format_file) + '</td><td class="bold">' + esc(d.judul) + '</td><td>' + esc(JENIS_EN[d.jenis] || d.jenis) + '</td><td>' + esc([d.program, d.mapel, d.stage_grade].filter(Boolean).join(' · ')) + '</td><td>' + esc(d.nama_pengunggah) + '</td>' +
        '<td class="small">' + [d.hitung.lo && d.hitung.lo + ' LOs', d.hitung.topik && d.hitung.topik + ' topics', d.hitung.soal && d.hitung.soal + ' questions'].filter(Boolean).join(' / ') + '</td><td>' + (d.hitung.flag ? '<span class="pill wait">⚠ ' + d.hitung.flag + '</span>' : '—') + '</td><td class="small">' + fmtRel(d.diajukan) + '</td>' +
        '<td class="actions"><a class="btn btn-success btn-sm" href="#/a-verif/' + encodeURIComponent(d.dokumen_id) + '">Review</a></td></tr>').join('') + '</tbody></table></div>';
  },
  acts: { retry(b, e, el) { this.show(el); } }
});

// =========================================================
// LAYAR VERIFIKASI (belah)
// =========================================================
function verifTable(d, tab) {
  const T = DOK_TABS[tab], rows = d[tab] || [];
  if (!rows.length) return '<div class="muted small" style="padding:16px">No items in this tab.</div>';
  return '<div class="tbl-wrap"><table class="tbl" data-tab="' + tab + '"><thead><tr>' + T.cols.map(c => '<th>' + c[1] + '</th>').join('') + '<th>Flag</th><th></th></tr></thead><tbody>' +
    rows.map((r, i) => '<tr data-i="' + i + '" class="' + (r.bendera && !/Digabung/.test(r.bendera) ? 'flag' : '') + '">' + T.cols.map(c => '<td>' + (c[2] === 'area' ? '<textarea class="cell" data-k="' + c[0] + '" rows="2">' + esc(r[c[0]]) + '</textarea>' : '<input class="cell' + (c[2] === 'mono' ? ' mono' : '') + '" data-k="' + c[0] + '" value="' + esc(r[c[0]]) + '" style="min-width:' + (c[3] || 90) + 'px">') + '</td>').join('') +
      '<td>' + (r.bendera ? '<div class="col gap-s"><span class="pill wait" title="' + esc(r.bendera) + '">⚠ ' + esc(r.bendera.replace('Kode tidak ditemukan di silabus', 'Code not in syllabus').replace(/Kode sudah ada di Bank Bersama.*/, 'Duplicate — will merge')) + '</span>' + (/tidak ditemukan/.test(r.bendera) ? '<button class="btn btn-ghost btn-sm" data-act="clearflag">Accept code</button>' : '') + '</div>' : '') + '</td>' +
      '<td class="actions"><button class="btn btn-ghost-danger btn-icon btn-sm" data-act="rmrow" aria-label="Delete row">' + ic('trash-2', 'ic-s') + '</button></td></tr>').join('') + '</tbody></table></div>';
}
registerPage('a-verif', {
  layout: 'admin', auth: 'admin', title: 'Review document', nav: 'a-antrean',
  template() { return '<div data-wrap>' + skeletonRows(10) + '</div>'; },
  show(el, id) {
    admTitle('Review document'); this.id = id; this.tab = 'lo'; this.edits = { lo: {}, topik: {}, soal: {} }; this.del = { lo: [], topik: [], soal: [] };
    swr('dok:' + id, 'sumber.hasil', { dokumen_id: id }, (d) => { if (this.dirty()) return; this.render(el, d); }, { fresh: 0, onError: (r) => $('[data-wrap]', el).innerHTML = errorBox(r, 'retry') });
  },
  dirty() { return ['lo', 'topik', 'soal'].some(t => Object.keys(this.edits[t]).length || this.del[t].length); },
  render(el, d) {
    this.d = d; const doc = d.dokumen; if (!d.lo.length && d.topik.length) this.tab = 'topik'; else if (!d.lo.length && d.soal.length) this.tab = 'soal';
    const isFolder = /folders/.test(doc.url || ''), prev = doc.file_asli_id && !isFolder ? 'https://drive.google.com/file/d/' + encodeURIComponent(doc.file_asli_id) + '/preview' : '';
    $('[data-wrap]', el).innerHTML = '<div class="row between wrap mb"><a href="#/a-antrean" class="small">' + ic('arrow-left', 'ic-s') + ' Verification Queue</a><div class="row">' + statusPill(doc.status_proses) + statusPill(doc.status_verifikasi) + '</div></div>' +
      '<div class="card" style="padding:0;overflow:hidden"><div class="split" style="min-height:70vh"><div class="viewer">' +
      (prev ? '<div class="row between" style="padding:8px 12px;color:#fff"><span class="small">' + esc(doc.jumlah || '') + '</span><a class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff" href="' + esc(doc.url) + '" target="_blank" rel="noopener">' + ic('external-link', 'ic-s') + 'Open original</a></div><iframe src="' + prev + '" title="Document preview" loading="lazy" allow="autoplay"></iframe>'
        : '<div class="empty" style="color:#E5E7EB">' + ic('file-text', 'ic-l') + '<p class="mt-s">' + (doc.url ? 'Preview not available for this format.' : 'No original file stored (table import).') + '</p>' + (doc.url ? '<a class="btn btn-outline" style="background:#fff" href="' + esc(doc.url) + '" target="_blank" rel="noopener">' + ic('external-link') + 'Open in Google Drive</a>' : '') + '</div>') +
      '<p class="tiny" style="color:#9CA3AF;padding:6px 12px">Preview requires your admin Google account to have access to the app\'s Drive folder.</p></div>' +
      '<div class="panel"><div class="panel-b"><h3>' + esc(doc.judul) + '</h3><dl class="kv-list mt"><dt>Type</dt><dd>' + esc(JENIS_EN[doc.jenis] || doc.jenis) + '</dd><dt>Format</dt><dd>' + esc(String(doc.format_file).replace('TAUTAN:', 'Drive link · ')) + '</dd><dt>Uploader</dt><dd>' + esc(doc.nama_pengunggah) + '</dd><dt>Program</dt><dd>' + esc([doc.program, doc.mapel, doc.stage_grade].filter(Boolean).join(' · ')) + '</dd>' + (doc.tahun_sesi ? '<dt>Session</dt><dd>' + esc(doc.tahun_sesi) + '</dd>' : '') + '</dl>' +
      '<div class="tabs mt">' + Object.keys(DOK_TABS).map(t => '<button class="' + (this.tab === t ? 'on' : '') + '" data-act="tab" data-t="' + t + '">' + DOK_TABS[t].label.replace('Extracted ', '') + ' <span class="count">' + (d[t] || []).length + '</span></button>').join('') + '</div>' +
      '<div class="mt" data-table>' + verifTable(d, this.tab) + '</div>' +
      '<p class="tiny muted mt">Flagged rows stay on hold when you verify. Click a cell to fix it; "Accept code" clears a "not in syllabus" flag.</p></div>' +
      '<div class="panel-f"><button class="btn btn-outline btn-block" data-act="save" data-save disabled>' + ic('check') + 'Save edits</button>' +
      (doc.status_verifikasi === 'Terverifikasi' ? '<div class="alert ok small">' + ic('circle-check') + 'Already verified.</div>' : '<button class="btn btn-success btn-block btn-lg" data-act="verify"' + (doc.status_proses !== 'Selesai' ? ' disabled' : '') + '>' + ic('shield-check') + 'Verify & Share</button><button class="btn btn-outline-danger btn-block" data-act="reject">' + ic('ban') + 'Reject</button>') + '</div></div></div></div>';
    $('[data-table]', el).addEventListener('input', (e) => {
      const t = e.target; if (!t.dataset.k) return;
      const tr = t.closest('tr'), tab = tr.closest('table').dataset.tab, row = this.d[tab][+tr.dataset.i], k = DOK_TABS[tab].key;
      row[t.dataset.k] = t.value; (this.edits[tab][row[k]] = this.edits[tab][row[k]] || {})[t.dataset.k] = t.value; $('[data-save]', el).disabled = false;
    });
  },
  async saveEdits(el) {
    if (!this.dirty()) return true;
    const p = { dokumen_id: this.id, hapus: this.del };
    ['lo', 'topik', 'soal'].forEach(t => { const k = DOK_TABS[t].key; p[t] = Object.keys(this.edits[t]).map(id => Object.assign({ [k]: id }, this.edits[t][id])); });
    const r = await api('sumber.simpanHasil', p);
    if (!r.success) { toast(r.message, 'err'); return false; }
    this.edits = { lo: {}, topik: {}, soal: {} }; this.del = { lo: [], topik: [], soal: [] }; return true;
  },
  acts: {
    retry(b, e, el) { this.show(el, this.id); },
    tab(b, e, el) { this.tab = b.dataset.t; $$('.panel .tabs button', el).forEach(x => x.classList.toggle('on', x === b)); $('[data-table]', el).innerHTML = verifTable(this.d, this.tab); },
    clearflag(b, e, el) { const tr = b.closest('tr'), tab = tr.closest('table').dataset.tab, row = this.d[tab][+tr.dataset.i], k = DOK_TABS[tab].key; row.bendera = ''; (this.edits[tab][row[k]] = this.edits[tab][row[k]] || {}).bendera = ''; $('[data-table]', el).innerHTML = verifTable(this.d, tab); $('[data-save]', el).disabled = false; },
    rmrow(b, e, el) { const tr = b.closest('tr'), tab = tr.closest('table').dataset.tab, i = +tr.dataset.i, row = this.d[tab][i], k = DOK_TABS[tab].key; this.del[tab].push(row[k]); delete this.edits[tab][row[k]]; this.d[tab].splice(i, 1); $('[data-table]', el).innerHTML = verifTable(this.d, tab); $('[data-save]', el).disabled = false; },
    async save(b, e, el) { btnBusy(b, true, 'Saving'); const ok = await this.saveEdits(el); btnBusy(b, false); if (ok) { toast('Edits saved.'); b.disabled = true; } },
    async verify(b, e, el) {
      const flags = ['lo'].reduce((n, t) => n + (this.d[t] || []).filter(r => /tidak ditemukan/.test(r.bendera || '')).length, 0);
      if (!(await confirmBox('Verify & share?', 'All items will be added to the Shared LO Bank for every teacher.' + (flags ? ' ' + flags + ' flagged item(s) will stay on hold.' : ''), 'Verify & Share'))) return;
      btnBusy(b, true, 'Verifying');
      if (!(await this.saveEdits(el))) return btnBusy(b, false);
      const r = await api('admin.verifikasi', { dokumen_id: this.id, aksi: 'verifikasi' }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      toast(r.message); cacheDel('a:antrean'); cacheDel('a:dash'); cacheDel('a:bank:lo'); go('a-antrean');
    },
    async reject() {
      const note = await promptBox('Reject document', 'Reason for rejection (sent to the uploader)', { textarea: true, required: true, ok: 'Confirm Reject', danger: true }); if (!note) return;
      const r = await api('admin.verifikasi', { dokumen_id: this.id, aksi: 'tolak', catatan: note });
      if (!r.success) return toast(r.message, 'err');
      toast(r.message); cacheDel('a:antrean'); go('a-antrean');
    }
  }
});

// =========================================================
// BANK LO
// =========================================================
const BANK_COLS = {
  lo: [['kode_lo', 'Code'], ['bunyi_lo', 'Statement'], ['stage_grade', 'Stage'], ['strand', 'Strand / Sub-strand'], ['akt_saran', 'AKT']],
  topik: [['bab', 'Chapter'], ['sub_bab', 'Section'], ['halaman', 'Pages'], ['kode_lo', 'LO codes'], ['ringkasan_konsep', 'Summary']],
  soal: [['nomor_soal', 'No.'], ['ringkasan_soal', 'Summary'], ['skor', 'Marks'], ['kode_lo', 'LO code'], ['akt', 'AKT']]
};
registerPage('a-bank', {
  layout: 'admin', auth: 'admin', title: 'LO Bank', nav: 'a-bank',
  template() {
    const o = aboot().opsi;
    return '<div class="page-h"><div><h2>LO Bank</h2><div class="sub">Learning objectives, coursebook topic maps and reference questions.</div></div><div class="row wrap"><a class="btn btn-outline" href="#/unggah">' + ic('file-spreadsheet') + 'Import Excel/CSV</a><button class="btn btn-outline" data-act="export">' + ic('download') + 'Export JSON/CSV</button><button class="btn btn-primary" data-act="add">' + ic('plus') + 'Add item</button></div></div>' +
      '<div class="tabs mb" data-tabs><button class="on" data-act="tab" data-t="lo">Learning Objectives <span class="count" data-c="lo"></span></button><button data-act="tab" data-t="topik">Topic Map <span class="count" data-c="topik"></span></button><button data-act="tab" data-t="soal">Question Bank <span class="count" data-c="soal"></span></button></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search code or text"></div>' + selFilter('program', o.program, 'All programs') + selFilter('mapel', o.mapel, 'All subjects') + '<select class="select" data-f="stage"><option value="">All stages</option></select>' +
      selFilter('status', [{ v: 'Terverifikasi', l: 'Verified' }, { v: 'Menunggu', l: 'Pending' }, { v: 'Draf', l: 'Draft' }, { v: 'Ditolak', l: 'Rejected' }], 'All statuses') + selFilter('visibilitas', [{ v: 'Bersama', l: 'Shared' }, { v: 'Pribadi', l: 'Private' }], 'All visibility') + '</div>' +
      '<div class="row between mb" data-bulk hidden><span class="small" data-bulkn></span><button class="btn btn-outline-danger btn-sm" data-act="bulkdel">' + ic('trash-2', 'ic-s') + 'Delete selected</button></div><div data-list>' + skeletonRows(8) + '</div>';
  },
  mount(el) { this.tab = 'lo'; this.page = 1; this.sel = new Set(); $('[data-q]', el).addEventListener('input', debounce(() => { this.page = 1; this.draw(el); }, 250)); $$('[data-f]', el).forEach(s => s.addEventListener('change', () => { this.page = 1; this.draw(el); })); el.addEventListener('change', (e) => { if (e.target.matches('[data-sel]')) { e.target.checked ? this.sel.add(e.target.dataset.sel) : this.sel.delete(e.target.dataset.sel); this.bulkUI(el); } if (e.target.matches('[data-selall]')) { $$('[data-sel]', el).forEach(c => { c.checked = e.target.checked; e.target.checked ? this.sel.add(c.dataset.sel) : this.sel.delete(c.dataset.sel); }); this.bulkUI(el); } }); },
  show(el) { admTitle('LO Bank'); this.load(el); },
  load(el, force) { const t = this.tab; swr('a:bank:' + t, 'bank.list', { tab: t }, (l) => { this.data = this.data || {}; this.data[t] = l; if (this.tab === t) { this.stages(el); this.draw(el); } }, { fresh: force ? 0 : 60000, onError: (r) => $('[data-list]', el).innerHTML = errorBox(r, 'retry') }); },
  stages(el) { const s = $('[data-f=stage]', el), v = s.value; s.innerHTML = optionList([...new Set((this.data[this.tab] || []).map(r => r.stage_grade).filter(Boolean))].sort(), v, 'All stages'); },
  rows(el) {
    const q = $('[data-q]', el).value.toLowerCase(), f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value);
    return ((this.data || {})[this.tab] || []).filter(r => (!q || Object.values(r).join(' ').toLowerCase().includes(q)) && ['program', 'mapel', 'status', 'visibilitas'].every(k => !f[k] || r[k] === f[k]) && (!f.stage || r.stage_grade === f.stage));
  },
  draw(el) {
    const all = this.rows(el), p = paged(all, this.page, 25), cols = BANK_COLS[this.tab];
    $('[data-c=' + this.tab + ']', el).textContent = ((this.data || {})[this.tab] || []).length;
    $('[data-list]', el).innerHTML = (all.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:36px"><input type="checkbox" data-selall aria-label="Select all"></th>' + cols.map(c => '<th>' + c[1] + '</th>').join('') + '<th>Program · Subject</th><th>Sources</th><th>Status</th><th></th></tr></thead><tbody>' +
      p.rows.map(r => '<tr><td><input type="checkbox" data-sel="' + esc(r.id) + '"' + (this.sel.has(r.id) ? ' checked' : '') + ' aria-label="Select"></td>' + cols.map(([k]) => '<td>' + (k === 'kode_lo' ? '<span class="code">' + esc(r[k]) + '</span>' : /akt/.test(k) ? aktPill(r[k]) : k === 'strand' ? esc(r.strand) + (r.sub_strand ? '<div class="tiny muted">' + esc(r.sub_strand) + '</div>' : '') : '<span title="' + esc(r[k]) + '">' + esc(String(r[k] ?? '').slice(0, 160)) + '</span>') + (k === 'bunyi_lo' && r.bendera ? '<div><span class="pill wait mt-s">⚠ ' + esc(r.bendera.replace('Kode tidak ditemukan di silabus', 'Code not in syllabus').replace(/Kode sudah ada.*/, 'Duplicate')) + '</span></div>' : '') + '</td>').join('') +
        '<td class="small">' + esc(r.program) + '<div class="tiny muted">' + esc(r.mapel) + '</div></td><td class="small" title="' + esc(r.sumber) + '">' + r.jumlah_sumber + '</td><td>' + statusPill(r.status) + (r.visibilitas === 'Pribadi' ? '<div class="tiny muted mt-s">Private</div>' : '') + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-icon btn-sm" data-act="edit" data-id="' + esc(r.id) + '" aria-label="Edit">' + ic('pencil', 'ic-s') + '</button><button class="btn btn-ghost-danger btn-icon btn-sm" data-act="del" data-id="' + esc(r.id) + '" aria-label="Delete">' + ic('trash-2', 'ic-s') + '</button></td></tr>').join('') + '</tbody></table></div>' + pagerHtml(p)
      : '<div class="card">' + emptyState('book', 'No items found', 'Import a syllabus or adjust the filters.') + '</div>');
  },
  bulkUI(el) { $('[data-bulk]', el).hidden = !this.sel.size; $('[data-bulkn]', el).textContent = this.sel.size + ' selected'; },
  form(it) {
    const o = aboot().opsi, t = this.tab, v = (k) => esc((it || {})[k] || '');
    const common = '<div class="grid grid-2"><div class="field"><label class="label req">Program</label><select class="select" name="program">' + optionList(o.program, (it || {}).program) + '</select></div><div class="field"><label class="label req">Subject</label><select class="select" name="mapel">' + optionList(o.mapel, (it || {}).mapel) + '</select></div><div class="field"><label class="label">Stage / grade</label><input class="input" name="stage_grade" value="' + v('stage_grade') + '"></div>';
    const st = '<div class="field"><label class="label">Status</label><select class="select" name="status">' + optionList([{ v: 'Terverifikasi', l: 'Verified' }, { v: 'Menunggu', l: 'Pending' }, { v: 'Draf', l: 'Draft' }, { v: 'Ditolak', l: 'Rejected' }], (it || {}).status || 'Terverifikasi') + '</select></div><div class="field"><label class="label">Visibility</label><select class="select" name="visibilitas">' + optionList([{ v: 'Bersama', l: 'Shared' }, { v: 'Pribadi', l: 'Private' }], (it || {}).visibilitas || 'Bersama') + '</select></div>';
    if (t === 'lo') return common + '<div class="field"><label class="label req">LO code</label><input class="input mono" name="kode_lo" value="' + v('kode_lo') + '"></div></div><div class="field mt"><label class="label req">LO statement</label><textarea class="textarea" name="bunyi_lo">' + v('bunyi_lo') + '</textarea></div><div class="grid grid-2 mt"><div class="field"><label class="label">Strand</label><input class="input" name="strand" value="' + v('strand') + '"></div><div class="field"><label class="label">Sub-strand</label><input class="input" name="sub_strand" value="' + v('sub_strand') + '"></div><div class="field"><label class="label">AKT level</label><input class="input mono" name="akt_saran" value="' + v('akt_saran') + '" placeholder="e.g. CC2"></div>' + st + (it && it.bendera ? '<div class="field"><label class="label">Flag</label><input class="input" name="bendera" value="' + v('bendera') + '"><div class="help">Clear to accept the item.</div></div>' : '') + '</div>';
    if (t === 'topik') return common + '<div class="field"><label class="label">Pages</label><input class="input" name="halaman" value="' + v('halaman') + '"></div></div><div class="grid grid-2 mt"><div class="field"><label class="label req">Chapter</label><input class="input" name="bab" value="' + v('bab') + '"></div><div class="field"><label class="label">Section</label><input class="input" name="sub_bab" value="' + v('sub_bab') + '"></div><div class="field"><label class="label">LO codes</label><input class="input mono" name="kode_lo" value="' + v('kode_lo') + '"></div>' + st + '</div><div class="field mt"><label class="label">Summary</label><textarea class="textarea" name="ringkasan_konsep">' + v('ringkasan_konsep') + '</textarea></div>';
    return common + '<div class="field"><label class="label">Question no.</label><input class="input" name="nomor_soal" value="' + v('nomor_soal') + '"></div></div><div class="field mt"><label class="label req">Summary</label><textarea class="textarea" name="ringkasan_soal">' + v('ringkasan_soal') + '</textarea></div><div class="grid grid-2 mt"><div class="field"><label class="label">Marks</label><input class="input" name="skor" value="' + v('skor') + '"></div><div class="field"><label class="label">LO code</label><input class="input mono" name="kode_lo" value="' + v('kode_lo') + '"></div><div class="field"><label class="label">AKT</label><input class="input mono" name="akt" value="' + v('akt') + '"></div><div class="field"><label class="label">Page</label><input class="input" name="halaman" value="' + v('halaman') + '"></div>' + st + '</div>';
  },
  editor(el, it) {
    const m = modal((it ? 'Edit ' : 'Add ') + ({ lo: 'learning objective', topik: 'topic map entry', soal: 'reference question' }[this.tab]), '<form data-form>' + this.form(it) + '</form>', '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>' + ic('check') + 'Save</button>', { wide: true });
    $('[data-ok]', m.el).onclick = async (e) => {
      const item = { id: it ? it.id : '' }; $$('[name]', m.el).forEach(i => item[i.name] = i.value.trim());
      btnBusy(e.currentTarget, true, 'Saving'); const r = await api('bank.simpan', { tab: this.tab, item }); btnBusy(e.currentTarget, false);
      if (!r.success) return toast(r.message, 'err');
      toast('Saved.'); m.close(); this.load(el, true);
    };
  },
  acts: {
    retry(b, e, el) { this.load(el, true); },
    tab(b, e, el) { this.tab = b.dataset.t; this.page = 1; this.sel.clear(); this.bulkUI(el); $$('[data-tabs] button', el).forEach(x => x.classList.toggle('on', x === b)); if ((this.data || {})[this.tab]) { this.stages(el); this.draw(el); } else $('[data-list]', el).innerHTML = skeletonRows(8); this.load(el); },
    pg(b, e, el) { this.page = +b.dataset.p; this.draw(el); el.scrollIntoView(); },
    add(b, e, el) { this.editor(el, null); },
    edit(b, e, el) { this.editor(el, (this.data[this.tab] || []).find(r => r.id === b.dataset.id)); },
    async del(b, e, el) { if (!(await confirmBox('Delete item?', 'This permanently removes the item from the LO Bank.', 'Delete', true))) return; const r = await api('bank.hapus', { tab: this.tab, id: b.dataset.id }); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { this.data[this.tab] = this.data[this.tab].filter(x => x.id !== b.dataset.id); cacheSet('a:bank:' + this.tab, this.data[this.tab]); this.draw(el); } },
    async bulkdel(b, e, el) { const ids = Array.from(this.sel); if (!(await confirmBox('Delete ' + ids.length + ' items?', 'This cannot be undone.', 'Delete', true))) return; const r = await api('bank.hapus', { tab: this.tab, ids }); toast(r.message, r.success ? 'ok' : 'err'); this.sel.clear(); this.bulkUI(el); this.load(el, true); },
    async export(b) {
      btnBusy(b, true, 'Exporting'); const r = await api('ekspor.integrasi', {}); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      downloadBlob(new Blob([JSON.stringify(r.data, null, 1)], { type: 'application/json' }), 'lo-finding-export-' + new Date().toISOString().slice(0, 10) + '.json');
      const lo = r.data.Bank_LO || []; if (lo.length) exportXlsx('lo-bank-' + new Date().toISOString().slice(0, 10), Object.keys(lo[0]), lo.map(o => Object.values(o)));
      toast('Exported JSON (all tables) and LO Bank spreadsheet.');
    }
  }
});

// =========================================================
// SUMBER DOKUMEN
// =========================================================
registerPage('a-dokumen', {
  layout: 'admin', auth: 'admin', title: 'Source Documents', nav: 'a-dokumen',
  template() {
    return '<div class="page-h"><div><h2>Source Documents</h2><div class="sub">All uploaded sources and their processing status.</div></div><a class="btn btn-primary" href="#/unggah">' + ic('upload') + 'Upload Source</a></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search title or uploader"></div>' + selFilter('jenis', [{ v: 'Silabus', l: 'Syllabus' }, { v: 'Ebook', l: 'Ebook' }, { v: 'Past Paper', l: 'Past Paper' }], 'All types') +
      selFilter('proc', [{ v: 'Antre', l: 'Queued' }, { v: 'Diproses', l: 'Processing' }, { v: 'Selesai', l: 'Done' }, { v: 'Gagal', l: 'Failed' }], 'Any processing') + selFilter('ver', [{ v: 'Pribadi', l: 'Private' }, { v: 'Menunggu', l: 'Pending' }, { v: 'Terverifikasi', l: 'Verified' }, { v: 'Ditolak', l: 'Rejected' }], 'Any verification') + '</div><div data-list>' + skeletonRows(8) + '</div>';
  },
  mount(el) { this.page = 1; $('[data-q]', el).addEventListener('input', debounce(() => { this.page = 1; this.draw(el); }, 250)); $$('[data-f]', el).forEach(s => s.addEventListener('change', () => { this.page = 1; this.draw(el); })); },
  show(el) { admTitle('Source Documents'); swr('a:dok', 'dokumen.list', {}, (l) => { this.list = l; this.draw(el); }, { fresh: 20000, onError: (r) => $('[data-list]', el).innerHTML = errorBox(r, 'retry') }); },
  draw(el) {
    const q = $('[data-q]', el).value.toLowerCase(), f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value);
    const all = (this.list || []).filter(d => (!q || (d.judul + ' ' + d.nama_pengunggah + ' ' + d.mapel).toLowerCase().includes(q)) && (!f.jenis || d.jenis === f.jenis) && (!f.proc || d.status_proses === f.proc) && (!f.ver || d.status_verifikasi === f.ver));
    const p = paged(all, this.page, 25);
    $('[data-list]', el).innerHTML = all.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Title</th><th>Type</th><th>Program · Subject</th><th>Size</th><th>Uploader</th><th>Processing</th><th>Verification</th><th>Date</th><th></th></tr></thead><tbody>' +
      p.rows.map(d => '<tr><td>' + fileIcon(d.format_file) + '</td><td><a href="#" data-act="info" data-id="' + esc(d.dokumen_id) + '" class="bold">' + esc(d.judul) + '</a></td><td>' + esc(JENIS_EN[d.jenis] || d.jenis) + '</td><td class="small">' + esc(d.program) + '<div class="tiny muted">' + esc(d.mapel) + '</div></td><td class="small">' + esc(d.jumlah || '—') + '</td><td class="small">' + esc(d.nama_pengunggah) + '</td>' +
        '<td>' + statusPill(d.status_proses) + (['Antre', 'Diproses'].includes(d.status_proses) ? '<div class="progress mt-s" style="width:80px"><i style="width:' + d.progres + '%"></i></div>' : '') + '</td><td>' + statusPill(d.status_verifikasi) + '</td><td class="small">' + fmtDate(d.diunggah) + '</td>' +
        '<td class="actions">' + (d.status_proses === 'Gagal' ? '<button class="btn btn-ghost btn-icon btn-sm" data-act="retry1" data-id="' + esc(d.dokumen_id) + '" title="Retry" aria-label="Retry">' + ic('rotate-ccw', 'ic-s') + '</button>' : '') + '<a class="btn btn-ghost btn-icon btn-sm" href="#/a-verif/' + encodeURIComponent(d.dokumen_id) + '" title="Review" aria-label="Review">' + ic('eye', 'ic-s') + '</a><button class="btn btn-ghost-danger btn-icon btn-sm" data-act="del" data-id="' + esc(d.dokumen_id) + '" aria-label="Delete">' + ic('trash-2', 'ic-s') + '</button></td></tr>').join('') + '</tbody></table></div>' + pagerHtml(p)
      : '<div class="card">' + emptyState('folder', 'No documents', 'Uploaded sources will appear here.') + '</div>';
  },
  acts: {
    retry(b, e, el) { this.show(el); },
    pg(b, e, el) { this.page = +b.dataset.p; this.draw(el); },
    info(b) {
      const d = this.list.find(x => x.dokumen_id === b.dataset.id); if (!d) return;
      drawer('Document details', '<div class="row gap-s mb">' + fileIcon(d.format_file) + '<h4>' + esc(d.judul) + '</h4></div><dl class="kv-list"><dt>Type</dt><dd>' + esc(JENIS_EN[d.jenis]) + '</dd><dt>Format</dt><dd>' + esc(d.format_file) + '</dd><dt>Program</dt><dd>' + esc(d.program) + '</dd><dt>Subject</dt><dd>' + esc(d.mapel) + '</dd><dt>Stage</dt><dd>' + esc(d.stage_grade || '—') + '</dd><dt>Size</dt><dd>' + esc(d.jumlah || '—') + '</dd><dt>Uploader</dt><dd>' + esc(d.nama_pengunggah) + '</dd><dt>Uploaded</dt><dd>' + fmtDate(d.diunggah, true) + '</dd><dt>Processing</dt><dd>' + statusPill(d.status_proses) + ' ' + d.bagian_selesai + '/' + d.total_bagian + ' parts</dd><dt>Items</dt><dd>' + d.jumlah_item + '</dd><dt>Verification</dt><dd>' + statusPill(d.status_verifikasi) + '</dd>' + (d.catatan_admin ? '<dt>Admin note</dt><dd>' + esc(d.catatan_admin) + '</dd>' : '') + (d.galat ? '<dt>Error</dt><dd style="color:var(--err)">' + esc(d.galat) + '</dd>' : '') + '</dl>' +
        '<div class="row wrap mt-l">' + (d.url ? '<a class="btn btn-outline" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + ic('external-link') + 'Open original</a>' : '') + '<a class="btn btn-primary" href="#/a-verif/' + encodeURIComponent(d.dokumen_id) + '">' + ic('eye') + 'Review items</a></div>');
    },
    async retry1(b, e, el) { const r = await api('dokumen.ulang', { dokumen_id: b.dataset.id }); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { cacheDel('a:dok'); this.show(el); } },
    async del(b, e, el) { if (!(await confirmBox('Delete document?', 'The document, its file and all extracted items will be deleted.', 'Delete', true))) return; const r = await api('dokumen.hapus', { dokumen_id: b.dataset.id }); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { this.list = this.list.filter(x => x.dokumen_id !== b.dataset.id); cacheSet('a:dok', this.list); this.draw(el); cacheDel('a:bank:lo'); } }
  }
});

// =========================================================
// LAPORAN CAKUPAN LO
// =========================================================
registerPage('a-cakupan', {
  layout: 'admin', auth: 'admin', title: 'LO Coverage', nav: 'a-cakupan',
  template() {
    const o = aboot().opsi;
    return '<div class="page-h"><div><h2>LO Coverage Report</h2><div class="sub">Which verified learning objectives have been planned by teachers.</div></div><div class="row wrap no-print">' + exportBtns() + '</div></div>' +
      '<div class="filterbar">' + selFilter('program', o.program, 'All programs') + selFilter('mapel', o.mapel, 'All subjects') + '<select class="select" data-f="stage"><option value="">All stages</option></select><select class="select" data-f="term"></select><label class="check"><span class="switch"><input type="checkbox" data-untouched><span></span></span>Only untouched LOs</label></div>' +
      '<div class="grid grid-3" data-sum></div><div class="card mt"><div class="card-h"><h4>Coverage by stage</h4></div><div data-chart></div></div><div class="card mt" style="padding:0"><div class="tree" data-tree>' + skeletonRows(8) + '</div></div>';
  },
  mount(el) { $$('[data-f], [data-untouched]', el).forEach(s => s.addEventListener('change', () => this.draw(el))); document.addEventListener('termchange', () => { const t = $('[data-f=term]', el); if (t) { t.value = admTerm(); this.draw(el); } }); document.addEventListener('themechange', () => { if (!el.hidden && this.d) this.draw(el); }); },
  show(el) { admTitle('LO Coverage'); swr('a:cak', 'laporan.cakupan', {}, (d) => { this.d = d; const t = $('[data-f=term]', el); t.innerHTML = optionList(aboot().opsi.term, t.value || admTerm() || d.term, 'All terms'); this.draw(el); }, { fresh: 120000, onError: (r) => $('[data-tree]', el).innerHTML = errorBox(r, 'retry') }); },
  rows(el) {
    const f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value); const un = $('[data-untouched]', el).checked;
    const st = $('[data-f=stage]', el), sv = st.value; st.innerHTML = optionList([...new Set(this.d.lo.filter(r => (!f.program || r.program === f.program) && (!f.mapel || r.mapel === f.mapel)).map(r => r.stage))].sort(), sv, 'All stages');
    return this.d.lo.map(r => Object.assign({}, r, { cnt: f.term ? (r.terms[f.term] || 0) : r.n })).filter(r => (!f.program || r.program === f.program) && (!f.mapel || r.mapel === f.mapel) && (!f.stage || r.stage === f.stage) && (!un || !r.cnt));
  },
  draw(el) {
    if (!this.d) return;
    const rows = this.rows(el);
    const base = this.d.lo.filter(r => { const f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value); return (!f.program || r.program === f.program) && (!f.mapel || r.mapel === f.mapel) && (!f.stage || r.stage === f.stage); });
    const term = $('[data-f=term]', el).value, bp = base.filter(r => term ? r.terms[term] : r.n).length;
    $('[data-sum]', el).innerHTML = '<div class="card kpi"><div class="kv">' + base.length + '</div><div class="kl">Verified LOs</div></div><div class="card kpi green"><div class="kv">' + bp + ' <span class="small muted">(' + (base.length ? Math.round(bp / base.length * 100) : 0) + '%)</span></div><div class="kl">Planned' + (term ? ' in ' + esc(term) : '') + '</div></div><div class="card kpi amber"><div class="kv">' + (base.length - bp) + '</div><div class="kl">Untouched</div></div>';
    const byStage = {}; base.forEach(r => { const k = r.stage; byStage[k] = byStage[k] || { t: 0, p: 0 }; byStage[k].t++; if (term ? r.terms[term] : r.n) byStage[k].p++; });
    Charts.bar($('[data-chart]', el), Object.keys(byStage).sort().map(k => ({ label: k, value: Math.round(byStage[k].p / byStage[k].t * 100), title: k + ': ' + byStage[k].p + '/' + byStage[k].t })), { suffix: '%', max: 100, empty: 'No verified LOs' });
    const tree = {}; rows.forEach(r => { ((tree[r.program + ' · ' + r.mapel] = tree[r.program + ' · ' + r.mapel] || {})[r.stage] = (tree[r.program + ' · ' + r.mapel][r.stage] || {}))[r.strand] = ((tree[r.program + ' · ' + r.mapel][r.stage] || {})[r.strand] || []).concat([r]); });
    const prog = (list) => { const p = list.filter(r => r.cnt).length; return '<span class="minibar"><i style="width:' + (list.length ? p / list.length * 100 : 0) + '%"></i></span><span class="small muted" style="min-width:60px;text-align:right">' + p + '/' + list.length + '</span>'; };
    const flat = (o) => Object.values(o).flatMap(v => Array.isArray(v) ? v : flat(v));
    $('[data-tree]', el).innerHTML = Object.keys(tree).length ? Object.keys(tree).sort().map(s => '<details open><summary>' + ic('chevron-right', 'ic-s chev') + '<span class="grow">' + esc(s) + '</span>' + prog(flat(tree[s])) + '</summary>' +
      Object.keys(tree[s]).sort().map(g => '<details><summary>' + ic('chevron-right', 'ic-s chev') + '<span class="grow">' + esc(g) + '</span>' + prog(flat(tree[s][g])) + '</summary>' +
        Object.keys(tree[s][g]).sort().map(t => '<details><summary>' + ic('chevron-right', 'ic-s chev') + '<span class="grow">' + esc(t) + '</span>' + prog(tree[s][g][t]) + '</summary><div class="lo-rows"><table class="tbl"><tbody>' +
          tree[s][g][t].map(r => '<tr><td style="width:110px"><span class="code">' + esc(r.kode) + '</span></td><td>' + esc(r.bunyi) + '</td><td style="width:110px">' + (r.cnt ? '<span class="pill ok">Planned ×' + r.cnt + '</span>' : '<span class="pill">Untouched</span>') + '</td><td style="width:120px"><div class="avatars">' + r.guru.slice(0, 4).map(n => '<span class="avatar" title="' + esc(n) + '">' + esc(initials(n)) + '</span>').join('') + '</div></td><td class="tiny muted" style="width:90px">' + (r.last ? fmtDate(r.last) : '') + '</td></tr>').join('') + '</tbody></table></div></details>').join('') + '</details>').join('') + '</details>').join('')
      : emptyState('chart', 'No LOs match', 'Adjust the filters or verify more sources.');
  },
  acts: {
    retry(b, e, el) { this.show(el); },
    print() { $$('[data-tree] details').forEach(d => d.open = true); setTimeout(() => window.print(), 50); },
    xlsx(b, e, el) { const term = $('[data-f=term]', el).value; exportXlsx('lo-coverage', ['Program', 'Subject', 'Stage', 'Strand', 'Code', 'Statement', 'Times planned' + (term ? ' (' + term + ')' : ''), 'Teachers', 'Last planned'], this.rows(el).map(r => [r.program, r.mapel, r.stage, r.strand, r.kode, r.bunyi, r.cnt, r.guru.join(', '), r.last ? fmtDate(r.last) : ''])); }
  }
});

// =========================================================
// LAPORAN KELENGKAPAN BANK LO
// =========================================================
registerPage('a-kelengkapan', {
  layout: 'admin', auth: 'admin', title: 'Bank Completeness', nav: 'a-kelengkapan',
  template() {
    return '<div class="page-h"><div><h2>LO Bank Completeness</h2><div class="sub">Verified sources per program and subject.</div></div><div class="row wrap no-print">' + exportBtns() + '</div></div>' +
      '<div class="filterbar">' + selFilter('program', aboot().opsi.program, 'All programs') + selFilter('mapel', aboot().opsi.mapel, 'All subjects') + '<label class="check"><span class="switch"><input type="checkbox" data-hide checked><span></span></span>Hide empty rows</label></div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(260px,1fr);align-items:start" data-grid><div class="col gap-l"><div data-table>' + skeletonRows(8) + '</div><div class="card"><div class="card-h"><h4>Sources by subject</h4></div><div data-chart></div></div></div><div class="card" style="border-left:4px solid var(--warn)"><div class="card-h"><h4>' + ic('triangle-alert') + 'Gaps to fill</h4></div><div data-gaps></div></div></div>';
  },
  mount(el) { $$('[data-f], [data-hide]', el).forEach(s => s.addEventListener('change', () => this.draw(el))); if (window.innerWidth < 900) $('[data-grid]', el).style.gridTemplateColumns = '1fr'; },
  show(el) { admTitle('Bank Completeness'); swr('a:leng', 'laporan.kelengkapan', {}, (d) => { this.d = d; this.draw(el); }, { fresh: 120000, onError: (r) => $('[data-table]', el).innerHTML = errorBox(r, 'retry') }); },
  rows(el) { const f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value); const hide = $('[data-hide]', el).checked; return (this.d || []).filter(r => (!f.program || r.program === f.program) && (!f.mapel || r.mapel === f.mapel) && (!hide || r.silabus || r.ebook || r.papers.length || r.lo)); },
  draw(el) {
    const rows = this.rows(el), ok = '<span style="color:var(--accent)">' + ic('circle-check') + '</span>', no = '<span style="color:var(--err)">' + ic('x') + '</span>';
    $('[data-table]', el).innerHTML = rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Program</th><th>Subject</th><th>Syllabus</th><th>Ebooks</th><th>Past papers</th><th>Questions</th><th>Verified LOs</th><th>LOs without reference question</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + esc(r.program) + '</td><td class="bold">' + esc(r.mapel) + '</td><td>' + (r.silabus ? ok + ' ' + r.silabus : no) + '</td><td>' + r.ebook + '</td><td>' + r.papers.length + (r.papers.length ? '<div class="tiny muted">' + esc(r.papers.slice(0, 3).join(', ')) + (r.papers.length > 3 ? '…' : '') + '</div>' : '') + '</td><td>' + r.soal + '</td><td>' + r.lo + '</td><td>' + (r.loTanpaSoal ? '<span class="pill wait">' + r.loTanpaSoal + '</span>' : '0') + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="card">' + emptyState('book', 'No verified sources yet', 'Verified syllabuses, ebooks and past papers appear here.') + '</div>';
    const pal = Charts.palette();
    Charts.hstack($('[data-chart]', el), rows.map(r => ({ label: r.program + ' · ' + r.mapel, values: [r.silabus, r.ebook, r.papers.length] })), [{ name: 'Syllabus', color: pal[0] }, { name: 'Ebook', color: pal[1] }, { name: 'Past paper', color: pal[4] }], { empty: 'No verified sources yet' });
    const gaps = []; (this.d || []).forEach(r => { if (!r.silabus && (r.ebook || r.papers.length || r.lo)) gaps.push([r, 'no syllabus']); else if (r.silabus && !r.papers.length) gaps.push([r, 'no past papers']); else if (r.loTanpaSoal > 5) gaps.push([r, r.loTanpaSoal + ' LOs without reference questions']); });
    $('[data-gaps]', el).innerHTML = gaps.length ? '<div class="col gap-s">' + gaps.slice(0, 15).map(g => '<div class="small"><b>' + esc(g[0].program + ' ' + g[0].mapel) + '</b>: ' + esc(g[1]) + '</div>').join('') + '</div>' : '<p class="small muted">No major gaps. 🎉</p>';
  },
  acts: { retry(b, e, el) { this.show(el); }, print() { window.print(); }, xlsx(b, e, el) { exportXlsx('lo-bank-completeness', ['Program', 'Subject', 'Syllabus', 'Ebooks', 'Past papers', 'Questions', 'Verified LOs', 'LOs without reference question'], this.rows(el).map(r => [r.program, r.mapel, r.silabus, r.ebook, r.papers.join('; '), r.soal, r.lo, r.loTanpaSoal])); } }
});

// =========================================================
// REKAMAN PEMAKAIAN
// =========================================================
registerPage('a-pemakaian', {
  layout: 'admin', auth: 'admin', title: 'Usage Log', nav: 'a-pemakaian',
  template() {
    const o = aboot().opsi;
    return '<div class="page-h"><div><h2>Usage Log</h2><div class="sub">Who used the app, when, and for what.</div></div><div class="row wrap no-print">' + exportBtns() + '</div></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search topic, teacher or LO code"></div><input class="input" type="date" data-from aria-label="From date" style="max-width:160px"><input class="input" type="date" data-to aria-label="To date" style="max-width:160px">' +
      selFilter('unit', o.unit, 'All units') + selFilter('mapel', o.mapel, 'All subjects') + selFilter('term', o.term, 'All terms') + selFilter('aktivitas', ['Search', 'Upload', 'PDF', 'Email'], 'All activities') + '</div><div data-list>' + skeletonRows(10) + '</div>';
  },
  mount(el) { this.page = 1; $('[data-q]', el).addEventListener('input', debounce(() => { this.page = 1; this.draw(el); }, 250)); $$('[data-f], [data-from], [data-to]', el).forEach(s => s.addEventListener('change', () => { this.page = 1; this.draw(el); })); },
  show(el) { admTitle('Usage Log'); swr('a:pakai', 'laporan.pemakaian', {}, (l) => { this.list = l; this.draw(el); }, { fresh: 60000, onError: (r) => $('[data-list]', el).innerHTML = errorBox(r, 'retry') }); },
  rows(el) {
    const q = $('[data-q]', el).value.toLowerCase(), f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value);
    const from = $('[data-from]', el).value, to = $('[data-to]', el).value;
    return (this.list || []).filter(r => (!q || (r.topik + ' ' + r.guru + ' ' + (r.kode || []).join(' ')).toLowerCase().includes(q)) && ['unit', 'mapel', 'term', 'aktivitas'].every(k => !f[k] || r[k] === f[k]) && (!from || String(r.waktu).slice(0, 10) >= from) && (!to || String(r.waktu).slice(0, 10) <= to));
  },
  draw(el) {
    const all = this.rows(el), p = paged(all, this.page, 30), icn = { Search: 'search', Upload: 'upload', PDF: 'download', Email: 'mail' };
    $('[data-list]', el).innerHTML = all.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date-time</th><th>Teacher</th><th>Unit</th><th>Subject</th><th>Class</th><th>Topic / document</th><th>Periods</th><th>Selected LOs</th><th>Activity</th><th></th></tr></thead><tbody>' +
      p.rows.map((r, i) => '<tr><td class="small" style="white-space:nowrap">' + fmtDate(r.waktu, true) + '</td><td class="bold small">' + esc(r.guru) + '</td><td class="small">' + esc(r.unit || '—') + '</td><td class="small">' + esc(r.mapel || '—') + '</td><td class="small">' + esc(r.kelas || '—') + '</td><td>' + esc(r.topik || '—') + '</td><td>' + esc(r.period || '') + '</td><td><div class="row wrap gap-s">' + (r.kode || []).slice(0, 4).map(c => '<span class="code">' + esc(c) + '</span>').join('') + ((r.kode || []).length > 4 ? '<span class="tiny muted">+' + (r.kode.length - 4) + '</span>' : '') + '</div></td>' +
        '<td><span class="pill">' + ic(icn[r.aktivitas] || 'info', 'ic-s') + esc(r.aktivitas) + '</span></td><td class="actions">' + (r.aktivitas === 'Search' ? '<button class="btn btn-ghost btn-sm" data-act="detail" data-id="' + esc(r.ref) + '">View</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' + pagerHtml(p)
      : '<div class="card">' + emptyState('chart', 'No activity found', 'Adjust the filters.') + '</div>';
  },
  acts: {
    retry(b, e, el) { this.show(el); }, pg(b, e, el) { this.page = +b.dataset.p; this.draw(el); },
    async detail(b) {
      const d = drawer('Search detail', skeletonRows(8), { wide: true });
      const r = await api('lo.detail', { pencarian_id: b.dataset.id });
      if (!r.success) { $('.drawer-b', d.el).innerHTML = errorBox(r); return; }
      const p = r.data.pencarian;
      $('.drawer-b', d.el).innerHTML = '<h3>' + esc(p.topik) + '</h3><p class="small muted">' + esc([p.nama_guru, p.program, p.mapel, p.grade, p.kelas, p.term, p.jumlah_period + ' periods'].filter(Boolean).join(' · ')) + '</p>' +
        r.data.hasil.map(h => '<div class="mini' + (h.dipilih ? '' : '" style="opacity:.55') + '"><div class="row wrap gap-s"><span class="code">' + esc(h.kode_lo) + '</span>' + aktPill(h.akt_final) + '<span class="pill">' + h.period_final + ' P</span>' + (h.dipilih ? '' : '<span class="pill">not selected</span>') + '</div><p class="small mt-s">' + esc(h.bunyi_lo) + '</p><details class="small"><summary>Teaching & assessment</summary><p><b>Opening</b><br>' + esc(h.pembuka).replace(/\n/g, '<br>') + '</p><p><b>Main</b><br>' + esc(h.inti).replace(/\n/g, '<br>') + '</p><p><b>Closing</b><br>' + esc(h.penutup).replace(/\n/g, '<br>') + '</p><p><b>Formative (' + esc(h.formatif_akt) + ')</b><br>' + esc(h.formatif) + '</p><p><b>Summative (' + esc(h.sumatif_akt) + ')</b><br>' + esc(h.sumatif) + '</p></details></div>').join('') +
        '<div class="mini"><b>Differentiation:</b> ' + esc(diName(p.diferensiasi)) + '</div>';
    },
    print() { window.print(); },
    xlsx(b, e, el) { exportXlsx('usage-log', ['Date-time', 'Teacher', 'Unit', 'Subject', 'Program', 'Class', 'Term', 'Topic/document', 'Periods', 'Selected LOs', 'Activity'], this.rows(el).map(r => [fmtDate(r.waktu, true), r.guru, r.unit, r.mapel, r.program, r.kelas, r.term, r.topik, r.period, (r.kode || []).join(', '), r.aktivitas])); }
  }
});

// =========================================================
// GURU TERDAFTAR
// =========================================================
registerPage('a-guru', {
  layout: 'admin', auth: 'admin', title: 'Teachers', nav: 'a-guru',
  template() {
    const o = aboot().opsi;
    return '<div class="page-h"><div><h2>Registered Teachers</h2><div class="sub">Only registered, active emails can sign in with a login code.</div></div><div class="row wrap"><button class="btn btn-outline" data-act="imp">' + ic('file-spreadsheet') + 'Import Excel</button><button class="btn btn-primary" data-act="add">' + ic('user-plus') + 'Add Teacher</button></div></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search name or email"></div>' + selFilter('unit', o.unit, 'All units') + selFilter('mapel', o.mapel, 'All subjects') + selFilter('status', [{ v: 'Aktif', l: 'Active' }, { v: 'Nonaktif', l: 'Inactive' }], 'All statuses') + '</div><div data-list>' + skeletonRows(8) + '</div>';
  },
  mount(el) { this.page = 1; $('[data-q]', el).addEventListener('input', debounce(() => { this.page = 1; this.draw(el); }, 250)); $$('[data-f]', el).forEach(s => s.addEventListener('change', () => { this.page = 1; this.draw(el); })); },
  show(el) { admTitle('Teachers'); this.load(el); },
  load(el, force) { swr('a:guru', 'guruAdm.list', {}, (l) => { this.list = l; this.draw(el); }, { fresh: force ? 0 : 60000, onError: (r) => $('[data-list]', el).innerHTML = errorBox(r, 'retry') }); },
  draw(el) {
    const q = $('[data-q]', el).value.toLowerCase(), f = {}; $$('[data-f]', el).forEach(s => f[s.dataset.f] = s.value);
    const all = (this.list || []).filter(g => (!q || (g.nama + ' ' + g.email + ' ' + (g.no_wa || '')).toLowerCase().includes(q)) && (!f.unit || g.unit === f.unit) && (!f.mapel || String(g.mapel).includes(f.mapel)) && (!f.status || g.status === f.status));
    const p = paged(all, this.page, 25);
    $('[data-list]', el).innerHTML = (this.list || []).length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Name</th><th>Email</th><th>WhatsApp</th><th>Unit</th><th>Subject</th><th>Classes</th><th>Searches</th><th>Status</th><th>Last active</th><th></th></tr></thead><tbody>' +
      p.rows.map(g => '<tr><td><span class="avatar" style="width:30px;height:30px;font-size:11px">' + esc(initials(g.nama)) + '</span></td><td class="bold">' + esc(g.nama) + '</td><td class="small">' + esc(g.email) + '</td><td class="small mono">' + (g.no_wa ? esc(g.no_wa) + (g.status_wa === 'Terdaftar' ? ' ' + ic('circle-check', 'ic-s') : g.status_wa ? ' ' + ic('circle-alert', 'ic-s') : '') : '<span class="muted">—</span>') + '</td><td>' + esc(g.unit) + '</td><td class="small">' + esc(g.mapel) + '</td><td class="small">' + esc(g.kelas_diampu) + '</td><td>' + g.pencarian + '</td><td>' + statusPill(g.status) + '</td><td class="small">' + (g.terakhir_aktif ? fmtRel(g.terakhir_aktif) : '—') + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-icon btn-sm" data-act="edit" data-id="' + esc(g.guru_id) + '" aria-label="Edit">' + ic('pencil', 'ic-s') + '</button><button class="btn btn-ghost btn-sm" data-act="toggle" data-id="' + esc(g.guru_id) + '">' + (g.status === 'Aktif' ? 'Deactivate' : 'Activate') + '</button></td></tr>').join('') + '</tbody></table></div>' + pagerHtml(p)
      : '<div class="card">' + emptyState('folder', 'No teachers yet', 'Add teachers one by one or import an Excel list.', '<button class="btn btn-primary" data-act="imp">' + ic('file-spreadsheet') + 'Import Excel</button>') + '</div>';
  },
  editor(el, g) {
    const o = aboot().opsi;
    const m = modal(g ? 'Edit teacher' : 'Add teacher', '<div class="grid grid-2"><div class="field"><label class="label req">Name</label><input class="input" name="nama" value="' + esc((g || {}).nama || '') + '"></div><div class="field"><label class="label req">Email</label><input class="input" type="email" name="email" value="' + esc((g || {}).email || '') + '"></div>' +
      '<div class="field"><label class="label">Unit</label><select class="select" name="unit">' + optionList(o.unit, (g || {}).unit, 'Choose unit') + '</select></div><div class="field"><label class="label">Subject(s)</label><input class="input" name="mapel" list="mp-list" value="' + esc((g || {}).mapel || '') + '"><datalist id="mp-list">' + o.mapel.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label class="label">WhatsApp number</label><input class="input mono" name="no_wa" inputmode="tel" value="' + esc((g || {}).no_wa || '') + '" placeholder="0812…"><div class="help">Optional — used for WhatsApp notifications.</div></div>' +
      '<div class="field"><label class="label">Classes taught</label><input class="input" name="kelas_diampu" value="' + esc((g || {}).kelas_diampu || '') + '" placeholder="e.g. 8A, 8B"></div><div class="field"><label class="label">Status</label><select class="select" name="status">' + optionList([{ v: 'Aktif', l: 'Active' }, { v: 'Nonaktif', l: 'Inactive' }], (g || {}).status || 'Aktif') + '</select></div></div>',
      '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>' + ic('check') + 'Save</button>', { wide: true });
    $('[data-ok]', m.el).onclick = async (e) => {
      const item = { guru_id: g ? g.guru_id : '' }; $$('[name]', m.el).forEach(i => item[i.name] = i.value.trim());
      btnBusy(e.currentTarget, true, 'Saving'); const r = await api('guruAdm.simpan', { item }); btnBusy(e.currentTarget, false);
      if (!r.success) return toast(r.message, 'err'); toast('Saved.'); m.close(); this.load(el, true);
    };
  },
  acts: {
    retry(b, e, el) { this.load(el, true); }, pg(b, e, el) { this.page = +b.dataset.p; this.draw(el); },
    add(b, e, el) { this.editor(el, null); },
    edit(b, e, el) { this.editor(el, this.list.find(g => g.guru_id === b.dataset.id)); },
    async toggle(b, e, el) {
      const g = this.list.find(x => x.guru_id === b.dataset.id), status = g.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
      if (status === 'Nonaktif' && !(await confirmBox('Deactivate ' + g.nama + '?', 'They will be signed out on all devices and cannot sign in until reactivated.', 'Deactivate', true))) return;
      const prev = g.status; g.status = status; this.draw(el);
      const r = await api('guruAdm.simpan', { item: Object.assign({}, g, { status }) });
      if (!r.success) { g.status = prev; this.draw(el); return toast(r.message, 'err'); }
      cacheSet('a:guru', this.list); toast(status === 'Aktif' ? 'Activated.' : 'Deactivated.');
    },
    async imp(b, e, el) {
      const m = modal('Import teachers from Excel', '<p class="small muted">Columns: <b>Name</b>, <b>Email</b>, WhatsApp, Unit, Subject, Classes. The first row must be the header.</p><div class="drop mt" data-drop tabindex="0">' + '<div class="ic-circle">' + ic('upload') + '</div><b>Choose an Excel or CSV file</b><input type="file" accept=".xlsx,.xls,.csv" hidden data-file></div><div class="row mt"><button class="btn btn-ghost btn-sm" data-tpl>' + ic('download', 'ic-s') + 'Download template</button></div><div data-prev class="mt"></div>',
        '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok disabled>Import</button>', { wide: true });
      let rows = [];
      $('[data-tpl]', m.el).onclick = () => exportXlsx('teachers-template', ['Name', 'Email', 'WhatsApp', 'Unit', 'Subject', 'Classes'], [['Sarah Lim', 'sarah@school.sch.id', '081234567890', 'MS', 'Mathematics', '8A, 8B']]);
      const inp = $('[data-file]', m.el); $('[data-drop]', m.el).onclick = () => inp.click();
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try { await loadXLSX(); } catch (err) { return toast('Could not load the Excel library.', 'err'); }
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
        const h = (arr[0] || []).map(x => String(x).toLowerCase()), idx = (re) => h.findIndex(x => re.test(x));
        const I = { nama: idx(/name|nama/), email: idx(/mail/), no_wa: idx(/whats|^wa$|^no.?wa|phone|hp|telp/), unit: idx(/unit/), mapel: idx(/subject|mapel/), kelas_diampu: idx(/class|kelas/) };
        const exist = new Set((this.list || []).map(g => String(g.email).toLowerCase())), seen = new Set();
        rows = arr.slice(1).filter(r => r.some(String)).map(r => { const o = {}; Object.keys(I).forEach(k => o[k] = I[k] > -1 ? String(r[I[k]]).trim() : ''); const em = o.email.toLowerCase(); o._dup = exist.has(em) || seen.has(em); o._bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || !o.nama; seen.add(em); return o; });
        const okN = rows.filter(r => !r._dup && !r._bad).length;
        $('[data-prev]', m.el).innerHTML = '<div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>WhatsApp</th><th>Unit</th><th>Subject</th><th>Status</th></tr></thead><tbody>' + rows.slice(0, 100).map(r => '<tr class="' + (r._dup || r._bad ? 'flag' : '') + '"><td>' + esc(r.nama) + '</td><td>' + esc(r.email) + '</td><td class="mono">' + esc(r.no_wa) + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.mapel) + '</td><td>' + (r._bad ? '<span class="pill bad">Invalid</span>' : r._dup ? '<span class="pill wait">Duplicate email</span>' : '<span class="pill ok">OK</span>') + '</td></tr>').join('') + '</tbody></table></div><div class="summary-bar mt">' + rows.length + ' rows · ' + okN + ' to import</div>';
        const ok = $('[data-ok]', m.el); ok.disabled = !okN; ok.textContent = 'Import ' + okN + ' teachers';
      };
      $('[data-ok]', m.el).onclick = async (ev) => {
        btnBusy(ev.currentTarget, true, 'Importing');
        const r = await api('guruAdm.impor', { rows: rows.filter(x => !x._dup && !x._bad) }); btnBusy(ev.currentTarget, false);
        if (!r.success) return toast(r.message, 'err'); toast(r.message); m.close(); this.load(el, true);
      };
    }
  }
});

// =========================================================
// PENGATURAN (umum, kuota, AI, kode akses, tampilan, akun admin, keamanan)
// =========================================================
const SET_TABS = [['umum', 'General', 'settings'], ['kuota', 'Quotas', 'clock'], ['ai', 'AI', 'sparkles'], ['tpl', 'Teaching Templates', 'layers'], ['kode', 'Access Code', 'key-round'], ['tampilan', 'Appearance', 'palette'], ['akun', 'Admin Accounts', 'users'], ['aman', 'Security', 'shield-check']];
const COLOR_ROWS = [['primary', 'Primary', 'Header, primary buttons'], ['primaryDark', 'Primary dark', 'Sidebar, hover'], ['accent', 'Accent', 'Verified, success'], ['accentSoft', 'Accent soft', 'Soft highlights'], ['bg', 'Background', 'Cards'], ['surface', 'Secondary background', 'Page background'], ['text', 'Text', 'Body text']];
registerPage('a-set', {
  layout: 'admin', auth: 'admin', title: 'Settings', nav: 'a-set',
  template() {
    return '<div class="page-h"><div><h2>Settings</h2><div class="sub" data-ro></div></div></div><div class="grid" style="grid-template-columns:minmax(0,220px) minmax(0,1fr);align-items:start" data-g>' +
      '<div class="card" style="padding:8px"><div class="col gap-s" data-menu>' + SET_TABS.map(t => '<button class="btn btn-ghost" style="justify-content:flex-start" data-act="tab" data-t="' + t[0] + '">' + ic(t[2]) + t[1] + '</button>').join('') + '</div></div><div data-body>' + skeletonRows(8) + '</div></div>';
  },
  mount(el) { this.tab = 'umum'; if (window.innerWidth < 800) $('[data-g]', el).style.gridTemplateColumns = '1fr'; },
  show(el, t) {
    admTitle('Settings'); if (t) this.tab = t;
    $('[data-ro]', el).textContent = isSA() ? 'Changes apply to everyone.' : 'Read-only — only the superadmin can change settings.';
    swr('a:set', 'pengaturan.get', {}, (d) => { this.d = d; this.draw(el); }, { fresh: 30000, onError: (r) => $('[data-body]', el).innerHTML = errorBox(r, 'retry') });
  },
  menu(el) { $$('[data-menu] button', el).forEach(b => { const on = b.dataset.t === this.tab; b.classList.toggle('on', on); b.style.background = on ? 'var(--primary-soft)' : ''; }); },
  field(k, label, type, help) {
    const v = esc((this.d.settings || {})[k] || ''), dis = isSA() ? '' : ' disabled';
    if (type === 'yn') return '<div class="field"><label class="label">' + label + '</label><label class="check"><span class="switch"><input type="checkbox" data-s="' + k + '"' + ((this.d.settings || {})[k] === 'Y' ? ' checked' : '') + dis + '><span></span></span>' + (help || '') + '</label></div>';
    return '<div class="field"><label class="label">' + label + '</label><input class="input" data-s="' + k + '" value="' + v + '" type="' + (type || 'text') + '"' + dis + '>' + (help ? '<div class="help">' + help + '</div>' : '') + '</div>';
  },
  draw(el) {
    this.menu(el); const d = this.d, b = $('[data-body]', el), save = isSA() ? '<div class="row mt-l" style="justify-content:flex-end"><button class="btn btn-primary" data-act="saveset">' + ic('check') + 'Save settings</button></div>' : '';
    if (this.tab === 'umum') b.innerHTML = '<div class="card"><h3 class="mb">General</h3><div class="grid grid-2">' + this.field('NAMA_APLIKASI', 'App name') + this.field('NAMA_SEKOLAH', 'School name') + this.field('TAHUN_AJARAN', 'Academic year') + this.field('TERM_AKTIF', 'Active term') + this.field('DURASI_PERIOD', 'Period duration (minutes)', 'number') + this.field('MASA_SESI_HARI', 'Remember device (days)', 'number') + '</div>' +
      '<h4 class="mt-l">Lists</h4><p class="help">Separate items with commas.</p><div class="col mt-s">' + this.field('DAFTAR_PROGRAM', 'Programs') + this.field('DAFTAR_MAPEL', 'Subjects') + this.field('DAFTAR_UNIT', 'Units') + this.field('DAFTAR_TERM', 'Terms') + '</div>' + save + '</div>';
    if (this.tab === 'kuota') b.innerHTML = '<div class="card"><h3 class="mb">Quotas</h3><div class="grid grid-2">' + this.field('KUOTA_AI_GURU', 'AI searches per teacher per day', 'number') + this.field('KUOTA_AI_SEKOLAH', 'AI searches per school per day', 'number') + this.field('KUOTA_UNGGAH_GURU', 'Uploads per teacher per day', 'number') + this.field('KUOTA_HALAMAN_HARIAN', 'Extraction pages per day (school)', 'number') + '</div><div class="alert info mt">' + ic('mail') + '<div class="small">Email quota left today for OTP & notifications: <b>' + d.emailSisa + '</b>. Gmail accounts allow about 100/day, Google Workspace about 1,500/day.</div></div>' + save + '</div>';
    if (this.tab === 'ai') b.innerHTML = '<div class="card"><h3 class="mb">AI (Gemini)</h3><div class="field"><label class="label">Gemini API key</label><div class="row"><input class="input" type="password" autocomplete="off" data-key placeholder="' + esc(d.rahasia.gemini.ada ? d.rahasia.gemini.samar : 'Not set') + '"' + (isSA() ? '' : ' disabled') + '>' + (isSA() ? '<button class="btn btn-primary" data-act="savekey">Save key</button>' : '') + '</div><div class="help">Stored securely in Script Properties — never shown again in full. Get a key at Google AI Studio.</div></div>' +
      '<div class="mt">' + (d.rahasia.gemini.ada ? '<span class="pill ok">' + ic('circle-check', 'ic-s') + 'Key configured</span>' : '<span class="pill bad">Key missing — AI features are off</span>') + '</div><div class="mt-l">' + this.field('GEMINI_MODEL', 'Model', 'text', 'Change when Google releases a newer model (e.g. a newer "flash" version). If you hit quota errors, a Flash-Lite model has larger free limits.') + '</div></div>' + this.modeCard() + save;
    if (this.tab === 'tpl') this.drawTpl(b);
    if (this.tab === 'ai') {
      $$('[data-modes] input', b).forEach(i => i.addEventListener('change', () => { $('[data-s=MODE_AI]', b).value = i.value; $$('.mode-opt', b).forEach(l => l.classList.toggle('on', l.contains(i))); }));
      this.cacheStat(el);
    }
    if (this.tab === 'kode') b.innerHTML = '<div class="card"><h3 class="mb">Guest access code</h3><p class="small muted">For trainings and guests. Guests can search LOs but cannot upload. Teachers normally sign in with their email.</p>' + this.field('KODE_AKSES_AKTIF', 'Enable guest access code', 'yn', 'Active') +
      '<div class="grid grid-2 mt">' + this.field('KODE_AKSES_BERLAKU', 'Valid until', 'date') + this.field('KODE_AKSES_MAKS', 'Max uses', 'number') + '</div>' +
      (isSA() ? '<div class="card mt" style="background:var(--surface)"><div class="row between wrap"><div><div class="tiny muted">Current code</div><div class="mono" style="font-size:24px;letter-spacing:3px">' + esc((d.kodeAkses || {}).kode || '— none —') + '</div><div class="tiny muted">Used ' + ((d.kodeAkses || {}).dipakai || 0) + ' times</div></div><div class="row">' + ((d.kodeAkses || {}).kode ? '<button class="btn btn-outline btn-sm" data-act="copycode">' + ic('copy', 'ic-s') + 'Copy</button>' : '') + '<button class="btn btn-primary btn-sm" data-act="gencode">' + ic('refresh-cw', 'ic-s') + 'Generate</button></div></div></div>' : '') + save + '</div>';
    if (this.tab === 'tampilan') this.drawTheme(b);
    if (this.tab === 'akun') this.drawAkun(b);
    if (this.tab === 'aman') b.innerHTML = '<div class="card"><h3 class="mb">Security</h3><div class="col"><button class="btn btn-outline" style="justify-content:flex-start" data-act="pw">' + ic('key-round') + 'Change my password</button><button class="btn btn-outline-danger" style="justify-content:flex-start" data-act="outall">' + ic('log-out') + 'Sign out of all devices</button></div>' +
      '<div class="alert info mt">' + ic('info') + '<div class="small">All secrets (API key, token secret, password hashes) are stored in Apps Script <b>Script Properties</b>, never in the spreadsheet or the website code. Keep the Apps Script project editors to a minimum.' + (d.akunScript ? ' Script owner: <b>' + esc(d.akunScript) + '</b>.' : '') + '</div></div></div>';
  },
  /** v2.1: cara pencarian dijawab — hibrida / AI saja / template saja */
  modeCard() {
    const m = String((this.d.settings || {}).MODE_AI || 'HIBRIDA').toUpperCase(), dis = isSA() ? '' : ' disabled';
    const opt = [['HIBRIDA', 'Hybrid', 'Recommended', 'Reuses saved AI results for the same topic, calls AI otherwise, and builds the result from the LO Bank and teaching templates when AI is unavailable or the quota runs out. Teachers never see a quota error.'],
      ['AI', 'AI only', '', 'Always asks AI for a fresh result. Teachers see an error when AI is unavailable or the quota is used up.'],
      ['TEMPLATE', 'Templates only', 'No API key needed', 'Never calls AI: free and instant. LOs are matched by keyword; steps, differentiation and assessments come from your teaching templates and past-paper bank.']];
    return '<div class="card mt"><h3 class="mb">How searches are answered</h3><input type="hidden" data-s="MODE_AI" value="' + m + '"><div class="col gap-s" data-modes>' +
      opt.map(o => '<label class="mode-opt' + (m === o[0] ? ' on' : '') + '"><input type="radio" name="mode_ai" value="' + o[0] + '"' + (m === o[0] ? ' checked' : '') + dis + '><span><b>' + o[1] + '</b>' + (o[2] ? ' <span class="pill ' + (o[0] === 'HIBRIDA' ? 'ok' : 'info') + '">' + o[2] + '</span>' : '') + '<span class="help" style="display:block;margin-top:2px">' + o[3] + '</span></span></label>').join('') + '</div>' +
      '<div class="grid grid-2 mt">' + this.field('CACHE_HASIL_HARI', 'Keep saved AI results for (days)', 'number', 'Saved results are refreshed automatically when the LO Bank for that subject changes.') + '<div data-cstat class="field"><label class="label">Today</label><div class="small muted">Loading…</div></div></div>' +
      (isSA() ? '<div class="row wrap mt-s"><button class="btn btn-ghost btn-sm" data-act="clearcache">' + ic('trash-2', 'ic-s') + 'Clear saved AI results</button><a class="btn btn-ghost btn-sm" href="#/a-set/tpl">' + ic('layers', 'ic-s') + 'Edit teaching templates</a></div>' : '') + '</div>';
  },
  async cacheStat(el) {
    const box = $('[data-cstat]', el); if (!box) return;
    const r = await api('cacheAI.stats', {}); if (!r.success || !$('[data-cstat]', el)) return;
    const h = r.data.hariIni;
    box.innerHTML = '<label class="label">Today</label><div class="row wrap gap-s"><span class="pill info">' + ic('sparkles', 'ic-s') + h.ai + ' AI</span><span class="pill ok">' + ic('history', 'ic-s') + h.cache + ' saved</span><span class="pill">' + ic('layers', 'ic-s') + h.template + ' template</span></div><div class="help">' + r.data.tersimpan + ' saved AI result(s) ready to reuse.</div>';
  },
  async drawTpl(b) {
    b.innerHTML = '<div class="card">' + skeletonRows(6) + '</div>';
    const r = await api('template.list', {});
    if (this.tab !== 'tpl') return;                 // pengguna sudah pindah tab sebelum data tiba
    if (!r.success) { b.innerHTML = errorBox(r); return; }
    this.tpl = r.data.items;
    const card = (t) => '<div class="tpl-item"><div class="row between gap-s"><div><b>' + esc(t.label) + '</b>' + (t.diubah ? ' <span class="pill info">Customised</span>' : '') + '</div>' + (isSA() ? '<button class="btn btn-ghost btn-sm" data-act="tpledit" data-k="' + t.kunci + '">' + ic('pencil', 'ic-s') + 'Edit</button>' : '') + '</div>' +
      '<div class="small muted tpl-prev">' + esc(t.jenis === 'di' ? t.inti : t.inti.split('\n')[0]) + '</div></div>';
    b.innerHTML = '<div class="card"><h3>Teaching templates</h3><p class="small muted mt-s">Used whenever a result is built without AI (Templates-only mode, or Hybrid when AI is unavailable). Each LO uses the template of its cognitive level (C1–C6); the lesson gets one differentiation cell.</p>' +
      (r.data.mode === 'AI' ? '<div class="alert info mt">' + ic('info') + '<div class="small">Search mode is <b>AI only</b>, so templates are not used until you switch to Hybrid or Templates only (Settings → AI).</div></div>' : '') +
      '<h4 class="mt-l mb-s">By AKT cognitive level</h4><div class="tpl-grid">' + this.tpl.filter(t => t.jenis === 'akt').map(card).join('') + '</div>' +
      '<h4 class="mt-l mb-s">Differentiated Instruction (3 × 3)</h4><div class="tpl-grid">' + this.tpl.filter(t => t.jenis === 'di').map(card).join('') + '</div></div>';
  },
  tplModal(el, t) {
    const di = t.jenis === 'di', ta = (k, l, rows, help) => '<div class="field"><label class="label">' + l + '</label><textarea class="textarea mono" name="' + k + '" rows="' + rows + '">' + esc(t[k] || '') + '</textarea>' + (help ? '<div class="help">' + help + '</div>' : '') + '</div>';
    const ph = 'Placeholders: <code>{topik}</code> topic · <code>{kode}</code> LO code · <code>{lo}</code> LO statement · <code>{bab}</code> coursebook chapter' + (di ? '' : ' · minutes <code>{o}</code> <code>{o2}</code> opening, <code>{a}</code> <code>{b}</code> <code>{c}</code> main, <code>{z}</code> closing. Keep one step per line starting with the minutes.');
    const m = modal('Template — ' + t.label, '<p class="help mb">' + ph + '</p>' + (di ? ta('pembuka', 'Why this cell (reason)', 2) + ta('inti', 'Classroom example', 3)
      : ta('pembuka', 'Opening', 3) + ta('inti', 'Main activities', 4) + ta('penutup', 'Closing', 2) + ta('formatif', 'Formative assessment', 2) + ta('sumatif', 'Summative assessment (used when no past-paper item matches)', 2)),
      (t.diubah ? '<button class="btn btn-ghost" data-reset>' + ic('rotate-ccw', 'ic-s') + 'Restore default</button>' : '') + '<div class="spacer" style="flex:1"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>' + ic('check') + 'Save template</button>', { wide: true });
    const v = (n) => { const x = $('[name=' + n + ']', m.el); return x ? x.value : ''; };
    $('[data-ok]', m.el).onclick = async (e) => {
      btnBusy(e.currentTarget, true, 'Saving');
      const r = await api('template.simpan', { kunci: t.kunci, label: t.label, pembuka: v('pembuka'), inti: v('inti'), penutup: v('penutup'), formatif: v('formatif'), sumatif: v('sumatif') });
      btnBusy(e.currentTarget, false); if (!r.success) return toast(r.message, 'err');
      m.close(); toast(r.message); this.drawTpl($('[data-body]', el));
    };
    const rs = $('[data-reset]', m.el); if (rs) rs.onclick = async () => {
      if (!(await confirmBox('Restore the default template?', 'Your changes to "' + t.label + '" will be replaced by the built-in text.', 'Restore'))) return;
      const r = await api('template.reset', { kunci: t.kunci }); if (!r.success) return toast(r.message, 'err');
      m.close(); toast(r.message); this.drawTpl($('[data-body]', el));
    };
  },
  drawTheme(b) {
    const cur = Theme.school(); this.tl = Object.assign({}, Theme.DEFAULT.light, cur.light); this.td = Object.assign({}, Theme.DEFAULT.dark, cur.dark);
    const ro = isSA() ? '' : ' disabled';
    b.innerHTML = '<div class="card"><div class="row between wrap mb"><h3>School theme</h3><span class="small muted">Version ' + (cur.versi || 0) + '</span></div>' + (isSA() ? '' : '<div class="alert info mb">' + ic('info') + '<div class="small">Only the superadmin can change the school theme.</div></div>') +
      '<div class="grid" style="grid-template-columns:minmax(0,4fr) minmax(0,6fr);gap:20px" data-tg><div><div data-rows>' + COLOR_ROWS.map(c => '<div class="colorrow"><input type="color" data-c="' + c[0] + '" value="' + this.tl[c[0]] + '" aria-label="' + c[1] + '"' + ro + '><div><div class="small bold">' + c[1] + '</div><div class="tiny muted">' + c[2] + '</div></div><input class="input mono" data-h="' + c[0] + '" value="' + this.tl[c[0]] + '" maxlength="7" style="min-height:36px;font-size:13px"' + ro + '></div>').join('') + '</div>' +
      '<div data-contrast class="mt"></div><label class="check mt"><span class="switch"><input type="checkbox" data-auto' + (this.td.auto !== false ? ' checked' : '') + ro + '><span></span></span>Auto-generate dark mode</label><div data-darkrows class="mt-s"></div></div>' +
      '<div><div class="row between mb"><b class="small">Live preview</b><div class="seg" data-pm><button class="on" data-pv="l">Light</button><button data-pv="d">Dark</button></div></div><div class="preview-box" data-preview></div></div></div>' +
      '<div class="row wrap mt-l" style="justify-content:flex-end">' + (isSA() ? '<button class="btn btn-ghost" data-act="restore">' + ic('rotate-ccw') + 'Restore Default</button><button class="btn btn-outline" data-act="history">' + ic('history') + 'Theme History</button><button class="btn btn-primary" data-act="savetheme">' + ic('check') + 'Save Theme</button>' : '') + '</div></div>';
    if (window.innerWidth < 900) $('[data-tg]', b).style.gridTemplateColumns = '1fr';
    this.pv = 'l';
    const sync = (k, v) => { if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return; this.tl[k] = v.toUpperCase(); $('[data-c="' + k + '"]', b).value = v; $('[data-h="' + k + '"]', b).value = v.toUpperCase(); this.preview(b); };
    $$('[data-c]', b).forEach(i => i.addEventListener('input', () => sync(i.dataset.c, i.value)));
    $$('[data-h]', b).forEach(i => i.addEventListener('input', () => sync(i.dataset.h, i.value.trim())));
    $('[data-auto]', b).addEventListener('change', (e) => { this.td.auto = e.target.checked; this.darkRows(b); this.preview(b); });
    $$('[data-pv]', b).forEach(x => x.addEventListener('click', () => { this.pv = x.dataset.pv; $$('[data-pv]', b).forEach(y => y.classList.toggle('on', y === x)); this.preview(b); }));
    this.darkRows(b); this.preview(b);
  },
  darkRows(b) {
    const box = $('[data-darkrows]', b); if (this.td.auto !== false) { box.innerHTML = ''; return; }
    box.innerHTML = [['bg', 'Dark background'], ['surface', 'Dark cards'], ['text', 'Dark text'], ['primary', 'Dark primary'], ['accent', 'Dark accent']].map(c => '<div class="colorrow"><input type="color" data-dc="' + c[0] + '" value="' + this.td[c[0]] + '"><div class="small bold">' + c[1] + '</div><input class="input mono" data-dh="' + c[0] + '" value="' + this.td[c[0]] + '" maxlength="7" style="min-height:36px;font-size:13px"></div>').join('');
    const sync = (k, v) => { if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return; this.td[k] = v.toUpperCase(); $('[data-dc="' + k + '"]', b).value = v; $('[data-dh="' + k + '"]', b).value = v.toUpperCase(); this.preview(b); };
    $$('[data-dc]', box).forEach(i => i.addEventListener('input', () => sync(i.dataset.dc, i.value)));
    $$('[data-dh]', box).forEach(i => i.addEventListener('input', () => sync(i.dataset.dh, i.value.trim())));
  },
  checks() {
    const L = this.tl, D = this.td.auto !== false ? Object.assign({}, this.td, { primary: C.lighten(L.primary, .32), accent: C.lighten(L.accent, .18) }) : this.td;
    return [['Text on background', L.text, L.bg, 4.5], ['Text on secondary background', L.text, L.surface, 4.5], ['White text on primary', '#FFFFFF', L.primary, 4.5], ['White text on accent', '#FFFFFF', L.accent, 3], ['Dark mode text', D.text, D.bg, 4.5], ['Dark mode text on cards', D.text, D.surface, 4.5]]
      .map(c => ({ n: c[0], r: C.ratio(c[1], c[2]), min: c[3], fg: c[1], bg: c[2] }));
  },
  preview(b) {
    const v = Theme.compute(this.tl, this.td, this.pv === 'd'), box = $('[data-preview]', b);
    const style = Object.keys(v).map(k => k + ':' + v[k]).join(';');
    box.setAttribute('style', style + ';background:var(--surface);color:var(--text)');
    box.innerHTML = '<div style="background:var(--nav-bg);color:var(--nav-fg);padding:12px 16px;display:flex;align-items:center;gap:10px;font-family:var(--font-head);font-weight:700">' + LOGO.replace('<svg', '<svg width="20" height="20"') + 'LO Finding<span style="margin-left:auto;font-weight:500;font-size:13px;opacity:.85">Find LO · Upload</span></div>' +
      '<div style="padding:16px"><div class="row wrap"><button class="btn btn-primary btn-sm">Primary</button><button class="btn btn-outline btn-sm">Secondary</button><button class="btn btn-success btn-sm">Verify</button></div>' +
      '<div class="lo-card mt" style="margin-bottom:10px"><div class="lo-head"><div class="lo-text"><div class="row wrap gap-s"><span class="code">8Ae.03</span><span class="pill ok">Verified</span><span class="pill akt c2">CC2</span><span class="pill akt c4">PC4</span></div><div class="stmt">Understand how to manipulate algebraic expressions.</div></div></div></div>' +
      '<div class="card" style="padding:12px"><div class="row" style="align-items:flex-end;gap:8px;height:60px">' + [40, 70, 55, 90, 65].map((h, i) => '<div style="flex:1;height:' + h + '%;border-radius:4px;background:' + (i % 2 ? 'var(--accent)' : 'var(--primary)') + '"></div>').join('') + '</div></div>' +
      '<table class="tbl mt" style="background:var(--card);border-radius:8px"><tr><th>Teacher</th><th>Status</th></tr><tr><td>Sarah Lim</td><td><span class="pill wait">Pending</span></td></tr></table></div>';
    const cs = this.checks();
    $('[data-contrast]', b).innerHTML = '<div class="col gap-s">' + cs.map(c => '<div class="row between small"><span>' + c.n + '</span><span class="contrast" style="color:' + (c.r >= c.min ? 'var(--accent)' : 'var(--err)') + '">' + (c.r >= c.min ? '✓ ' : '✗ ') + c.r.toFixed(1) + ':1' + (c.r >= c.min ? '' : ' (min ' + c.min + ')') + '</span></div>').join('') + '</div>' +
      (cs.some(c => c.r < c.min) ? '<div class="alert bad mt-s small">' + ic('circle-alert', 'ic-s') + 'Some combinations are hard to read. Darken the text/primary color or lighten the background.</div>' : '');
    const sv = $('[data-act=savetheme]', b); if (sv) sv.disabled = cs.some(c => c.r < c.min);
  },
  async drawAkun(b) {
    if (!isSA()) { b.innerHTML = '<div class="card">' + emptyState('check', 'Superadmin only', 'Only the superadmin can manage admin accounts.') + '</div>'; return; }
    b.innerHTML = '<div class="card">' + skeletonRows(5) + '</div>';
    const r = await api('akunAdmin.list', {}); if (!r.success) { b.innerHTML = errorBox(r); return; }
    this.akun = r.data;
    b.innerHTML = '<div class="card"><div class="row between mb"><h3>Admin Accounts</h3><button class="btn btn-primary btn-sm" data-act="addadm">' + ic('user-plus', 'ic-s') + 'Add admin</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
      r.data.map(a => '<tr><td class="bold">' + esc(a.nama) + '</td><td class="small">' + esc(a.email) + '</td><td>' + (a.peran === 'superadmin' ? '<span class="pill info">Superadmin</span>' : '<span class="pill">Admin</span>') + '</td><td>' + statusPill(a.status) + (a.wajib_ganti === 'Y' ? '<div class="tiny muted">temp. password</div>' : '') + '</td><td class="actions"><button class="btn btn-ghost btn-sm" data-act="editadm" data-id="' + esc(a.admin_id) + '">' + ic('pencil', 'ic-s') + 'Edit</button></td></tr>').join('') + '</tbody></table></div>' +
      '<p class="tiny muted mt">New admins get Viewer access to the app\'s source folder in Google Drive so the verification preview works.</p></div>';
  },
  admEditor(el, a) {
    const m = modal(a ? 'Edit admin' : 'Add admin', '<div class="grid grid-2"><div class="field"><label class="label req">Name</label><input class="input" name="nama" value="' + esc((a || {}).nama || '') + '"></div><div class="field"><label class="label req">Email</label><input class="input" name="email" type="email" value="' + esc((a || {}).email || '') + '"></div>' +
      '<div class="field"><label class="label">WhatsApp number</label><input class="input mono" name="no_wa" inputmode="tel" value="' + esc((a || {}).no_wa || '') + '" placeholder="0812…"></div><div></div>' +
      '<div class="field"><label class="label">Role</label><select class="select" name="peran">' + optionList([{ v: 'admin', l: 'Admin' }, { v: 'superadmin', l: 'Superadmin' }], (a || {}).peran || 'admin') + '</select></div><div class="field"><label class="label">Status</label><select class="select" name="status">' + optionList([{ v: 'Aktif', l: 'Active' }, { v: 'Nonaktif', l: 'Inactive' }], (a || {}).status || 'Aktif') + '</select></div></div>' +
      (a ? '<label class="check mt"><input type="checkbox" name="resetSandi"> Reset password (a new temporary password will be shown once)</label>' : '<p class="small muted mt">A temporary password will be shown once after saving.</p>'),
      '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save</button>');
    $('[data-ok]', m.el).onclick = async (e) => {
      const item = { admin_id: a ? a.admin_id : '' }; $$('[name]', m.el).forEach(i => item[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim());
      btnBusy(e.currentTarget, true, 'Saving'); const r = await api('akunAdmin.simpan', { item }); btnBusy(e.currentTarget, false);
      if (!r.success) return toast(r.message, 'err');
      m.close();
      if (r.data.sandiSementara) { const mm = modal('Temporary password', '<p class="small">Share this privately with <b>' + esc(item.email) + '</b>. It is shown only once; they must change it at first login.</p><div class="row mt"><input class="input mono" readonly value="' + esc(r.data.sandiSementara) + '"><button class="btn btn-outline" data-cp>' + ic('copy') + '</button></div>', '<button class="btn btn-primary" data-close>Done</button>', { sticky: true }); $('[data-cp]', mm.el).onclick = async () => toast(await copyText(r.data.sandiSementara) ? 'Copied.' : 'Copy failed.'); }
      else toast('Saved.');
      this.drawAkun($('[data-body]', el));
    };
  },
  acts: {
    retry(b, e, el) { this.show(el); },
    tab(b, e, el) { this.tab = b.dataset.t; this.draw(el); },
    tpledit(b, e, el) { const t = (this.tpl || []).find(x => x.kunci === b.dataset.k); if (t) this.tplModal(el, t); },
    async clearcache(b, e, el) {
      if (!(await confirmBox('Clear saved AI results?', 'New searches will call AI again until results are saved. Teachers\' own search history is not affected.', 'Clear', true))) return;
      const r = await api('cacheAI.hapus', {}); toast(r.message, r.success ? 'ok' : 'err'); this.cacheStat(el);
    },
    async saveset(b, e, el) {
      const s = {}; $$('[data-s]', el).forEach(i => s[i.dataset.s] = i.type === 'checkbox' ? (i.checked ? 'Y' : 'N') : i.value.trim());
      btnBusy(b, true, 'Saving'); const r = await api('pengaturan.simpan', { settings: s }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      this.d.settings = r.data.settings; cacheSet('a:set', this.d); if (AppState.adminBoot) { AppState.adminBoot.settings = r.data.settings; cacheSet('a:boot', AppState.adminBoot); }
      toast('Settings saved.'); refreshShellUser();
    },
    async savekey(b, e, el) {
      const v = $('[data-key]', el).value.trim(); if (!v) return toast('Paste the API key first.', 'warn');
      btnBusy(b, true, 'Saving'); const r = await api('rahasia.simpan', { kunci: 'GEMINI_API_KEY', nilai: v }); btnBusy(b, false);
      $('[data-key]', el).value = '';
      if (!r.success) return toast(r.message, 'err');
      this.d.rahasia.gemini = { ada: r.data.ada, samar: r.data.samar }; this.draw(el); toast('API key saved.');
    },
    async gencode(b, e, el) {
      if ((this.d.kodeAkses || {}).kode && !(await confirmBox('Generate a new code?', 'The current code will stop working.', 'Generate'))) return;
      const r = await api('kodeAkses.buat', {}); if (!r.success) return toast(r.message, 'err');
      this.d.kodeAkses = r.data; this.draw(el); toast('New access code generated. Remember to enable it.');
    },
    async copycode() { toast(await copyText(this.d.kodeAkses.kode) ? 'Code copied.' : 'Copy failed.'); },
    async savetheme(b, e, el) {
      btnBusy(b, true, 'Saving'); const r = await api('tema.simpan', { light: this.tl, dark: this.td }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      Theme.setSchool(r.data); if (AppState.adminBoot) { AppState.adminBoot.tema = r.data; cacheSet('a:boot', AppState.adminBoot); }
      toast(r.message); this.draw(el);
    },
    async restore(b, e, el) {
      if (!(await confirmBox('Restore default theme?', 'The Blue-White default colors will be applied for all users.', 'Restore'))) return;
      const r = await api('tema.pulihkan', { tema_id: 'DEFAULT' }); if (!r.success) return toast(r.message, 'err');
      Theme.setSchool(r.data); toast('Default theme restored.'); this.draw(el);
    },
    async history(b, e, el) {
      const r = await api('tema.riwayat', {}); if (!r.success) return toast(r.message, 'err');
      const m = modal('Theme history', '<div class="col">' + r.data.map(t => '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="row"><div class="strip" style="display:flex;width:80px;height:20px;border-radius:5px;overflow:hidden">' + ['primary', 'accent', 'surface', 'text'].map(k => '<i style="flex:1;background:' + ((t.light || {})[k] || '#ccc') + '"></i>').join('') + '</div><div><div class="small bold">v' + t.versi + ' · ' + esc(t.nama) + (t.aktif ? ' <span class="pill ok">Active</span>' : '') + '</div><div class="tiny muted">' + esc(t.oleh || '') + ' · ' + fmtDate(t.waktu, true) + '</div></div></div>' + (t.aktif ? '' : '<button class="btn btn-ghost btn-sm" data-restore="' + esc(t.tema_id) + '">Restore</button>') + '</div>').join('') + '</div>', '<button class="btn btn-primary" data-close>Close</button>');
      m.el.addEventListener('click', async (ev) => { const x = ev.target.closest('[data-restore]'); if (!x) return; const rr = await api('tema.pulihkan', { tema_id: x.dataset.restore }); if (!rr.success) return toast(rr.message, 'err'); Theme.setSchool(rr.data); toast('Theme restored.'); m.close(); this.draw(el); });
    },
    addadm(b, e, el) { this.admEditor(el, null); },
    editadm(b, e, el) { this.admEditor(el, this.akun.find(a => a.admin_id === b.dataset.id)); },
    pw() { changePassword(false); },
    outall() { logout(true); }
  }
});

window.ADMIN_READY = true;
// Bila admin sudah masuk saat bundel selesai dimuat
if (AppState.token && isAdmin()) { adminBoot(); }
