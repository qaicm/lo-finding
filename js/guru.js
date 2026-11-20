/* =========================================================
   LO Finding — guru.js : Portal Guru
   Cari LO · Hasil · Unggah Sumber · Dokumen Saya · Tinjau Ekstraksi · Riwayat
   ========================================================= */
'use strict';

const DEFAULT_STAGES = {
  'Checkpoint': ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6', 'Stage 7', 'Stage 8', 'Stage 9'],
  'IGCSE': ['Year 10', 'Year 11'], 'AS & A Level': ['AS Level', 'A Level']
};
const DI = { rows: ['Content', 'Process', 'Product'], cols: ['Readiness', 'Interest', 'Learning Profile'] };
function diName(n) { n = Number(n); return n >= 1 && n <= 9 ? DI.rows[Math.floor((n - 1) / 3)] + ' × ' + DI.cols[(n - 1) % 3] : '—'; }
function boot() { return AppState.boot || cacheGet('boot') || { opsi: { program: [], mapel: [], term: [], stage: {} }, stat: {}, kuota: {}, riwayat: [], settings: {} }; }
function menitPeriod() { return Number((boot().settings || {}).DURASI_PERIOD || 40); }
function stagesFor(program, mapel) {
  const b = boot(), fromBank = (b.opsi.stage || {})[program + '|' + mapel] || [];
  const set = new Set(fromBank.concat(DEFAULT_STAGES[program] || []));
  return Array.from(set).sort((a, b2) => (parseInt(a.replace(/\D/g, '')) || 99) - (parseInt(b2.replace(/\D/g, '')) || 99) || a.localeCompare(b2));
}
function countLO(program, mapel, stage) {
  const st = boot().stat || {}; let v = 0, p = 0;
  Object.keys(st).forEach(k => { const [pr, mp, sg] = k.split('|'); if (pr !== program || mp !== mapel) return; if (stage && sg && sg !== stage && sg.replace(/\D/g, '') !== stage.replace(/\D/g, '')) return; v += st[k].v; p += st[k].p; });
  return { v, p };
}

// =========================================================
// 1. CARI LO (Beranda)
// =========================================================
registerPage('cari', {
  title: 'Find LO', nav: 'cari',
  template() {
    return '<div class="main-inner" style="max-width:960px;margin:0 auto">' +
      '<div class="page-h"><div><h2 data-hello>Hi 👋</h2><div class="sub" data-prof></div></div><span class="pill info" data-quota></span></div>' +
      '<form class="card" id="f-cari" novalidate><div class="card-h"><h3>' + ic('graduation-cap') + 'Lesson Context</h3></div>' +
      '<div class="ctx-grid">' +
      '<div class="field"><label class="label req" for="c-program">Program</label><select class="select" id="c-program"></select></div>' +
      '<div class="field"><label class="label req" for="c-mapel">Subject</label><select class="select" id="c-mapel"></select></div>' +
      '<div class="field"><label class="label" for="c-stage">Stage / Grade</label><select class="select" id="c-stage"></select></div>' +
      '<div class="field"><label class="label" for="c-kelas">Class</label><input class="input" id="c-kelas" list="kelas-list" placeholder="e.g. 8A"><datalist id="kelas-list"></datalist></div>' +
      '<div class="field"><label class="label" for="c-term">Term</label><select class="select" id="c-term"></select></div>' +
      '<div class="field"><label class="label req" for="c-period">Number of periods</label><div class="row"><div class="stepper"><button type="button" data-act="pminus" aria-label="Fewer periods">−</button><input type="number" id="c-period" min="1" max="200" value="6"><button type="button" data-act="pplus" aria-label="More periods">+</button></div><span class="pill" data-minutes></span></div></div>' +
      '<div class="field full"><label class="label req" for="c-topik">Topic / Chapter</label><input class="input" id="c-topik" maxlength="300" placeholder="e.g. Linear equations"><div class="err-msg" id="c-err" hidden></div></div>' +
      '</div>' +
      '<div class="row wrap between mt small"><span class="muted row gap-s">' + ic('info', 'ic-s') + '<span data-count>—</span></span><a href="#/unggah" data-addsrc>+ Add source</a></div>' +
      '<button class="btn btn-primary btn-lg btn-block mt" type="submit" id="btn-cari">' + ic('search') + 'Find LO</button></form>' +
      '<div class="card mt" id="cari-loading" hidden><div class="steps"><div class="st" data-s="1"><span class="dot">1</span>Finding learning objectives</div><div class="st" data-s="2"><span class="dot">2</span>Building teaching suggestions</div><div class="st" data-s="3"><span class="dot">3</span>Preparing assessments</div></div>' +
      '<p class="tiny muted mt">This usually takes 20–60 seconds. Please keep this page open.</p><div class="grid mt">' + '<div class="sk sk-card"></div>'.repeat(2) + '</div></div>' +
      '<div id="cari-error"></div>' +
      '<div class="row between mt-l mb"><h3>Recent searches</h3><a href="#/riwayat" class="small" data-allhist>View all</a></div><div class="recent" data-recent></div></div>';
  },
  mount(el) {
    const f = $('#f-cari', el);
    const save = () => Store.set(userKey('cari:form'), this.read(el));
    ['c-program', 'c-mapel'].forEach(id => $('#' + id, el).addEventListener('change', () => { this.fillStages(el); this.updateCount(el); save(); }));
    $('#c-stage', el).addEventListener('change', () => { this.updateCount(el); save(); });
    ['c-kelas', 'c-term', 'c-topik'].forEach(id => $('#' + id, el).addEventListener('change', save));
    $('#c-period', el).addEventListener('input', () => { this.updateMinutes(el); save(); });
    f.addEventListener('submit', (e) => { e.preventDefault(); this.submit(el); });
    document.addEventListener('boot', () => { if (!el.hidden) this.render(el); });
  },
  show(el) {
    this.render(el);
    if (!AppState.boot) guruBoot();
  },
  read(el) {
    return { program: $('#c-program', el).value, mapel: $('#c-mapel', el).value, stage: $('#c-stage', el).value, kelas: $('#c-kelas', el).value.trim(), term: $('#c-term', el).value, period: Number($('#c-period', el).value), topik: $('#c-topik', el).value.trim() };
  },
  render(el) {
    const b = boot(), me = AppState.me || {}, saved = Store.get(userKey('cari:form'), null) || {};
    $('[data-hello]', el).textContent = 'Hi, ' + String(me.nama || '').split(' ')[0] + ' 👋';
    $('[data-prof]', el).textContent = [me.unit && ({ ECP: 'Early Childhood', PS: 'Primary School', MS: 'Middle School', HS: 'High School' }[me.unit] || me.unit), me.mapel].filter(Boolean).join(' · ') || (isTamu() ? 'Guest access' : '');
    const k = b.kuota || {}; $('[data-quota]', el).textContent = 'AI searches today: ' + (k.ai || 0) + '/' + (k.aiMaks || 20);
    const prog = $('#c-program', el), mp = $('#c-mapel', el);
    const keep = (sel, v) => (sel.value || v);
    const pv = keep(prog, saved.program), mv = keep(mp, saved.mapel || (me.mapel && b.opsi.mapel.includes(me.mapel) ? me.mapel : ''));
    prog.innerHTML = optionList(b.opsi.program, pv || b.opsi.program[0]);
    mp.innerHTML = optionList(b.opsi.mapel, mv || b.opsi.mapel[0]);
    $('#c-term', el).innerHTML = optionList(b.opsi.term, $('#c-term', el).value || saved.term || (b.settings || {}).TERM_AKTIF);
    $('#kelas-list', el).innerHTML = String(me.kelas || '').split(/[,;]/).map(x => x.trim()).filter(Boolean).map(x => '<option value="' + esc(x) + '">').join('');
    if (!$('#c-kelas', el).value && saved.kelas) $('#c-kelas', el).value = saved.kelas;
    if (!$('#c-topik', el).value && saved.topik) $('#c-topik', el).value = saved.topik;
    if (saved.period && !this._touchedP) $('#c-period', el).value = saved.period;
    this.fillStages(el, saved.stage);
    this.updateCount(el); this.updateMinutes(el);
    $('[data-addsrc]', el).hidden = isTamu();
    $('[data-allhist]', el).hidden = isTamu();
    const rec = (b.riwayat || []).slice(0, 3);
    $('[data-recent]', el).innerHTML = isTamu() ? '<div class="card small muted">Guest searches are not saved to history.</div>' : rec.length ? rec.map(r =>
      '<a class="card hoverable" href="#/hasil/' + encodeURIComponent(r.pencarian_id) + '" style="text-decoration:none;color:inherit"><div class="bold">' + esc(r.topik) + '</div><div class="small muted mt-s">' + esc([r.grade, r.kelas, r.jumlah_period + ' P'].filter(Boolean).join(' · ')) + '</div><div class="row between mt-s small"><span class="muted">' + fmtRel(r.waktu) + '</span><span style="color:var(--primary)">Open →</span></div></a>').join('')
      : '<div style="grid-column:1/-1" class="card">' + emptyState('book', 'Your first lesson plan starts here.', 'Choose the context above and tap Find LO.') + '</div>';
  },
  fillStages(el, want) {
    const sel = $('#c-stage', el), cur = want || sel.value;
    const list = stagesFor($('#c-program', el).value, $('#c-mapel', el).value);
    sel.innerHTML = optionList(list, list.includes(cur) ? cur : '', 'All stages');
  },
  updateCount(el) {
    const c = countLO($('#c-program', el).value, $('#c-mapel', el).value, $('#c-stage', el).value);
    $('[data-count]', el).textContent = c.v + c.p ? 'Searching in ' + c.v + ' verified LOs' + (c.p ? ' + ' + c.p + ' of your unverified LOs' : '') : 'No LOs yet for this subject — add the syllabus first.';
  },
  updateMinutes(el) { const n = Math.max(1, Number($('#c-period', el).value) || 1); $('[data-minutes]', el).textContent = '= ' + n * menitPeriod() + ' minutes'; },
  acts: {
    pminus(b, e, el) { const i = $('#c-period', el); i.value = Math.max(1, (Number(i.value) || 1) - 1); this._touchedP = true; i.dispatchEvent(new Event('input')); },
    pplus(b, e, el) { const i = $('#c-period', el); i.value = Math.min(200, (Number(i.value) || 0) + 1); this._touchedP = true; i.dispatchEvent(new Event('input')); },
    upload() { go('unggah'); }
  },
  async submit(el) {
    const d = this.read(el), err = $('#c-err', el);
    err.hidden = true; $('#c-topik', el).classList.remove('is-error'); $('#cari-error', el).innerHTML = '';
    if (!d.topik) { err.hidden = false; err.innerHTML = ic('circle-alert', 'ic-s') + 'Please enter the topic or chapter.'; $('#c-topik', el).classList.add('is-error'); $('#c-topik', el).focus(); return; }
    if (!(d.period >= 1)) { toast('Number of periods must be at least 1.', 'warn'); return; }
    const btn = $('#btn-cari', el), load = $('#cari-loading', el);
    btnBusy(btn, true, 'Searching…'); load.hidden = false;
    const steps = $$('.st', load); steps.forEach(s => s.className = 'st');
    const setStep = (n) => steps.forEach((s, i) => { s.className = 'st' + (i < n - 1 ? ' done' : i === n - 1 ? ' on' : ''); s.querySelector('.dot').innerHTML = i < n - 1 ? ic('check', 'ic-s') : (i + 1); });
    setStep(1); const t1 = setTimeout(() => setStep(2), 5000), t2 = setTimeout(() => setStep(3), 16000);
    load.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const r = await api('lo.cari', d);
    clearTimeout(t1); clearTimeout(t2); btnBusy(btn, false); load.hidden = true;
    if (!r.success) {
      const code = r.data && r.data.code;
      $('#cari-error', el).innerHTML = '<div class="alert ' + (code === 'QUOTA' ? 'warn' : 'bad') + ' mt">' + ic(code === 'QUOTA' ? 'clock' : 'circle-alert') + '<div class="grow">' + esc(r.message) +
        (code === 'NO_LO' && !isTamu() ? '<div class="mt-s"><a class="btn btn-sm btn-outline" href="#/unggah">' + ic('upload', 'ic-s') + 'Upload Source</a></div>' : '') + '</div></div>';
      return;
    }
    const data = r.data; data.dif_ai = data.pencarian.diferensiasi;
    cacheSet('hasil:' + data.pencarian.pencarian_id, data);
    if (AppState.boot) { AppState.boot.kuota = Object.assign({}, AppState.boot.kuota, data.kuota || {}); AppState.boot.riwayat = [{ pencarian_id: data.pencarian.pencarian_id, waktu: data.pencarian.waktu, topik: d.topik, grade: d.stage, kelas: d.kelas, jumlah_period: d.period, kode: data.hasil.filter(h => h.dipilih).map(h => h.kode_lo) }].concat(AppState.boot.riwayat || []); cacheSet('boot', AppState.boot); }
    cacheDel('riwayat');
    go('hasil', data.pencarian.pencarian_id);
  }
});

