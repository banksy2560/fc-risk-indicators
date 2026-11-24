/* Linkage view: hub-and-spoke diagram. Typology card in the centre, indicators left, controls right.
   Reverse mode: an indicator or control in the centre, the typologies it appears in on the left. */
(async function () {
'use strict';
const { $, $$, esc, MARK, KIND, sig, kindOf } = FC;
let X;
try { X = await FC.loadIndex(); } catch (e) { FC.fail(); return; }
const { TM, IM, CM } = X;
const lab = X.labels;
const view = $('#view'), strip = $('#strip'), q = $('#q'), qlist = $('#qlist');
const drawer = $('#drawer'), dbody = $('#dbody'), scrim = $('#scrim');
const DEFAULT = 'ML-MULE', LIM = 8;
const SEVR = { high: 0, medium: 1, low: 2 };
const flat = () => window.matchMedia('(max-width:1000px)').matches;
const modal = () => window.matchMedia('(max-width:1099px)').matches;
const pl = n => n + ' typolog' + (n === 1 ? 'y' : 'ies');

/* ---------- state + hash ---------- */
let S = { mode: 't', id: DEFAULT, sel: null, want: '' };   // mode: t (typology) | i | c (reverse)
let CB = { on: false, p: '', c: '' };                        // consumer bank view
let dom = '';                                                // '' = follow the open typology, 'all', or a domain id
let cur = null, M = null, tok = 0, ex = { l: false, r: false };

function parseHash() {
  const o = { id: '', sel: '', cb: null };
  decodeURIComponent(location.hash.slice(1)).split('&').forEach((p, n) => {
    const [k, v] = p.split('=');
    if (v === undefined) { if (n === 0 && k) o.id = k; } else if (k === 't') o.id = v; else if (k === 'sel') o.sel = v;
    else if (k === 'cb') { const [a, b] = v.split('~'); o.cb = { p: a || '', c: b || '' }; }
  });
  return o;
}
function applyHash() {
  const h = parseHash();
  if (h.cb) CB = { on: true, p: lab.cp[h.cb.p] ? h.cb.p : '', c: lab.cc[h.cb.c] ? h.cb.c : '' };
  const k = kindOf(h.id);
  if (k === 't' && TM[h.id]) S = { mode: 't', id: h.id, sel: null, want: h.sel };
  else if (k === 'i' && IM[h.id]) S = { mode: 'i', id: h.id, sel: null, want: '' };
  else if (k === 'c' && CM[h.id]) S = { mode: 'c', id: h.id, sel: null, want: '' };
  else if (h.cb) { const l = stripList(); S = { mode: 't', id: (l[0] || TM[DEFAULT]).id, sel: null, want: '' }; }
  else return false;
  return true;
}
const hashFor = s => '#' + s.id + (s.mode === 't' && s.sel ? '&sel=' + s.sel.id : '') + (CB.on ? '&cb=' + CB.p + '~' + CB.c : '');
function writeHash(push) {
  const h = hashFor(S);
  if (location.hash === h) return;
  history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + location.search + h);
}
function go(mode, id, sel, push) { S = { mode, id, sel: null, want: sel || '' }; writeHash(push !== false); render(); }

/* ---------- consumer bank filter + tab strip ---------- */
const cbMatch = t => t.x || (t.cn.r && (!CB.p || t.cn.p.includes(CB.p)) && (!CB.c || t.cn.c.includes(CB.c)));
function stripList() {
  const cur = S.mode === 't' && TM[S.id] ? TM[S.id].d : X.domains[0];
  const d = dom === 'all' ? '' : (dom || (CB.on ? '' : cur));
  return X.T.filter(t => (!CB.on || cbMatch(t)) && (!d || t.d === d));
}
function paintControls() {
  const opts = [['all', 'All domains']].concat(X.domains.map(d => [d, lab.dom[d]]));
  $('#dom').innerHTML = opts.map(o => '<option value="' + o[0] + '">' + esc(o[1]) + '</option>').join('');
  $('#dom').value = dom || (CB.on ? 'all' : (S.mode === 't' ? TM[S.id].d : 'all'));
  $('#cbon').checked = CB.on; $('#cbrow').hidden = !CB.on;
  const po = '<option value="">Any product</option>' + Object.keys(lab.cp).map(k => '<option value="' + k + '">' + esc(lab.cp[k]) + '</option>').join('');
  const co = '<option value="">Any channel</option>' + Object.keys(lab.cc).map(k => '<option value="' + k + '">' + esc(lab.cc[k]) + '</option>').join('');
  if ($('#cbp').options.length === 0) { $('#cbp').innerHTML = po; $('#cbc').innerHTML = co; }
  $('#cbp').value = CB.p; $('#cbc').value = CB.c;
  if (CB.on) {
    const spec = X.T.filter(t => !t.x && t.cn.r && (!CB.p || t.cn.p.includes(CB.p)) && (!CB.c || t.cn.c.includes(CB.c))).length, all = X.T.filter(t => t.x).length;
    const what = (CB.p ? lab.cp[CB.p] : 'any product') + ' via ' + (CB.c ? lab.cc[CB.c] : 'any channel');
    $('#cbnote').textContent = spec + ' typolog' + (spec === 1 ? 'y' : 'ies') + ' relevant to ' + what + ', plus ' + all + ' that apply across all products. Tags are AI-inferred, not any institution\'s assessed exposure.';
  }
}
function paintStrip() {
  const l = stripList();
  strip.hidden = S.mode !== 't';
  if (!l.length) { strip.innerHTML = '<span class="none">No typologies match this filter.</span>'; return; }
  const on = S.mode === 't' ? S.id : '';
  strip.innerHTML = l.map(t => '<button type="button" data-t="' + t.id + '" aria-pressed="' + (t.id === on) + '" tabindex="' + (t.id === on ? 0 : -1) + '">' + esc(t.n) + '</button>').join('');
  if (!l.some(t => t.id === on)) { const f = $('button', strip); if (f) f.tabIndex = 0; }
  const b = $('button[aria-pressed="true"]', strip);
  if (b) strip.scrollLeft = Math.max(0, b.offsetLeft - strip.clientWidth / 2 + b.offsetWidth / 2);
}
strip.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) go('t', b.dataset.t, '', true); });
strip.addEventListener('keydown', e => {
  const bs = $$('button', strip), at = bs.indexOf(document.activeElement); if (at < 0) return;
  const to = e.key === 'ArrowRight' ? bs[at + 1] : e.key === 'ArrowLeft' ? bs[at - 1] : e.key === 'Home' ? bs[0] : e.key === 'End' ? bs[bs.length - 1] : null;
  if (to) { e.preventDefault(); bs.forEach(b => b.tabIndex = -1); to.tabIndex = 0; to.focus(); }
});
$('#dom').addEventListener('change', e => { dom = e.target.value; paintControls(); paintStrip(); const l = stripList(); if (S.mode === 't' && l.length && !l.some(t => t.id === S.id)) go('t', l[0].id); });
$('#cbon').addEventListener('change', e => { CB.on = e.target.checked; dom = CB.on ? 'all' : ''; afterFilter(); });
$('#cbp').addEventListener('change', e => { CB.p = e.target.value; afterFilter(); });
$('#cbc').addEventListener('change', e => { CB.c = e.target.value; afterFilter(); });
function afterFilter() {
  paintControls(); paintStrip();
  const l = stripList();
  if (S.mode === 't' && l.length && !l.some(t => t.id === S.id)) go('t', l[0].id); else writeHash(false);
}

