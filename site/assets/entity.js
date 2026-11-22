/* Typologies, controls and indicators: hash-routed, citable pages with a grouped side navigation */
(async function(){
'use strict';
const {h,nice,cap,getJSON,loadIndex,sig,citeTag,TAGS,L,usedIn,plural}=FC;
const MODE=document.body.dataset.page;               // typologies | controls | indicators
const $=id=>document.getElementById(id);
let X;try{X=await loadIndex()}catch(e){return FC.fail(e)}
const {T,I,C,DOM,data}=X;
const LABEL={typologies:'Typologies',controls:'Controls',indicators:'Indicators'};
const SING={typologies:'typology',controls:'control',indicators:'indicator'};

// ---------- navigation
const groups={typologies:()=>data.domains.map(d=>({key:d.id,label:d.label,items:data.typologies.filter(t=>t.domain===d.id).map(t=>({id:t.id,name:t.name}))})),
 controls:()=>X.FAMS.map(f=>({key:f,label:cap(f),items:data.controls.filter(c=>c.family===f).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({id:c.id,name:c.name,n:c.nTyp}))})),
 indicators:()=>[...new Set(data.indicators.map(i=>i.cat))].sort().map(k=>({key:k,label:cap(k),items:data.indicators.filter(i=>i.cat===k).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>({id:i.id,name:i.name,n:i.used}))}))}[MODE]();
const href={typologies:L.typ,controls:L.ctl,indicators:L.ind}[MODE];
function buildNav(){
 const tabs=Object.keys(LABEL).map(k=>`<a class="btn sm ${k===MODE?'on':''}" href="${k}" ${k===MODE?'aria-current="page"':''}>${LABEL[k]}</a>`).join(' ');
 $('sidenav').innerHTML=`<div class="tags" style="margin-bottom:10px" role="group" aria-label="Browse by">${tabs}</div>
 <label class="sr" for="nf">Filter ${LABEL[MODE].toLowerCase()}</label><input type="search" id="nf" class="filter" placeholder="Filter ${LABEL[MODE].toLowerCase()}" autocomplete="off">
 <div id="navlist">${groups.map(g=>`<details data-g="${h(g.key)}"><summary>${h(g.label)} <span class="n">${g.items.length}</span></summary><ul>${g.items.map(i=>`<li data-id="${h(i.id)}" data-s="${h((i.name+' '+i.id).toLowerCase())}"><a href="${href(i.id)}">${h(i.name)}</a></li>`).join('')}</ul></details>`).join('')}</div><p class="note" id="nfe" hidden>No matches.</p>`;
 $('nf').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();let any=false;
  document.querySelectorAll('#navlist details').forEach(d=>{let n=0;d.querySelectorAll('li').forEach(li=>{const ok=!q||li.dataset.s.includes(q);li.hidden=!ok;if(ok)n++});d.hidden=!n;if(q)d.open=!!n;if(n)any=true});
  $('nfe').hidden=any})}