// =========================================================
// 2. HASIL LO
// =========================================================
const AKT_K = [['F', 'Factual'], ['C', 'Conceptual'], ['P', 'Procedural'], ['M', 'Metacognitive']];
const AKT_C = [['1', 'Remember'], ['2', 'Understand'], ['3', 'Apply'], ['4', 'Analyse'], ['5', 'Evaluate'], ['6', 'Create']];
function normPeriods(hasil, target) {
  const sel = hasil.filter(h => h.dipilih);
  if (sel.length > target) sel.slice(target).forEach(h => { h.dipilih = false; });
  const act = hasil.filter(h => h.dipilih);
  const sum = act.reduce((s, h) => s + (h.period_final || h.saran_period || 1), 0) || 1;
  let tot = 0;
  act.forEach(h => { h.period_final = Math.max(1, Math.floor((h.period_final || h.saran_period || 1) * target / sum)); tot += h.period_final; });
  let i = 0; while (tot < target && act.length) { act[i % act.length].period_final++; tot++; i++; }
  i = act.length - 1; let g = 0; while (tot > target && g++ < 500) { const h = act[((i % act.length) + act.length) % act.length]; if (h.period_final > 1) { h.period_final--; tot--; } i--; }
  hasil.forEach(h => { if (!h.dipilih) h.period_final = 0; });
}