/* ---------- search ---------- */
let results = [], active = -1;
function score(name, id, toks) {
  const n = name.toLowerCase(), i = id.toLowerCase(); let s = 0;
  for (const t of toks) {
    if (n.startsWith(t) || i.startsWith(t)) s += 3; else if (n.includes(' ' + t)) s += 2; else if (n.includes(t) || i.includes(t)) s += 1; else return 0;
  }
  return s;
}
function search(text) {
  const toks = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const rank = (arr, k, nameOf, max) => arr.map(r => ({ k, r, s: score(nameOf(r), r.id, toks) })).filter(x => x.s)
    .sort((a, b) => b.s - a.s || (b.r.u || 0) - (a.r.u || 0) || nameOf(a.r).localeCompare(nameOf(b.r))).slice(0, max);
  return [].concat(rank(X.T, 't', r => r.n + ' ' + (lab.dom[r.d] || ''), 6), rank(X.I, 'i', r => r.n, 8), rank(X.C, 'c', r => r.n, 8));
}
function paintResults() {
  if (!results.length) {
    qlist.hidden = !q.value.trim(); qlist.innerHTML = q.value.trim() ? '<li role="presentation" class="meta">No match. Try fewer words.</li>' : '';
    q.setAttribute('aria-expanded', String(!qlist.hidden)); return;
  }
  let html = '', last = '';
  results.forEach((x, n) => {
    if (x.k !== last) { last = x.k; html += '<li role="presentation" class="eyebrow">' + (x.k === 't' ? 'Typologies' : KIND[x.k] + 's') + '</li>'; }
    const meta = x.k === 't' ? esc(lab.dom[x.r.d] || '') : 'in ' + pl(x.r.u);
    html += '<li role="option" id="qo' + n + '" data-n="' + n + '" class="c-' + x.k + '" aria-selected="' + (n === active) + '">' + MARK[x.k] + '<span>' + esc(x.r.n) + '</span><span class="meta">' + meta + '</span></li>';
  });
  qlist.innerHTML = html; qlist.hidden = false; q.setAttribute('aria-expanded', 'true');
  if (active >= 0) q.setAttribute('aria-activedescendant', 'qo' + active); else q.removeAttribute('aria-activedescendant');
}
function closeResults() { qlist.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); active = -1; }
function choose(n) { const x = results[n]; if (!x) return; q.value = ''; results = []; closeResults(); dom = ''; go(x.k, x.r.id); }
q.addEventListener('input', () => { results = search(q.value); active = results.length ? 0 : -1; paintResults(); });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); active = (active + 1) % results.length; paintResults(); $('#qo' + active).scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; paintResults(); $('#qo' + active).scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) choose(active); }
  else if (e.key === 'Escape') { if (!qlist.hidden) { e.preventDefault(); closeResults(); } else q.value = ''; }
});
qlist.addEventListener('mousedown', e => e.preventDefault());
qlist.addEventListener('click', e => { const li = e.target.closest('[data-n]'); if (li) choose(+li.dataset.n); });
let blurT = 0;
q.addEventListener('blur', () => { blurT = setTimeout(closeResults, 120); });
q.addEventListener('focus', () => clearTimeout(blurT));
q.addEventListener('input', () => clearTimeout(blurT));
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); q.select(); }
});

