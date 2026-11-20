/* =========================================================
   LO Finding — charts.js : grafik SVG ringan (tanpa pustaka)
   line · bar · hbarStack · donut · heatmap3 — semua responsif & mengikuti tema
   ========================================================= */
'use strict';
const Charts = (function () {
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const AKT = ['#93C5FD', '#60A5FA', '#5EC4C9', '#7CC79A', '#3FAE6B', '#1F7A4D'];
  function palette() { const p = cssv('--primary'), a = cssv('--accent'); return [p, a, C.mix(p, cssv('--card') || '#fff', .45), C.mix(a, cssv('--card') || '#fff', .45), cssv('--warn') || '#F59E0B', '#94A3B8', '#8B5CF6', '#EC4899']; }
  const e = (s) => esc(s);
  const wOf = (el) => Math.max(260, Math.round(el.clientWidth || 560));
  function niceMax(v) { if (v <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function legend(items) { return '<div class="legend">' + items.map(x => '<span><i style="background:' + x[1] + '"></i>' + e(x[0]) + '</span>').join('') + '</div>'; }
  function empty(msg) { return '<div class="empty" style="padding:24px">' + illu('chart') + '<p class="small">' + e(msg || 'No data yet') + '</p></div>'; }

  function line(el, labels, series, opt = {}) {
    const names = Object.keys(series), all = names.flatMap(n => series[n]);
    if (!all.some(v => v > 0)) { el.innerHTML = empty(opt.empty); return; }
    const W = wOf(el), H = 220, L = 34, R = 10, T = 12, B = 28, max = niceMax(Math.max(...all)), cols = palette();
    const x = (i) => L + i * ((W - L - R) / Math.max(1, labels.length - 1)), y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e(opt.label || 'Line chart') + '">';
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>'; }
    labels.forEach((l, i) => { if (labels.length <= 8 || i % 2 === 0) s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + e(l) + '</text>'; });
    names.forEach((n, k) => {
      const c = cols[k % cols.length], pts = series[n].map((v, i) => x(i) + ',' + y(v)).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
      series[n].forEach((v, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.2" fill="' + c + '"><title>' + e(n + ' · ' + labels[i] + ': ' + v) + '</title></circle>'; });
    });
    el.innerHTML = '<div class="chart">' + s + '</svg></div>' + legend(names.map((n, k) => [n, cols[k % cols.length]]));
  }

  function bar(el, items, opt = {}) {   // items: [{label, value, title}]
    if (!items.length || !items.some(i => i.value > 0)) { el.innerHTML = empty(opt.empty); return; }
    const W = wOf(el), H = 220, L = 34, R = 8, T = 12, B = 40, max = opt.max || niceMax(Math.max(...items.map(i => i.value))), c = opt.color || cssv('--accent');
    const bw = (W - L - R) / items.length, y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e(opt.label || 'Bar chart') + '">';
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + (opt.suffix || '') + '</text>'; }
    items.forEach((it, i) => {
      const x = L + i * bw + bw * .18, w = bw * .64, yy = y(it.value);
      s += '<rect x="' + x + '" y="' + yy + '" width="' + w + '" height="' + Math.max(0, H - B - yy) + '" rx="4" fill="' + c + '"><title>' + e(it.title || (it.label + ': ' + it.value + (opt.suffix || ''))) + '</title></rect>';
      s += '<text x="' + (x + w / 2) + '" y="' + (yy - 4) + '" text-anchor="middle" style="font-weight:600;fill:var(--text)">' + it.value + (opt.suffix || '') + '</text>';
      const lab = String(it.label); s += '<text x="' + (x + w / 2) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + e(lab.length > 12 ? lab.slice(0, 11) + '…' : lab) + '</text>';
    });
    el.innerHTML = '<div class="chart">' + s + '</svg></div>';
  }

  /** Batang horizontal bertumpuk: rows [{label, values:[...]}], seg [{name,color}] */
  function hstack(el, rows, seg, opt = {}) {
    if (!rows.length || !rows.some(r => r.values.some(v => v > 0))) { el.innerHTML = empty(opt.empty); return; }
    const W = wOf(el), rowH = 26, L = Math.min(120, W * .3), R = 40, H = rows.length * rowH + 8, max = Math.max(...rows.map(r => r.values.reduce((a, b) => a + b, 0)));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e(opt.label || 'Stacked bar chart') + '">';
    rows.forEach((r, i) => {
      const y = i * rowH + 4, tot = r.values.reduce((a, b) => a + b, 0); let x = L;
      s += '<text x="' + (L - 8) + '" y="' + (y + 14) + '" text-anchor="end">' + e(String(r.label).length > 18 ? String(r.label).slice(0, 17) + '…' : r.label) + '</text>';
      r.values.forEach((v, k) => { if (!v) return; const w = (W - L - R) * v / max; s += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(1, w - 1) + '" height="18" rx="3" fill="' + seg[k].color + '"><title>' + e(r.label + ' · ' + seg[k].name + ': ' + v) + '</title></rect>'; x += w; });
      s += '<text x="' + (x + 6) + '" y="' + (y + 14) + '" style="font-weight:600;fill:var(--text)">' + tot + '</text>';
    });
    el.innerHTML = '<div class="chart">' + s + '</svg></div>' + legend(seg.map(x => [x.name, x.color]));
  }

  function donut(el, items, opt = {}) {   // [{label, value, color}]
    const tot = items.reduce((a, b) => a + b.value, 0);
    if (!tot) { el.innerHTML = empty(opt.empty); return; }
    const R = 70, r = 44, cx = 90, cy = 90; let a0 = -Math.PI / 2, s = '<svg viewBox="0 0 320 180" role="img" aria-label="' + e(opt.label || 'Donut chart') + '">';
    items.forEach(it => {
      if (!it.value) return;
      const a1 = a0 + 2 * Math.PI * it.value / tot, big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1 - 0.0001), [x2, y2] = p(r, a1 - 0.0001), [x3, y3] = p(r, a0);
      s += '<path d="M' + x0 + ' ' + y0 + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + 'A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + x3 + ' ' + y3 + 'Z" fill="' + it.color + '"><title>' + e(it.label + ': ' + it.value + ' (' + Math.round(it.value / tot * 100) + '%)') + '</title></path>';
      a0 = a1;
    });
    s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" style="font-size:22px;font-weight:700;fill:var(--text);font-family:var(--font-head)">' + tot + '</text><text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle">' + e(opt.center || 'total') + '</text>';
    items.forEach((it, i) => { s += '<rect x="190" y="' + (34 + i * 28) + '" width="12" height="12" rx="3" fill="' + it.color + '"/><text x="210" y="' + (44 + i * 28) + '" style="fill:var(--text);font-size:12px">' + e(it.label) + '</text><text x="312" y="' + (44 + i * 28) + '" text-anchor="end" style="font-weight:600;fill:var(--text)">' + Math.round(it.value / tot * 100) + '%</text>'; });
    el.innerHTML = '<div class="chart">' + s + '</svg></div>';
  }

  function heat3(el, counts, opt = {}) {   // counts[9] urut 1..9
    const mx = Math.max(1, ...counts), p = cssv('--primary'), card = cssv('--card') || '#fff';
    const rows = ['Content', 'Process', 'Product'], cols = ['Readiness', 'Interest', 'Learning Profile'];
    let h = '<div class="dimatrix" style="grid-template-columns:70px repeat(3,1fr)"><span></span>' + cols.map(c => '<span class="hd">' + c + '</span>').join('');
    rows.forEach((r, ri) => { h += '<span class="rh">' + r + '</span>'; cols.forEach((c, ci) => { const v = counts[ri * 3 + ci] || 0, t = v / mx, bg = C.mix(card, p, .08 + t * .85); h += '<div title="' + e(r + ' × ' + c + ': ' + v) + '" style="min-height:52px;border-radius:8px;display:grid;place-items:center;font-weight:700;background:' + bg + ';color:' + C.onColor(bg) + '">' + v + '</div>'; }); });
    el.innerHTML = h + '</div>' + (counts.some(Boolean) ? '' : '<p class="tiny muted mt-s">No searches yet.</p>');
  }
  return { line, bar, hstack, donut, heat3, AKT, palette };
})();
window.Charts = Charts;