registerPage('hasil', {
  title: 'LO Results', nav: 'cari',
  template() {
    return '<div data-wrap><div class="sk sk-line" style="width:40%;height:22px"></div><div class="res-layout mt"><div>' + '<div class="sk sk-card mb"></div>'.repeat(3) + '</div><div class="sk sk-card" style="height:260px"></div></div></div>';
  },
  show(el, id) {
    this.id = id; this.dirty = {}; this.difDirty = false;
    const c = cacheGet('hasil:' + id);
    if (c) this.render(el, c);
    else $('[data-wrap]', el).innerHTML = '<div class="sk sk-line" style="width:40%;height:22px"></div><div class="res-layout mt"><div>' + '<div class="sk sk-card mb"></div>'.repeat(3) + '</div><div class="sk sk-card" style="height:260px"></div></div>';
    swr('hasil:' + id, 'lo.detail', { pencarian_id: id }, (d, fromCache) => {
      if (fromCache && c) return;
      const prev = cacheGet('hasil:' + id); if (prev && prev.dif_ai) d.dif_ai = prev.dif_ai;
      if (Object.keys(this.dirty).length) return;   // jangan timpa suntingan yang belum tersimpan
      this.render(el, d);
    }, { fresh: c ? 120000 : 0, onError: (r) => { $('[data-wrap]', el).innerHTML = errorBox(r, 'reload'); } });
  },
  data() { return cacheGet('hasil:' + this.id); },
  render(el, d) {
    this.d = d;
    const p = d.pencarian, menit = menitPeriod();
    const head = '<div class="page-h"><div><a href="#/cari" class="small">' + ic('arrow-left', 'ic-s') + ' Back to search</a><h2 class="mt-s">' + esc(p.topik) + '</h2><div class="sub">' +
      esc([p.program, p.mapel, p.grade, p.kelas && 'Class ' + p.kelas, p.term].filter(Boolean).join(' · ')) + ' · ' + p.jumlah_period + ' × ' + menit + ' min</div></div>' +
      '<div class="row wrap no-print"><span class="small muted" data-save-state></span><button class="btn btn-outline" data-act="copy">' + ic('copy') + 'Copy</button>' +
      (isTamu() ? '' : '<button class="btn btn-outline" data-act="email">' + ic('mail') + 'Email me</button>') + '<button class="btn btn-primary" data-act="pdf">' + ic('download') + 'Download PDF</button></div></div>';
    const cards = d.hasil.map((h, i) => this.card(h, i, i === 0)).join('');
    const side = '<div class="res-side col gap-l">' +
      '<div class="card period-card"><div class="card-h"><h4>' + ic('clock') + 'Period Counter</h4></div><div data-counter></div></div>' +
      '<div class="card"><div class="card-h"><h4>' + ic('layers') + 'Differentiated Instruction</h4></div><div data-di></div></div>' +
      '<div class="card"><div class="card-h"><h4>' + ic('chart-column') + 'AKT summary</h4></div><div data-aktsum></div></div></div>';
    $('[data-wrap]', el).innerHTML = head + '<div class="res-layout"><div data-cards>' + cards + '</div>' + side + '</div>' +
      '<div class="mobile-bar no-print"><div><div class="tiny muted">Periods</div><div class="bold" data-mcount></div></div><button class="btn btn-primary btn-sm" data-act="pdf">' + ic('download', 'ic-s') + 'PDF</button></div>';
    this.bind(el); this.refreshSide(el); this.saveState(el, 'saved');
  },
  card(h, i, open) {
    const st = h.status === 'Terverifikasi';
    return '<article class="lo-card' + (h.dipilih ? '' : ' off') + '" data-i="' + i + '"><div class="lo-head">' +
      '<label class="check" title="Include this LO"><input type="checkbox" data-f="dipilih"' + (h.dipilih ? ' checked' : '') + ' aria-label="Include ' + esc(h.kode_lo) + '"></label>' +
      '<div class="lo-text"><div class="row wrap gap-s"><span class="code">' + esc(h.kode_lo) + '</span><span class="pill ' + (st ? 'ok' : 'wait') + '">' + (st ? 'Verified' : 'Unverified') + '</span>' + aktPill(h.akt_final) +
      '<button class="btn btn-ghost btn-sm" data-act="akt" style="padding:2px 6px;min-height:24px">' + ic('pencil', 'ic-s') + '</button></div>' +
      '<div class="stmt">' + esc(h.bunyi_lo) + '</div>' + (h.akt_alasan ? '<div class="why">Why ' + esc(h.akt_final) + ': ' + esc(h.akt_alasan) + '</div>' : '') + '</div>' +
      '<div class="col" style="align-items:flex-end"><div class="stepper sm"><button type="button" data-act="pm" aria-label="Fewer periods">−</button><input type="number" min="0" data-f="period_final" value="' + (h.period_final || 0) + '" aria-label="Periods"><button type="button" data-act="pp" aria-label="More periods">+</button></div><span class="tiny muted">periods</span>' +
      '<button class="btn btn-ghost btn-sm toggle" data-act="tog" aria-expanded="' + (open ? 'true' : 'false') + '">' + ic(open ? 'chevron-down' : 'chevron-right') + '</button></div></div>' +
      '<div class="lo-body"' + (open ? '' : ' hidden') + '><div class="tabs" role="tablist"><button class="on" data-act="tab" data-tab="t">Teaching</button><button data-act="tab" data-tab="a">Assessment</button><button data-act="tab" data-tab="s">Sources</button></div>' +
      '<div data-pane="t">' + this.mini('Opening', 'pembuka', h) + this.mini('Main', 'inti', h) + this.mini('Closing', 'penutup', h) + (h.rujukan_ebook ? '<span class="ref">' + ic('book-open', 'ic-s') + esc(h.rujukan_ebook) + '</span>' : '') + '</div>' +
      '<div data-pane="a" hidden>' + this.mini('Formative', 'formatif', h, h.formatif_akt) + this.mini('Summative', 'sumatif', h, h.sumatif_akt) + (h.rujukan_soal ? '<span class="ref">' + ic('file-text', 'ic-s') + 'Inspired by ' + esc(h.rujukan_soal) + '</span>' : '') + '</div>' +
      '<div data-pane="s" hidden><dl class="kv-list"><dt>LO status</dt><dd>' + (st ? 'Verified by QA admin' : 'From your own source — not yet verified') + '</dd><dt>Strand</dt><dd>' + esc(h.strand || '—') + '</dd><dt>Coursebook</dt><dd>' + esc(h.rujukan_ebook || '—') + '</dd><dt>Past paper</dt><dd>' + esc(h.rujukan_soal || '—') + '</dd><dt>AI periods</dt><dd>' + (h.saran_period || '—') + '</dd></dl></div></div></article>';
  },
  mini(label, f, h, akt) {
    const rows = Math.min(10, Math.max(3, String(h[f] || '').split('\n').length + 1));
    return '<div class="mini"><div class="mini-h"><span>' + label + '</span>' + (akt !== undefined ? aktPill(akt) : '') + '</div><textarea class="edit" data-f="' + f + '" rows="' + rows + '" aria-label="' + label + '">' + esc(h[f] || '') + '</textarea></div>';
  },
  bind(el) {
    const wrap = $('[data-cards]', el);
    wrap.addEventListener('input', (e) => {
      const t = e.target, card = t.closest('.lo-card'); if (!card || !t.dataset.f) return;
      const h = this.d.hasil[+card.dataset.i];
      if (t.dataset.f === 'period_final') { h.period_final = Math.max(0, parseInt(t.value) || 0); this.refreshSide(el); }
      else if (t.dataset.f !== 'dipilih') h[t.dataset.f] = t.value;
      this.mark(el, h);
    });
    wrap.addEventListener('change', (e) => {
      const t = e.target, card = t.closest('.lo-card'); if (!card || t.dataset.f !== 'dipilih') return;
      const h = this.d.hasil[+card.dataset.i]; h.dipilih = t.checked;
      if (h.dipilih && !h.period_final) h.period_final = 1;
      if (!h.dipilih) h.period_final = 0;
      card.classList.toggle('off', !h.dipilih); $('[data-f=period_final]', card).value = h.period_final;
      this.refreshSide(el); this.mark(el, h);
    });
  },
  mark(el, h) {
    this.dirty[h.hasil_id] = 1; cacheSet('hasil:' + this.id, this.d); this.saveState(el, 'pending');
    clearTimeout(this._st); this._st = setTimeout(() => this.flush(el), 1200);
  },
  async flush(el) {
    const ids = Object.keys(this.dirty); if (!ids.length && !this.difDirty) return;
    const items = this.d.hasil.filter(h => this.dirty[h.hasil_id]).map(h => ({ hasil_id: h.hasil_id, dipilih: h.dipilih, period_final: h.period_final, akt_final: h.akt_final, pembuka: h.pembuka, inti: h.inti, penutup: h.penutup, formatif: h.formatif, sumatif: h.sumatif }));
    const payload = { pencarian_id: this.id, items }; if (this.difDirty) payload.diferensiasi = this.d.pencarian.diferensiasi;
    this.dirty = {}; this.difDirty = false; this.saveState(el, 'saving');
    const r = await api('lo.simpanHasil', payload);
    if (!r.success) { items.forEach(i => this.dirty[i.hasil_id] = 1); if (payload.diferensiasi) this.difDirty = true; this.saveState(el, 'error'); toast('Could not save changes: ' + r.message, 'err'); return; }
    this.saveState(el, Object.keys(this.dirty).length ? 'pending' : 'saved');
  },
  saveState(el, s) {
    const x = $('[data-save-state]', el); if (!x) return;
    x.innerHTML = { saved: ic('circle-check', 'ic-s') + ' All changes saved', pending: 'Unsaved changes…', saving: ic('loader-circle', 'ic-s spin') + ' Saving…', error: '<span style="color:var(--err)">' + ic('circle-alert', 'ic-s') + ' Not saved</span>' }[s] || '';
  },
  refreshSide(el) {
    const d = this.d, p = d.pencarian, target = Number(p.jumlah_period);
    const sel = d.hasil.filter(h => h.dipilih), sum = sel.reduce((s, h) => s + (Number(h.period_final) || 0), 0);
    const over = sum !== target, pct = Math.min(100, Math.round(sum / Math.max(target, 1) * 100));
    $('[data-counter]', el).innerHTML = '<div class="counter-big' + (over ? ' over' : '') + '">' + sum + ' / ' + target + ' <span class="small muted" style="font-weight:500">periods</span></div>' +
      '<div class="progress mt-s' + (sum > target ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      (over ? '<div class="row between mt"><span class="small" style="color:var(--err)">' + (sum > target ? 'Over by ' + (sum - target) : 'Under by ' + (target - sum)) + '</span><button class="btn btn-sm" style="background:var(--warn);color:#1F2937" data-act="autofix">' + ic('wand-sparkles', 'ic-s') + 'Auto-adjust</button></div>' : '<p class="small muted mt-s">' + ic('circle-check', 'ic-s') + ' Allocation matches the lesson.</p>');
    $('[data-mcount]', el).innerHTML = '<span style="color:' + (over ? 'var(--err)' : 'var(--accent)') + '">' + sum + ' / ' + target + '</span>' + (over ? ' <button class="btn btn-sm btn-ghost" data-act="autofix">Fix</button>' : '');
    const cur = Number(p.diferensiasi) || 0, rec = Number(d.dif_ai || cur);
    let g = '<div class="dimatrix"><span></span>' + DI.cols.map(c => '<span class="hd">' + c + '</span>').join('');
    DI.rows.forEach((r, ri) => { g += '<span class="rh">' + r + '</span>'; DI.cols.forEach((c, ci) => { const n = ri * 3 + ci + 1; g += '<button data-act="di" data-n="' + n + '" class="' + (n === cur ? 'on' : '') + '" title="' + r + ' × ' + c + '" aria-pressed="' + (n === cur) + '">' + n + (n === rec ? '<svg class="star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/></svg>' : '') + '</button>'; }); });
    g += '</div><p class="small mt"><b>' + esc(diName(cur)) + '</b>' + (cur === rec ? ' <span class="pill ok">Recommended</span>' : '') + '</p>' +
      (cur === rec && p.diferensiasi_alasan ? '<p class="small muted">' + esc(p.diferensiasi_alasan) + '</p>' : '') +
      (cur === rec && p.diferensiasi_contoh ? '<div class="mini small"><b>Example:</b> ' + esc(p.diferensiasi_contoh) + '</div>' : '') + '<p class="tiny muted">Select only one cell. ★ = AI recommendation.</p>';
    $('[data-di]', el).innerHTML = g;
    const cnt = [0, 0, 0, 0, 0, 0]; sel.forEach(h => { const a = String(h.akt_final || ''); if (/^[FCPM]C[1-6]$/.test(a)) cnt[+a[2] - 1]++; });
    const mx = Math.max(1, ...cnt);
    $('[data-aktsum]', el).innerHTML = '<div class="aktbar">' + cnt.map((n, i) => '<span class="mono">C' + (i + 1) + '</span><div class="bar"><i style="width:' + (n / mx * 100) + '%;background:var(--c' + (i + 1) + '-bg);' + (i === 5 ? '' : 'box-shadow:inset 0 0 0 1px var(--c' + (i + 1) + '-fg)') + '"></i></div><span class="tiny">' + n + '</span>').join('') + '</div>' +
      '<p class="tiny muted mt-s">' + (cnt[3] + cnt[4] + cnt[5] ? 'Includes higher-order thinking (C4–C6).' : 'Consider adding a higher-order objective (C4–C6).') + '</p>';
  },
  acts: {
    reload(b, e, el) { this.show(el, this.id); },
    tog(b) { const card = b.closest('.lo-card'), body = $('.lo-body', card), open = body.hidden; body.hidden = !open; b.innerHTML = ic(open ? 'chevron-down' : 'chevron-right'); b.setAttribute('aria-expanded', open); },
    tab(b) { const card = b.closest('.lo-card'); $$('.tabs button', card).forEach(x => x.classList.toggle('on', x === b)); $$('[data-pane]', card).forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab); },
    pm(b, e, el) { const i = b.parentElement.querySelector('input'); i.value = Math.max(0, (+i.value || 0) - 1); i.dispatchEvent(new Event('input', { bubbles: true })); },
    pp(b, e, el) { const i = b.parentElement.querySelector('input'); i.value = (+i.value || 0) + 1; i.dispatchEvent(new Event('input', { bubbles: true })); const card = b.closest('.lo-card'), cb = $('[data-f=dipilih]', card); if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } },
    autofix(b, e, el) {
      if (!this.d.hasil.some(h => h.dipilih)) return toast('Select at least one LO first.', 'warn');
      normPeriods(this.d.hasil, Number(this.d.pencarian.jumlah_period));
      this.d.hasil.forEach((h, i) => { const card = $('.lo-card[data-i="' + i + '"]', el); $('[data-f=period_final]', card).value = h.period_final; $('[data-f=dipilih]', card).checked = h.dipilih; card.classList.toggle('off', !h.dipilih); this.dirty[h.hasil_id] = 1; });
      this.refreshSide(el); this.mark(el, this.d.hasil[0]); toast('Periods adjusted to ' + this.d.pencarian.jumlah_period + '.');
    },
    di(b, e, el) { this.d.pencarian.diferensiasi = +b.dataset.n; this.difDirty = true; this.refreshSide(el); cacheSet('hasil:' + this.id, this.d); this.saveState(el, 'pending'); clearTimeout(this._st); this._st = setTimeout(() => this.flush(el), 800); },
    akt(b, e, el) {
      const card = b.closest('.lo-card'), h = this.d.hasil[+card.dataset.i], a = String(h.akt_final || 'CC2');
      const m = modal('AKT level · ' + h.kode_lo, '<p class="small muted">' + esc(h.bunyi_lo) + '</p><div class="grid grid-2"><div class="field"><label class="label">Knowledge dimension</label><select class="select" id="ak-k">' + AKT_K.map(k => '<option value="' + k[0] + '"' + (a[0] === k[0] ? ' selected' : '') + '>' + k[0] + ' — ' + k[1] + '</option>').join('') + '</select></div>' +
        '<div class="field"><label class="label">Cognitive process</label><select class="select" id="ak-c">' + AKT_C.map(c => '<option value="' + c[0] + '"' + (a[2] === c[0] ? ' selected' : '') + '>C' + c[0] + ' — ' + c[1] + '</option>').join('') + '</select></div></div><p class="mt small">Result: <b id="ak-out" class="mono"></b></p>',
        '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="ak-ok">Apply</button>');
      const upd = () => { $('#ak-out', m.el).textContent = $('#ak-k', m.el).value + 'C' + $('#ak-c', m.el).value; };
      m.el.addEventListener('change', upd); upd();
      $('#ak-ok', m.el).onclick = () => { h.akt_final = $('#ak-out', m.el).textContent; m.close(); const i = +card.dataset.i, open = !$('.lo-body', card).hidden; card.outerHTML = this.card(h, i, open); this.refreshSide(el); this.mark(el, h); };
    },
    async copy() {
      const d = this.d, p = d.pencarian;
      const txt = ['LEARNING OBJECTIVE PLAN', p.topik + ' — ' + [p.program, p.mapel, p.grade, p.kelas && 'Class ' + p.kelas, p.term].filter(Boolean).join(' · '), p.jumlah_period + ' periods × ' + menitPeriod() + ' min', '']
        .concat(d.hasil.filter(h => h.dipilih).map(h => [h.kode_lo + ' (' + (h.akt_final || '-') + ', ' + h.period_final + ' P) ' + h.bunyi_lo + (h.status !== 'Terverifikasi' ? ' [unverified]' : ''), 'Opening:\n' + h.pembuka, 'Main:\n' + h.inti, 'Closing:\n' + h.penutup, 'Formative (' + (h.formatif_akt || '-') + '): ' + h.formatif, 'Summative (' + (h.sumatif_akt || '-') + '): ' + h.sumatif, ''].join('\n')))
        .concat(['Differentiation: ' + diName(p.diferensiasi)]).join('\n');
      toast(await copyText(txt) ? 'Plan copied to clipboard.' : 'Copy failed.', 'ok');
    },
    async pdf(b) {
      await this.flush($('.page[data-page=hasil]'));
      btnBusy(b, true, 'Preparing'); const r = await api('lo.pdf', { pencarian_id: this.id }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      downloadBase64(r.data.base64, r.data.nama); toast('PDF downloaded.');
    },
    async email(b) {
      await this.flush($('.page[data-page=hasil]'));
      btnBusy(b, true, 'Sending'); const r = await api('lo.email', { pencarian_id: this.id }); btnBusy(b, false);
      toast(r.success ? r.message : r.message, r.success ? 'ok' : 'err');
    }
  }
});
window.addEventListener('beforeunload', (e) => { const p = Pages.hasil; if (p && p.dirty && Object.keys(p.dirty).length) { p.flush($('.page[data-page=hasil]')); e.preventDefault(); e.returnValue = ''; } });

