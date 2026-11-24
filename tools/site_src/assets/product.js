/* Product mapper (consumer bank): product -> channels -> questions -> relevant typologies, plus a product x channel grid.
   Runs entirely in the browser; nothing is sent anywhere. Rules: questionnaire/README.md "Matching rules v2". */
(async function () {
'use strict';
const { $, $$, esc, MARK } = FC;
let X, Q;
try { [X, Q] = await Promise.all([FC.loadIndex(), FC.getJSON('/data/questionnaire.json')]); } catch (e) { FC.fail(); return; }
const root = $('#pm'), lab = X.labels;
const KEY = 'fc-product-v2';
const OPT = {}, QOF = {}, PROF = {};
Q.questions.forEach(q => q.o.forEach(o => { OPT[o.id] = o; QOF[o.id] = q; }));
Q.profiles.forEach(p => PROF[p.id] = p);
const Q01 = Q.questions.find(q => q.id === 'Q01'), Q02 = Q.questions.find(q => q.id === 'Q02');
const BASELINE_SEG = 'retail';   // true of every consumer product, so it does not count as a segment overlap

/* ---------- state ---------- */
const S = { a: new Set(), x: new Set(), i: new Set(), p: '', g: false };
let ui = { open: {}, animate: true, grid: null };
const enc = () => {
  const p = new URLSearchParams();
  if (S.a.size) p.set('a', [...S.a].join(','));
  if (S.x.size) p.set('x', [...S.x].join(','));
  if (S.i.size) p.set('i', [...S.i].join(','));
  if (S.p) p.set('p', S.p);
  if (S.g) p.set('g', '1');
  return p.toString();
};
function dec(str) {
  const p = new URLSearchParams(str), list = k => (p.get(k) || '').split(',').filter(Boolean);
  S.a = new Set(list('a').filter(id => OPT[id])); S.x = new Set(list('x').filter(id => X.TM[id])); S.i = new Set(list('i').filter(id => X.TM[id]));
  S.p = PROF[p.get('p')] ? p.get('p') : ''; S.g = p.get('g') === '1';
  if (S.p && !p.has('a')) S.a = new Set(PROF[S.p].a.filter(id => OPT[id]));
  return str.length > 0;
}
function save() {
  const s = enc();
  try { history.replaceState(null, '', location.pathname + (s ? '#' + s : '')); } catch (e) {}
  try { localStorage.setItem(KEY, s); } catch (e) {}
}
(function () {
  const h = location.hash.slice(1);
  if (h && dec(h)) return;
  try { const v = localStorage.getItem(KEY); if (v) dec(v); } catch (e) {}
})();

/* ---------- derived: product, channels, visible questions, profile tags, matches ---------- */
function product() { const o = Q01.o.find(o => S.a.has(o.id)); return o ? { opt: o, id: o.m.pr[0] } : null; }
function channels() { return Q02.o.filter(o => S.a.has(o.id)).map(o => ({ opt: o, id: (o.m.ch || [])[0] })).filter(c => c.id); }
function visible(q, prod, chs) {
  if (q.id === 'Q01' || q.id === 'Q02') return false;
  if (!prod || !chs.length) return false;
  if (q.ap.length && !q.ap.includes(prod)) return false;
  if (q.ac.length && !q.ac.some(c => chs.includes(c))) return false;
  return true;
}
function prune() {
  const p = product(), cs = channels().map(c => c.id);
  Q.questions.forEach(q => { if (q.id !== 'Q01' && q.id !== 'Q02' && !visible(q, p && p.id, cs)) q.o.forEach(o => S.a.delete(o.id)); });
}
const baseSet = (p, c) => X.T.filter(t => !t.x && t.cn.r && t.cn.p.includes(p) && t.cn.c.includes(c));
function compute() {
  const prod = product(), chs = channels(), C = { prod, chs, matched: [], across: X.T.filter(t => t.x), tags: { rl: new Set(), sg: new Set() }, why: { rl: {}, sg: {} } };
  if (!prod || !chs.length) return C;
  const cids = chs.map(c => c.id);
  Q.questions.filter(q => visible(q, prod.id, cids)).forEach(q => q.o.forEach(o => {
    if (!S.a.has(o.id)) return;
    ['rl', 'sg'].forEach(s => (o.m[s] || []).forEach(v => { C.tags[s].add(v); (C.why[s][v] = C.why[s][v] || []).push(o.id); }));
  }));
  X.T.forEach(t => {
    if (t.x || !t.cn.r || !t.cn.p.includes(prod.id)) return;
    const mc = t.cn.c.filter(c => cids.includes(c)); if (!mc.length) return;
    const rl = t.e.rl.filter(v => C.tags.rl.has(v)), sg = t.e.sg.filter(v => C.tags.sg.has(v) && v !== BASELINE_SEG);
    const tier = rl.length && sg.length ? 'strong' : (rl.length || sg.length) ? 'possible' : 'base';
    C.matched.push({ t, mc, rl, sg, tier });
  });
  const ord = { strong: 0, possible: 1, base: 2 };
  C.matched.sort((a, b) => ord[a.tier] - ord[b.tier] || (b.rl.length + b.sg.length) - (a.rl.length + a.sg.length) || a.t.n.localeCompare(b.t.n));
  return C;
}

/* ---------- questions panel ---------- */
const optHtml = (q, o, cls) => '<label class="opt' + (cls || '') + '"><input type="' + (q.ty === 'multi' ? 'checkbox' : 'radio') + '" name="' + q.id + '" value="' + o.id + '"' + (S.a.has(o.id) ? ' checked' : '') + '><span>' + esc(o.l) + '</span></label>';
function stepsHtml() {
  const prod = product(), chs = channels(), cids = chs.map(c => c.id);
  let h = '<section class="qsec"><h2><span class="stepn">1</span> ' + esc(Q01.t) + '</h2><p class="qh">' + esc(Q01.h) + '</p><div class="pcards" role="radiogroup" aria-label="Product">' + Q01.o.map(o => optHtml(Q01, o, ' pcard')).join('') + '</div></section>';
  h += '<section class="qsec"><h2><span class="stepn">2</span> ' + esc(Q02.t) + '</h2><p class="qh">' + esc(Q02.h) + '</p><div class="ccards">' + Q02.o.map(o => optHtml(Q02, o, ' pcard')).join('') + '</div></section>';
  h += '<section class="qsec" id="step3"><h2><span class="stepn">3</span> Questions for this product</h2>';
  if (!prod || !chs.length) return h + '<p class="qh">Choose a product and at least one channel to see the questions that apply.</p></section>';
  const vis = Q.questions.filter(q => visible(q, prod.id, cids)), bySec = {};
  vis.forEach(q => (bySec[q.s] = bySec[q.s] || []).push(q));
  h += '<p class="qh">' + vis.length + ' questions apply to ' + esc(lab.cp[prod.id]) + ' via ' + esc(chs.map(c => lab.cc[c.id]).join(', ').toLowerCase()) + '. Skip any you are unsure about.</p>';
  Q.sections.filter(s => bySec[s.id]).forEach(s => {
    h += '<h3 class="qsub">' + esc(s.t) + '</h3>' + bySec[s.id].map(q => '<fieldset class="q" data-q="' + q.id + '"><legend>' + esc(q.t) + ' <span class="qtype">(' + (q.ty === 'multi' ? 'select all that apply' : 'select one') + ')</span></legend>' +
      (q.h ? '<p class="qh">' + esc(q.h) + '</p>' : '') + q.o.map(o => optHtml(q, o)).join('') +
      (q.ty === 'single' ? '<button type="button" class="linkbtn clr" data-clr="' + q.id + '">Clear answer</button>' : '') + '</fieldset>').join('');
  });
  return h + '</section>';
}

/* ---------- results ---------- */
const lbl = (dim, v) => (lab.tag[dim] && lab.tag[dim][v]) || v;
function reasons(r, C) {
  const ids = [C.prod.opt.id].concat(C.chs.filter(c => r.mc.includes(c.id)).map(c => c.opt.id));
  r.rl.forEach(v => C.why.rl[v].forEach(id => ids.push(id))); r.sg.forEach(v => C.why.sg[v].forEach(id => ids.push(id)));
  return [...new Set(ids)];
}
function chipsFor(r, C) {
  const row = (l, arr) => arr.length ? '<div class="dimrow"><span class="dl">' + l + '</span>' + arr.map(v => '<span class="chip match">' + esc(v) + '</span>').join('') + '</div>' : '';
  return row('Product', [lab.cp[C.prod.id]]) + row('Channels', r.mc.map(c => lab.cc[c])) + row('Payment rails', r.rl.map(v => lbl('rl', v))) + row('Customer segments', r.sg.map(v => lbl('sg', v))) +
    '<p class="ans">Because you answered: ' + reasons(r, C).map(id => '<q>' + esc(OPT[id].l) + '</q>').join(', ') + '</p>';
}
function card(t, inner, kind) {
  const off = S.x.has(t.id);
  return '<article class="mcard' + (off ? ' off' : '') + '" data-t="' + t.id + '"><div class="top2"><h4>' + MARK.t + '<span>' + esc(t.n) + '</span></h4><div class="acts">' +
    '<a class="btn" href="/#' + t.id + '" data-focus="open-' + t.id + '">Open linkage</a>' +
    (kind === 'manual' ? '<button type="button" class="btn" data-rm="' + t.id + '" data-focus="rm-' + t.id + '">Remove</button>' :
      '<button type="button" class="btn" data-tog="' + t.id + '" aria-pressed="' + !off + '" data-focus="tog-' + t.id + '">' + (off ? 'Include' : 'Exclude') + '</button>') +
    '</div></div><p class="dom">' + esc(lab.dom[t.d] || '') + ' | ' + t.ni + ' indicators | ' + t.nc + ' controls</p>' + (inner ? '<div class="why">' + inner + '</div>' : '') + '</article>';
}
function group(key, title, blurb, items, C) {
  if (!items.length) return '';
  const open = ui.open[key] !== undefined ? ui.open[key] : key === 'strong';
  return '<details class="tier" data-g="' + key + '"' + (open ? ' open' : '') + '><summary><h3 style="display:inline-flex;margin:0">' + esc(title) + ' <span class="n">(' + items.length + ')</span></h3></summary><p class="note">' + blurb + '</p>' +
    items.map(r => card(r.t, chipsFor(r, C))).join('') + '</details>';
}
function renderResults() {
  const C = compute(), box = $('#results');
  let h = '<h2>Relevant typologies</h2><p class="disc"><strong>Relevance by exposure overlap, not a risk rating.</strong> Tiers describe how specific the fit is, not how risky anything is. The institution assesses applicability and risk. Exposure tags are AI-inferred and unreviewed.</p>';
  const by = k => C.matched.filter(r => r.tier === k);
  if (!C.prod) h += '<p class="note">Choose a product (step 1) to start.</p>';
  else if (!C.chs.length) h += '<p class="note">Tick at least one channel (step 2).</p>';
  else {
    h += '<p class="note">' + C.matched.length + ' typologies are linked to ' + esc(lab.cp[C.prod.id]) + ' via ' + esc(C.chs.map(c => lab.cc[c.id]).join(', ').toLowerCase()) + '. The more your answers overlap a typology\'s payment rails and customer segments, the more specific the fit. "Retail customers" is treated as true of every consumer product and does not count.</p>';
    h += group('strong', 'Strong fit', 'Product, channel, and both payment rails and customer segments overlap your answers.', by('strong'), C) +
      group('possible', 'Possible fit', 'Product and channel match, and either payment rails or customer segments overlap.', by('possible'), C) +
      group('base', 'Base fit', 'Linked to this product and channel only; no extra overlap with your answers.', by('base'), C);
  }
  const manual = [...S.i].map(id => X.TM[id]).filter(t => t && !C.matched.some(r => r.t.id === t.id) && !t.x);
  if (manual.length) h += '<details class="tier" data-g="man" open><summary><h3 style="display:inline-flex;margin:0">Added by you <span class="n">(' + manual.length + ')</span></h3></summary>' + manual.map(t => card(t, '', 'manual')).join('') + '</details>';
  h += '<details class="tier" data-g="across"' + (ui.open.across ? ' open' : '') + '><summary><h3 style="display:inline-flex;margin:0">Applies across all products <span class="n">(' + C.across.length + ')</span></h3></summary><p class="note">Cross-cutting typologies are not tied to one product or channel, so they are listed apart from the ranking.</p>' + C.across.map(t => card(t, '')).join('') + '</details>';
  const excl = [...S.x].map(id => X.TM[id]).filter(Boolean);
  if (excl.length) h += '<p class="note" style="margin-top:12px">Excluded by you: ' + excl.length + '. Excluded cards are dimmed and left out of the export.</p>';
  const shown = new Set([...C.matched.map(r => r.t.id), ...C.across.map(t => t.id), ...manual.map(t => t.id)]);
  h += '<div class="addrow"><div class="field"><label for="addsel">Add a typology the overlap did not find</label><select id="addsel"><option value="">Choose...</option>' +
    X.domains.map(d => { const ts = X.T.filter(t => t.d === d && !shown.has(t.id)); return ts.length ? '<optgroup label="' + esc(lab.dom[d]) + '">' + ts.map(t => '<option value="' + t.id + '">' + esc(t.n) + '</option>').join('') + '</optgroup>' : ''; }).join('') + '</select></div></div>';
  h += '<p class="note" style="margin-top:14px"><button type="button" class="btn pri" id="pack"' + (C.prod && C.chs.length ? '' : ' disabled') + '>Export product pack (CSV)</button></p>' +
    '<p class="note">The pack lists the product, channels and your answers; every typology you have not excluded with its tier, matched tags and rationale; and for each its indicators and controls. Nothing is uploaded.</p>';
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null, st = box.scrollTop;
  box.innerHTML = h; box.scrollTop = st;
  if (active) { const el = $('[data-focus="' + active + '"]', box); if (el) el.focus({ preventScroll: true }); }
  if (ui.animate && C.matched.length) { ui.animate = false; FC.enter($$('.tier[open] .mcard', box).slice(0, 12), 0); }
  const nq = Q.questions.filter(q => visible(q, C.prod && C.prod.id, C.chs.map(c => c.id))).length;
  const cnt = $('#cnt'); if (cnt) cnt.textContent = S.a.size ? 'Answers: ' + S.a.size + (nq ? ' | ' + nq + ' questions apply' : '') : 'No answers yet';
  window.FC_PM = { C, included: included(C) };
}
function included(C) {
  const out = [];
  C.matched.forEach(r => { if (!S.x.has(r.t.id)) out.push({ t: r.t, r, tier: r.tier }); });
  C.across.forEach(t => { if (!S.x.has(t.id)) out.push({ t, r: null, tier: 'across_all' }); });
  [...S.i].forEach(id => { const t = X.TM[id]; if (t && !out.some(o => o.t.id === id)) out.push({ t, r: null, tier: 'manual' }); });
  return out;
}

/* ---------- export ---------- */
function exportPack() {
  const C = compute(), inc = included(C), rows = [];
  const head = ['record_type', 'product', 'channels', 'typology_id', 'typology', 'tier', 'matched_channels', 'matched_payment_rails', 'matched_customer_segments', 'consumer_rationale',
    'question_id', 'question', 'answer_id', 'answer', 'implied_tags', 'indicator_id', 'indicator', 'signal_strength (canonical, indicative, not a risk score)', 'control_id', 'control', 'control_type', 'note'];
  const row = o => head.map(h => o[h] == null ? '' : o[h]);
  const pn = C.prod ? lab.cp[C.prod.id] : '', cn = C.chs.map(c => lab.cc[c.id]).join('; ');
  rows.push(head);
  rows.push(row({ record_type: 'note', note: 'Relevance by exposure overlap, not a risk rating. Tiers describe specificity of fit (strong = product, channel, payment rails and customer segments overlap; possible = one of rails or segments; base = product and channel only; across_all = cross-cutting; manual = added by the user), not risk. The institution assesses applicability and risk. Exposure tags are AI-inferred and unreviewed (draft v0.1).' }));
  if (S.p && PROF[S.p]) rows.push(row({ record_type: 'note', note: 'Started from illustrative example profile: ' + PROF[S.p].n + ' (not a real product)' }));
  rows.push(row({ record_type: 'product', product: pn, channels: cn }));
  Q.questions.forEach(q => q.o.filter(o => S.a.has(o.id)).forEach(o => rows.push(row({
    record_type: 'product_answer', product: pn, channels: cn, question_id: q.id, question: q.t, answer_id: o.id, answer: o.l,
    implied_tags: [['pr', 'Product'], ['ch', 'Channels'], ['rl', 'Payment rails'], ['sg', 'Customer segments']].filter(d => (o.m[d[0]] || []).length).map(d => d[1] + ': ' + o.m[d[0]].map(v => d[0] === 'pr' ? lab.cp[v] : d[0] === 'ch' ? lab.cc[v] : lbl(d[0], v)).join(', ')).join('; ') }))));
  inc.forEach(o => rows.push(row({
    record_type: 'typology', product: pn, channels: cn, typology_id: o.t.id, typology: o.t.n, tier: o.tier,
    matched_channels: o.r ? o.r.mc.map(c => lab.cc[c]).join('; ') : '', matched_payment_rails: o.r ? o.r.rl.map(v => lbl('rl', v)).join('; ') : '',
    matched_customer_segments: o.r ? o.r.sg.map(v => lbl('sg', v)).join('; ') : '', consumer_rationale: o.t.cn.rt || '' })));
  inc.forEach(o => (X.L[o.t.id] || []).forEach(([iid, cs]) => cs.forEach(c => rows.push(row({
    record_type: 'linkage', product: pn, channels: cn, typology_id: o.t.id, typology: o.t.n, tier: o.tier, indicator_id: iid, indicator: X.IM[iid].n,
    'signal_strength (canonical, indicative, not a risk score)': X.IM[iid].s, control_id: c, control: X.CM[c].n, control_type: X.CM[c].t })))));
  FC.download('product-pack.csv', FC.csv(rows));
}

/* ---------- grid ---------- */
function gridHtml() {
  const ps = Object.keys(lab.cp), cs = Object.keys(lab.cc);
  let h = '<section class="gridv"><h2>Product by channel</h2><p class="note">Each cell counts the consumer-relevant typologies linked to that product via that channel. Counts of linked typologies, not risk. The ' + X.T.filter(t => t.x).length + ' cross-cutting typologies apply across all products and are not counted. Tags are AI-inferred and unreviewed.</p>' +
    '<div class="gscroll"><table class="gtab"><caption class="sr">Typologies linked to each consumer product and channel</caption><thead><tr><th scope="col">Product</th>' + cs.map(c => '<th scope="col">' + esc(lab.cc[c]) + '</th>').join('') + '</tr></thead><tbody>' +
    ps.map(p => '<tr><th scope="row">' + esc(lab.cp[p]) + '</th>' + cs.map(c => {
      const n = baseSet(p, c).length, on = ui.grid && ui.grid.p === p && ui.grid.c === c;
      return '<td><button type="button" class="gcell" data-gp="' + p + '" data-gc="' + c + '" aria-pressed="' + !!on + '" data-focus="g-' + p + '-' + c + '"><b>' + n + '</b><span class="sr"> typologies for ' + esc(lab.cp[p]) + ' via ' + esc(lab.cc[c]) + '</span></button></td>';
    }).join('') + '</tr>').join('') + '</tbody></table></div>';
  if (ui.grid) {
    const { p, c } = ui.grid, l = baseSet(p, c);
    h += '<div class="glist" id="glist" tabindex="-1"><h3>' + esc(lab.cp[p]) + ' via ' + esc(lab.cc[c]) + ' <span class="n">(' + l.length + ')</span></h3><p class="acts"><a class="btn" href="/#cb=' + p + '~' + c + '">Browse in the linkage view</a><button type="button" class="btn" data-assess="' + p + '~' + c + '">Assess this product</button></p>' +
      l.map(t => '<article class="mcard"><div class="top2"><h4>' + MARK.t + '<span>' + esc(t.n) + '</span></h4><div class="acts"><a class="btn" href="/#' + t.id + '">Open linkage</a></div></div><p class="dom">' + esc(lab.dom[t.d] || '') + ' | ' + t.ni + ' indicators | ' + t.nc + ' controls</p></article>').join('') + '</div>';
  } else h += '<p class="note">Select a cell to list its typologies.</p>';
  return h + '</section>';
}

/* ---------- shell ---------- */
function shell() {
  root.innerHTML =
    '<div class="pmbar"><div class="field"><label for="prof">Start from an example <span class="illus">illustrative</span></label><select id="prof"><option value="">None: start blank</option>' +
    Q.profiles.map(p => '<option value="' + esc(p.id) + '">' + esc(p.n) + '</option>').join('') + '</select></div>' +
    '<div class="acts"><button type="button" class="btn" id="reset">Reset</button><button type="button" class="btn" id="share">Copy link</button></div>' +
    '<div class="seg" role="group" aria-label="View"><button type="button" data-tab="assess" aria-pressed="' + !S.g + '">Assess a product</button><button type="button" data-tab="grid" aria-pressed="' + S.g + '">Product by channel grid</button></div>' +
    '<p id="profnote" class="pnote"></p></div>' +
    '<div class="pmbody" id="pmassess"' + (S.g ? ' hidden' : '') + '><div class="qcol" id="qcol"><p class="qh" id="cnt" aria-live="polite"></p><div id="steps"></div></div><aside class="res" id="results" aria-label="Results" aria-live="polite"></aside></div>' +
    '<div id="pmgrid"' + (S.g ? '' : ' hidden') + '></div>';
  $('#prof').value = S.p; profNote(); paintSteps(); if (S.g) $('#pmgrid').innerHTML = gridHtml();
}
function paintSteps() { const st = $('#steps'); if (st) st.innerHTML = stepsHtml(); }
function profNote() {
  const p = PROF[S.p];
  $('#profnote').innerHTML = p ? '<span class="illus" style="margin:0 6px 0 0">illustrative</span>' + esc(p.d) + ' Edit any answer; this is an example, not a real product.' : '';
}
function changed(rebuild) { prune(); save(); if (rebuild) paintSteps(); else syncInputs(); renderResults(); }
function syncInputs() { $$('#steps input', root).forEach(i => { i.checked = S.a.has(i.value); }); }
function applyTab() {
  const g = S.g;
  $$('.seg button', root).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.tab === 'grid') === g)));
  $('#pmassess').hidden = g; $('#pmgrid').hidden = !g;
  if (g) $('#pmgrid').innerHTML = gridHtml(); else renderResults();
}
function setTab(g) { S.g = g; save(); applyTab(); }
shell(); prune(); renderResults();