/* ---------- drawer ---------- */
let returnTo = null, drawerOpen = false;
function openDrawer(kind, html, opts) {
  opts = opts || {};
  $('#dkind').textContent = kind; dbody.innerHTML = html;
  drawer.removeAttribute('inert'); drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('open'); document.body.classList.add('drawer-open');
  if (modal()) { drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); scrim.hidden = false; scrim.classList.add('open'); }
  else { drawer.removeAttribute('role'); drawer.removeAttribute('aria-modal'); }
  if (opts.from) returnTo = opts.from;
  if (opts.focus || modal()) dbody.focus({ preventScroll: true });
  drawerOpen = true;
  requestAnimationFrame(() => drawLines(false, true));
}
function closeDrawer(restore) {
  if (!drawerOpen) return false;
  drawerOpen = false;
  drawer.classList.remove('open'); scrim.classList.remove('open'); document.body.classList.remove('drawer-open');
  drawer.setAttribute('inert', ''); drawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => { if (!drawerOpen) scrim.hidden = true; }, 240);
  if (restore !== false && returnTo && document.contains(returnTo)) returnTo.focus();
  requestAnimationFrame(() => drawLines(false, true));
  return true;
}
drawer.setAttribute('inert', ''); drawer.setAttribute('aria-hidden', 'true'); scrim.hidden = true;
$('#dclose').addEventListener('click', () => closeDrawer());
scrim.addEventListener('click', () => closeDrawer());
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !qlist.hidden || document.activeElement === q) return;
  if (closeDrawer()) { e.preventDefault(); return; }
  if (S.sel) { e.preventDefault(); select(null); }
});
drawer.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !modal()) return;
  const f = $$('button,a[href],summary', drawer).filter(x => x.offsetParent !== null);
  if (!f.length) return; const a = f[0], z = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === a || document.activeElement === dbody)) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
});