// =========================================================
// 3. UNGGAH SUMBER
// =========================================================
const UP_ACCEPT = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.jpg,.jpeg,.png';
function fmtOf(file) {
  const n = String(file.name || '').toLowerCase(), ext = n.split('.').pop();
  if (ext === 'pdf') return 'PDF'; if (ext === 'docx') return 'DOCX'; if (ext === 'pptx') return 'PPTX';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return ext === 'csv' ? 'CSV' : 'XLSX'; if (['jpg', 'jpeg'].includes(ext)) return 'JPG'; if (ext === 'png') return 'PNG';
  if (ext === 'epub') return 'EPUB'; if (['doc', 'ppt'].includes(ext)) return 'OLD'; return '';
}
function rejectMsg(f) { return { EPUB: 'Locked file (DRM). Please use the publisher\'s PDF.', OLD: 'Old Office format. Save as .docx/.pptx or export to PDF.', BIG: 'Larger than 20 MB. Use a Google Drive link or split by chapter.' }[f] || 'Unsupported format.'; }
function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
async function inspectImage(file) {
  const url = URL.createObjectURL(file), img = await loadImg(url);
  const w = img.naturalWidth, h = img.naturalHeight, warn = [];
  if (Math.min(w, h) < 1000) warn.push('Too small (' + Math.min(w, h) + ' px)');
  try { // perkiraan buram: varians Laplacian pada versi kecil
    const s = 256 / Math.max(w, h), cw = Math.max(8, Math.round(w * s)), ch = Math.max(8, Math.round(h * s));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cw, ch);
    const px = cx.getImageData(0, 0, cw, ch).data, g = new Float32Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) g[i] = px[i * 4] * .299 + px[i * 4 + 1] * .587 + px[i * 4 + 2] * .114;
    let sum = 0, sq = 0, n = 0;
    for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 1; x++) { const i = y * cw + x, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - cw] - g[i + cw]; sum += l; sq += l * l; n++; }
    const v = sq / n - (sum / n) ** 2; if (v < 60) warn.push('May be blurry');
  } catch (e) { }
  return { url, w, h, warn };
}
async function imageToPayload(file, meta) {
  if (file.size <= 1.5e6 && Math.max(meta.w, meta.h) <= 2400) return { name: file.name, mime: file.type || 'image/jpeg', base64: await fileToBase64(file) };
  const img = await loadImg(meta.url), s = Math.min(1, 2400 / Math.max(meta.w, meta.h));
  const cv = document.createElement('canvas'); cv.width = Math.round(meta.w * s); cv.height = Math.round(meta.h * s);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const b64 = cv.toDataURL('image/jpeg', .85).split(',')[1];
  return { name: file.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', base64: b64 };
}
const MAP_FIELDS = {
  lo: [['kode_lo', 'LO code', true, /^(lo\s*)?code|kode|^ref|objective\s*code|^id$/i], ['bunyi_lo', 'LO statement', true, /statement|objective|bunyi|description|learning/i], ['stage_grade', 'Stage / grade', false, /stage|grade|year|level$/i],
    ['strand', 'Strand', false, /^strand|domain|topic\s*area/i], ['sub_strand', 'Sub-strand', false, /sub/i], ['akt_saran', 'AKT level (optional)', false, /akt|bloom|cognitive/i]],
  topik: [['bab', 'Chapter', true, /chapter|bab|unit/i], ['sub_bab', 'Section', false, /section|sub|lesson/i], ['halaman', 'Pages', false, /page|halaman/i], ['kode_lo', 'LO codes', false, /code|kode|objective/i], ['ringkasan_konsep', 'Summary', false, /summary|ringkasan|concept|description/i]]
};

registerPage('unggah', {
  title: 'Upload Source', nav: 'unggah', noTamu: true,
  template() { return '<div style="max-width:880px;margin:0 auto"><div class="page-h"><div><h2>Add Source to LO Bank</h2><div class="sub">Syllabus, coursebook or past paper — PDF, Word, PowerPoint, Excel/CSV, images or a Google Drive link.</div></div></div><div data-wiz></div><div data-step></div></div>'; },
  show(el) { if (!this.U || this.U.done) this.reset(); this.render(el); },
  reset() { const b = boot(), saved = Store.get(userKey('cari:form'), {}) || {}; this.U = { step: 1, jenis: '', files: [], metaImg: [], kind: '', link: '', linkInfo: null, ms: null, meta: { program: saved.program || (b.opsi.program || [])[0] || '', mapel: saved.mapel || (AppState.me || {}).mapel || '', stage: saved.stage || '', judul: '', tahun_sesi: '', kode_silabus: '' }, langsung: false, table: null, isiAkt: false, rejects: [] }; },
  render(el) {
    const U = this.U, steps = U.kind === 'table' ? ['Type & File', 'Map Columns', 'Import'] : ['Type & File', 'Details', 'Processing'];
    $('[data-wiz]', el).innerHTML = '<div class="wizard">' + steps.map((s, i) => (i ? '<span class="ln"></span>' : '') + '<span class="w ' + (U.step > i + 1 ? 'done' : U.step === i + 1 ? 'on' : '') + '"><span class="n">' + (U.step > i + 1 ? ic('check', 'ic-s') : i + 1) + '</span>' + s + '</span>').join('') + '</div>';
    const box = $('[data-step]', el);
    if (U.step === 1) box.innerHTML = this.step1(); else if (U.kind === 'table') box.innerHTML = this.stepMap(); else box.innerHTML = this.step2();
    this.bindStep(el);
  },
  step1() {
    const U = this.U;
    const T = [['Silabus', 'graduation-cap', 'Syllabus', 'Official LO codes'], ['Ebook', 'book-open', 'Ebook / Coursebook', 'Chapter → LO map'], ['Past Paper', 'file-text', 'Past Paper', 'Reference questions']];
    let h = '<div class="card"><h3 class="mb">1. Choose source type</h3><div class="typecards">' + T.map(t => '<button type="button" class="typecard' + (U.jenis === t[0] ? ' on' : '') + '" data-act="jenis" data-v="' + t[0] + '"><span class="tick">' + ic('check', 'ic-s') + '</span><div class="ic-wrap">' + ic(t[1], 'ic-l') + '</div><div class="t">' + t[2] + '</div><div class="d">' + t[3] + '</div></button>').join('') + '</div>';
    if (U.jenis === 'Past Paper') h += '<div class="row wrap mt"><label class="check"><input type="checkbox" data-ms-toggle' + (U.ms !== null ? ' checked' : '') + '> Attach mark scheme (PDF)</label>' + (U.ms !== null ? '<input type="file" accept=".pdf" data-ms-file class="small">' + (U.ms ? '<span class="small muted">' + esc(U.ms.name) + '</span>' : '') : '') + '</div>';
    h += '<h3 class="mt-l mb">2. Add your file</h3>';
    if (U.kind === 'img') h += this.imgGrid();
    else h += '<div class="drop" data-drop tabindex="0" role="button" aria-label="Choose files"><div class="ic-circle">' + ic('upload') + '</div><div class="bold">Drag files here or <span style="color:var(--primary)">Browse</span></div><div class="chips"><span class="fchip f-pdf">PDF</span><span class="fchip f-docx">DOCX</span><span class="fchip f-pptx">PPTX</span><span class="fchip f-xlsx">XLSX</span><span class="fchip f-xlsx">CSV</span><span class="fchip f-img">JPG</span><span class="fchip f-img">PNG</span></div><div class="help mt-s">Max 20 MB per file · up to 20 images</div><input type="file" data-file accept="' + UP_ACCEPT + '" multiple hidden></div>';
    h += U.files.length && U.kind !== 'img' ? U.files.map((f, i) => '<div class="filerow">' + fileIcon(fmtOf(f)) + '<div class="grow"><div class="bold small">' + esc(f.name) + '</div><div class="tiny muted">' + fmtSize(f.size) + (U.kind === 'table' ? ' · table import (no AI needed)' : '') + '</div></div><button class="btn btn-ghost btn-icon btn-sm" data-act="rmfile" data-i="' + i + '" aria-label="Remove">' + ic('x') + '</button></div>').join('') : '';
    h += U.rejects.map(r => '<div class="filerow bad">' + ic('circle-alert') + '<div class="grow"><div class="bold small">' + esc(r.name) + '</div><div class="tiny">' + esc(rejectMsg(r.why)) + '</div></div></div>').join('');
    h += '<div class="divider">or</div><div class="row wrap"><div class="input-icon grow">' + ic('link') + '<input class="input" data-link placeholder="Paste Google Drive / Docs / Slides / Sheets link" value="' + esc(U.link) + '"></div><button class="btn btn-outline" data-act="cek">' + ic('shield-check') + 'Check access</button></div><div data-linkinfo>' + this.linkInfo() + '</div>';
    h += '</div><div class="sticky-bar"><a class="btn btn-ghost" href="#/dokumen">Cancel</a><button class="btn btn-primary" data-act="next"' + (this.canNext() ? '' : ' disabled') + '>Next ' + ic('chevron-right') + '</button></div>';
    return h;
  },
  linkInfo() {
    const L = this.U.linkInfo; if (!L) return '';
    if (L.err) return '<div class="alert ' + (L.code === 'NO_ACCESS' ? 'warn' : 'bad') + ' mt">' + ic('triangle-alert') + '<div class="grow">' + esc(L.err) + (L.email ? '<div class="mt-s"><button class="btn btn-sm btn-outline" data-act="copymail">' + ic('copy', 'ic-s') + 'Copy ' + esc(L.email) + '</button></div>' : '') + '</div></div>';
    return '<div class="filerow">' + fileIcon(L.format) + '<div class="grow"><div class="bold small">' + esc(L.nama) + '</div><div class="tiny muted">' + (L.ukuran ? fmtSize(L.ukuran) + ' · ' : '') + 'Google Drive link ✓ accessible</div></div><button class="btn btn-ghost btn-icon btn-sm" data-act="rmlink" aria-label="Remove link">' + ic('x') + '</button></div>';
  },
  imgGrid() {
    const U = this.U;
    return '<div class="row between mb"><div><b>Arrange pages · ' + U.files.length + ' images</b><div class="tiny muted">Drag to reorder. Images are processed as one document.</div></div><label class="btn btn-outline btn-sm">' + ic('plus', 'ic-s') + 'Add more<input type="file" data-file accept=".jpg,.jpeg,.png" multiple hidden></label></div><div class="thumbs" data-thumbs>' +
      U.files.map((f, i) => { const m = U.metaImg[i] || {}; return '<div class="thumb" draggable="true" data-i="' + i + '"><img src="' + m.url + '" alt="Page ' + (i + 1) + '"><span class="num">' + (i + 1) + '</span><button class="icon-btn btn-sm rm" data-act="rmfile" data-i="' + i + '" aria-label="Remove image" style="background:rgba(0,0,0,.45);color:#fff;width:28px;height:28px">' + ic('x', 'ic-s') + '</button>' + (m.warn && m.warn.length ? '<span class="warn">⚠ ' + esc(m.warn.join(' · ')) + '</span>' : '') + '</div>'; }).join('') + '</div>';
  },
  canNext() { const U = this.U; return !!U.jenis && (U.files.length > 0 || (U.linkInfo && !U.linkInfo.err)); },
  async addFiles(el, list) {
    const U = this.U; U.rejects = [];
    for (const f of list) {
      const fmt = fmtOf(f);
      if (!fmt || fmt === 'EPUB' || fmt === 'OLD') { U.rejects.push({ name: f.name, why: fmt }); continue; }
      if (f.size > 20 * 1048576) { U.rejects.push({ name: f.name, why: 'BIG' }); continue; }
      const kind = fmt === 'JPG' || fmt === 'PNG' ? 'img' : (fmt === 'XLSX' || fmt === 'CSV') ? 'table' : 'doc';
      if (kind === 'img') {
        if (U.kind && U.kind !== 'img') { U.files = []; U.metaImg = []; }
        if (U.files.length >= 20) { toast('Maximum 20 images per upload.', 'warn'); break; }
        U.kind = 'img'; U.files.push(f); U.metaImg.push(await inspectImage(f));
      } else { U.kind = kind; U.files = [f]; U.metaImg = []; U.link = ''; U.linkInfo = null; }
    }
    if (U.kind === 'table' && !U.jenis) U.jenis = 'Silabus';
    this.render(el);
  },
  bindStep(el) {
    const U = this.U, box = $('[data-step]', el);
    const drop = $('[data-drop]', box), inp = $('[data-file]', box);
    if (drop) {
      drop.addEventListener('click', () => inp.click()); drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => this.addFiles(el, Array.from(e.dataTransfer.files || [])));
    }
    if (inp) inp.addEventListener('change', () => { this.addFiles(el, Array.from(inp.files || [])); inp.value = ''; });
    const msT = $('[data-ms-toggle]', box); if (msT) msT.addEventListener('change', () => { U.ms = msT.checked ? (U.ms || false) : null; this.render(el); });
    const msF = $('[data-ms-file]', box); if (msF) msF.addEventListener('change', () => { U.ms = msF.files[0] || false; this.render(el); });
    const lk = $('[data-link]', box); if (lk) lk.addEventListener('input', () => { U.link = lk.value.trim(); U.linkInfo = null; $('[data-linkinfo]', box).innerHTML = ''; $('[data-act=next]', box).disabled = !this.canNext(); });
    const th = $('[data-thumbs]', box);
    if (th) {
      let from = -1;
      th.addEventListener('dragstart', (e) => { const t = e.target.closest('.thumb'); if (!t) return; from = +t.dataset.i; t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      th.addEventListener('dragover', (e) => { e.preventDefault(); $$('.thumb', th).forEach(x => x.classList.remove('target')); const t = e.target.closest('.thumb'); if (t) t.classList.add('target'); });
      th.addEventListener('drop', (e) => { e.preventDefault(); const t = e.target.closest('.thumb'); if (!t || from < 0) return; const to = +t.dataset.i; const mv = (a) => { const [x] = a.splice(from, 1); a.splice(to, 0, x); }; mv(U.files); mv(U.metaImg); from = -1; this.render(el); });
      th.addEventListener('dragend', () => { $$('.thumb', th).forEach(x => x.classList.remove('dragging', 'target')); });
    }
    if (U.step === 2 && U.kind === 'table') this.bindMap(el);
  },
  acts: {
    jenis(b, e, el) { this.U.jenis = b.dataset.v; this.render(el); },
    rmfile(b, e, el) { const i = +b.dataset.i; const m = this.U.metaImg[i]; if (m && m.url) URL.revokeObjectURL(m.url); this.U.files.splice(i, 1); this.U.metaImg.splice(i, 1); if (!this.U.files.length) this.U.kind = ''; this.render(el); },
    rmlink(b, e, el) { this.U.link = ''; this.U.linkInfo = null; if (this.U.kind === 'table' && !this.U.files.length) this.U.kind = ''; this.render(el); },
    async copymail() { if (this.U.linkInfo && this.U.linkInfo.email) toast(await copyText(this.U.linkInfo.email) ? 'Email copied.' : 'Copy failed.'); },
    async cek(b, e, el) {
      const U = this.U; if (!U.link) return toast('Paste a Google Drive link first.', 'warn');
      btnBusy(b, true, 'Checking'); const r = await api('sumber.cekTautan', { link: U.link }); btnBusy(b, false);
      U.linkInfo = r.success ? r.data : { err: r.message, code: r.data && r.data.code, email: r.data && r.data.email };
      if (r.success) { U.files = []; U.metaImg = []; U.kind = r.data.format === 'GSHEET' ? 'table' : 'doc'; if (U.kind === 'table' && !U.jenis) U.jenis = 'Silabus'; }
      this.render(el);
    },
    async next(b, e, el) {
      const U = this.U; if (!this.canNext()) return;
      if (U.kind === 'table') {
        btnBusy(b, true, 'Reading table');
        try { await this.readTable(); } catch (err) { btnBusy(b, false); return toast(err.message || 'Could not read the table.', 'err'); }
        btnBusy(b, false);
      }
      if (!U.meta.judul) U.meta.judul = (U.files[0] && U.files[0].name.replace(/\.\w+$/, '')) || (U.linkInfo && U.linkInfo.nama) || '';
      U.step = 2; this.render(el); window.scrollTo(0, 0);
    },
    back(b, e, el) { this.U.step = 1; this.render(el); },
    async upload(b, e, el) { this.doUpload(el, b); },
    async imp(b, e, el) { this.doImport(el, b); },
    tpl() {
      loadXLSX().then(() => {
        const t = this.U.table ? this.U.table.target : 'lo';
        const rows = t === 'lo' ? [['LO code', 'LO statement', 'Stage', 'Strand', 'Sub-strand', 'AKT level'], ['8Ae.01', 'Understand that letters can be used to represent unknown numbers.', 'Stage 8', 'Algebra', 'Expressions', 'CC2']]
          : [['Chapter', 'Section', 'Pages', 'LO codes', 'Summary'], ['Chapter 4 Equations', '4.1 Linear equations', '62-65', '8Ae.01, 8Ae.05', 'Solving one-step and two-step linear equations']];
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Template'); XLSX.writeFile(wb, t === 'lo' ? 'LO-Bank-template.xlsx' : 'Topic-Map-template.xlsx');
      }).catch(() => toast('Could not load the Excel library.', 'err'));
    }
  },
  metaForm(withYear) {
    const U = this.U, b = boot(), m = U.meta;
    return '<div class="ctx-grid"><div class="field"><label class="label req">Program</label><select class="select" data-m="program">' + optionList(b.opsi.program, m.program) + '</select></div>' +
      '<div class="field"><label class="label req">Subject</label><select class="select" data-m="mapel">' + optionList(b.opsi.mapel, m.mapel, 'Choose subject') + '</select></div>' +
      '<div class="field"><label class="label">Stage / Grade</label><select class="select" data-m="stage">' + optionList(stagesFor(m.program, m.mapel), m.stage, 'Several / not specific') + '</select></div>' +
      '<div class="field"><label class="label">Title</label><input class="input" data-m="judul" value="' + esc(m.judul) + '" maxlength="200"></div>' +
      (withYear ? '<div class="field"><label class="label">Year / Session</label><input class="input" data-m="tahun_sesi" value="' + esc(m.tahun_sesi) + '" placeholder="e.g. 2023 Oct/Nov P1"></div>' : '') +
      '<div class="field"><label class="label">Syllabus code (optional)</label><input class="input" data-m="kode_silabus" value="' + esc(m.kode_silabus) + '" placeholder="e.g. 0862"></div></div>' +
      (isAdmin() ? '<label class="check mt"><input type="checkbox" data-langsung' + (U.langsung ? ' checked' : '') + '> Verify & share immediately (admin)</label>' : '');
  },
  step2() {
    const U = this.U, f = U.files[0];
    const what = U.kind === 'img' ? U.files.length + ' images' : f ? f.name + ' · ' + fmtSize(f.size) : (U.linkInfo && U.linkInfo.nama) + ' (Google Drive)';
    return '<div class="card"><div class="row between wrap mb"><h3>Details</h3><span class="pill info">' + esc(JENIS_EN[U.jenis]) + ' · ' + esc(what) + '</span></div>' + this.metaForm(U.jenis === 'Past Paper') +
      '<div class="alert info mt">' + ic('info') + '<div class="small">Processing runs in the background (usually 1–10 minutes depending on size). You can close the app — we\'ll email you when it\'s done. Your LOs are usable by you right away and become shared after QA verification.</div></div>' +
      '<div data-upprog class="mt" hidden><div class="row between small"><span>Uploading…</span><span data-upsize></span></div><div class="progress striped mt-s"><i style="width:100%"></i></div></div></div>' +
      '<div class="sticky-bar"><button class="btn btn-ghost" data-act="back">' + ic('chevron-left') + 'Back</button><button class="btn btn-primary" data-act="upload">' + ic('upload') + 'Upload & Process</button></div>';
  },
  bindMeta(el) {
    const U = this.U;
    $$('[data-m]', el).forEach(i => i.addEventListener('change', () => {
      U.meta[i.dataset.m] = i.value.trim();
      if (i.dataset.m === 'program' || i.dataset.m === 'mapel') { const s = $('[data-m=stage]', el); s.innerHTML = optionList(stagesFor(U.meta.program, U.meta.mapel), U.meta.stage, 'Several / not specific'); }
    }));
    const l = $('[data-langsung]', el); if (l) l.addEventListener('change', () => { U.langsung = l.checked; });
  },
  async doUpload(el, btn) {
    const U = this.U; this.bindMeta(el); $$('[data-m]', el).forEach(i => U.meta[i.dataset.m] = i.value.trim());
    if (!U.meta.program || !U.meta.mapel) return toast('Please choose the program and subject.', 'warn');
    btnBusy(btn, true, 'Uploading'); const prog = $('[data-upprog]', el); prog.hidden = false;
    try {
      const payload = Object.assign({ jenis: U.jenis, langsungBersama: U.langsung }, U.meta);
      if (U.linkInfo && !U.files.length) payload.link = U.link;
      else if (U.kind === 'img') payload.files = await Promise.all(U.files.map((f, i) => imageToPayload(f, U.metaImg[i])));
      else payload.files = [{ name: U.files[0].name, mime: U.files[0].type || '', base64: await fileToBase64(U.files[0]) }];
      if (U.jenis === 'Past Paper' && U.ms) payload.ms = { name: U.ms.name, mime: 'application/pdf', base64: await fileToBase64(U.ms) };
      const size = (payload.files || []).reduce((s, f) => s + f.base64.length * .75, 0); $('[data-upsize]', el).textContent = size ? fmtSize(size) : '';
      const r = await api('sumber.unggah', payload);
      btnBusy(btn, false); prog.hidden = true;
      if (!r.success) {
        if (r.data && r.data.code === 'DUPLICATE' && r.data.milik) { toast(r.message, 'warn', 6000); return go('dok', r.data.dokumen_id); }
        return toast(r.message, 'err', 6000);
      }
      U.done = true; cacheDel('dok:list'); if (AppState.boot && AppState.boot.dokumen) { AppState.boot.dokumen.proses++; setBadge('dok', AppState.boot.dokumen.proses); }
      cacheSet('dok:' + r.data.dokumen.dokumen_id, { dokumen: r.data.dokumen, lo: [], topik: [], soal: [] });
      toast(r.message || 'Uploaded.'); go('dok', r.data.dokumen.dokumen_id);
    } catch (err) { btnBusy(btn, false); prog.hidden = true; toast('Could not read the file: ' + err.message, 'err'); }
  },
  // ---------- Tabel ----------
  async readTable() {
    const U = this.U;
    let sheets = {}, format = 'XLSX', fileB64 = '';
    if (U.files.length) {
      await loadXLSX();
      const f = U.files[0], buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      wb.SheetNames.slice(0, 10).forEach(n => { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }).slice(0, 3001); });
      format = fmtOf(f) === 'CSV' ? 'CSV' : 'XLSX';
      if (f.size < 5e6) fileB64 = await fileToBase64(f);
    } else {
      const r = await api('sumber.tabelDariSheet', { link: U.link });
      if (!r.success) throw new Error(r.message);
      sheets = r.data.sheets; format = 'GSHEET'; if (!U.meta.judul) U.meta.judul = r.data.nama;
    }
    const names = Object.keys(sheets).filter(n => (sheets[n] || []).length > 1);
    if (!names.length) throw new Error('The table looks empty (needs a header row and at least one data row).');
    U.table = { sheets, sheet: names[0], target: U.jenis === 'Ebook' ? 'topik' : 'lo', map: {}, format, fileB64 };
    this.guessMap();
  },
  guessMap() {
    const T = this.U.table, head = (T.sheets[T.sheet][0] || []).map(String), sig = T.target + '|' + head.join('|');
    const saved = Store.get(userKey('map:' + sig), null);
    if (saved) { T.map = saved; return; }
    const used = new Set(); T.map = {};
    MAP_FIELDS[T.target].forEach(([k, , , re]) => { const i = head.findIndex((h, j) => !used.has(j) && re.test(h)); if (i > -1) { T.map[k] = i; used.add(i); } });
  },
  tableRows() {
    const T = this.U.table, rows = T.sheets[T.sheet].slice(1);
    const out = [], seen = {};
    rows.forEach(r => {
      if (!r.some(c => String(c).trim())) return;
      const o = {}; MAP_FIELDS[T.target].forEach(([k]) => { o[k] = T.map[k] !== undefined && T.map[k] !== '' ? String(r[T.map[k]] ?? '').trim() : ''; });
      let st = 'ok';
      if (T.target === 'lo') { if (!o.kode_lo) st = 'nocode'; else if (!o.bunyi_lo) st = 'nostmt'; else if (seen[o.kode_lo.toLowerCase()]) st = 'dup'; else seen[o.kode_lo.toLowerCase()] = 1; }
      else if (!o.bab && !o.kode_lo) st = 'nocode';
      o._st = st; out.push(o);
    });
    return out;
  },
  stepMap() {
    const U = this.U, T = U.table, head = (T.sheets[T.sheet][0] || []).map(String), F = MAP_FIELDS[T.target], rows = this.tableRows();
    const cnt = { ok: 0, dup: 0, err: 0 }; rows.forEach(r => { if (r._st === 'ok') cnt.ok++; else if (r._st === 'dup') cnt.dup++; else cnt.err++; });
    const stl = { ok: '<span class="pill ok">✓ OK</span>', dup: '<span class="pill wait">Duplicate in file</span>', nocode: '<span class="pill bad">Empty ' + (T.target === 'lo' ? 'code' : 'chapter') + '</span>', nostmt: '<span class="pill bad">Empty statement</span>' };
    return '<div class="card"><div class="row between wrap mb"><h3>' + ic('table') + ' Map Columns · ' + esc(U.files[0] ? U.files[0].name : (U.linkInfo || {}).nama) + '</h3><span class="pill">No AI needed</span></div>' +
      '<div class="grid grid-2"><div class="field"><label class="label">Sheet tab</label><select class="select" data-tsheet>' + optionList(Object.keys(T.sheets), T.sheet) + '</select></div>' +
      '<div class="field"><label class="label">Import as</label><select class="select" data-ttarget>' + optionList([{ v: 'lo', l: 'Learning Objectives (LO Bank)' }, { v: 'topik', l: 'Topic Map (coursebook chapters)' }], T.target) + '</select></div></div>' +
      '<h4 class="mt-l">Columns</h4><div>' + F.map(([k, label, req]) => { const mapped = T.map[k] !== undefined && T.map[k] !== ''; return '<div class="map-row"><span class="label' + (req ? ' req' : '') + '">' + label + '</span><select class="select" data-map="' + k + '">' + optionList(head.map((h, i) => ({ v: i, l: h || 'Column ' + (i + 1) })), mapped ? T.map[k] : '', 'Not mapped') + '</select><span>' + (mapped ? '<span style="color:var(--accent)">' + ic('circle-check') + '</span>' : '') + '</span></div>'; }).join('') + '</div>' +
      '<div class="row wrap between mt">' + (T.target === 'lo' ? '<label class="check"><input type="checkbox" data-aiakt' + (U.isiAkt ? ' checked' : '') + '> Fill empty AKT levels with AI (uses AI quota)</label>' : '<span></span>') + '<button class="btn btn-ghost btn-sm" data-act="tpl">' + ic('download', 'ic-s') + 'Download Excel template</button></div>' +
      '<h4 class="mt-l mb">Preview (first 10 rows)</h4><div class="tbl-wrap"><table class="tbl"><thead><tr>' + F.filter(([k]) => T.map[k] !== undefined && T.map[k] !== '').map(f => '<th>' + f[1] + '</th>').join('') + '<th>Status</th></tr></thead><tbody>' +
      rows.slice(0, 10).map(r => '<tr>' + F.filter(([k]) => T.map[k] !== undefined && T.map[k] !== '').map(([k]) => '<td>' + (k === 'kode_lo' ? '<span class="code">' + esc(r[k]) + '</span>' : esc(String(r[k]).slice(0, 140))) + '</td>').join('') + '<td>' + stl[r._st] + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="summary-bar mt">' + rows.length + ' rows · ' + cnt.ok + ' OK' + (cnt.dup ? ' · ' + cnt.dup + ' duplicates skipped' : '') + (cnt.err ? ' · ' + cnt.err + ' errors skipped' : '') + '</div>' +
      '<h4 class="mt-l mb">Details</h4>' + this.metaForm(false) + '</div>' +
      '<div class="sticky-bar"><button class="btn btn-ghost" data-act="back">' + ic('chevron-left') + 'Back</button><button class="btn btn-primary" data-act="imp"' + (cnt.ok ? '' : ' disabled') + '>' + ic('file-spreadsheet') + 'Import ' + cnt.ok + ' rows</button></div>';
  },
  bindMap(el) {
    const T = this.U.table, rer = () => { const y = window.scrollY; this.render(el); window.scrollTo(0, y); };
    $('[data-tsheet]', el).addEventListener('change', (e) => { T.sheet = e.target.value; this.guessMap(); rer(); });
    $('[data-ttarget]', el).addEventListener('change', (e) => { T.target = e.target.value; this.guessMap(); rer(); });
    $$('[data-map]', el).forEach(s => s.addEventListener('change', () => { T.map[s.dataset.map] = s.value === '' ? '' : +s.value; rer(); }));
    const ai = $('[data-aiakt]', el); if (ai) ai.addEventListener('change', () => { this.U.isiAkt = ai.checked; });
    this.bindMeta(el);
  },
  async doImport(el, btn) {
    const U = this.U, T = U.table; $$('[data-m]', el).forEach(i => U.meta[i.dataset.m] = i.value.trim());
    if (!U.meta.program || !U.meta.mapel) return toast('Please choose the program and subject.', 'warn');
    const req = MAP_FIELDS[T.target].filter(f => f[2]).map(f => f[0]).filter(k => T.map[k] === undefined || T.map[k] === '');
    if (req.length) return toast('Please map the required columns first.', 'warn');
    const head = (T.sheets[T.sheet][0] || []).map(String); Store.set(userKey('map:' + T.target + '|' + head.join('|')), T.map);
    const rows = this.tableRows().filter(r => r._st === 'ok').map(r => { delete r._st; return r; });
    btnBusy(btn, true, U.isiAkt ? 'Importing + AI levels' : 'Importing');
    const r = await api('sumber.imporTabel', { target: T.target, meta: Object.assign({ jenis: U.jenis }, U.meta), rows, isiAktAI: U.isiAkt, langsungBersama: U.langsung, format: T.format,
      file: T.fileB64 ? { name: U.files[0].name, mime: U.files[0].type, base64: T.fileB64 } : null, link: U.files.length ? '' : U.link });
    btnBusy(btn, false);
    if (!r.success) return toast(r.message, 'err', 6000);
    U.done = true; cacheDel('dok:list'); cacheDel('boot');
    toast(r.data.ditambah + ' rows imported' + (r.data.digabung ? ', ' + r.data.digabung + ' merged' : '') + '.');
    guruBoot(true);
    go('dok', r.data.dokumen.dokumen_id);
  }
});

// =========================================================
// 4. DOKUMEN SAYA
// =========================================================
registerPage('dokumen', {
  title: 'My Documents', nav: 'dokumen', noTamu: true,
  template() {
    return '<div class="page-h"><div><h2>My Documents</h2><div class="sub">Sources you uploaded and their processing & verification status.</div></div><a class="btn btn-primary" href="#/unggah">' + ic('plus') + 'Upload Source</a></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search title or subject"></div><select class="select" data-ft><option value="">All types</option><option value="Silabus">Syllabus</option><option value="Ebook">Ebook</option><option value="Past Paper">Past Paper</option></select>' +
      '<select class="select" data-fs><option value="">All statuses</option><option value="proc">Processing</option><option value="Pribadi">Private</option><option value="Menunggu">Pending</option><option value="Terverifikasi">Verified</option><option value="Ditolak">Rejected</option><option value="Gagal">Failed</option></select></div>' +
      '<div data-list>' + skeletonRows(6) + '</div>';
  },
  mount(el) { const f = debounce(() => this.draw(el), 250); $('[data-q]', el).addEventListener('input', f); $$('select', el).forEach(s => s.addEventListener('change', () => this.draw(el))); },
  show(el) { this.load(el); },
  load(el, force) {
    swr('dok:list', 'sumber.saya', {}, (list) => { this.list = list; this.draw(el); this.poll(el); }, { fresh: force ? 0 : 20000, onError: (r) => { $('[data-list]', el).innerHTML = errorBox(r, 'retry'); } });
  },
  poll(el) {
    clearTimeout(this._p);
    const proc = (this.list || []).filter(d => d.status_proses === 'Antre' || d.status_proses === 'Diproses');
    setBadge('dok', proc.length);
    if (!proc.length) return;
    this._delay = Math.min((this._delay || 4000) * 1.5, 30000);
    this._p = setTimeout(async () => {
      if (AppState.page !== 'dokumen' || document.hidden) { this._delay = 4000; return; }
      const r = await api('sumber.status', { ids: proc.map(d => d.dokumen_id) });
      if (r.success) { const m = {}; r.data.forEach(d => m[d.dokumen_id] = d); let changed = false; this.list = this.list.map(d => { if (m[d.dokumen_id] && JSON.stringify(m[d.dokumen_id]) !== JSON.stringify(d)) { changed = true; return m[d.dokumen_id]; } return d; }); if (changed) { cacheSet('dok:list', this.list); this.draw(el); } }
      this.poll(el);
    }, this._delay);
  },
  draw(el) {
    const q = $('[data-q]', el).value.toLowerCase(), ft = $('[data-ft]', el).value, fs = $('[data-fs]', el).value;
    const list = (this.list || []).filter(d => (!q || (d.judul + ' ' + d.mapel + ' ' + d.program).toLowerCase().includes(q)) && (!ft || d.jenis === ft) &&
      (!fs || (fs === 'proc' ? ['Antre', 'Diproses'].includes(d.status_proses) : fs === 'Gagal' ? d.status_proses === 'Gagal' : d.status_verifikasi === fs)));
    if (!(this.list || []).length) { $('[data-list]', el).innerHTML = '<div class="card">' + emptyState('folder', 'No documents yet', 'Share your syllabus, ebook or past paper to enrich the LO Bank.', '<a class="btn btn-primary" href="#/unggah">' + ic('upload') + 'Upload Source</a>') + '</div>'; return; }
    $('[data-list]', el).innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Title</th><th>Type</th><th>Subject · Stage</th><th>Size</th><th>Processing</th><th>Verification</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(d => '<tr><td>' + fileIcon(d.format_file) + '</td><td><a class="bold" href="#/dok/' + encodeURIComponent(d.dokumen_id) + '">' + esc(d.judul) + '</a><div class="tiny muted">' + fmtRel(d.diunggah) + (d.jumlah_item ? ' · ' + d.jumlah_item + ' items' : '') + '</div>' +
        (d.status_verifikasi === 'Ditolak' && d.catatan_admin ? '<div class="alert bad mt-s small" style="padding:6px 10px">' + ic('message-square', 'ic-s') + esc(d.catatan_admin) + '</div>' : '') + '</td>' +
        '<td>' + esc(JENIS_EN[d.jenis] || d.jenis) + '</td><td>' + esc(d.mapel) + '<div class="tiny muted">' + esc([d.program, d.stage_grade].filter(Boolean).join(' · ')) + '</div></td><td class="small">' + esc(d.jumlah || '—') + '</td>' +
        '<td>' + statusPill(d.status_proses) + (['Antre', 'Diproses'].includes(d.status_proses) ? '<div class="progress mt-s" style="width:90px"><i style="width:' + d.progres + '%"></i></div>' : '') + '</td><td>' + statusPill(d.status_verifikasi) + '</td>' +
        '<td class="actions"><a class="btn btn-ghost btn-sm" href="#/dok/' + encodeURIComponent(d.dokumen_id) + '">' + ic('eye', 'ic-s') + 'Review</a>' + (d.url ? '<a class="btn btn-ghost btn-icon btn-sm" href="' + esc(d.url) + '" target="_blank" rel="noopener" title="View original" aria-label="View original">' + ic('external-link', 'ic-s') + '</a>' : '') + '</td></tr>').join('')
        : '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">No documents match the filter.</td></tr>') + '</tbody></table></div>';
  },
  acts: { retry(b, e, el) { this.load(el, true); } }
});

