/* =========================================================
   LO Finding — admin-ext.js (v2, dimuat lazy bersama admin.js)
   WhatsApp & Notifikasi (Blast · Antrean · Konfigurasi) · CRM Kontak · Migrasi Data
   Token Fonnte tidak pernah tampil utuh di sini — server hanya mengirim versi tersamar.
   ========================================================= */
'use strict';

const EV_LABEL = { GURU_DITAMBAHKAN: 'Teacher added (welcome)', EKSTRAKSI_SELESAI: 'Extraction finished', EKSTRAKSI_GAGAL: 'Extraction failed', DOKUMEN_DIAJUKAN: 'Document submitted (to admins)', DOKUMEN_DIVERIFIKASI: 'Document verified', DOKUMEN_DITOLAK: 'Document rejected', BLAST: 'Blast' };
const Q_STATUS = { Antri: ['info', 'Queued'], Terkirim: ['ok', 'Sent'], Gagal: ['bad', 'Failed'], Batal: ['', 'Cancelled'] };
const B_STATUS = { Berjalan: ['info', 'Running'], Selesai: ['ok', 'Finished'], Dihentikan: ['', 'Stopped'] };
const WA_STATUS = { Terdaftar: ['ok', 'On WhatsApp'], 'Tidak Terdaftar': ['bad', 'Not on WA'] };
function pillOf(map, s) { const x = map[s] || ['', s || '—']; return '<span class="pill ' + x[0] + '">' + esc(x[1]) + '</span>'; }
function waPill(k) { if (!k.wa) return '<span class="tiny muted">—</span>'; if (!k.waValid) return '<span class="pill bad">Invalid</span>'; return k.statusWA ? pillOf(WA_STATUS, k.statusWA) : '<span class="pill wait">Not checked</span>'; }
function kpiCard(icon, val, label, act) { return '<button class="card kpi" style="text-align:left;cursor:' + (act ? 'pointer' : 'default') + '"' + (act ? ' data-act="kf" data-k="' + act + '"' : '') + '><span class="ki">' + ic(icon) + '</span><span class="kv">' + esc(val) + '</span><span class="kl">' + esc(label) + '</span></button>'; }
function switchHtml(name, on) { return '<label class="switch"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '><span></span></label>'; }
/** Polling adaptif: hanya saat tab terlihat, lambat saat admin diam > 2 menit */
const Activity = { at: Date.now(), last: {},
  init() { if (this._i) return; this._i = 1; ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach(ev => addEventListener(ev, () => this.at = Date.now(), { passive: true })); },
  due(key, activeMs, idleMs) { if (document.visibilityState !== 'visible') return false; const gap = Date.now() - this.at > 120000 ? idleMs : activeMs; if (Date.now() - (this.last[key] || 0) < gap - 500) return false; this.last[key] = Date.now(); return true; } };
Activity.init();

// =========================================================
// WHATSAPP & NOTIFIKASI
// =========================================================
registerPage('a-wa', {
  layout: 'admin', auth: 'admin', title: 'WhatsApp & Notifications', nav: 'a-wa',
  template() {
    return '<div class="page-h"><div><h2>WhatsApp & Notifications</h2><div class="sub">Automatic notifications and WhatsApp blasts are queued and sent in the background — buttons respond instantly.</div></div></div>' +
      '<div class="tabs mb" role="tablist"><button data-act="tab" data-t="blast">' + ic('megaphone', 'ic-s') + 'Blast</button><button data-act="tab" data-t="antrean">' + ic('inbox', 'ic-s') + '<span>Queue<span class="hide-xs"> &amp; History</span></span><span class="count" data-qn></span></button><button data-act="tab" data-t="konfig">' + ic('settings', 'ic-s') + 'Settings</button></div><div data-body></div>';
  },
  mount(el) {
    this.tab = 'blast';
    setInterval(() => { if (el.hidden || this.tab !== 'blast' || !(this.blasts || []).some(b => b.status === 'Berjalan')) return; if (Activity.due('blast', 15000, 60000)) this.loadBlasts(el, true); }, 5000);
  },
  show(el, t) {
    admTitle('WhatsApp & Notifications');
    if (t) this.tab = t;
    if (AppState.blastPreset) this.tab = 'blast';
    $$('.tabs [data-t]', el).forEach(b => b.classList.toggle('on', b.dataset.t === this.tab));
    const b = $('[data-body]', el);
    if (this.tab === 'blast') this.drawBlast(el, b);
    if (this.tab === 'antrean') this.drawQueue(el, b);
    if (this.tab === 'konfig') this.drawConfig(el, b);
  },
  // ---------- Blast ----------
  drawBlast(el, b) {
    const preset = AppState.blastPreset; AppState.blastPreset = null;
    const cfg = cacheGet('a:notifcfg') || {};
    b.innerHTML = '<div class="grid" style="grid-template-columns:minmax(0,1fr);gap:16px" data-bl>' +
      '<div class="card form-stack"><div class="card-h"><h4>' + ic('send', 'ic-s') + ' New blast</h4></div>' +
      (cfg.waAktif === false ? '<div class="alert warn mb">' + ic('triangle-alert') + '<div>WhatsApp is turned off. ' + (isSA() ? 'Turn it on in the <a href="#/a-wa/konfig">Configuration</a> tab.' : 'Ask the superadmin to turn it on.') + '</div></div>' : '') +
      '<div class="grid grid-2"><div class="field"><label class="label req">Title</label><input class="input" name="judul" maxlength="120" placeholder="e.g. Workshop reminder"></div>' +
      '<div class="field"><label class="label">Recipients</label><select class="select" name="sumber">' + optionList([{ v: 'crm', l: 'CRM contacts' }, { v: 'manual', l: 'Paste numbers manually' }], preset ? 'crm' : 'crm') + '</select></div></div>' +
      '<div data-aud-crm class="grid grid-3"><div class="field"><label class="label">Segment</label><select class="select" name="segmen">' + optionList(['Teacher', 'Admin', 'Workshop'], '', 'All segments') + '</select></div><div class="field"><label class="label">Tag</label><input class="input" name="tag" placeholder="optional"></div>' +
      '<div class="field"><label class="label">Unit</label><select class="select" name="unit">' + optionList(aboot().opsi.unit || [], '', 'All units') + '</select></div></div>' +
      '<div data-aud-man class="field" hidden><label class="label">Numbers (one per line: 0812…|Name)</label><textarea class="textarea" name="manual" rows="4" placeholder="081234567890|Sarah Lim"></textarea></div>' +
      (preset ? '<div class="alert info mb">' + ic('info') + '<div>' + preset.length + ' contact(s) selected from CRM. <button class="btn btn-ghost btn-sm" data-act="clearpreset">Clear</button></div></div>' : '') +
      '<div class="field"><label class="label req">Message</label><textarea class="textarea" name="pesan" rows="5" maxlength="3000" placeholder="Hi {nama}, …"></textarea><div class="help">Placeholders: <code>{nama}</code> <code>{sekolah}</code> <code>{app}</code> <code>{link}</code>. Use *bold* for WhatsApp bold.</div></div>' +
      '<div class="row wrap gap-s"><div class="field"><label class="label">Batch size</label><div class="seg" data-batch>' + [10, 20, 50].map(n => '<button type="button" data-n="' + n + '" class="' + (n === (cfg.batchDefault || 20) ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div>' +
      '<div class="field" style="max-width:150px"><label class="label">Delay (sec)</label><input class="input" name="jeda" value="' + esc(cfg.jeda || '5') + '" placeholder="5 or 3-8"></div>' +
      '<label class="check" style="align-self:flex-end;margin-bottom:12px"><input type="checkbox" name="hanyaWA"> Only numbers confirmed on WhatsApp</label></div>' +
      '<div data-aud class="mt-s"></div>' +
      '<div class="row wrap gap-s mt"><button class="btn btn-outline" data-act="aud">' + ic('users-round') + 'Preview recipients</button><button class="btn btn-outline" data-act="cekwa" disabled>' + ic('scan-search') + 'Check WhatsApp numbers</button><div class="spacer" style="flex:1"></div><button class="btn btn-primary" data-act="buat" disabled>' + ic('send') + 'Create blast</button></div></div>' +
      '<div class="card"><div class="card-h"><h4>' + ic('history', 'ic-s') + ' Blasts</h4><button class="btn btn-ghost btn-sm" data-act="reloadbl">' + ic('refresh-cw', 'ic-s') + 'Refresh</button></div><div data-bls>' + skeletonRows(4) + '</div></div></div>';
    this.preset = preset;
    const f = $('[data-bl]', b);
    $('[name=sumber]', f).onchange = (e) => { $('[data-aud-crm]', f).hidden = e.target.value === 'manual'; $('[data-aud-man]', f).hidden = e.target.value !== 'manual'; this.aud = null; this.drawAud(f); };
    $$('[name=segmen],[name=tag],[name=unit],[name=manual]', f).forEach(i => i.addEventListener('change', () => { this.aud = null; this.drawAud(f); }));
    $('[name=hanyaWA]', f).onchange = () => this.drawAud(f);
    $('[data-batch]', f).onclick = (e) => { const x = e.target.closest('[data-n]'); if (!x) return; $$('[data-n]', f).forEach(y => y.classList.toggle('on', y === x)); this.drawAud(f); };
    this.loadBlasts(el);
    if (!cacheGet('a:notifcfg') && isSA()) api('notif.config', {}).then(r => { if (!r.success) return; cacheSet('a:notifcfg', r.data); const n = $('[data-batch] [data-n="' + r.data.batchDefault + '"]', f); if (n && !this.aud) { $$('[data-batch] [data-n]', f).forEach(y => y.classList.toggle('on', y === n)); $('[name=jeda]', f).value = r.data.jeda; } });
    if (preset) this.acts.aud.call(this, null, null, el);
  },
  audFilter(f) {
    const v = (n) => ($('[name=' + n + ']', f) || {}).value || '';
    return v('sumber') === 'manual' ? { sumber: 'manual', manual: v('manual') } : Object.assign({ segmen: v('segmen'), tag: v('tag').trim(), unit: v('unit') }, this.preset ? { ids: this.preset } : {});
  },
  recipients(f) {
    const only = $('[name=hanyaWA]', f).checked, seen = new Set();
    return (this.aud ? this.aud.rows : []).filter(r => { if (!r.valid || r.optOut || seen.has(r.hp)) return false; if (only && r.statusWA !== 'Terdaftar') return false; seen.add(r.hp); return true; });
  },
  drawAud(f) {
    const box = $('[data-aud]', f), btn = $('[data-act=buat]', f), cek = $('[data-act=cekwa]', f);
    if (!this.aud) { box.innerHTML = ''; btn.disabled = true; cek.disabled = true; return; }
    const r = this.aud.ringkas, list = this.recipients(f), n = +($('[data-batch] .on', f) || {}).dataset?.n || 20, belum = this.aud.rows.filter(x => x.valid && !x.statusWA).length;
    box.innerHTML = '<div class="summary-bar">' + r.total + ' found · <b>' + list.length + ' will receive</b> · ' + r.tidakValid + ' invalid · ' + r.ganda + ' duplicate · ' + r.optOut + ' opted out · ' + r.terdaftarWA + ' on WA · ' + belum + ' not checked → ' + Math.ceil(list.length / n || 0) + ' batch(es) of ' + n + '</div>';
    btn.disabled = !list.length; cek.disabled = !belum;
  },
  async loadBlasts(el, force) {
    const box = $('[data-bls]', el); if (!box) return;
    await swr('a:blasts', 'wa.blastList', force ? { _fresh: 1 } : {}, (l) => {
      this.blasts = l;
      box.innerHTML = l.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Blast</th><th>Progress</th><th>Sent</th><th>Failed</th><th>Batch</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>' +
        l.map(x => '<tr><td><div class="bold">' + esc(x.judul) + '</div><div class="tiny muted">' + esc(x.oleh || '') + '</div></td><td style="min-width:140px"><div class="progress' + (x.status === 'Berjalan' ? ' striped' : '') + '"><i style="width:' + x.persen + '%"></i></div><div class="tiny muted">' + x.persen + '% · ' + x.sisa + ' left of ' + x.total + '</div></td><td>' + x.terkirim + '</td><td>' + (x.gagal ? '<span class="pill bad">' + x.gagal + '</span>' : '0') + '</td><td>' + x.ukuran_batch + '</td><td>' + pillOf(B_STATUS, x.status) + '</td><td class="small">' + fmtRel(x.tanggal) + '</td><td class="actions">' +
          (x.status === 'Berjalan' ? '<button class="btn btn-success btn-sm" data-act="next" data-id="' + esc(x.blast_id) + '">' + ic('play', 'ic-s') + 'Send next batch</button><button class="btn btn-ghost-danger btn-sm" data-act="stop" data-id="' + esc(x.blast_id) + '">' + ic('circle-stop', 'ic-s') + 'Stop</button>' : '') +
          '<button class="btn btn-ghost btn-sm" data-act="bq" data-id="' + esc(x.blast_id) + '">' + ic('list-checks', 'ic-s') + 'Details</button></td></tr>').join('') + '</tbody></table></div><p class="tiny muted mt">Running blasts send one batch per minute automatically, even when this tab is closed.</p>'
        : emptyState('chart', 'No blasts yet', 'Create your first WhatsApp blast above.');
    }, { fresh: force ? 0 : 20000, force: !!force, onError: (r) => box.innerHTML = errorBox(r, 'reloadbl') });
  },
  // ---------- Antrean ----------
  drawQueue(el, b) {
    b.innerHTML = '<div class="filterbar"><select class="select" data-qf="status">' + optionList([{ v: 'Antri', l: 'Queued' }, { v: 'Terkirim', l: 'Sent' }, { v: 'Gagal', l: 'Failed' }, { v: 'Batal', l: 'Cancelled' }], this.qf?.status || '', 'All statuses') + '</select>' +
      '<select class="select" data-qf="kanal">' + optionList([{ v: 'WA', l: 'WhatsApp' }, { v: 'EMAIL', l: 'Email' }], this.qf?.kanal || '', 'All channels') + '</select><div class="spacer" style="flex:1"></div>' +
      '<button class="btn btn-outline btn-sm" data-act="proses">' + ic('send', 'ic-s') + 'Process now</button>' + (isSA() ? '<button class="btn btn-outline btn-sm" data-act="retry">' + ic('refresh-cw', 'ic-s') + 'Retry failed</button>' : '') + '<button class="btn btn-ghost btn-sm" data-act="reloadq">' + ic('refresh-cw', 'ic-s') + '</button></div><div data-ql>' + skeletonRows(8) + '</div>';
    $$('[data-qf]', b).forEach(s => s.onchange = () => { this.qf = { status: $('[data-qf=status]', b).value, kanal: $('[data-qf=kanal]', b).value }; this.loadQueue(el); });
    this.loadQueue(el);
  },
  async loadQueue(el) {
    const box = $('[data-ql]', el); if (!box) return;
    const q = Object.assign({}, this.qf || {}, this.qBlast ? { blastId: this.qBlast } : {});
    const r = await api('notif.queue', q);
    if (!r.success) { box.innerHTML = errorBox(r, 'reloadq'); return; }
    const s = r.data.ringkas; $('[data-qn]', el).textContent = s.Antri || '';
    box.innerHTML = '<div class="row wrap gap-s mb">' + Object.keys(Q_STATUS).map(k => '<span class="pill ' + Q_STATUS[k][0] + '">' + Q_STATUS[k][1] + ': ' + (s[k] || 0) + '</span>').join('') + (this.qBlast ? '<button class="btn btn-ghost btn-sm" data-act="qall">' + ic('x', 'ic-s') + 'Blast filter</button>' : '') + '</div>' +
      (r.data.rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Channel</th><th>Recipient</th><th>Event</th><th>Message</th><th>Status</th><th>Created</th><th>Sent</th></tr></thead><tbody>' +
        r.data.rows.map(x => '<tr><td>' + ic(x.kanal === 'WA' ? 'message-circle' : 'mail', 'ic-s') + ' ' + (x.kanal === 'WA' ? 'WhatsApp' : 'Email') + '</td><td><div class="bold small">' + esc(x.nama || '—') + '</div><div class="tiny muted mono">' + esc(x.tujuan) + '</div></td><td class="small">' + esc(EV_LABEL[x.event] || x.event) + '</td><td class="small" style="min-width:220px">' + esc(x.pesan) + '</td><td>' + pillOf(Q_STATUS, x.status) + (x.status === 'Gagal' && x.respon ? '<div class="tiny muted">' + esc(x.respon) + '</div>' : '') + '</td><td class="small">' + fmtRel(x.dibuat) + '</td><td class="small">' + (x.dikirim ? fmtRel(x.dikirim) : '—') + '</td></tr>').join('') + '</tbody></table></div><p class="tiny muted mt">Showing the latest 300 messages.</p>'
        : emptyState('folder', 'Nothing here', 'Messages appear here once notifications are queued.'));
  },
  // ---------- Konfigurasi ----------
  async drawConfig(el, b) {
    if (!isSA()) { b.innerHTML = '<div class="card">' + emptyState('check', 'Superadmin only', 'Only the superadmin can change notification settings.') + '</div>'; return; }
    const c0 = cacheGet('a:notifcfg'); b.innerHTML = c0 ? '' : '<div class="card">' + skeletonRows(8) + '</div>';
    if (c0) this.renderConfig(el, b, c0);
    const r = await api('notif.config', {});
    if (!r.success) { if (!c0) b.innerHTML = errorBox(r); return; }
    cacheSet('a:notifcfg', r.data);
    if (!c0 || hashStr(JSON.stringify(c0)) !== hashStr(JSON.stringify(r.data))) this.renderConfig(el, b, r.data);
  },
  renderConfig(el, b, c) {
    this.cfg = JSON.parse(JSON.stringify(c));
    b.innerHTML = '<div class="grid grid-2" style="align-items:start">' +
      '<div class="card form-stack"><div class="card-h"><h4>' + ic('message-circle', 'ic-s') + ' WhatsApp (Fonnte)</h4>' + switchHtml('waAktif', c.waAktif) + '</div>' +
      '<div class="field"><label class="label">Fonnte token</label><input class="input mono" type="password" autocomplete="off" name="token" placeholder="' + esc(c.token.ada ? c.token.samar + ' (saved — leave empty to keep)' : 'Paste the device token from fonnte.com') + '"><div class="help">Stored in Script Properties only — never in the spreadsheet or this page.' + (c.token.ada ? ' <a href="#" data-act="deltoken">Remove token</a>' : '') + '</div></div>' +
      '<div class="grid grid-2"><div class="field"><label class="label">Default batch</label><select class="select" name="batchDefault">' + optionList([10, 20, 50], c.batchDefault) + '</select></div><div class="field"><label class="label">Delay between messages (sec)</label><input class="input" name="jeda" value="' + esc(c.jeda) + '"></div></div>' +
      '<label class="check">' + '<input type="checkbox" name="deteksiOtomatis"' + (c.deteksiOtomatis ? ' checked' : '') + '> Check new contacts on WhatsApp automatically (every ~10 min)</label>' +
      '<div class="row wrap gap-s mt"><button class="btn btn-outline btn-sm" data-act="device">' + ic('smartphone', 'ic-s') + 'Device status</button><button class="btn btn-outline btn-sm" data-act="testwa">' + ic('send', 'ic-s') + 'Send test WA</button></div><div data-dev class="mt-s"></div></div>' +
      '<div class="card form-stack"><div class="card-h"><h4>' + ic('mail', 'ic-s') + ' Email</h4>' + switchHtml('emailAktif', c.emailAktif) + '</div>' +
      '<div class="field"><label class="label">Sender name</label><input class="input" name="namaPengirim" value="' + esc(c.namaPengirim) + '" placeholder="LO Finding"></div>' +
      '<div class="field"><label class="label">App link for {link}</label><input class="input" name="appUrl" value="' + esc(c.appUrl) + '" placeholder="https://your-school.github.io/lo-finding/"></div>' +
      '<div class="kv-list"><dt>Email quota left</dt><dd>' + c.emailSisa + ' today</dd><dt>Background sender</dt><dd>' + (c.trigger ? '<span class="pill ok">Active (1 min)</span>' : '<span class="pill bad">Not installed — run setupV2()</span>') + '</dd></div>' +
      '<button class="btn btn-outline btn-sm mt" data-act="testmail">' + ic('mail', 'ic-s') + 'Send test email to me</button></div></div>' +
      '<div class="card mt"><div class="card-h"><h4>' + ic('bell', 'ic-s') + ' Which events send a notification</h4><span class="small muted">Main switches above override this table.</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Event</th><th style="text-align:center">WhatsApp</th><th style="text-align:center">Email</th><th>Template</th></tr></thead><tbody>' +
      c.matriks.map((m, i) => '<tr><td class="bold">' + esc(EV_LABEL[m.kode] || m.label) + '</td><td style="text-align:center">' + switchHtml('mw' + i, m.wa) + '</td><td style="text-align:center">' + switchHtml('me' + i, m.email) + '</td><td class="small" style="min-width:220px"><span class="muted">' + esc(String(m.pesan).slice(0, 90)) + '…</span> <button class="btn btn-ghost btn-sm" data-act="tpl" data-i="' + i + '">' + ic('pencil', 'ic-s') + 'Edit</button></td></tr>').join('') + '</tbody></table></div></div>' +
      '<div class="sticky-bar mt"><span class="small muted">Changes apply immediately after saving.</span><button class="btn btn-primary" data-act="savecfg">' + ic('check') + 'Save configuration</button></div>';
  },
  collectConfig(b) {
    const v = (n) => $('[name=' + n + ']', b), c = this.cfg;
    c.matriks.forEach((m, i) => { m.wa = v('mw' + i).checked; m.email = v('me' + i).checked; });
    return { waAktif: v('waAktif').checked, emailAktif: v('emailAktif').checked, token: v('token').value.trim(), batchDefault: +v('batchDefault').value, jeda: v('jeda').value.trim(), deteksiOtomatis: v('deteksiOtomatis').checked, namaPengirim: v('namaPengirim').value.trim(), appUrl: v('appUrl').value.trim(), matriks: c.matriks };
  },
  acts: {
    tab(btn, e, el) { this.tab = btn.dataset.t; this.qBlast = null; this.show(el); },
    clearpreset(btn, e, el) { this.preset = null; this.show(el); },
    reloadbl(btn, e, el) { this.loadBlasts(el, true); },
    async aud(btn, e, el) {
      const f = $('[data-bl]', el); if (btn) btnBusy(btn, true, 'Loading');
      const r = await api('wa.audience', this.audFilter(f)); if (btn) btnBusy(btn, false);
      if (!r.success) return toast(r.message, 'err');
      this.aud = r.data; this.drawAud(f);
    },
    async cekwa(btn, e, el) {
      const f = $('[data-bl]', el), nums = [...new Set(this.aud.rows.filter(x => x.valid && !x.statusWA).map(x => x.hp))];
      let done = 0; btnBusy(btn, true, 'Checking 0/' + nums.length);
      for (let i = 0; i < nums.length; i += 50) {
        const r = await api('wa.validate', { nomor: nums.slice(i, i + 50) });
        if (!r.success) { btnBusy(btn, false); return toast(r.message, 'err'); }
        this.aud.rows.forEach(x => { if (r.data.peta[x.hp]) x.statusWA = r.data.peta[x.hp]; });
        done = Math.min(nums.length, i + 50); btn.querySelector('span') && (btn.querySelector('span').textContent = 'Checking ' + done + '/' + nums.length);
      }
      btnBusy(btn, false); this.aud.ringkas.terdaftarWA = this.aud.rows.filter(x => x.statusWA === 'Terdaftar').length; this.drawAud(f); toast(done + ' number(s) checked.');
    },
    async buat(btn, e, el) {
      const f = $('[data-bl]', el), list = this.recipients(f), n = +$('[data-batch] .on', f).dataset.n;
      const judul = $('[name=judul]', f).value.trim(), pesan = $('[name=pesan]', f).value.trim();
      if (!judul || !pesan) return toast('Title and message are required.', 'warn');
      if (!(await confirmBox('Send to ' + list.length + ' recipient(s)?', 'They will be sent in ' + Math.ceil(list.length / n) + ' batch(es) of ' + n + ', one batch per minute. You can stop at any time.', 'Create blast'))) return;
      btnBusy(btn, true, 'Creating');
      const r = await api('wa.blastCreate', { judul, pesan, ukuranBatch: n, jeda: $('[name=jeda]', f).value.trim(), sasaran: JSON.stringify(this.audFilter(f)).slice(0, 200), penerima: list.map(x => ({ hp: x.hp, nama: x.nama })) });
      btnBusy(btn, false);
      if (!r.success) return toast(r.message, 'err');
      toast(r.message); $('[name=judul]', f).value = ''; $('[name=pesan]', f).value = ''; this.aud = null; this.preset = null; this.drawAud(f);
      const p = await api('wa.blastProcess', { blastId: r.data.blast_id });
      if (p.success && p.data.blast) toast('First batch: ' + p.data.blast.terkirim + ' sent.');
      this.loadBlasts(el, true);
    },
    async next(btn, e, el) {
      btnBusy(btn, true, 'Sending'); const r = await api('wa.blastProcess', { blastId: btn.dataset.id }); btnBusy(btn, false);
      if (!r.success) return toast(r.message, 'err');
      toast((r.data.proses.dikirim || 0) + ' sent' + (r.data.proses.info ? ' — ' + r.data.proses.info : '') + '.'); this.loadBlasts(el, true);
    },
    async stop(btn, e, el) {
      if (!(await confirmBox('Stop this blast?', 'Messages not yet sent will be cancelled. Already-sent messages are not affected.', 'Stop blast', true))) return;
      const r = await api('wa.blastStop', { blastId: btn.dataset.id }); if (!r.success) return toast(r.message, 'err');
      toast(r.message); this.loadBlasts(el, true);
    },
    bq(btn, e, el) { this.qBlast = btn.dataset.id; this.qf = {}; this.tab = 'antrean'; $$('.tabs [data-t]', el).forEach(b => b.classList.toggle('on', b.dataset.t === 'antrean')); this.drawQueue(el, $('[data-body]', el)); },
    qall(btn, e, el) { this.qBlast = null; this.loadQueue(el); },
    reloadq(btn, e, el) { this.loadQueue(el); },
    async proses(btn, e, el) { btnBusy(btn, true, 'Sending'); const r = await api('notif.processNow', {}); btnBusy(btn, false); toast(r.message, r.success ? 'ok' : 'err'); this.loadQueue(el); },
    async retry(btn, e, el) { const r = await api('notif.retry', {}); toast(r.message, r.success ? 'ok' : 'err'); this.loadQueue(el); },
    async savecfg(btn, e, el) {
      const b = $('[data-body]', el), d = this.collectConfig(b);
      btnBusy(btn, true, 'Saving'); const r = await api('notif.configSave', d); btnBusy(btn, false);
      if (!r.success) return toast(r.message, 'err');
      cacheSet('a:notifcfg', r.data); this.renderConfig(el, b, r.data); toast('Configuration saved.');
    },
    async deltoken(btn, e, el) {
      e.preventDefault();
      if (!(await confirmBox('Remove the Fonnte token?', 'WhatsApp sending will stop until a new token is saved.', 'Remove', true))) return;
      const d = this.collectConfig($('[data-body]', el)); d.token = '__HAPUS__'; d.waAktif = false;
      const r = await api('notif.configSave', d); if (!r.success) return toast(r.message, 'err');
      cacheSet('a:notifcfg', r.data); this.renderConfig(el, $('[data-body]', el), r.data); toast('Token removed.');
    },
    async device(btn, e, el) {
      btnBusy(btn, true); const r = await api('wa.device', {}); btnBusy(btn, false); const box = $('[data-dev]', el);
      box.innerHTML = r.success ? '<dl class="kv-list"><dt>Number</dt><dd>' + esc(r.data.nomor) + '</dd><dt>Status</dt><dd>' + (r.data.status === 'connect' ? '<span class="pill ok">Connected</span>' : '<span class="pill bad">' + esc(r.data.status) + '</span>') + '</dd><dt>Package</dt><dd>' + esc(r.data.paket) + '</dd><dt>Quota</dt><dd>' + esc(r.data.kuota) + '</dd><dt>Expires</dt><dd>' + esc(r.data.kedaluwarsa) + '</dd></dl>' : '<div class="alert err">' + ic('circle-alert') + '<div>' + esc(r.message) + '</div></div>';
    },
    async testwa(btn) { const n = await promptBox('Send test WhatsApp', 'WhatsApp number', { placeholder: '0812…', required: true, ok: 'Send' }); if (!n) return; btnBusy(btn, true); const r = await api('wa.test', { nomor: n }); btnBusy(btn, false); toast(r.message, r.success ? 'ok' : 'err'); },
    async testmail(btn) { btnBusy(btn, true); const r = await api('email.test', {}); btnBusy(btn, false); toast(r.message, r.success ? 'ok' : 'err'); },
    tpl(btn, e, el) {
      const m0 = this.cfg.matriks[+btn.dataset.i];
      const m = modal('Template — ' + (EV_LABEL[m0.kode] || m0.label), '<div class="field"><label class="label">Email subject</label><input class="input" name="subjek" value="' + esc(m0.subjek) + '"></div><div class="field"><label class="label">Message (WhatsApp & email)</label><textarea class="textarea" name="pesan" rows="7">' + esc(m0.pesan) + '</textarea><div class="help">Placeholders: {nama} {app} {sekolah} {link} {judul} {status} {catatan}</div></div>',
        '<button class="btn btn-ghost" data-reset>Restore default</button><div class="spacer" style="flex:1"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Apply</button>', { wide: true });
      $('[data-reset]', m.el).onclick = () => { $('[name=subjek]', m.el).value = m0.subjekDefault || m0.subjek; $('[name=pesan]', m.el).value = m0.pesanDefault || m0.pesan; };
      $('[data-ok]', m.el).onclick = () => { m0.subjek = $('[name=subjek]', m.el).value.trim(); m0.pesan = $('[name=pesan]', m.el).value.trim(); m.close(); toast('Applied — press "Save configuration" to keep it.', 'info'); };
    }
  }
});

// =========================================================
// CRM KONTAK
// =========================================================
const CRM_FILTERS = [{ v: 'waValid', l: 'On WhatsApp' }, { v: 'belumCek', l: 'WA not checked' }, { v: 'emailValid', l: 'Valid email' }, { v: 'optout', l: 'Opted out' }, { v: 'duplikat', l: 'Possible duplicates' }, { v: 'tidakBisa', l: 'Unreachable' }];
registerPage('a-crm', {
  layout: 'admin', auth: 'admin', title: 'CRM Contacts', nav: 'a-crm',
  template() {
    return '<div class="page-h"><div><h2>CRM Contacts</h2><div class="sub" data-sync>Teachers and admins are synced automatically. Name · Email · WhatsApp in one place.</div></div><div class="tool-row"><button class="btn btn-outline" data-act="sync">' + ic('refresh-cw') + '<span>Sync<span class="hide-xs"> now</span></span></button><button class="btn btn-outline" data-act="imp">' + ic('upload') + 'Import CSV</button><button class="btn btn-outline" data-act="dup">' + ic('merge') + 'Duplicates</button>' + (isSA() ? '<button class="btn btn-outline" data-act="exp">' + ic('download') + 'Export</button>' : '') + '</div></div>' +
      '<div data-kpi class="grid grid-kpi kpi-sm">' + '<div class="card sk sk-card"></div>'.repeat(6) + '</div>' +
      '<div class="filterbar mt"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search name, email, number, tag"></div><select class="select" data-f="segmen"><option value="">All segments</option></select><select class="select" data-f="filter">' + optionList(CRM_FILTERS, '', 'All contacts') + '</select><select class="select" data-f="tag"><option value="">All tags</option></select></div>' +
      '<label class="check crm-mob-only mt-s"><input type="checkbox" data-ckall> Select all on this page</label><div class="summary-bar bulk-bar" data-bulk hidden><b data-seln>0</b> selected <button class="btn btn-ghost btn-sm" data-act="bulk" data-a="tag">' + ic('tag', 'ic-s') + 'Add tag</button><button class="btn btn-ghost btn-sm" data-act="bulk" data-a="untag">Remove tag</button><button class="btn btn-ghost btn-sm" data-act="bulk" data-a="optout">' + ic('ban', 'ic-s') + 'Opt out</button><button class="btn btn-ghost btn-sm" data-act="bulk" data-a="optin">Opt in</button><button class="btn btn-ghost btn-sm" data-act="bulkcek">' + ic('scan-search', 'ic-s') + 'Check WA</button><button class="btn btn-success btn-sm" data-act="bulkblast">' + ic('send', 'ic-s') + 'Blast to selected</button></div>' +
      '<div data-list class="mt-s">' + skeletonRows(8) + '</div>';
  },
  mount(el) {
    this.page = 1; this.sel = new Set(); this.f = {};
    $('[data-q]', el).addEventListener('input', debounce(() => { this.page = 1; this.load(el); }, 300));
    $$('[data-f]', el).forEach(s => s.addEventListener('change', () => { this.page = 1; this.load(el); }));
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-ck]')) { e.target.checked ? this.sel.add(e.target.dataset.ck) : this.sel.delete(e.target.dataset.ck); this.drawBulk(el); }
      if (e.target.matches('[data-ckall]')) { $$('[data-ck]', el).forEach(c => { c.checked = e.target.checked; e.target.checked ? this.sel.add(c.dataset.ck) : this.sel.delete(c.dataset.ck); }); this.drawBulk(el); }
    });
  },
  show(el) { admTitle('CRM Contacts'); this.loadStats(el); this.load(el); },
  query(el) { const q = { cari: $('[data-q]', el).value.trim(), halaman: this.page, per: 50 }; $$('[data-f]', el).forEach(s => { if (s.value) q[s.dataset.f] = s.value; }); return q; },
  loadStats(el, force) {
    swr('a:crmstats', 'crm.stats', force ? { _fresh: 1 } : {}, (s) => {
      $('[data-kpi]', el).innerHTML = kpiCard('book-user', s.total, 'Contacts') + kpiCard('message-circle', s.terdaftarWA, 'On WhatsApp', 'waValid') + kpiCard('scan-search', s.belumCek, 'WA not checked', 'belumCek') + kpiCard('mail', s.emailValid, 'Valid email', 'emailValid') + kpiCard('ban', s.optout, 'Opted out', 'optout') + kpiCard('merge', s.duplikat, 'Possible duplicates', 'duplikat');
      const seg = $('[data-f=segmen]', el), cur = seg.value; seg.innerHTML = optionList(Object.keys(s.segmen || {}).map(k => ({ v: k, l: k + ' (' + s.segmen[k] + ')' })), cur, 'All segments');
      $('[data-sync]', el).textContent = 'Teachers and admins sync automatically' + (s.sync ? ' · last sync ' + fmtRel(s.sync) : '') + '.';
    }, { fresh: force ? 0 : 30000, force: !!force });
  },
  async load(el) {
    const q = this.query(el), key = 'a:crm:' + hashStr(JSON.stringify(q)), box = $('[data-list]', el);
    const draw = (d) => {
      this.d = d;
      const tag = $('[data-f=tag]', el), cur = tag.value; tag.innerHTML = optionList(d.tags || [], cur, 'All tags');
      const pg = { page: d.halaman, pages: Math.max(1, Math.ceil(d.total / d.per)), total: d.total, from: d.total ? (d.halaman - 1) * d.per + 1 : 0, to: Math.min(d.halaman * d.per, d.total) };
      box.innerHTML = d.total ? '<div class="tbl-wrap crm-desk"><table class="tbl"><thead><tr><th><input type="checkbox" data-ckall aria-label="Select all"></th><th>Name</th><th>WhatsApp</th><th>Email</th><th>Segment</th><th>Tags</th><th>Msgs</th><th>Last contact</th><th></th></tr></thead><tbody>' +
        d.rows.map(k => '<tr' + (k.optOut ? ' class="flag"' : '') + '><td><input type="checkbox" data-ck="' + esc(k.id) + '"' + (this.sel.has(k.id) ? ' checked' : '') + ' aria-label="Select"></td><td><div class="bold">' + esc(k.nama || '—') + (k.duplikat ? ' <span class="pill wait" title="Same number or email as another contact">dup</span>' : '') + '</div><div class="tiny muted">' + esc((k.info && (k.info.unit || k.info.peran)) || k.sumber) + '</div></td>' +
          '<td><div class="mono small">' + esc(k.wa || '—') + '</div>' + waPill(k) + '</td><td class="small">' + esc(k.email || '—') + '</td><td><span class="pill">' + esc(k.segmen) + '</span></td><td class="small">' + esc(k.tag || '') + (k.optOut ? ' <span class="pill bad">opt-out</span>' : '') + '</td><td>' + k.jumlah + '</td><td class="small">' + (k.terakhir ? fmtRel(k.terakhir) : '—') + '</td>' +
          '<td class="actions"><button class="btn btn-ghost btn-sm" data-act="det" data-id="' + esc(k.id) + '">' + ic('contact', 'ic-s') + 'Open</button></td></tr>').join('') + '</tbody></table></div>' +
        '<div class="crm-mob">' + d.rows.map(k => '<div class="crm-card' + (k.optOut ? ' flag' : '') + '"><input type="checkbox" data-ck="' + esc(k.id) + '"' + (this.sel.has(k.id) ? ' checked' : '') + ' aria-label="Select ' + esc(k.nama) + '"><button class="crm-main" data-act="det" data-id="' + esc(k.id) + '"><span class="row between gap-s"><b class="ellipsis">' + esc(k.nama || '—') + '</b><span class="pill">' + esc(k.segmen) + '</span></span>' +
          '<span class="row wrap gap-s small">' + (k.wa ? '<span class="mono">' + esc(k.wa) + '</span>' + waPill(k) : '<span class="muted">No WhatsApp number</span>') + (k.duplikat ? '<span class="pill wait">dup</span>' : '') + (k.optOut ? '<span class="pill bad">opt-out</span>' : '') + '</span>' +
          '<span class="tiny muted ellipsis">' + esc(k.email || 'No email') + (k.tag ? ' · ' + esc(k.tag) : '') + ' · ' + k.jumlah + ' msg</span></button></div>').join('') + '</div>' + pagerHtml(pg)
        : '<div class="card">' + emptyState('folder', 'No contacts match', 'Try another filter, or press "Sync now" to pull teachers and admins.') + '</div>';
    };
    const c = cacheGet(key); if (c) draw(c); else if (!this.d) box.innerHTML = skeletonRows(8);
    const r = await api('crm.list', q);
    if (r.success) { if (JSON.stringify(this.query(el)) !== JSON.stringify(q)) return; cacheSet(key, r.data); if (!c || hashStr(JSON.stringify(c)) !== hashStr(JSON.stringify(r.data))) draw(r.data); }
    else if (!c) box.innerHTML = errorBox(r, 'retry');
  },
  drawBulk(el) { $('[data-bulk]', el).hidden = !this.sel.size; $('[data-seln]', el).textContent = this.sel.size; },
  refresh(el) { Object.keys(localStorage).filter(k => k.indexOf('a:crm:') > -1).forEach(k => localStorage.removeItem(k)); this.loadStats(el, true); this.load(el); },
  async detail(el, id) {
    const d = drawer('Contact', skeletonRows(6), { wide: true });
    const r = await api('crm.detail', { kontakId: id }); if (!r.success) { $('.drawer-b', d.el).innerHTML = errorBox(r); return; }
    const k = r.data.kontak, tl = r.data.timeline, edit = k.sumber === 'manual' || k.sumber === 'guru' || k.sumber === 'admin';
    $('.drawer-b', d.el).classList.add('form-stack'); $('.drawer-b', d.el).innerHTML = '<div class="row" style="gap:12px"><span class="avatar" style="width:48px;height:48px;font-size:17px">' + esc(initials(k.nama)) + '</span><div><div class="bold">' + esc(k.nama) + '</div><div class="small muted">' + esc(k.segmen) + ' · source: ' + esc(k.sumber) + '</div></div></div>' +
      '<div class="grid grid-2"><div class="field"><label class="label">Name</label><input class="input" name="nama" value="' + esc(k.nama) + '"' + (edit ? '' : ' readonly') + '></div><div class="field"><label class="label">WhatsApp</label><input class="input mono" name="wa" value="' + esc(k.wa) + '" placeholder="08…"' + (edit ? '' : ' readonly') + '><div class="help">' + waPill(k) + (k.cekWA ? ' checked ' + fmtRel(k.cekWA) : '') + '</div></div></div>' +
      '<div class="field"><label class="label">Email</label><input class="input" name="email" value="' + esc(k.email) + '"' + (edit ? '' : ' readonly') + '></div>' +
      (k.sumber === 'guru' || k.sumber === 'admin' ? '<p class="tiny muted">Name, email and number are written back to the ' + (k.sumber === 'guru' ? 'Teachers' : 'Admin accounts') + ' list.</p>' : '') +
      '<div class="field"><label class="label">Tags (comma separated)</label><input class="input" name="tag" value="' + esc(k.tag) + '"></div><div class="field"><label class="label">Notes</label><textarea class="textarea" name="catatan" rows="3">' + esc(k.catatan) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" name="optOut"' + (k.optOut ? ' checked' : '') + '> Opted out of blasts (transactional notifications still sent)</label>' +
      '<div class="row gap-s mt"><button class="btn btn-primary" data-save>' + ic('check') + 'Save</button>' + (k.wa && k.waValid ? '<button class="btn btn-outline" data-cek>' + ic('scan-search') + 'Check WA</button>' : '') + '</div>' +
      '<div class="divider"></div><div class="row between"><h4>Timeline</h4><button class="btn btn-ghost btn-sm" data-int>' + ic('plus', 'ic-s') + 'Log interaction</button></div>' +
      '<div class="col gap-s mt-s">' + (tl.length ? tl.map(t => '<div class="row" style="gap:10px;align-items:flex-start"><span class="ki" style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);flex:none">' + ic(t.kanal === 'WhatsApp' ? 'message-circle' : t.kanal === 'Email' ? 'mail' : t.kanal === 'Telepon' ? 'phone' : 'contact', 'ic-s') + '</span><div class="grow">' + (t.event ? '<div class="tiny bold">' + esc(EV_LABEL[t.event] || t.event) + '</div>' : '') + '<div class="small">' + esc(t.ringkasan) + '</div><div class="tiny muted">' + esc(t.kanal) + ' · ' + esc({ Keluar: 'Outgoing', Masuk: 'Incoming' }[t.arah] || t.arah || '') + ' · ' + fmtDate(t.waktu, true) + (t.oleh ? ' · ' + esc(Q_STATUS[t.oleh] ? Q_STATUS[t.oleh][1] : t.oleh) : '') + '</div></div></div>').join('') : '<p class="small muted">No messages or interactions yet.</p>') + '</div>';
    const val = (n) => $('[name=' + n + ']', d.el);
    $('[data-save]', d.el).onclick = async (e) => {
      const kontak = { id: k.id, tag: val('tag').value, catatan: val('catatan').value, optOut: val('optOut').checked };
      if (edit) Object.assign(kontak, { nama: val('nama').value.trim(), email: val('email').value.trim(), wa: val('wa').value.trim() });
      btnBusy(e.currentTarget, true, 'Saving'); const s = await api('crm.save', { kontak }); btnBusy(e.currentTarget, false);
      if (!s.success) return toast(s.message, 'err'); toast('Saved.'); d.close(); this.refresh(el);
    };
    const cek = $('[data-cek]', d.el); if (cek) cek.onclick = async () => { btnBusy(cek, true); const s = await api('wa.validate', { nomor: [k.wa] }); btnBusy(cek, false); if (!s.success) return toast(s.message, 'err'); toast(k.wa + ': ' + (WA_STATUS[s.data.peta[k.wa]] || ['', 'unknown'])[1]); d.close(); this.detail(el, id); this.refresh(el); };
    $('[data-int]', d.el).onclick = () => {
      const m = modal('Log interaction', '<div class="grid grid-2"><div class="field"><label class="label">Channel</label><select class="select" name="kanal">' + optionList(['Telepon', 'WhatsApp', 'Email', 'Tatap muka', 'Lainnya'].map(x => ({ v: x, l: { Telepon: 'Phone', 'Tatap muka': 'In person', Lainnya: 'Other' }[x] || x }))) + '</select></div><div class="field"><label class="label">Direction</label><select class="select" name="arah">' + optionList([{ v: 'Keluar', l: 'Outgoing' }, { v: 'Masuk', l: 'Incoming' }]) + '</select></div></div><div class="field"><label class="label req">Summary</label><textarea class="textarea" name="ringkasan" rows="3"></textarea></div>',
        '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok>Save</button>');
      $('[data-ok]', m.el).onclick = async (e) => {
        const ring = $('[name=ringkasan]', m.el).value.trim(); if (!ring) return toast('Summary is required.', 'warn');
        btnBusy(e.currentTarget, true); const s = await api('crm.interaksi', { kontakId: k.id, kanal: $('[name=kanal]', m.el).value, arah: $('[name=arah]', m.el).value, ringkasan: ring }); btnBusy(e.currentTarget, false);
        if (!s.success) return toast(s.message, 'err'); m.close(); d.close(); this.detail(el, id);
      };
    };
  },
  acts: {
    retry(b, e, el) { this.load(el); }, pg(b, e, el) { this.page = +b.dataset.p; this.load(el); },
    kf(b, e, el) { $('[data-f=filter]', el).value = b.dataset.k; this.page = 1; this.load(el); },
    det(b, e, el) { this.detail(el, b.dataset.id); },
    async sync(b, e, el) { btnBusy(b, true, 'Syncing'); const r = await api('crm.sync', {}); btnBusy(b, false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) this.refresh(el); },
    async bulk(b, e, el) {
      const a = b.dataset.a; let nilai = '';
      if (a === 'tag' || a === 'untag') { nilai = await promptBox(a === 'tag' ? 'Add tag' : 'Remove tag', 'Tag', { required: true, placeholder: 'e.g. Workshop 2026' }); if (!nilai) return; }
      const r = await api('crm.bulk', { ids: [...this.sel], aksi: a, nilai }); if (!r.success) return toast(r.message, 'err');
      toast(r.message); this.sel.clear(); this.drawBulk(el); this.refresh(el);
    },
    async bulkcek(b, e, el) {
      const nums = [...new Set((this.d.rows || []).filter(k => this.sel.has(k.id) && k.waValid).map(k => k.wa))];
      if (!nums.length) return toast('No valid numbers in the selection.', 'warn');
      btnBusy(b, true, 'Checking');
      for (let i = 0; i < nums.length; i += 50) { const r = await api('wa.validate', { nomor: nums.slice(i, i + 50) }); if (!r.success) { btnBusy(b, false); return toast(r.message, 'err'); } }
      btnBusy(b, false); toast(nums.length + ' number(s) checked.'); this.refresh(el);
    },
    bulkblast(b, e, el) { AppState.blastPreset = [...this.sel]; go('a-wa', 'blast'); },
    async exp(b) {
      btnBusy(b, true); const r = await api('crm.export', {}); btnBusy(b, false); if (!r.success) return toast(r.message, 'err');
      exportXlsx('crm-contacts-' + new Date().toISOString().slice(0, 10), ['Name', 'WhatsApp', 'WA status', 'Email', 'Segment', 'Source', 'Tags', 'Opt-out', 'Messages', 'Last contact', 'Notes'],
        r.data.map(k => [k.nama, k.wa, k.statusWA || '', k.email, k.segmen, k.sumber, k.tag, k.optOut ? 'Yes' : '', k.jumlah, k.terakhir ? fmtDate(k.terakhir, true) : '', k.catatan]));
    },
    imp(b, e, el) {
      const m = modal('Import contacts (CSV / Excel)', '<p class="small muted">Columns: <b>Name</b>, <b>WhatsApp</b> and/or <b>Email</b>, optional Segment and Tag. Numbers may start with 08, 8, 62 or +62. Existing numbers/emails are skipped.</p><div class="drop mt" data-drop tabindex="0"><div class="ic-circle">' + ic('upload') + '</div><b>Choose a CSV or Excel file</b><input type="file" accept=".csv,.xlsx,.xls" hidden data-file></div><div class="row mt"><button class="btn btn-ghost btn-sm" data-tpl>' + ic('download', 'ic-s') + 'Download template</button></div><div data-prev class="mt"></div>',
        '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-ok disabled>Import</button>', { wide: true });
      let rows = [];
      $('[data-tpl]', m.el).onclick = () => exportXlsx('crm-template', ['Name', 'WhatsApp', 'Email', 'Segment', 'Tag'], [['Guest Speaker', '081234567890', 'guest@mail.com', 'Workshop', 'Speaker']]);
      const inp = $('[data-file]', m.el); $('[data-drop]', m.el).onclick = () => inp.click();
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try { await loadXLSX(); } catch (err) { return toast('Could not load the Excel library.', 'err'); }
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', raw: false }), arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
        const h = (arr[0] || []).map(x => String(x).toLowerCase()), idx = (re) => h.findIndex(x => re.test(x));
        const I = { nama: idx(/name|nama/), wa: idx(/whats|wa\b|hp|phone|telp|no/), email: idx(/mail/), segmen: idx(/segment|segmen/), tag: idx(/tag/) };
        rows = arr.slice(1).filter(r => r.some(String)).map(r => { const o = {}; Object.keys(I).forEach(k => o[k] = I[k] > -1 ? String(r[I[k]]).trim() : ''); return o; });
        $('[data-prev]', m.el).innerHTML = '<div class="tbl-wrap" style="max-height:280px;overflow:auto"><table class="tbl"><thead><tr><th>Name</th><th>WhatsApp</th><th>Email</th><th>Segment</th><th>Tag</th></tr></thead><tbody>' + rows.slice(0, 100).map(r => '<tr><td>' + esc(r.nama) + '</td><td class="mono">' + esc(r.wa) + '</td><td>' + esc(r.email) + '</td><td>' + esc(r.segmen) + '</td><td>' + esc(r.tag) + '</td></tr>').join('') + '</tbody></table></div><div class="summary-bar mt">' + rows.length + ' rows read — duplicates and invalid rows are skipped on the server.</div>';
        const ok = $('[data-ok]', m.el); ok.disabled = !rows.length; ok.textContent = 'Import ' + rows.length + ' rows';
      };
      $('[data-ok]', m.el).onclick = async (ev) => { btnBusy(ev.currentTarget, true, 'Importing'); const r = await api('crm.import', { rows }); btnBusy(ev.currentTarget, false); if (!r.success) return toast(r.message, 'err'); toast(r.message); m.close(); this.refresh(el); };
    },
    async dup(b, e, el) {
      const d = drawer('Possible duplicates', skeletonRows(5), { wide: true });
      const r = await api('crm.duplikat', {}); if (!r.success) { $('.drawer-b', d.el).innerHTML = errorBox(r); return; }
      $('.drawer-b', d.el).innerHTML = r.data.length ? '<p class="small muted mb">Contacts sharing the same number or email. Choose the one to keep, then merge — tags, notes and message counts are combined.</p>' + r.data.map((g, gi) => '<div class="card mb" data-g="' + gi + '"><div class="small bold mb-s">' + esc(g.kunci.replace(':', ': ')) + '</div>' + g.kontak.map((k, i) => '<label class="check" style="display:flex;gap:8px"><input type="radio" name="u' + gi + '" value="' + esc(k.id) + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(k.nama) + '</b> <span class="tiny muted">' + esc(k.segmen) + ' · ' + esc(k.sumber) + ' · ' + esc(k.wa || k.email) + '</span></span></label>').join('') + '<button class="btn btn-outline btn-sm mt-s" data-merge="' + gi + '">' + ic('merge', 'ic-s') + 'Merge into selected</button></div>').join('')
        : emptyState('check', 'No duplicates', 'Every number and email is unique.');
      d.el.addEventListener('click', async (ev) => {
        const mb = ev.target.closest('[data-merge]'); if (!mb) return;
        const g = r.data[+mb.dataset.merge], utama = $('input[name=u' + mb.dataset.merge + ']:checked', d.el).value;
        btnBusy(mb, true); const s = await api('crm.merge', { utama, gabung: g.kontak.map(k => k.id).filter(x => x !== utama) }); btnBusy(mb, false);
        if (!s.success) return toast(s.message, 'err'); toast(s.message); mb.closest('.card').remove(); this.refresh(el);
      });
    }
  }
});