function srcList(src) {
  if (!src.length) return '<p class="quiet">No sources listed.</p>';
  return '<ul class="src">' + src.map(s => '<li>' + (s.u ? '<a href="' + esc(s.u) + '" rel="noopener">' + esc(s.t) + '</a>' : esc(s.t)) + ' <span class="' + FC.tagCls(s.g) + '">' + esc(s.g) + '</span></li>').join('') + '</ul>' +
    '<p class="quiet">No human has confirmed any citation. <a href="/about#citations">What the tags mean</a></p>';
}
function alsoList(kind, id, excl) {
  const all = (kind === 'i' ? X.indTyps[id] : X.ctlTyps[id]) || [];
  const rest = all.filter(t => t !== excl).sort((a, b) => TM[a].n.localeCompare(TM[b].n));
  if (!rest.length) return '<h3>Reuse</h3><p class="quiet">Used only in this typology.</p>';
  const mkl = t => '<li>' + MARK.t + '<a href="#' + t + '&sel=' + id + '" data-go="t:' + t + ':' + id + '">' + esc(TM[t].n) + '</a></li>';
  return '<h3>Also used in ' + pl(rest.length) + '</h3><ul class="lst c-t">' + rest.slice(0, 6).map(mkl).join('') + '</ul>' +
    (rest.length > 6 ? '<details><summary>Show the other ' + (rest.length - 6) + '</summary><ul class="lst c-t">' + rest.slice(6).map(mkl).join('') + '</ul></details>' : '') +
    '<p style="margin-top:8px"><a href="#' + id + '" data-go="' + kind + ':' + id + '">See all ' + pl(all.length) + ' for this ' + (kind === 'i' ? 'indicator' : 'control') + '</a></p>';
}
const chips = (arr, map) => '<div class="chips">' + arr.map(v => '<span class="chip">' + esc((map && map[v]) || v) + '</span>').join('') + '</div>';
function drawerTyp(d) {
  const cn = d.cn, g = ['ch', 'rl', 'sg', 'pr'].filter(s => d.e[s].length).map(s => '<p class="quiet" style="margin:6px 0 2px">' + esc(lab.dim[s]) + '</p>' + chips(d.e[s], lab.tag[s])).join('');
  return '<h2>' + esc(d.n) + '</h2><p class="quiet">' + esc(lab.dom[d.d] || d.d) + '</p><p>' + esc(d.ds) + '</p>' +
    ((d.st.length || d.sc.length) ? '<h3>Stage and sectors</h3>' + chips(d.st.concat(d.sc), lab.sec) : '') +
    '<h3>Sources</h3>' + srcList(d.src) +
    '<details><summary>Where it typically shows up <span class="illus">AI-inferred</span></summary>' +
    (cn.r ? (d.x ? '<p class="quiet">Consumer bank: applies across all products.</p>' : '<p class="quiet" style="margin:6px 0 2px">Consumer bank products</p>' + chips(cn.p, lab.cp) + '<p class="quiet" style="margin:6px 0 2px">Consumer bank channels</p>' + chips(cn.c, lab.cc)) : '<p class="quiet">Not flagged as consumer-bank relevant.</p>') + g +
    (d.rat ? '<p class="quiet" style="margin-top:8px">' + esc(d.rat) + '</p>' : '') + '<p class="quiet">Not any institution\'s assessed exposure.</p></details>';
}
function drawerInd(n) {
  const ctls = n.c.map(c => cur.ctl.find(x => x.id === c));
  return '<h2>' + esc(n.n) + '</h2><p class="quiet">' + n.id + '</p>' + (n.cn ? '<p class="quiet">Canonical indicator: ' + esc(n.cn) + '</p>' : '') +
    '<p>' + sig(n.s) + '</p><p class="quiet">Signal strength is indicative, not a risk score.</p>' +
    (n.cx ? '<h3>How it shows up in this typology</h3><p>' + esc(n.cx) + '</p>' : '') +
    '<h3>What it is</h3><p>' + esc(n.ds) + '</p>' + (n.fp ? '<h3>Possible false positives</h3><p>' + esc(n.fp) + '</p>' : '') +
    '<h3>Mitigated here by ' + ctls.length + ' control' + (ctls.length === 1 ? '' : 's') + '</h3><ul class="lst c-c">' + ctls.map(c => '<li>' + MARK.c + '<button type="button" class="linkbtn" data-pick="c:' + c.id + '">' + esc(c.n) + '</button></li>').join('') + '</ul>' +
    alsoList('i', n.id, cur.id);
}
function drawerCtl(c) {
  const inds = cur.ind.filter(i => i.c.includes(c.id));
  return '<h2>' + esc(c.n) + '</h2><p class="quiet">' + c.id + '</p><p><span class="chip">' + esc(lab.ct[c.t] || c.t) + '</span> <span class="chip">' + esc(lab.im[c.im] || c.im) + '</span></p>' +
    '<h3>What it is</h3><p>' + esc(c.ds) + '</p>' +
    '<h3>Mitigates here: ' + inds.length + ' indicator' + (inds.length === 1 ? '' : 's') + '</h3><ul class="lst c-i">' + inds.map(i => '<li>' + MARK.i + '<button type="button" class="linkbtn" data-pick="i:' + i.id + '">' + esc(i.n) + '</button></li>').join('') + '</ul>' +
    alsoList('c', c.id, cur.id);
}
async function drawerCanon(kind, id, extra) {
  const r = await FC.getJSON('/data/' + kind + '/' + id + '.json'), n = (kind === 'i' ? X.indTyps[id] : X.ctlTyps[id]).length;
  const head = kind === 'i' ? '<h2>' + esc(r.n) + '</h2><p class="quiet">' + id + '</p><p>' + sig(r.s) + '</p><p class="quiet">Signal strength is indicative, not a risk score.</p>' :
    '<h2>' + esc(r.n) + '</h2><p class="quiet">' + id + '</p><p><span class="chip">' + esc(lab.ct[r.t] || r.t) + '</span> <span class="chip">' + esc(lab.im[r.im] || r.im) + '</span></p>';
  return head + '<h3>What it is</h3><p>' + esc(r.ds) + '</p>' + (kind === 'i' && r.fp ? '<h3>Possible false positives</h3><p>' + esc(r.fp) + '</p>' : '') +
    (kind === 'c' && r.aka.length ? '<h3>Also known as</h3><p>' + esc(r.aka.join('; ')) + '</p>' : '') +
    '<h3>Reuse</h3><p>Appears in ' + pl(n) + '. How it shows up differs by typology: open one to read its context.</p>' + (extra || '');
}
dbody.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); const [k, id, sel] = g.dataset.go.split(':'); go(k, id, sel); return; }
  const p = e.target.closest('[data-pick]');
  if (p) { const [k, id] = p.dataset.pick.split(':'); select({ k, id }, { open: true }); }
});