function markCurrent(id){
 document.querySelectorAll('#navlist a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));
 const li=id&&document.querySelector(`#navlist li[data-id="${CSS.escape(id)}"]`);
 if(li){const a=li.querySelector('a');a.setAttribute('aria-current','true');li.closest('details').open=true;
  const sn=$('sidenav');if(sn.offsetParent&&getComputedStyle(sn).position==='sticky'){const r=a.getBoundingClientRect(),s=sn.getBoundingClientRect();if(r.top<s.top||r.bottom>s.bottom)sn.scrollTop+=r.top-s.top-80}}}

// ---------- shared fragments
const cchip=(id,extra)=>{const c=C[id];return c?`<a class="cchip" href="${L.ctl(id)}" title="${h(c.name)}"><b>${h(c.name)}</b><span>${id} | ${usedIn(c.nTyp)}${extra?' | '+extra:''}</span></a>`:`<span class="tag">${h(id)}</span>`};
const tlink=id=>T[id]?`<a href="${L.typ(id)}">${h(T[id].name)}</a>`:h(id);
const ilink=id=>I[id]?`<a href="${L.ind(id)}">${h(I[id].name)}</a>`:h(id);
function citeBox(kind,id,name){
 const url=location.origin&&location.origin!=='null'?location.origin+location.pathname+'#'+id:location.href;
 return `<div class="cite-box"><span class="lbl" style="margin:0">Cite this ${kind}</span><code id="cu">${h(url)}</code><button type="button" class="btn sm" id="cp">Copy link</button><span class="note" id="cpm" role="status"></span><span class="note" style="flex-basis:100%">Suggested: FC Risk Indicators (v0.1 draft, unreviewed), "${h(name)}" (${h(id)}). Draft content: check before relying on it.</span></div>`}
function wireCite(){const b=$('cp');if(!b)return;b.onclick=async()=>{const t=$('cu').textContent;try{await navigator.clipboard.writeText(t);$('cpm').textContent='Copied.'}catch(e){const r=document.createRange();r.selectNodeContents($('cu'));const s=getSelection();s.removeAllRanges();s.addRange(r);$('cpm').textContent='Press Ctrl/Cmd+C to copy.'}}}
const crumbs=(...p)=>`<nav class="crumbs" aria-label="Breadcrumb">${p.join(' / ')}</nav>`;
const byFamily=ids=>{const g={};ids.forEach(c=>{const f=C[c]?C[c].family:'other';(g[f]=g[f]||[]).push(c)});return Object.keys(g).sort().map(f=>[f,g[f].sort((a,b)=>C[b].nTyp-C[a].nTyp||C[a].name.localeCompare(C[b].name))])};

// ---------- overviews
function overview(){
 let html;
 if(MODE==='typologies')html=`<h1>Typologies</h1><p class="lead">A typology is the unit of analysis: a recognisable way that financial crime is carried out. Each page lists its description, sectors, sources with citation status, every linked indicator in typology context, and the candidate controls used. Choose one below or use the navigation.</p><div class="domgrid">${groups.map(g=>`<section class="card"><h3>${h(g.label)} <span class="note">(${g.items.length})</span></h3><ul>${g.items.map(i=>`<li><a href="${href(i.id)}">${h(i.name)}</a></li>`).join('')}</ul></section>`).join('')}</div>`;
 else if(MODE==='controls'){html=`<h1>Controls</h1><p class="lead">${data.counts.controls} canonical controls, each defined once and linked from many indicators and typologies. "Used in N typologies" counts linkage only, not effectiveness. Sorted by reuse.</p>`+
  `<table class="l"><thead><tr><th>Control</th><th>Family</th><th>Type</th><th>Typologies</th></tr></thead><tbody>${[...data.controls].sort((a,b)=>b.nTyp-a.nTyp||a.name.localeCompare(b.name)).map(c=>`<tr><td><a href="${L.ctl(c.id)}">${h(c.name)}</a> <span class="note mono">${c.id}</span></td><td>${h(cap(c.family))}</td><td>${h(c.type)}</td><td>${c.nTyp}</td></tr>`).join('')}</tbody></table>`}
 else html=`<h1>Indicators</h1><p class="lead">${data.counts.indicators} canonical indicators (red flags), each defined once and linked from one or more typologies. They are not proof of crime. Signal is indicative strength only. Grouped by category in the navigation; the most reused are below.</p>`+
  `<table class="l"><thead><tr><th>Indicator</th><th>Category</th><th>Signal</th><th>Typologies</th></tr></thead><tbody>${[...data.indicators].sort((a,b)=>b.used-a.used||a.name.localeCompare(b.name)).slice(0,60).map(i=>`<tr><td><a href="${L.ind(i.id)}">${h(i.name)}</a> <span class="note mono">${i.id}</span></td><td>${h(cap(i.cat))}</td><td>${sig(i.sev)}</td><td>${i.used}</td></tr>`).join('')}</tbody></table><p class="note">Showing the 60 most reused of ${data.counts.indicators}.</p>`;
 $('article').innerHTML=html;document.title=LABEL[MODE]+' | FC Risk Indicators';markCurrent(null)}

// ---------- typology page
async function typologyPage(id,focusRef){
 const t=T[id];const d=await getJSON(`data/typologies/${id}.json`);
 const fams=byFamily(d.controls);
 const srcs=d.sources.length?`<ul class="sources">${d.sources.map(s=>`<li><span class="t">${h(s.text)}${s.url?` <a href="${h(s.url)}" rel="noopener noreferrer">${h(s.url.replace(/^https?:\/\//,'').slice(0,60))}</a>`:''}</span>${citeTag(s.tag)}</li>`).join('')}</ul>`:'<p class="note">No sources recorded.</p>';
 const indHtml=d.indicators.map(i=>`<article class="ind" id="ind-${h(i.ref)}" data-ref="${h(i.ref)}"><h3><span>${h(i.name)}</span><span class="tags">${sig(i.sev)}<span class="tag">${h(cap(i.cat))}</span></span></h3>
  <div class="idline"><a href="${L.ind(i.ref)}">${i.ref}</a><span>${usedIn(i.used)}</span>${i.legacy?`<span title="Version 0.1 identifier kept for traceability">legacy ${h(i.legacy)}</span>`:''}</div>
  ${i.ctx?`<div class="row"><b>In this typology</b>${h(i.ctx)}</div>`:''}
  ${i.fp?`<div class="row"><b>Legitimate explanations (false positives)</b>${h(i.fp)}</div>`:''}
  <div class="row"><b>Linked controls (${i.controls.length})</b><div class="chips">${i.controls.map(c=>cchip(c)).join('')||'<span class="note">None recorded.</span>'}</div></div>
  <details><summary>Generic definition and detection</summary><p style="margin:6px 0">${h(i.desc)}</p><p class="note" style="margin:0">Canonical name: ${h(i.canon)}.${i.sev!==i.canonSev?` Signal in this typology differs from the canonical signal (${h(i.canonSev)}).`:''} Detection: ${i.det.map(x=>h(nice(x))).join(', ')||'n/a'}. Data: ${i.data.map(x=>h(nice(x))).join(', ')||'n/a'}.</p>${i.refs.length?`<p class="note" style="margin:6px 0 0">References: ${i.refs.map(h).join('; ')}</p>`:''}</details></article>`).join('');
 $('article').innerHTML=`${crumbs('<a href="typologies">Typologies</a>',`<a href="typologies" data-dom="${h(d.domain)}">${h(DOM[d.domain]||d.domain)}</a>`)}
 <p class="idline"><span class="kind k-typology">typology</span><span>${id}</span><span>v0.1 draft, unreviewed</span></p>
 <h1 tabindex="-1" id="pt">${h(d.name)}</h1>
 <div class="tags" style="margin-bottom:12px"><span class="tag">${h(DOM[d.domain]||d.domain)}</span>${d.stage.map(s=>`<span class="tag">stage: ${h(nice(s))}</span>`).join('')}</div>
 <p class="lead">${h(d.description)}</p>
 ${citeBox('typology',id,d.name)}
 <h2>Sectors</h2><div class="tags">${d.sectors.map(s=>`<span class="tag">${h(cap(s))}</span>`).join('')||'<span class="note">Not specified.</span>'}</div>
 <h2>Sources <span class="n">(${d.sources.length})</span></h2><p class="note">No citation has been confirmed by a human. Tags show how far each was checked. <a href="about#citations">What the tags mean</a>.</p>${srcs}
 <h2>Indicators <span class="n">(${d.indicators.length})</span></h2><p class="note">Red flags, not proof of crime. Signal is the indicative strength of the indicator in this typology, never a score and never aggregated.</p>${indHtml}
 <h2>Controls used in this typology <span class="n">(${d.controls.length})</span></h2><p class="note">Candidate controls linked to this typology's indicators. "Used in N typologies" shows how widely a control is reused, not how well it works.</p>${fams.map(([f,ids])=>`<div class="famgrp"><h3>${h(cap(f))}</h3><div class="chips">${ids.map(c=>cchip(c)).join('')}</div></div>`).join('')}`;
 document.title=`${d.name} (${id}) | FC Risk Indicators`;
 const m=document.querySelector('meta[name=description]');if(m)m.content=d.description.slice(0,200);
 wireCite();
 if(focusRef){const el=document.getElementById('ind-'+focusRef);if(el){el.classList.add('hl');el.scrollIntoView({block:'start'});return 'scrolled'}}
}

// ---------- control page
async function controlPage(id){
 const c=C[id];const d=await getJSON(`data/controls/${id}.json`);
 const byDom={};d.links.forEach(l=>{const t=T[l.typ];if(t)(byDom[t.domain]=byDom[t.domain]||[]).push(l)});
 const doms=data.domains.filter(x=>byDom[x.id]);
 $('article').innerHTML=`${crumbs('<a href="controls">Controls</a>',`<span>${h(cap(c.family))}</span>`)}
 <p class="idline"><span class="kind k-control">control</span><span>${id}</span><span>v0.1 draft, unreviewed</span></p>
 <h1 tabindex="-1" id="pt">${h(c.name)}</h1>
 <div class="tags" style="margin-bottom:12px"><span class="tag">${h(c.type)}</span><span class="tag">${h(cap(c.family))}</span><span class="tag">${h(cap(c.impl))}</span><span class="tag" title="Typical effectiveness as drafted. Indicative only; not an assessment of any institution's control.">typical effectiveness: ${h(c.eff||'n/a')} (indicative)</span></div>
 <p class="lead">${h(c.desc)}</p>
 ${c.aka.length?`<p class="note">Also known as: ${c.aka.map(h).join('; ')}</p>`:''}
 ${citeBox('control',id,c.name)}
 <p><b>${usedIn(c.nTyp)}</b>, linked to ${plural(c.nInd,'indicator','indicators')}. Counts show linkage, not effectiveness.</p>
 <h2>Typologies using this control <span class="n">(${c.nTyp})</span></h2>
 ${doms.map(dm=>`<div class="famgrp"><h3>${h(dm.label)} (${byDom[dm.id].length})</h3><ul class="ctl-list">${byDom[dm.id].map(l=>`<li><a href="${L.typ(l.typ)}"><b>${h(T[l.typ].name)}</b></a> <span class="u">${l.typ}</span><div class="note" style="margin-top:4px">Applied to ${plural(l.inds.length,'indicator','indicators')}: ${l.inds.map(r=>`<a href="${L.typ(l.typ)}/${r}">${h(I[r]?I[r].name:r)}</a>`).join('; ')}</div></li>`).join('')}</ul></div>`).join('')}
 <h2>Indicators using this control <span class="n">(${c.nInd})</span></h2>
 <ul class="ctl-list">${c.inds.map(r=>{const i=I[r];return i?`<li><a href="${L.ind(r)}"><b>${h(i.name)}</b></a> ${sig(i.sev)} <span class="tag">${h(cap(i.cat))}</span><div class="u">${r} | ${usedIn(i.used)}</div></li>`:''}).join('')}</ul>`;
 document.title=`${c.name} (${id}) | FC Risk Indicators`;
 wireCite();
}

// ---------- indicator page
async function indicatorPage(id){
 const i=I[id];const d=await getJSON(`data/indicators/${id}.json`);
 $('article').innerHTML=`${crumbs('<a href="indicators">Indicators</a>',`<span>${h(cap(i.cat))}</span>`)}
 <p class="idline"><span class="kind k-indicator">indicator</span><span>${id}</span><span>v0.1 draft, unreviewed</span></p>
 <h1 tabindex="-1" id="pt">${h(i.name)}</h1>
 <div class="tags" style="margin-bottom:12px">${sig(i.sev)}<span class="tag">${h(cap(i.cat))}</span></div>
 <p class="lead">${h(d.description)}</p>
 <p class="note">A red flag, not proof of crime. Defined once; ${usedIn(i.used)}. Detection: ${d.det.map(x=>h(nice(x))).join(', ')||'n/a'}. Data: ${d.data.map(x=>h(nice(x))).join(', ')||'n/a'}.</p>
 ${citeBox('indicator',id,i.name)}
 ${d.fp?`<h2>Legitimate explanations (false positives)</h2><p>${h(d.fp)}</p>`:''}
 <h2>Typologies <span class="n">(${d.links.length})</span></h2>
 ${d.links.map(l=>`<article class="ind"><h3><a href="${L.typ(l.typ)}/${id}">${h(T[l.typ]?T[l.typ].name:l.typ)}</a><span class="tags">${sig(l.sev)}</span></h3>${l.name!==i.name?`<div class="idline">Named in this typology: ${h(l.name)}</div>`:''}${l.ctx?`<div class="row"><b>In this typology</b>${h(l.ctx)}</div>`:''}<div class="row"><b>Controls used here</b><div class="chips">${l.controls.map(c=>cchip(c)).join('')}</div></div></article>`).join('')}
 <h2>Controls linked to this indicator <span class="n">(${i.ctls.length})</span></h2>
 ${byFamily(i.ctls).map(([f,ids])=>`<div class="famgrp"><h3>${h(cap(f))}</h3><div class="chips">${ids.map(c=>cchip(c)).join('')}</div></div>`).join('')}`;
 document.title=`${i.name} (${id}) | FC Risk Indicators`;
 wireCite();
}

// ---------- router
let first=true,navTok=0;
async function route(){
 const raw=decodeURIComponent(location.hash.replace(/^#/,''));const[id,sub]=raw.split('/');
 const tok=++navTok;
 $('sidenav').classList.remove('open');$('navtoggle').setAttribute('aria-expanded','false');
 const known={typologies:T,controls:C,indicators:I}[MODE];
 if(!id){overview();if(!first)scrollTo(0,0);first=false;return}
 if(!known[id]){$('article').innerHTML=`<h1>Not found</h1><p>No ${SING[MODE]} with id <code>${h(id)}</code>. It may have been renamed or removed. <a href="${MODE}">Browse all ${LABEL[MODE].toLowerCase()}</a>.</p>`;document.title='Not found | FC Risk Indicators';return}
 markCurrent(id);
 $('article').innerHTML='<p class="note" role="status">Loading</p>';
 let r;
 try{r=await(MODE==='typologies'?typologyPage(id,sub):MODE==='controls'?controlPage(id):indicatorPage(id))}catch(e){if(tok===navTok)$('article').innerHTML='<div class="callout warn" role="alert">Could not load this page.</div>';return}
 if(tok!==navTok)return;
 if(r!=='scrolled'){scrollTo(0,0)}
 const pt=$('pt');if(pt&&!first)pt.focus({preventScroll:true});
 first=false;
}
// in-article links to other pages of the same kind use hash change; make sure same-hash clicks still work
buildNav();
$('navtoggle').addEventListener('click',e=>{const o=$('sidenav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)});
addEventListener('hashchange',route);
route();
})();
