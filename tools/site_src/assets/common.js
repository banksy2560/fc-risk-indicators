/* Shared helpers: data loading, marks, CSV, toast, input-mode tracking (keyboard input never animates). */
(function () {
'use strict';
const FC = window.FC = {};
const $ = FC.$ = (s, r) => (r || document).querySelector(s);
FC.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
FC.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mk = k => '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true"><use href="#m-' + k + '"/></svg>';
FC.MARK = { t: mk('t'), i: mk('i'), c: mk('c') };
FC.KIND = { t: 'Typology', i: 'Indicator', c: 'Control' };
FC.SEV = { low: 'Low', medium: 'Medium', high: 'High' };
FC.sig = s => s ? '<span class="sig" data-s="' + FC.esc(s) + '"><i aria-hidden="true"><b></b><b></b><b></b></i>' + FC.esc(FC.SEV[s] || s) + '<span class="sr"> signal strength</span></span>' : '';
FC.kindOf = id => /^IND-/.test(id) ? 'i' : /^CTL-/.test(id) ? 'c' : 't';

/* input mode: 'kbd' after any key press, 'ptr' after a pointer press. Keyboard-driven changes are never animated. */
FC.input = 'ptr';
const setIn = m => { FC.input = m; document.documentElement.dataset.input = m; };
document.addEventListener('keydown', e => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) setIn('kbd'); }, true);
document.addEventListener('pointerdown', () => setIn('ptr'), true);
/* true when motion should run at all (CSS reduces it to opacity-only fades under prefers-reduced-motion) */
FC.motionOK = () => document.documentElement.dataset.motion !== 'off' && FC.input !== 'kbd';

const cache = {};
FC.getJSON = path => cache[path] || (cache[path] = fetch(path + '?v=' + window.FC_V).then(r => {
  if (!r.ok) throw new Error(path + ' ' + r.status); return r.json();
}).catch(e => { delete cache[path]; throw e; }));
FC.fail = () => { const n = $('#nofetch'); if (n) n.hidden = false; const l = $('.loading'); if (l) l.remove(); };
FC.loadIndex = async function () {
  const d = await FC.getJSON('/data/index.json');
  if (!d.TM) {
    d.TM = {}; d.IM = {}; d.CM = {};
    d.T.forEach(t => d.TM[t.id] = t); d.I.forEach(i => d.IM[i.id] = i); d.C.forEach(c => d.CM[c.id] = c);
    d.indTyps = {}; d.ctlTyps = {}; d.ctlInds = {}; // ctlInds[cid][tid] = [iid]
    Object.keys(d.L).forEach(tid => d.L[tid].forEach(([iid, cs]) => {
      (d.indTyps[iid] = d.indTyps[iid] || []).push(tid);
      cs.forEach(c => {
        d.ctlTyps[c] = d.ctlTyps[c] || [];
        if (!d.ctlTyps[c].includes(tid)) d.ctlTyps[c].push(tid);
        d.ctlInds[c] = d.ctlInds[c] || {};
        (d.ctlInds[c][tid] = d.ctlInds[c][tid] || []).push(iid);
      });
    }));
  }
  return d;
};

/* CSV: UTF-8 BOM, CRLF, quoting; neutralises spreadsheet formulas. */
FC.csv = rows => '﻿' + rows.map(r => r.map(v => {
  let s = String(v == null ? '' : v);
  if (/^[=+@-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}).join(',')).join('\r\n') + '\r\n';
FC.download = (name, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
let tt;
FC.toast = msg => { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); };
FC.copy = async text => {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove();
  }
  FC.toast('Link copied');
};
FC.tagCls = g => /unverified|untagged/.test(g) ? 'cite warn' : 'cite';

/* Entrance on first render of a set: 200ms fade + 6px rise; delay = base + 30ms steps capped at 2 steps, so the
   whole sequence ends within 300ms. Skipped for keyboard-driven renders and data-motion=off. */
FC.enter = (els, base) => {
  if (!FC.motionOK()) return;
  els.forEach((el, k) => { el.style.animationDelay = (base + Math.min(k, 2) * 30) + 'ms'; el.classList.add('enter'); });
  setTimeout(() => els.forEach(el => { el.classList.remove('enter'); el.style.animationDelay = ''; }), 400);
};

/* about page: play the diagram draw-in once when it scrolls into view */
document.addEventListener('DOMContentLoaded', () => {
  const dia = $('#dia'); if (!dia) return;
  if (!('IntersectionObserver' in window)) { dia.classList.add('on'); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { dia.classList.add('on'); io.disconnect(); } }, { threshold: .4 });
  io.observe(dia);
});
})();