/* ---------- diagram model ---------- */
const LNODE = { t: 'c-t', i: 'c-i', c: 'c-c' };
function typSentence(s) { const m = s.match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : s; }
function buildModel() {
  if (S.mode === 't') {
    const d = cur, inds = d.ind.slice().sort((a, b) => (SEVR[a.s] - SEVR[b.s]) || a.n.localeCompare(b.n));
    const rank = {}; inds.forEach((i, n) => i.c.forEach(c => { if (rank[c] === undefined) rank[c] = n; }));
    const ctls = d.ctl.slice().sort((a, b) => rank[a.id] - rank[b.id] || a.n.localeCompare(b.n));
    return { L: { k: 'i', title: 'Indicators', sub: 'what you would observe', items: inds.map(i => ({ id: i.id, n: i.n, s: i.s, u: i.u })) },
      R: { k: 'c', title: 'Controls', sub: 'what mitigates', items: ctls.map(c => ({ id: c.id, n: c.n, t: c.t, u: c.u })) },
      edges: inds.flatMap(i => i.c.map(c => [i.id, c])),
      center: { k: 't', id: d.id, n: d.n, ds: typSentence(d.ds), meta: [d.ind.length + ' indicators', d.ctl.length + ' controls', d.src.length + ' sources'] } };
  }
  const id = S.id, ts = (S.mode === 'i' ? X.indTyps[id] : X.ctlTyps[id]).slice().sort((a, b) => X.domains.indexOf(TM[a].d) - X.domains.indexOf(TM[b].d) || TM[a].n.localeCompare(TM[b].n));
  const edges = [], seen = {};
  ts.forEach(t => {
    if (S.mode === 'i') X.L[t].find(r => r[0] === id)[1].forEach(c => { edges.push([t, c]); seen[c] = (seen[c] || 0) + 1; });
    else (X.ctlInds[id][t] || []).forEach(i => { edges.push([t, i]); seen[i] = (seen[i] || 0) + 1; });
  });
  const rk = S.mode === 'i' ? 'c' : 'i', rmap = rk === 'c' ? CM : IM;
  const ritems = Object.keys(seen).map(k => ({ id: k, n: rmap[k].n, s: rmap[k].s, t: rmap[k].t, u: rmap[k].u, here: seen[k] }))
    .sort((a, b) => b.here - a.here || a.n.localeCompare(b.n));
  const r = (S.mode === 'i' ? IM : CM)[id];
  return { L: { k: 't', title: 'Typologies', sub: S.mode === 'i' ? 'where it appears' : 'where it is used', items: ts.map(t => ({ id: t, n: TM[t].n, d: TM[t].d })) },
    R: { k: rk, title: rk === 'c' ? 'Controls' : 'Indicators', sub: rk === 'c' ? 'what mitigates it' : 'what it mitigates', items: ritems }, edges,
    center: { k: S.mode, id, n: r.n, ds: '', meta: [pl(ts.length)], s: r.s, t: r.t } };
}
function nodeHtml(it, k, col, idx, rev) {
  const hid = idx >= LIM && !ex[col];
  let sub = '<span class="id">' + it.id + '</span>';
  if (k === 'i') sub += sig(it.s); else if (k === 'c') sub += '<span>' + esc(lab.ct[it.t] || it.t) + '</span>'; else sub += '<span>' + esc(lab.dom[it.d] || '') + '</span>';
  if (it.here) sub += '<span class="reuse">in ' + it.here + ' of these</span>'; else if (it.u > 1 && k !== 't') sub += '<span class="reuse">in ' + it.u + ' typologies</span>';
  return '<button type="button" class="node c-' + k + (idx >= LIM ? ' extra' : '') + '" data-k="' + k + '" data-id="' + it.id + '" data-col="' + col + '" aria-pressed="false" tabindex="-1"' + (hid ? ' hidden' : '') + '><span class="nm">' + esc(it.n) + '</span><span class="sub">' + sub + '</span></button>';
}
function colHtml(c, col) {
  const n = c.items.length, shown = ex[col] ? n : Math.min(n, LIM);
  return '<div class="col col-' + (col === 'l' ? 'i' : 'c') + ' c-' + c.k + '" role="group" aria-label="' + esc(c.title) + '"><h3>' + MARK[c.k] + esc(c.title) + ' <span class="ct" data-ct="' + col + '">' + (shown < n ? shown + ' of ' + n : n) + '</span></h3><div class="nodes">' +
    c.items.map((it, k) => nodeHtml(it, c.k, col, k)).join('') + '</div>' +
    (n > LIM ? '<button type="button" class="more-btn" data-more="' + col + '" aria-expanded="' + !!ex[col] + '">' + (ex[col] ? 'Show fewer' : 'Show all ' + n) + '</button>' : '') + '<p class="quiet" style="margin:6px 0 0;font-size:12.5px;color:var(--ink-2)">' + esc(c.sub) + '</p></div>';
}
function centerHtml(c) {
  const kind = c.k === 't' ? 'Typology' : KIND[c.k];
  return '<div class="col col-t"><button type="button" class="typnode c-' + c.k + '" data-k="center" data-id="' + c.id + '" data-col="m" aria-pressed="false" tabindex="0"><span class="k">' + MARK[c.k] + kind + '<span class="id">' + c.id + '</span></span><span class="nm">' + esc(c.n) + '</span>' +
    (c.ds ? '<p>' + esc(c.ds) + '</p>' : '') + '<span class="meta">' + (c.s ? sig(c.s) : '') + (c.t ? '<span>' + esc(lab.ct[c.t] || c.t) + '</span>' : '') + c.meta.map(m => '<span>' + esc(m) + '</span>').join('') + '</span></button></div>';
}
function renderDiagram(first) {
  M = buildModel();
  const foot = S.mode === 't' ? 'Showing every indicator and control linked to this typology. Click an indicator to see the controls that mitigate it here, or a control to see its indicators.' :
    S.mode === 'i' ? 'Every typology this indicator appears in, and the controls linked to it there. Click a control to see which typologies use it with this indicator, or a typology to open its linkage.' :
      'Every typology this control is used in, and the indicators it mitigates there. Click an indicator to see which typologies pair it with this control, or a typology to open its linkage.';
  view.innerHTML = '<div class="sheet' + (S.mode === 't' ? '' : ' rev') + '"><p class="cap" id="cap"></p><div class="bflow" id="flow"><svg class="lines" id="lines" aria-hidden="true"></svg>' +
    colHtml(M.L, 'l') + centerHtml(M.center) + colHtml(M.R, 'r') + '</div>' +
    '<div class="sheet-foot"><p>' + foot + '</p><div class="acts"><button type="button" class="btn" id="bdet">Details</button><button type="button" class="btn" id="bcopy">Copy link</button><button type="button" class="btn" id="bcsv">Export CSV</button></div></div></div>';
  // DOM order for the phone stack comes from CSS order; desktop order is left, centre, right
  const fl = $('#flow', view); fl.insertBefore($('.col-t', fl), $('.col-c', fl));
  roving();
  paintSel(false);
  if (ro) ro.disconnect(); ro = new ResizeObserver(relayout); ro.observe(fl);
  if (!flat()) drawLines(first, !first);
  if (first) { FC.enter($$('.typnode', view), 0); FC.enter($$('.col-i .node:not([hidden])', view), 0); FC.enter($$('.col-c .node:not([hidden])', view), 40); }
}