root.addEventListener('change', e => {
  const inp = e.target;
  if (inp.id === 'prof') {
    S.p = inp.value; S.x.clear(); S.i.clear(); S.a = new Set(S.p ? PROF[S.p].a.filter(id => OPT[id]) : []);
    profNote(); ui.animate = true; ui.open = {}; changed(true); return;
  }
  if (inp.id === 'addsel') { if (inp.value) { S.i.add(inp.value); S.x.delete(inp.value); changed(); } return; }
  if (inp.matches('#steps input')) {
    const o = OPT[inp.value], q = QOF[inp.value];
    if (q.ty === 'single') { q.o.forEach(x => S.a.delete(x.id)); S.a.add(o.id); }
    else if (inp.checked) {
      const none = x => !['pr', 'ch', 'rl', 'sg'].some(s => (x.m[s] || []).length);
      if (q.id !== 'Q02') { if (none(o)) q.o.forEach(x => S.a.delete(x.id)); else q.o.filter(none).forEach(x => S.a.delete(x.id)); }
      S.a.add(o.id);
    } else S.a.delete(o.id);
    changed(q.id === 'Q01' || q.id === 'Q02');
  }
});
root.addEventListener('click', e => {
  const t = e.target.closest('button,a,summary'); if (!t) return;
  if (t.dataset.tog) { const id = t.dataset.tog; S.x.has(id) ? S.x.delete(id) : S.x.add(id); changed(); }
  else if (t.dataset.rm) { S.i.delete(t.dataset.rm); changed(); }
  else if (t.dataset.clr) { Q.questions.find(q => q.id === t.dataset.clr).o.forEach(o => S.a.delete(o.id)); changed(true); }
  else if (t.id === 'reset') { S.a.clear(); S.x.clear(); S.i.clear(); S.p = ''; $('#prof').value = ''; profNote(); ui.open = {}; changed(true); }
  else if (t.id === 'share') { save(); FC.copy(location.href); }
  else if (t.id === 'pack') exportPack();
  else if (t.dataset.tab) setTab(t.dataset.tab === 'grid');
  else if (t.dataset.gp) { ui.grid = { p: t.dataset.gp, c: t.dataset.gc }; $('#pmgrid').innerHTML = gridHtml(); const g = $('#glist'); if (g) FC.enter($$('.mcard', g).slice(0, 12), 0); const f = $('[data-focus="g-' + ui.grid.p + '-' + ui.grid.c + '"]'); if (f) f.focus({ preventScroll: true }); }
  else if (t.dataset.assess) {
    const [p, c] = t.dataset.assess.split('~');
    Q01.o.concat(Q02.o).forEach(o => S.a.delete(o.id));
    const po = Q01.o.find(o => o.m.pr && o.m.pr[0] === p), co = Q02.o.find(o => o.m.ch && o.m.ch[0] === c);
    if (po) S.a.add(po.id); if (co) S.a.add(co.id);
    S.p = ''; $('#prof').value = ''; profNote(); ui.animate = true; setTab(false); changed(true);
  }
});
root.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.g) ui.open[d.dataset.g] = d.open; }, true);
window.addEventListener('hashchange', () => { dec(location.hash.slice(1)); $('#prof').value = S.p; profNote(); paintSteps(); prune(); renderResults(); applyTab(); });
})();