// =========================================================
// 5. TINJAU DOKUMEN (progres + hasil ekstraksi)
// =========================================================
const DOK_TABS = {
  lo: { label: 'Extracted LOs', key: 'lo_id', cols: [['kode_lo', 'Code', 'mono', 110], ['bunyi_lo', 'Statement', 'area'], ['stage_grade', 'Stage', '', 100], ['strand', 'Strand', '', 140], ['akt_saran', 'AKT', 'mono', 70]] },
  topik: { label: 'Topic Map', key: 'peta_id', cols: [['bab', 'Chapter', '', 160], ['sub_bab', 'Section', '', 160], ['halaman', 'Pages', '', 80], ['kode_lo', 'LO codes', 'mono', 140], ['ringkasan_konsep', 'Summary', 'area']] },
  soal: { label: 'Questions', key: 'soal_id', cols: [['nomor_soal', 'No.', '', 60], ['ringkasan_soal', 'Summary', 'area'], ['skor', 'Marks', '', 60], ['kode_lo', 'LO code', 'mono', 100], ['akt', 'AKT', 'mono', 70], ['halaman', 'Page', '', 60]] }
};
function dokTable(data, tab, editable) {
  const T = DOK_TABS[tab], rows = data[tab] || [];
  if (!rows.length) return '<div class="card">' + emptyState('book', 'Nothing extracted here', tab === 'soal' ? 'Questions are extracted from past papers.' : tab === 'topik' ? 'Topic maps come from coursebooks.' : 'LOs come from syllabus documents.') + '</div>';
  return '<div class="tbl-wrap"><table class="tbl" data-tab="' + tab + '"><thead><tr>' + T.cols.map(c => '<th' + (c[3] ? ' style="width:' + c[3] + 'px"' : '') + '>' + c[1] + '</th>').join('') + '<th>Flag</th>' + (editable ? '<th></th>' : '') + '</tr></thead><tbody>' +
    rows.map((r, i) => '<tr data-i="' + i + '" class="' + (r.bendera && !/Digabung/.test(r.bendera) ? 'flag' : '') + '">' + T.cols.map(c => '<td>' + (editable ? (c[2] === 'area' ? '<textarea class="cell" data-k="' + c[0] + '" rows="2">' + esc(r[c[0]]) + '</textarea>' : '<input class="cell' + (c[2] === 'mono' ? ' mono' : '') + '" data-k="' + c[0] + '" value="' + esc(r[c[0]]) + '">') : (c[0] === 'kode_lo' ? '<span class="code">' + esc(r[c[0]]) + '</span>' : /akt/.test(c[0]) ? aktPill(r[c[0]]) : esc(r[c[0]]))) + '</td>').join('') +
      '<td>' + (r.bendera ? '<span class="pill wait" title="' + esc(r.bendera) + '">⚠ ' + esc(r.bendera.replace('Kode tidak ditemukan di silabus', 'Code not in syllabus').replace(/Kode sudah ada di Bank Bersama.*/, 'Already shared — will merge')) + '</span>' : '') + '</td>' +
      (editable ? '<td class="actions"><button class="btn btn-ghost-danger btn-icon btn-sm" data-act="rmrow" aria-label="Delete row">' + ic('trash-2', 'ic-s') + '</button></td>' : '') + '</tr>').join('') + '</tbody></table></div>';
}