/* ---------- selection ---------- */
function relSets() {
  if (!S.sel || !M) return null;
  const isL = S.sel.k === M.L.k, key = isL ? 0 : 1;
  const hit = M.edges.filter(e => e[key] === S.sel.id);
  if (!hit.length) return null;
  return { l: new Set(hit.map(e => e[0])), r: new Set(hit.map(e => e[1])) };
}
function select(sel, o) {
  o = o || {};
  if (sel && S.sel && S.sel.id === sel.id && !o.open) sel = null;
  const ok = sel && M && ((sel.k === M.L.k && M.L.items.some(i => i.id === sel.id)) || (sel.k === M.R.k && M.R.items.some(i => i.id === sel.id)));
  S.sel = ok ? sel : null;
  writeHash(false);
  if (S.sel) { const rel = relSets(), side = S.sel.k === M.L.k ? 'r' : 'l'; if (rel) expandFor(side, rel[side]); }
  const el = S.sel && $('.node[data-id="' + S.sel.id + '"]', view);
  if (S.sel) {
    const isTyp = S.mode === 't';
    if (isTyp) { const n = S.sel.k === 'i' ? cur.ind.find(i => i.id === S.sel.id) : cur.ctl.find(c => c.id === S.sel.id); openDrawer(KIND[S.sel.k], S.sel.k === 'i' ? drawerInd(n) : drawerCtl(n), { from: el, focus: FC.input === 'kbd' && !o.noFocus }); }
    else drawerCanon(S.sel.k, S.sel.id, revExtra()).then(h => openDrawer(KIND[S.sel.k], h, { from: el, focus: FC.input === 'kbd' && !o.noFocus }));
  } else closeDrawer(false);
  paintSel(true);
}
function revExtra() {
  const rel = relSets(); if (!rel) return '';
  const ts = [...rel.l];
  return '<h3>Together in ' + pl(ts.length) + '</h3><ul class="lst c-t">' + ts.map(t => '<li>' + MARK.t + '<a href="#' + t + '&sel=' + S.sel.id + '" data-go="t:' + t + ':' + S.sel.id + '">' + esc(TM[t].n) + '</a></li>').join('') + '</ul>' +
    '<p style="margin-top:8px"><a href="#' + S.sel.id + '" data-go="' + S.sel.k + ':' + S.sel.id + '">Make this the centre of the view</a></p>';
}
function expandFor(side, set) {
  const col = side, items = (col === 'l' ? M.L : M.R).items;
  const hiddenHit = [...set].some(id => items.findIndex(i => i.id === id) >= LIM);
  if (hiddenHit && !ex[col]) setExpanded(col, true);
}
function setExpanded(col, on) {
  ex[col] = on;
  const items = (col === 'l' ? M.L : M.R).items;
  $$('.node[data-col="' + col + '"]', view).forEach((n, k) => { n.hidden = k >= LIM && !on; });
  const b = $('[data-more="' + col + '"]', view);
  if (b) { b.textContent = on ? 'Show fewer' : 'Show all ' + items.length; b.setAttribute('aria-expanded', String(on)); }
  const c = $('[data-ct="' + col + '"]', view); if (c) c.textContent = on || items.length <= LIM ? items.length : LIM + ' of ' + items.length;
}
function paintSel(withLines) {
  const rel = relSets();
  $$('.node', view).forEach(el => {
    const k = el.dataset.k, id = el.dataset.id, isSel = !!S.sel && S.sel.id === id;
    el.setAttribute('aria-pressed', String(isSel));
    const inRel = rel ? (el.dataset.col === 'l' ? rel.l : rel.r).has(id) : true;
    el.classList.toggle('dim', !!rel && !inRel);
    el.classList.toggle('hl', !!rel && inRel && !isSel);
  });
  const cap = $('#cap');
  if (cap) {
    if (!S.sel) cap.textContent = S.mode === 't' ? 'All links for this typology. Select an indicator or control to trace it.' : 'All links for this ' + (S.mode === 'i' ? 'indicator' : 'control') + '. Select an item on the right to trace it.';
    else if (!rel) cap.textContent = '';
    else {
      const nm = ((S.sel.k === M.L.k ? M.L : M.R).items.find(i => i.id === S.sel.id) || {}).n;
      const n = S.sel.k === M.L.k ? rel.r.size : rel.l.size, what = S.sel.k === M.L.k ? M.R : M.L;
      cap.innerHTML = '<span>' + MARK[S.sel.k] + ' <b>' + esc(nm) + '</b> links to <b>' + n + '</b> ' + (n === 1 ? what.title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '') : what.title.toLowerCase()) + ' here.</span> <button type="button" class="linkbtn" data-clear>Clear</button>';
    }
  }
  if (withLines && !flat()) drawLines(true);
}