// =========================================================
// MIGRASI DATA (superadmin)
// =========================================================
const MIG_SHEETS = [['Guru_Terdaftar', 'Teachers', 1], ['Pengaturan', 'Settings', 1], ['Sumber_Dokumen', 'Source documents', 1], ['Bank_LO', 'LO Bank', 1], ['Peta_Topik_LO', 'Topic map', 1], ['Bank_Soal', 'Question bank', 1], ['Pencarian', 'Searches (history)', 1], ['Hasil_LO', 'Search results', 1], ['CRM_Kontak', 'CRM contacts', 1], ['CRM_Interaksi', 'CRM interactions', 1], ['BlastWA', 'Blast history', 0], ['Log_AI', 'AI log', 0], ['Log_Aktivitas', 'Activity log', 0]];
registerPage('a-migrasi', {
  layout: 'admin', auth: 'sa', title: 'Data Migration', nav: 'a-migrasi',
  template() {
    return '<div class="page-h"><div><h2>Import Data from the Old App</h2><div class="sub">The old spreadsheet is only read — nothing in the old app is changed. Safe to run more than once.</div></div></div>' +
      '<div class="grid grid-2" style="align-items:start"><div class="card form-stack"><div class="field"><label class="label req">Old spreadsheet URL or ID</label><input class="input" data-src placeholder="https://docs.google.com/spreadsheets/d/…/edit"><div class="help">Must belong to the same Google account that runs this app, so Drive file links keep working.</div></div>' +
      '<label class="label">Data to import</label><div class="grid grid-2 gap-s">' + MIG_SHEETS.map(s => '<label class="check"><input type="checkbox" data-sh="' + s[0] + '"' + (s[2] ? ' checked' : '') + '> ' + esc(s[1]) + '</label>').join('') + '</div>' +
      '<label class="check mt"><input type="checkbox" data-ow> Overwrite fields of records that already exist here (default: keep this app\'s data)</label>' +
      '<div class="row wrap gap-s mt"><button class="btn btn-outline" data-act="scan">' + ic('scan-search') + 'Scan (dry run)</button><button class="btn btn-primary" data-act="run" disabled>' + ic('database') + 'Run import</button></div></div>' +
      '<div class="card"><h4>How to switch over</h4><ol class="small" style="padding-left:18px;line-height:1.8"><li>Press <b>Scan</b> — nothing is written; you see what would be added.</li><li>Press <b>Run import</b>, then check teachers, LO Bank and history here.</li><li>Just before announcing the new address, run the import <b>once more</b> to catch data added to the old app meanwhile (only new rows are added).</li><li>Announce the new link (e.g. with a WhatsApp blast). Keep the old deployment archived.</li></ol><p class="tiny muted">Admin accounts and sign-in sessions are never imported — everyone signs in once on the new app.</p></div></div>' +
      '<div data-rep class="mt"></div>';
  },
  show() { admTitle('Data Migration'); },
  payload(el, dry) { return { source: $('[data-src]', el).value.trim(), sheets: $$('[data-sh]', el).filter(c => c.checked).map(c => c.dataset.sh), overwrite: $('[data-ow]', el).checked, dryRun: dry }; },
  report(el, d) {
    const rows = Object.keys(d.report), lbl = Object.fromEntries(MIG_SHEETS.map(s => [s[0], s[1]]));
    const tot = rows.reduce((a, k) => { a.i += d.report[k].inserted || 0; a.u += d.report[k].updated || 0; return a; }, { i: 0, u: 0 });
    $('[data-rep]', el).innerHTML = '<div class="card"><div class="card-h"><h4>' + (d.dryRun ? ic('scan-search', 'ic-s') + ' Scan result (nothing written)' : ic('circle-check', 'ic-s') + ' Import finished') + '</h4><span class="small muted">' + esc(d.source.name) + '</span></div>' +
      '<div class="summary-bar mb">' + tot.i + ' row(s) ' + (d.dryRun ? 'would be' : '') + ' added · ' + tot.u + ' ' + (d.dryRun ? 'would be' : '') + ' updated</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>In old app</th><th>Added</th><th>Updated</th><th>Skipped</th></tr></thead><tbody>' + rows.map(k => { const x = d.report[k]; return '<tr><td class="bold">' + esc(lbl[k] || k) + (x.catatan ? '<div class="tiny muted">' + esc(x.catatan) + '</div>' : '') + '</td><td>' + (x.source ?? '—') + '</td><td>' + (x.inserted ? '<span class="pill ok">' + x.inserted + '</span>' : '0') + '</td><td>' + (x.updated || 0) + '</td><td>' + (x.skipped || 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (d.warnings.length ? '<div class="alert warn mt">' + ic('triangle-alert') + '<div><b>Notes</b><ul class="small" style="margin:6px 0 0 16px">' + d.warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div>' : '') + '</div>';
  },
  acts: {
    async scan(b, e, el) {
      const p = this.payload(el, true); if (!p.source) return toast('Paste the old spreadsheet URL or ID.', 'warn');
      btnBusy(b, true, 'Scanning'); const r = await api('migrasi.import', p, { tries: 1 }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      this.report(el, r.data); this.scanned = JSON.stringify(Object.assign({}, p, { dryRun: 0 })); $('[data-act=run]', el).disabled = false;
    },
    async run(b, e, el) {
      const p = this.payload(el, false);
      if (this.scanned !== JSON.stringify(Object.assign({}, p, { dryRun: 0 }))) { $('[data-act=run]', el).disabled = true; return toast('Settings changed — press Scan again first.', 'warn'); }
      if (!(await confirmBox('Run the import now?', 'Data is added to this app. Existing records are ' + (p.overwrite ? 'updated with the old values.' : 'kept as they are.') + ' You can run it again safely.', 'Run import'))) return;
      btnBusy(b, true, 'Importing'); const r = await api('migrasi.import', p, { tries: 1, reqId: 'mig-' + Date.now() }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      this.report(el, r.data); toast('Import finished.');
      ['a:guru', 'a:bank:lo', 'a:dok', 'a:dash', 'a:crmstats'].forEach(cacheDel); adminBoot(true);
    }
  }
});

window.ADMIN_EXT_READY = true;
