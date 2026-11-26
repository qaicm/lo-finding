/* =========================================================
   LO Finding — analisis.js : Analyze LO / TP (v2.2)
   Masukkan satu LO (Cambridge) atau TP (non-Cambridge) →
   level AKT + penjelasan · jenis Differentiated Instruction + alasan rinci ·
   penerapan di kelas (pembukaan, kegiatan inti, penutup)
   ========================================================= */
'use strict';

const ANL_TXT = {
  en: { akt: 'Thinking level (AKT)', why: 'Why this level', lower: 'Why not a lower level', higher: 'Why not a higher level', evid: 'Evidence of mastery', verb: 'Key verb',
    di: 'Differentiated Instruction', rat: 'Why this type of DI', diag: 'How to find out learners\' readiness / interests', group: 'Grouping', tiers: 'What each group does', prep: 'Teacher preparation', others: 'Why not the other types', alt: 'Alternative',
    lesson: 'Classroom implementation', opening: 'Opening', main: 'Main activity', closing: 'Closing', teacher: 'Teacher', students: 'Students', diff: 'Differentiation', check: 'Check for understanding',
    assess: 'Assessment', sc: 'Success criteria', form: 'Formative', exit: 'Exit ticket', summ: 'Summative idea', mat: 'Materials', tips: 'Tips', min: 'min', support: 'Support' },
  id: { akt: 'Level berpikir (AKT)', why: 'Alasan level ini', lower: 'Mengapa bukan level di bawahnya', higher: 'Mengapa bukan level di atasnya', evid: 'Bukti ketercapaian', verb: 'Kata kerja kunci',
    di: 'Pembelajaran Berdiferensiasi (DI)', rat: 'Mengapa jenis DI ini dipilih', diag: 'Cara memetakan kesiapan / minat murid', group: 'Pengelompokan', tiers: 'Tugas tiap kelompok', prep: 'Persiapan guru', others: 'Mengapa bukan jenis lain', alt: 'Alternatif',
    lesson: 'Penerapan di kelas', opening: 'Pembukaan', main: 'Kegiatan inti', closing: 'Penutup', teacher: 'Guru', students: 'Murid', diff: 'Diferensiasi', check: 'Cek pemahaman',
    assess: 'Asesmen', sc: 'Kriteria keberhasilan', form: 'Formatif', exit: 'Tiket keluar', summ: 'Ide sumatif', mat: 'Bahan & alat', tips: 'Tips', min: 'menit', support: 'Dukungan' }
};
const DI_ELEM = { Content: 'what learners learn and how they access it', Process: 'how learners make sense of the idea', Product: 'how learners show what they learned' };
const DI_BASIS = { Readiness: 'current skill level', Interest: 'what engages them', 'Learning Profile': 'preferred ways of learning' };

function paras(s) { s = String(s || '').trim(); return s ? s.split(/\n{1,}/).filter(x => x.trim()).map(x => '<p>' + esc(x.trim()) + '</p>').join('') : ''; }
function liList(a) { a = (a || []).filter(x => String(x || '').trim()); return a.length ? '<ul class="anl-ul">' + a.map(x => '<li>' + esc(typeof x === 'string' ? x : JSON.stringify(x)) + '</li>').join('') + '</ul>' : ''; }
function sub(t, body) { return body ? '<div class="anl-sub"><h4>' + esc(t) + '</h4>' + body + '</div>' : ''; }