/* ---------- connectors: indicator -> card -> control, for the selected node only ---------- */
function drawLines(animate, instant) {
  const svg = $('#lines', view); if (!svg || !M || flat()) return;
  const flow = $('#flow', view), box = flow.getBoundingClientRect(), card = $('.typnode', view);
  const vis = n => n && !n.hidden && n.offsetParent !== null;
  const pt = (el, side) => { const r = el.getBoundingClientRect(); return [(side === 'r' ? r.right : r.left) - box.left, r.top + r.height / 2 - box.top]; };
  const rel = relSets(), segs = [];
  const add = (a, b, strong) => { const [x1, y1] = pt(a, 'r'), [x2, y2] = pt(b, 'l'), dx = (x2 - x1) / 2; segs.push({ d: 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2, strong }); };
  const ids = rel ? [[...rel.l], [...rel.r]] : [M.L.items.map(i => i.id), M.R.items.map(i => i.id)];
  const by = (col, id) => $('.node[data-col="' + col + '"][data-id="' + id + '"]', view);
  ids[0].forEach(id => { const n = by('l', id); if (vis(n)) add(n, card, !!rel); });
  ids[1].forEach(id => { const n = by('r', id); if (vis(n)) { const [x1, y1] = pt(card, 'r'), [x2, y2] = pt(n, 'l'), dx = (x2 - x1) / 2; segs.push({ d: 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2, strong: !!rel }); } });
  const rev = !!S.sel && S.sel.k === M.R.k;
  svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
  const key = (S.sel ? S.sel.id : 'none') + '|' + S.id + S.mode + ex.l + ex.r;
  const old = $$('path', svg);
  if (instant && svg.dataset.key === key && old.length === segs.length) { old.forEach((p, n) => p.setAttribute('d', segs[n].d)); return; }
  svg.dataset.key = key;
  const mkp = s => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', s.d); p.setAttribute('class', 'ln' + (s.strong ? ' strong' : '')); return p; };
  old.forEach(p => p.remove());
  if (instant || !animate || !FC.motionOK()) { segs.forEach(s => { const p = mkp(s); p.classList.add('now'); svg.appendChild(p); }); return; }
  const fresh = segs.map(s => { const p = mkp(s); p.classList.add('pre'); if (rev) p.classList.add('rev'); svg.appendChild(p); return p; });
  void svg.getBoundingClientRect();
  requestAnimationFrame(() => fresh.forEach(p => p.classList.remove('pre')));
}
let ro = null, rq = 0;
function relayout() { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => drawLines(false, true)); }

/* ---------- render ---------- */
async function render(first) {
  const my = ++tok; first = first !== false;
  closeDrawer(false); ex = { l: false, r: false };
  paintControls(); paintStrip();
  if (S.mode === 't') {
    let d;
    try { d = await FC.getJSON('/data/t/' + S.id + '.json'); } catch (e) { view.innerHTML = '<p class="notice">Could not load this typology.</p>'; return; }
    if (my !== tok) return;
    cur = d; document.title = d.n + ' | Linkage | FC Risk Indicators';
  } else { cur = null; document.title = (S.mode === 'i' ? IM : CM)[S.id].n + ' | Linkage | FC Risk Indicators'; }
  renderDiagram(first);
  const want = S.want; S.want = '';
  if (want && M) {
    const k = kindOf(want);
    if (k !== 't' && ((k === M.L.k && M.L.items.some(i => i.id === want)) || (k === M.R.k && M.R.items.some(i => i.id === want)))) {
      S.sel = { k, id: want };
      const rel = relSets(), side = k === M.L.k ? 'r' : 'l'; if (rel) expandFor(side, rel[side]);
      paintSel(true);
      const el = $('.node[data-id="' + want + '"]', view); if (el && !flat()) el.scrollIntoView({ block: 'nearest' });
    }
  }
}
window.addEventListener('hashchange', () => { if (applyHash()) render(); });
window.addEventListener('popstate', () => { if (applyHash()) render(); });