registerPage('dok', {
  title: 'Document', nav: 'dokumen', noTamu: true,
  template() { return '<div data-wrap>' + skeletonRows(8) + '</div>'; },
  show(el, id) {
    this.id = id; this.tab = this.tab || 'lo'; this.edits = { lo: {}, topik: {}, soal: {} }; this.del = { lo: [], topik: [], soal: [] };
    const c = cacheGet('dok:' + id); if (c) this.render(el, c); else $('[data-wrap]', el).innerHTML = skeletonRows(8);
    this.fetch(el, !c || ['Antre', 'Diproses'].includes(c.dokumen.status_proses));
  },
  fetch(el, force) {
    swr('dok:' + this.id, 'sumber.hasil', { dokumen_id: this.id }, (d) => { if (this.isDirty()) return; this.render(el, d); }, { fresh: force ? 0 : 30000, onError: (r) => $('[data-wrap]', el).innerHTML = errorBox(r, 'reload') });
  },
  isDirty() { return ['lo', 'topik', 'soal'].some(t => Object.keys(this.edits[t]).length || this.del[t].length); },
  render(el, d) {
    this.d = d; const doc = d.dokumen;
    const proc = ['Antre', 'Diproses'].includes(doc.status_proses);
    const editable = !proc && doc.status_proses !== 'Gagal' && (doc.status_verifikasi !== 'Terverifikasi' || isAdmin());
    let h = '<div class="page-h"><div><a href="#/dokumen" class="small">' + ic('arrow-left', 'ic-s') + ' My Documents</a><h2 class="mt-s row gap-s">' + fileIcon(doc.format_file) + esc(doc.judul) + '</h2><div class="sub">' + esc([JENIS_EN[doc.jenis], doc.program, doc.mapel, doc.stage_grade, doc.tahun_sesi, doc.jumlah].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="row wrap">' + statusPill(doc.status_proses) + statusPill(doc.status_verifikasi) + (doc.url ? '<a class="btn btn-outline btn-sm" href="' + esc(doc.url) + '" target="_blank" rel="noopener">' + ic('external-link', 'ic-s') + 'View original</a>' : '') + '</div></div>';
    if (proc) {
      const pages = /pages/.test(doc.jumlah || '') ? parseInt(doc.jumlah) : 0;
      h += '<div class="card"><div class="row gap-l"><div class="fileicon f-pdf" style="width:44px;height:52px">' + ic('loader-circle', 'spin') + '</div><div class="grow"><div class="bold">' + (doc.status_proses === 'Antre' ? 'Queued — processing starts within a minute' : 'Extracting with AI…') + '</div>' +
        '<div class="progress striped mt-s"><i style="width:' + Math.max(6, doc.progres) + '%"></i></div><div class="row between small muted mt-s"><span>' + (pages ? 'Pages ' + Math.min(pages, doc.bagian_selesai * 20) + ' / ' + pages : 'Part ' + doc.bagian_selesai + ' / ' + doc.total_bagian) + '</span><span>' + doc.jumlah_item + ' items found</span></div>' +
        '<p class="small muted mt">You can close the app. We\'ll email you when it\'s done.</p></div></div></div>';
      clearTimeout(this._p); this._p = setTimeout(() => { if (AppState.page === 'dok' && this.id === doc.dokumen_id && !document.hidden) this.fetch(el, true); }, 6000);
    } else if (doc.status_proses === 'Gagal') {
      h += '<div class="alert bad">' + ic('circle-alert') + '<div><b>Processing failed.</b> ' + esc(doc.galat || '') + '<div class="small mt-s">Try a clearer file or the publisher\'s PDF. ' + (isAdmin() ? 'Admins can retry from Source Documents.' : 'The QA admin can retry it.') + '</div></div></div>';
    } else {
      const vis = { Pribadi: ['info', 'lock', 'Private — only you can use these LOs. Submit them so the QA admin can share them with all teachers.'], Menunggu: ['warn', 'clock', 'Pending — the QA admin will review your document. You can still use these LOs.'],
        Terverifikasi: ['ok', 'circle-check', 'Verified — these items are in the Shared LO Bank for all teachers. Thank you!'], Ditolak: ['bad', 'circle-alert', 'Needs revision: ' + (doc.catatan_admin || '') + ' — fix the items and submit again.'] }[doc.status_verifikasi] || ['info', 'info', ''];
      h += '<div class="alert ' + vis[0] + ' mb">' + ic(vis[1]) + '<div>' + esc(vis[2]) + '</div></div>';
      h += '<div class="tabs mb">' + Object.keys(DOK_TABS).map(t => '<button class="' + (this.tab === t ? 'on' : '') + '" data-act="tab" data-t="' + t + '">' + DOK_TABS[t].label + ' <span class="count">' + (d[t] || []).length + '</span></button>').join('') + '</div>';
      h += '<div data-table>' + dokTable(d, this.tab, editable) + '</div>';
      const canSubmit = ['Pribadi', 'Ditolak'].includes(doc.status_verifikasi) && doc.pengunggah_id === (AppState.me || {}).id;
      if (editable || canSubmit) h += '<div class="sticky-bar"><span class="small muted" data-dirty>' + (editable ? 'Click a cell to edit.' : '') + '</span><div class="row">' + (editable ? '<button class="btn btn-outline" data-act="save" data-save disabled>' + ic('check') + 'Save changes</button>' : '') + (canSubmit ? '<button class="btn btn-success" data-act="submit">' + ic('send') + 'Submit to Shared Bank</button>' : '') + '</div></div>';
    }
    $('[data-wrap]', el).innerHTML = h;
    const tb = $('[data-table]', el);
    if (tb) tb.addEventListener('input', (e) => {
      const t = e.target; if (!t.dataset.k) return;
      const tr = t.closest('tr'), tab = tr.closest('table').dataset.tab, row = this.d[tab][+tr.dataset.i], key = DOK_TABS[tab].key;
      row[t.dataset.k] = t.value; (this.edits[tab][row[key]] = this.edits[tab][row[key]] || {})[t.dataset.k] = t.value; this.dirtyUI(el);
    });
  },
  dirtyUI(el) { const s = $('[data-save]', el), x = $('[data-dirty]', el), d = this.isDirty(); if (s) s.disabled = !d; if (x) x.textContent = d ? 'Unsaved changes' : 'Click a cell to edit.'; },
  acts: {
    reload(b, e, el) { this.fetch(el, true); },
    tab(b, e, el) { this.tab = b.dataset.t; $$('.tabs button', el).forEach(x => x.classList.toggle('on', x === b)); const doc = this.d.dokumen; $('[data-table]', el).innerHTML = dokTable(this.d, this.tab, !['Antre', 'Diproses', 'Gagal'].includes(doc.status_proses) && (doc.status_verifikasi !== 'Terverifikasi' || isAdmin())); },
    rmrow(b, e, el) { const tr = b.closest('tr'), tab = tr.closest('table').dataset.tab, i = +tr.dataset.i, row = this.d[tab][i]; this.del[tab].push(row[DOK_TABS[tab].key]); delete this.edits[tab][row[DOK_TABS[tab].key]]; this.d[tab].splice(i, 1); $('[data-table]', el).innerHTML = dokTable(this.d, tab, true); this.dirtyUI(el); },
    async save(b, e, el) {
      const payload = { dokumen_id: this.id, hapus: this.del };
      ['lo', 'topik', 'soal'].forEach(t => { const k = DOK_TABS[t].key; payload[t] = Object.keys(this.edits[t]).map(id => Object.assign({ [k]: id }, this.edits[t][id])); });
      btnBusy(b, true, 'Saving'); const r = await api('sumber.simpanHasil', payload); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      this.edits = { lo: {}, topik: {}, soal: {} }; this.del = { lo: [], topik: [], soal: [] }; toast('Changes saved.'); this.fetch(el, true);
    },
    async submit(b, e, el) {
      if (this.isDirty()) await this.acts.save.call(this, $('[data-save]', el), e, el);
      if (!(await confirmBox('Submit to Shared Bank?', 'The QA admin will review the extracted items. You can keep using them in the meantime.', 'Submit'))) return;
      btnBusy(b, true, 'Submitting'); const r = await api('sumber.ajukan', { dokumen_id: this.id }); btnBusy(b, false);
      if (!r.success) return toast(r.message, 'err');
      toast(r.message); cacheDel('dok:list'); this.fetch(el, true);
    }
  }
});

// =========================================================
// 6. RIWAYAT
// =========================================================
registerPage('riwayat', {
  title: 'History', nav: 'riwayat', noTamu: true,
  template() {
    return '<div class="page-h"><div><h2>History</h2><div class="sub">Your saved Learning Objective Plans.</div></div></div>' +
      '<div class="filterbar"><div class="input-icon">' + ic('search') + '<input class="input" data-q placeholder="Search topic or LO code"></div><select class="select" data-term></select><select class="select" data-kelas></select></div><div data-list>' + '<div class="sk sk-card mb"></div>'.repeat(3) + '</div>';
  },
  mount(el) { const f = debounce(() => this.draw(el), 250); $('[data-q]', el).addEventListener('input', f); $$('select', el).forEach(s => s.addEventListener('change', () => this.draw(el))); },
  show(el) { swr('riwayat', 'lo.riwayat', {}, (l) => { this.list = l; this.filters(el); this.draw(el); }, { fresh: 30000, onError: (r) => $('[data-list]', el).innerHTML = errorBox(r, 'retry') }); },
  filters(el) {
    const L = this.list || [], t = $('[data-term]', el), k = $('[data-kelas]', el), tv = t.value, kv = k.value;
    t.innerHTML = optionList([...new Set(L.map(x => x.term).filter(Boolean))], tv, 'All terms'); k.innerHTML = optionList([...new Set(L.map(x => x.kelas).filter(Boolean))].sort(), kv, 'All classes');
  },
  draw(el) {
    const q = $('[data-q]', el).value.toLowerCase(), t = $('[data-term]', el).value, k = $('[data-kelas]', el).value;
    const L = (this.list || []).filter(x => (!q || (x.topik + ' ' + (x.kode || []).join(' ') + ' ' + x.mapel).toLowerCase().includes(q)) && (!t || x.term === t) && (!k || x.kelas === k));
    if (!(this.list || []).length) { $('[data-list]', el).innerHTML = '<div class="card">' + emptyState('book', 'No saved plans yet', 'Your searches appear here automatically.', '<a class="btn btn-primary" href="#/cari">' + ic('search') + 'Find LO</a>') + '</div>'; return; }
    $('[data-list]', el).innerHTML = (L.length ? L.map(x => '<div class="card mb"><div class="row between wrap top"><div class="grow"><a class="bold" href="#/hasil/' + encodeURIComponent(x.pencarian_id) + '" style="font-size:16px">' + esc(x.topik) + '</a>' +
      '<div class="small muted mt-s">' + esc([x.program, x.mapel, x.grade, x.kelas && 'Class ' + x.kelas, x.term, x.jumlah_period + ' periods'].filter(Boolean).join(' · ')) + '</div><div class="row wrap gap-s mt-s">' + (x.kode || []).map(c => '<span class="code">' + esc(c) + '</span>').join('') + '</div></div>' +
      '<div class="col" style="align-items:flex-end"><span class="tiny muted">' + fmtDate(x.waktu, true) + '</span><div class="row wrap"><a class="btn btn-ghost btn-sm" href="#/hasil/' + encodeURIComponent(x.pencarian_id) + '">' + ic('eye', 'ic-s') + 'Open</a><button class="btn btn-ghost btn-sm" data-act="dup" data-id="' + esc(x.pencarian_id) + '">' + ic('copy', 'ic-s') + 'Duplicate for another class</button><button class="btn btn-ghost btn-sm" data-act="pdf" data-id="' + esc(x.pencarian_id) + '">' + ic('download', 'ic-s') + 'PDF</button></div></div></div></div>').join('')
      : '<div class="card muted" style="text-align:center">No plans match the filter.</div>');
  },
  acts: {
    retry(b, e, el) { this.show(el); },
    async dup(b, e, el) {
      const kelas = await promptBox('Duplicate for another class', 'Class', { placeholder: 'e.g. 8B', required: true, ok: 'Duplicate' }); if (!kelas) return;
      const r = await api('lo.duplikat', { pencarian_id: b.dataset.id, kelas }); if (!r.success) return toast(r.message, 'err');
      cacheSet('hasil:' + r.data.pencarian.pencarian_id, r.data); cacheDel('riwayat'); toast(r.message); go('hasil', r.data.pencarian.pencarian_id);
    },
    async pdf(b) { btnBusy(b, true); const r = await api('lo.pdf', { pencarian_id: b.dataset.id }); btnBusy(b, false); if (!r.success) return toast(r.message, 'err'); downloadBase64(r.data.base64, r.data.nama); }
  }
});