registerPage('analisis', {
  title: 'Analyze LO / TP', nav: 'analisis',
  template() {
    return '<div class="main-inner" style="max-width:960px;margin:0 auto">' +
      '<div class="page-h"><div><h2>' + ic('microscope') + ' Analyze LO / TP</h2><div class="sub">Type one objective → thinking level (AKT), the best type of Differentiated Instruction, and a detailed lesson flow.</div></div></div>' +
      '<form class="card" data-anl-form novalidate>' +
      '<div class="row between wrap" style="gap:10px"><div class="seg" role="tablist" aria-label="Objective type"><button type="button" class="on" data-act="jenis" data-v="LO" aria-pressed="true">LO · Cambridge</button><button type="button" data-act="jenis" data-v="TP" aria-pressed="false">TP · Non-Cambridge</button></div>' +
      '<span class="tiny muted" data-jhint>Cambridge learning objective — result in English</span></div>' +
      '<div class="field mt"><label class="label req" for="an-teks" data-tlabel>Learning objective (LO)</label><textarea class="textarea" id="an-teks" rows="3" maxlength="1200" placeholder="e.g. 8Ae.04 Understand that a situation can be represented either in words or as a linear equation…"></textarea><div class="tiny muted mt-s">Paste one objective. Include the code if you have it.</div></div>' +
      '<div class="ctx-grid">' +
      '<div class="field"><label class="label" for="an-mapel">Subject</label><input class="input" id="an-mapel" list="an-mapel-list" placeholder="e.g. Mathematics"><datalist id="an-mapel-list"></datalist></div>' +
      '<div class="field"><label class="label" for="an-tingkat">Stage / Grade</label><input class="input" id="an-tingkat" placeholder="e.g. Stage 8 / Kelas 8"></div>' +
      '<div class="field"><label class="label" for="an-period">Lesson length</label><div class="row"><div class="stepper"><button type="button" data-act="pm" aria-label="Fewer periods">−</button><input type="number" id="an-period" min="1" max="4" value="2"><button type="button" data-act="pp" aria-label="More periods">+</button></div><span class="pill" data-menit></span></div></div>' +
      '<div class="field"><label class="label" for="an-bahasa">Result language</label><select class="select" id="an-bahasa"><option value="">Automatic</option><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></div>' +
      '</div>' +
      '<div class="field"><label class="label" for="an-profil">Class profile <span class="muted" style="font-weight:400">(optional — makes the DI advice sharper)</span></label><textarea class="textarea" id="an-profil" rows="2" maxlength="800" placeholder="e.g. 24 students; 5 still struggle with negative numbers; many like football; 3 EAL learners"></textarea></div>' +
      '<div class="row between wrap mt"><span class="tiny muted" data-quota></span><button class="btn btn-primary" type="submit" data-run>' + ic('sparkles') + 'Analyse</button></div>' +
      '</form>' +
      '<div data-out></div>' +
      '<div class="card mt" data-recent><div class="card-h"><h3>' + ic('history') + 'Recent analyses</h3></div><div data-rlist>' + skeletonRows(3) + '</div></div>' +
      '</div>';
  },
  mount(el) {
    this.jenis = 'LO';
    const b = boot(), mp = (b.opsi && b.opsi.mapel) || [];
    $('#an-mapel-list', el).innerHTML = mp.map(m => '<option value="' + esc(typeof m === 'object' ? m.v || m.l : m) + '">').join('');
    if (AppState.me && AppState.me.mapel) $('#an-mapel', el).value = AppState.me.mapel;
    $('#an-period', el).addEventListener('input', () => this.menit(el));
    $('[data-anl-form]', el).addEventListener('submit', (e) => { e.preventDefault(); this.run(el); });
    this.menit(el);
  },
  show(el, param) {
    const q = boot().kuota || {};
    $('[data-quota]', el).textContent = q.aiMaks ? 'AI today: ' + (q.ai || 0) + ' / ' + q.aiMaks + ' · saved results and templates are free' : '';
    swr('anlr', 'analisis.riwayat', {}, (l) => { this.list = l; this.drawRecent(el); }, { fresh: 30000, onError: (r) => $('[data-rlist]', el).innerHTML = errorBox(r, 'rretry') });
    if (param) this.open(el, param);
    else if (this.cur && this.cur.analisis_id) { /* tetap tampilkan hasil terakhir */ }
  },
  menit(el) {
    const i = $('#an-period', el), v = Math.max(1, Math.min(4, Number(i.value) || 1)); if (String(v) !== i.value) i.value = v;
    $('[data-menit]', el).textContent = v + ' period' + (v > 1 ? 's' : '') + ' · ' + v * menitPeriod() + ' min';
  },
  async run(el) {
    const teks = $('#an-teks', el).value.trim();
    if (teks.length < 8) { $('#an-teks', el).focus(); return toast('Please type the ' + (this.jenis === 'TP' ? 'Tujuan Pembelajaran' : 'learning objective') + ' first.', 'warn'); }
    const btn = $('[data-run]', el), out = $('[data-out]', el);
    const d = { jenis: this.jenis, teks, mapel: $('#an-mapel', el).value.trim(), tingkat: $('#an-tingkat', el).value.trim(), period: Number($('#an-period', el).value) || 2, profil: $('#an-profil', el).value.trim(), bahasa: $('#an-bahasa', el).value };
    btnBusy(btn, true, 'Analysing…');
    out.innerHTML = '<div class="card mt" aria-live="polite"><div class="row gap-s">' + ic('loader-circle', 'spin') + '<b data-stage>Reading the objective…</b></div><p class="small muted mt-s">AI analysis usually takes 15–40 seconds. Saved results appear instantly.</p>' + '<div class="sk sk-card mt"></div>'.repeat(2) + '</div>';
    const stages = ['Reading the objective…', 'Finding the thinking level (AKT)…', 'Choosing the best DI type…', 'Writing the lesson flow…', 'Almost done…'];
    let si = 0; const tm = setInterval(() => { const s = $('[data-stage]', out); if (s && si < stages.length - 1) s.textContent = stages[++si]; }, 6000);
    const r = await api('analisis.jalankan', d, { timeout: 120000 });
    clearInterval(tm); btnBusy(btn, false);
    if (!r.success) { out.innerHTML = '<div class="card mt">' + errorBox(r, 'rerun') + '</div>'; return; }
    afterWrite(r);
    this.cur = r.data; cacheSet('anl:' + r.data.analisis_id, r.data); cacheDel('anlr');
    if (r.data.sumber === 'ai' && AppState.boot && AppState.boot.kuota) AppState.boot.kuota.ai = (AppState.boot.kuota.ai || 0) + 1;
    this.render(el, r.data);
    history.replaceState(null, '', '#/analisis/' + encodeURIComponent(r.data.analisis_id));
    swr('anlr', 'analisis.riwayat', {}, (l) => { this.list = l; this.drawRecent(el); }, { fresh: 0 });
    setTimeout(() => out.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  },
  async open(el, id) {
    const c = cacheGet('anl:' + id);
    if (c) { this.cur = c; this.fill(el, c); return this.render(el, c); }
    $('[data-out]', el).innerHTML = '<div class="card mt">' + '<div class="sk sk-card"></div>'.repeat(2) + '</div>';
    const r = await api('analisis.detail', { analisis_id: id });
    if (!r.success) { $('[data-out]', el).innerHTML = '<div class="card mt">' + errorBox(r, 'rretry') + '</div>'; return; }
    this.cur = r.data; cacheSet('anl:' + id, r.data); this.fill(el, r.data); this.render(el, r.data);
  },
  fill(el, d) {
    this.setJenis(el, d.jenis);
    $('#an-teks', el).value = d.teks || ''; $('#an-mapel', el).value = d.mapel || ''; $('#an-tingkat', el).value = d.tingkat || '';
    $('#an-period', el).value = d.period || 2; $('#an-profil', el).value = d.profil || ''; this.menit(el);
  },
  setJenis(el, j) {
    this.jenis = j === 'TP' ? 'TP' : 'LO';
    $$('[data-act="jenis"]', el).forEach(b => { const on = b.dataset.v === this.jenis; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('[data-tlabel]', el).textContent = this.jenis === 'TP' ? 'Tujuan Pembelajaran (TP)' : 'Learning objective (LO)';
    $('[data-jhint]', el).textContent = this.jenis === 'TP' ? 'Kurikulum Merdeka / non-Cambridge — hasil dalam Bahasa Indonesia' : 'Cambridge learning objective — result in English';
    $('#an-teks', el).placeholder = this.jenis === 'TP' ? 'mis. Peserta didik mampu menganalisis pengaruh kondisi geografis terhadap kegiatan ekonomi masyarakat.' : 'e.g. 8Ae.04 Understand that a situation can be represented either in words or as a linear equation…';
  },
  render(el, d) {
    const h = d.hasil || {}, T = ANL_TXT[d.bahasa === 'id' ? 'id' : 'en'], A = h.akt || {}, D = h.di || {}, L = h.lesson || {}, S = h.assessment || {};
    const src = d.sumber === 'ai' ? ['ok', 'sparkles', 'Analysed by AI'] : d.sumber === 'cache' ? ['info', 'archive', 'Saved result — same objective analysed before (no AI quota used)'] : ['warn', 'layout-template', 'Template result' + (d.sumberAlasan ? ' (' + d.sumberAlasan + ')' : '') + ' — estimated from the verb; ask an admin to set up AI for a deeper analysis'];
    const cell = Number(D.cell) || 0, alt = Number((D.alternative || {}).cell) || 0;
    let g = '<div class="dimatrix ro"><span></span>' + DI.cols.map(c => '<span class="hd">' + c + '</span>').join('');
    DI.rows.forEach((r, ri) => { g += '<span class="rh">' + r + '</span>'; DI.cols.forEach((c, ci) => { const n = ri * 3 + ci + 1; g += '<button type="button" tabindex="-1" class="' + (n === cell ? 'on' : n === alt ? 'alt' : '') + '" title="' + r + ' × ' + c + '">' + n + '</button>'; }); });
    g += '</div>';
    const tiers = (D.tiers || []).filter(t => t && (t.task || t.group));
    const phase = (k, label, ico) => {
      const st = L[k] || []; if (!st.length) return '';
      const m = st.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
      return '<div class="anl-phase ph-' + k + '"><div class="anl-ph"><span class="anl-dot">' + ic(ico) + '</span><h4>' + esc(label) + '</h4><span class="pill">' + m + ' ' + T.min + '</span></div>' +
        st.map(s => '<div class="anl-step"><div class="anl-min">' + (Number(s.minutes) || 0) + '<small>' + T.min + '</small></div><div class="grow">' +
          (s.title ? '<div class="bold">' + esc(s.title) + '</div>' : '') +
          (s.teacher ? '<div class="anl-kv"><span>' + T.teacher + '</span>' + paras(s.teacher) + '</div>' : '') +
          (s.students ? '<div class="anl-kv"><span>' + T.students + '</span>' + paras(s.students) + '</div>' : '') +
          (s.differentiation ? '<div class="anl-kv di"><span>' + T.diff + '</span>' + paras(s.differentiation) + '</div>' : '') +
          (s.check ? '<div class="anl-kv ck"><span>' + T.check + '</span>' + paras(s.check) + '</div>' : '') + '</div></div>').join('') + '</div>';
    };
    const lv = String(A.code || '').slice(-1);
    $('[data-out]', el).innerHTML = '<div class="anl-out mt" data-print>' +
      '<div class="alert ' + src[0] + ' src-note no-print">' + ic(src[1], 'ic-s') + '<span class="small">' + esc(src[2]) + '</span></div>' +
      '<div class="card mt"><div class="row between wrap top"><div class="grow"><span class="pill info">' + esc(d.jenis) + '</span> <span class="tiny muted">' + esc([d.mapel, d.tingkat, d.period + ' × ' + (d.menit || menitPeriod()) + ' ' + T.min].filter(Boolean).join(' · ')) + '</span>' +
      '<p class="anl-obj">' + esc(d.teks) + '</p></div>' +
      '<div class="row wrap anl-actions"><button class="btn btn-ghost btn-sm" data-act="copy">' + ic('copy', 'ic-s') + 'Copy</button><button class="btn btn-ghost btn-sm" data-act="print">' + ic('printer', 'ic-s') + 'Print / PDF</button><button class="btn btn-ghost btn-sm" data-act="baru">' + ic('plus', 'ic-s') + 'New</button></div></div></div>' +
      // AKT
      '<div class="card mt"><div class="card-h"><h3>' + ic('brain') + esc(T.akt) + '</h3></div><div class="anl-akt"><div class="anl-code c' + lv + '">' + esc(A.code || '—') + '</div><div class="grow">' +
      '<div class="bold" style="font-size:16px">' + esc([A.knowledge, A.process].filter(Boolean).join(' + ') || aktLabel(A.code || '')) + '</div>' +
      (A.key_verb ? '<div class="small muted">' + esc(T.verb) + ': <b>' + esc(A.key_verb) + '</b></div>' : '') +
      '<div class="anl-ladder" aria-hidden="true">' + [1, 2, 3, 4, 5, 6].map(i => '<i class="' + (String(i) === lv ? 'on' : '') + '">C' + i + '</i>').join('') + '</div></div></div>' +
      sub(T.why, paras(A.explanation)) + sub(T.lower, paras(A.why_not_lower)) + sub(T.higher, paras(A.why_not_higher)) + sub(T.evid, paras(A.evidence)) + '</div>' +
      // DI
      '<div class="card mt"><div class="card-h"><h3>' + ic('split') + esc(T.di) + '</h3></div><div class="anl-di"><div>' + g + '<p class="tiny muted mt-s">■ ' + (d.bahasa === 'id' ? 'dipilih' : 'chosen') + (alt ? ' · ▢ ' + T.alt.toLowerCase() : '') + '</p></div><div class="grow">' +
      '<div class="anl-dicell">' + cell + '</div><div class="bold" style="font-size:16px">' + esc(D.title || (D.element + ' × ' + D.basis)) + '</div>' +
      '<div class="small mt-s"><b>' + esc(D.element || '') + '</b> — ' + esc(DI_ELEM[D.element] || '') + '<br><b>' + esc(D.basis || '') + '</b> — ' + esc(DI_BASIS[D.basis] || '') + '</div></div></div>' +
      sub(T.rat, paras(D.rationale)) + sub(T.diag, paras(D.diagnosis)) + sub(T.group, paras(D.grouping)) +
      (tiers.length ? '<div class="anl-sub"><h4>' + esc(T.tiers) + '</h4><div class="anl-tiers">' + tiers.map((t, i) => '<div class="anl-tier t' + i + '"><div class="bold">' + esc(t.group || 'Group ' + (i + 1)) + '</div>' + (t.who ? '<div class="tiny muted">' + esc(t.who) + '</div>' : '') + paras(t.task) + (t.support ? '<div class="small"><b>' + T.support + ':</b> ' + esc(t.support) + '</div>' : '') + '</div>').join('') + '</div></div>' : '') +
      sub(T.prep, liList(D.preparation)) + sub(T.others, paras(D.why_not_others)) +
      (alt ? sub(T.alt + ' — ' + alt + ' · ' + diName(alt), paras((D.alternative || {}).when)) : '') + '</div>' +
      // Lesson
      '<div class="card mt"><div class="card-h"><h3>' + ic('presentation') + esc(T.lesson) + '</h3><span class="pill">' + (L.total_minutes || '') + ' ' + T.min + '</span></div>' +
      '<div class="anl-tl">' + phase('opening', T.opening, 'door-open') + phase('main', T.main, 'users') + phase('closing', T.closing, 'flag') + '</div>' +
      (L.sessions > 1 ? '<p class="small muted">' + esc((h.tips || [])[0] || '') + '</p>' : '') + '</div>' +
      // Assessment + materials
      '<div class="card mt"><div class="card-h"><h3>' + ic('clipboard-check') + esc(T.assess) + '</h3></div>' +
      sub(T.sc, liList(S.success_criteria)) + sub(T.form, paras(S.formative)) + sub(T.exit, paras(S.exit_ticket)) + sub(T.summ, paras(S.summative_idea)) +
      sub(T.mat, liList(h.materials)) + sub(T.tips, liList(h.tips)) + '</div>' +
      '</div>';
  },
  drawRecent(el) {
    const L = this.list || [];
    $('[data-rlist]', el).innerHTML = L.length ? L.slice(0, 15).map(x => '<div class="anl-ri"><a href="#/analisis/' + encodeURIComponent(x.analisis_id) + '" class="grow"><span class="pill info">' + esc(x.jenis) + '</span> ' + aktPill(x.akt) + (x.di_cell ? ' <span class="pill">DI ' + x.di_cell + '</span>' : '') +
      '<div class="small mt-s anl-rt">' + esc(x.teks) + '</div><div class="tiny muted">' + esc([x.mapel, x.tingkat, fmtRel(x.dibuat)].filter(Boolean).join(' · ')) + '</div></a>' +
      '<button class="icon-btn" data-act="hapus" data-id="' + esc(x.analisis_id) + '" title="Delete" aria-label="Delete analysis">' + ic('trash-2', 'ic-s') + '</button></div>').join('')
      : emptyState('book', 'No analyses yet', 'Your analyses appear here so you can reopen them any time.');
  },
  plain(d) {
    const h = d.hasil || {}, T = ANL_TXT[d.bahasa === 'id' ? 'id' : 'en'], A = h.akt || {}, D = h.di || {}, L = h.lesson || {}, S = h.assessment || {}, out = [];
    out.push(d.jenis + ': ' + d.teks, [d.mapel, d.tingkat].filter(Boolean).join(' · '), '');
    out.push('== ' + T.akt + ': ' + A.code + ' (' + [A.knowledge, A.process].filter(Boolean).join(' + ') + ')', A.explanation || '');
    if (A.why_not_lower) out.push(T.lower + ': ' + A.why_not_lower); if (A.why_not_higher) out.push(T.higher + ': ' + A.why_not_higher); if (A.evidence) out.push(T.evid + ': ' + A.evidence);
    out.push('', '== ' + T.di + ': ' + D.cell + ' · ' + D.element + ' × ' + D.basis + (D.title ? ' — ' + D.title : ''), D.rationale || '');
    if (D.diagnosis) out.push(T.diag + ': ' + D.diagnosis); if (D.grouping) out.push(T.group + ': ' + D.grouping);
    (D.tiers || []).forEach(t => out.push('• ' + (t.group || '') + (t.who ? ' (' + t.who + ')' : '') + ': ' + (t.task || '') + (t.support ? ' — ' + t.support : '')));
    if ((D.preparation || []).length) out.push(T.prep + ': ' + D.preparation.join('; ')); if (D.why_not_others) out.push(T.others + ': ' + D.why_not_others);
    out.push('', '== ' + T.lesson + ' (' + L.total_minutes + ' ' + T.min + ')');
    [['opening', T.opening], ['main', T.main], ['closing', T.closing]].forEach(([k, lab]) => { out.push('-- ' + lab); (L[k] || []).forEach(s => out.push(s.minutes + ' ' + T.min + ' – ' + (s.title ? s.title + ': ' : '') + (s.teacher || '') + (s.students ? ' | ' + T.students + ': ' + s.students : '') + (s.differentiation ? ' | ' + T.diff + ': ' + s.differentiation : '') + (s.check ? ' | ' + T.check + ': ' + s.check : ''))); });
    out.push('', '== ' + T.assess); (S.success_criteria || []).forEach(x => out.push('✓ ' + x));
    if (S.formative) out.push(T.form + ': ' + S.formative); if (S.exit_ticket) out.push(T.exit + ': ' + S.exit_ticket); if (S.summative_idea) out.push(T.summ + ': ' + S.summative_idea);
    if ((h.materials || []).length) out.push('', T.mat + ': ' + h.materials.join('; '));
    return out.join('\n');
  },
  acts: {
    jenis(b, e, el) { this.setJenis(el, b.dataset.v); },
    pm(b, e, el) { const i = $('#an-period', el); i.value = Math.max(1, (Number(i.value) || 1) - 1); this.menit(el); },
    pp(b, e, el) { const i = $('#an-period', el); i.value = Math.min(4, (Number(i.value) || 1) + 1); this.menit(el); },
    rerun(b, e, el) { this.run(el); },
    rretry(b, e, el) { this.show(el); },
    async copy() { if (this.cur && await copyText(this.plain(this.cur))) toast('Copied — paste it into your lesson plan.'); },
    print() { document.body.classList.add('print-anl'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-anl'), 500); }, 50); },
    baru(b, e, el) { this.cur = null; $('[data-out]', el).innerHTML = ''; $('#an-teks', el).value = ''; history.replaceState(null, '', '#/analisis'); $('#an-teks', el).focus(); window.scrollTo(0, 0); },
    async hapus(b, e, el) {
      if (!await confirmBox('Delete analysis?', 'This removes it from your list.', 'Delete', true)) return;
      const r = await api('analisis.hapus', { analisis_id: b.dataset.id }); if (!r.success) return toast(r.message, 'err');
      cacheDel('anl:' + b.dataset.id); cacheDel('anlr'); this.list = (this.list || []).filter(x => x.analisis_id !== b.dataset.id); this.drawRecent(el);
      if (this.cur && this.cur.analisis_id === b.dataset.id) this.acts.baru.call(this, b, e, el);
      toast('Deleted.');
    }
  }
});