/* ---------- events ---------- */
view.addEventListener('click', e => {
  if (e.target.closest('[data-clear]')) { select(null); return; }
  const mb = e.target.closest('[data-more]');
  if (mb) { setExpanded(mb.dataset.more, !ex[mb.dataset.more]); drawLines(false, true); relayout(); return; }
  const n = e.target.closest('.typnode');
  if (n) {
    select(null);
    if (S.mode === 't') openDrawer('Typology', drawerTyp(cur), { from: n, focus: FC.input === 'kbd' });
    else drawerCanon(S.mode, S.id).then(h => openDrawer(KIND[S.mode], h, { from: n, focus: FC.input === 'kbd' }));
    return;
  }
  const nd = e.target.closest('.node');
  if (nd) {
    if (nd.dataset.k === 't') { go('t', nd.dataset.id, S.id, true); return; }  // reverse view: open that typology with this item selected
    select({ k: nd.dataset.k, id: nd.dataset.id });
    return;
  }
  const b = e.target.closest('#bdet, #bcopy, #bcsv'); if (!b) return;
  if (b.id === 'bdet') {
    if (S.mode === 't') openDrawer('Typology', drawerTyp(cur), { from: b, focus: true });
    else drawerCanon(S.mode, S.id).then(h => openDrawer(KIND[S.mode], h, { from: b, focus: true }));
  } else if (b.id === 'bcopy') FC.copy(location.origin + location.pathname + hashFor(S));
  else exportCsv();
});
function rowsFor() {
  const head = ['typology_id', 'typology', 'domain', 'indicator_id', 'indicator', 'signal_strength (indicative, not a risk score)', 'control_id', 'control', 'control_type', 'status'];
  const st = 'draft - AI-drafted, unreviewed', rows = [head];
  if (S.mode === 't') cur.ind.forEach(i => i.c.forEach(c => { const cn = cur.ctl.find(x => x.id === c); rows.push([cur.id, cur.n, lab.dom[cur.d] || cur.d, i.id, i.n, i.s, c, cn.n, cn.t, st]); }));
  else {
    const typs = S.mode === 'i' ? X.indTyps[S.id] : X.ctlTyps[S.id];
    X.T.filter(t => typs.includes(t.id)).forEach(t => X.L[t.id].forEach(([iid, cs]) => cs.forEach(c => {
      if ((S.mode === 'i' && iid === S.id) || (S.mode === 'c' && c === S.id)) rows.push([t.id, t.n, lab.dom[t.d] || t.d, iid, IM[iid].n, IM[iid].s, c, CM[c].n, CM[c].t, st]);
    })));
  }
  return rows;
}
function exportCsv() { FC.download('linkage-' + S.id + '.csv', FC.csv(rowsFor())); }

/* ---------- keyboard: arrows move focus between nodes; Enter or Space selects ---------- */
function roving() {
  $$('.node', view).forEach(n => n.tabIndex = -1);
  [$('.col-i .node:not([hidden])', view), $('.typnode', view), $('.col-c .node:not([hidden])', view)].forEach(n => { if (n) n.tabIndex = 0; });
}
const colNodes = col => $$('.node[data-col="' + col + '"]', view).filter(n => !n.hidden);
view.addEventListener('keydown', e => {
  const n = e.target.closest && e.target.closest('.node, .typnode'); if (!n) return;
  const col = n.dataset.col;
  let target = null;
  if (flat()) {
    const all = $$('.typnode, .node', view).filter(x => !x.hidden && x.offsetParent !== null), at = all.indexOf(n);
    if (e.key === 'ArrowDown') target = all[at + 1]; else if (e.key === 'ArrowUp') target = all[at - 1];
  } else {
    const list = col === 'm' ? [n] : colNodes(col), at = list.indexOf(n), rel = relSets();
    if (e.key === 'ArrowDown') target = list[at + 1] || list[at]; else if (e.key === 'ArrowUp') target = list[at - 1] || list[at];
    else if (e.key === 'Home' && col !== 'm') target = list[0]; else if (e.key === 'End' && col !== 'm') target = list[list.length - 1];
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const to = col === 'm' ? (e.key === 'ArrowRight' ? 'r' : 'l') : col === 'l' ? (e.key === 'ArrowRight' ? 'm' : null) : (e.key === 'ArrowLeft' ? 'm' : null);
      if (to === 'm') target = $('.typnode', view);
      else if (to) { const l = colNodes(to); target = (rel && l.find(x => (to === 'l' ? rel.l : rel.r).has(x.dataset.id))) || l[0]; }
    }
  }
  if (target) { e.preventDefault(); $$('.node, .typnode', view).forEach(x => { if (x.dataset.col === target.dataset.col) x.tabIndex = -1; }); target.tabIndex = 0; target.focus(); }
});

/* ---------- boot ---------- */
if (!applyHash()) S = { mode: 't', id: DEFAULT, sel: null, want: '' };
if (!parseHash().id && !parseHash().cb) history.replaceState(null, '', location.pathname + location.search + '#' + S.id);
render(true);
})();
