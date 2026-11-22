/* Home: search-first catalogue with facets and a detail drawer */
(async function(){
'use strict';
const {h,nice,cap,getJSON,loadIndex,sig,L,usedIn,plural}=FC;
let X;try{X=await loadIndex()}catch(e){return FC.fail(e)}
const {T,I,C,DOM,data}=X;
const items=[];
data.typologies.forEach(t=>items.push({kind:'typology',id:t.id,name:t.name,text:t.desc,dom:[t.domain],sec:t.sectors,meta:`${t.nInd} indicators, ${t.nCtl} controls`,reuse:t.nInd}));
data.indicators.forEach(i=>{const ts=i.typs.map(t=>T[t]);items.push({kind:'indicator',id:i.id,name:i.name,text:i.desc,dom:[...new Set(ts.map(t=>t.domain))],sec:[...new Set(ts.flatMap(t=>t.sectors))],cat:i.cat,sev:i.sev,meta:usedIn(i.used),reuse:i.used})});
data.controls.forEach(c=>{const ts=c.typs.map(t=>T[t]);items.push({kind:'control',id:c.id,name:c.name,text:c.desc+' '+c.aka.join(' '),dom:[...new Set(ts.map(t=>t.domain))],sec:[...new Set(ts.flatMap(t=>t.sectors))],fam:c.family,ctype:c.type,meta:usedIn(c.nTyp),reuse:c.nTyp})});
items.forEach(i=>{i.nl=i.name.toLowerCase();i.tl=(i.text||'').toLowerCase();i.il=i.id.toLowerCase()});
const byKey=Object.fromEntries(items.map(i=>[i.kind+':'+i.id,i]));
const $=id=>document.getElementById(id);
$('tot').textContent=`${data.counts.typologies} typologies, ${data.counts.indicators} indicators, ${data.counts.controls} controls. Press / to search.`;
const FACETS=[
 {key:'dom',label:'Domain',vals:i=>i.dom,lab:v=>DOM[v]||v},
 {key:'cat',label:'Indicator category',vals:i=>i.cat?[i.cat]:[],lab:cap},
 {key:'ctype',label:'Control type',vals:i=>i.ctype?[i.ctype]:[],lab:cap},
 {key:'fam',label:'Control family',vals:i=>i.fam?[i.fam]:[],lab:cap},
 {key:'sec',label:'Sector',vals:i=>i.sec.filter(s=>s!=='all'),lab:cap}];
const STEP=36;
const state={q:'',kind:'',sort:'rel',f:Object.fromEntries(FACETS.map(f=>[f.key,new Set()])),shown:STEP};
// restore ?q=
try{const p=new URLSearchParams(location.search);if(p.get('q')){state.q=p.get('q');$('q').value=state.q}if(['typology','indicator','control'].includes(p.get('kind')))state.kind=p.get('kind')}catch(e){}
document.querySelectorAll('.kinds button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===state.kind));

function score(i,toks){if(!toks.length)return 1;let s=0;for(const k of toks){if(i.nl.includes(k))s+=i.nl.startsWith(k)?6:4;else if(i.tl.includes(k))s+=1;else if(i.il.includes(k))s+=3;else return 0}return s}
const stem=w=>{const s=w.replace(/(ies|ing|ed|es|s|y)$/,'');return s.length>=4?s:w};
const tokens=()=>state.q.toLowerCase().split(/\s+/).filter(Boolean).map(stem);
function run(excl){const toks=tokens();
 return items.filter(i=>!state.kind||i.kind===state.kind).map(i=>({i,s:score(i,toks)})).filter(r=>r.s>0&&FACETS.every(f=>f.key===excl||!state.f[f.key].size||f.vals(r.i).some(v=>state.f[f.key].has(v))))}
const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function hl(s){const toks=tokens();const e=h(s);if(!toks.length)return e;return e.replace(new RegExp('('+toks.map(t=>esc(h(t))).join('|')+')','ig'),'<mark>$1</mark>')}
function renderFacets(){const el=$('facets');let out='';
 for(const f of FACETS){const res=run(f.key),cnt={};res.forEach(r=>f.vals(r.i).forEach(v=>cnt[v]=(cnt[v]||0)+1));
  state.f[f.key].forEach(v=>{if(!(v in cnt))cnt[v]=0});
  const ks=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]||String(f.lab(a)).localeCompare(f.lab(b)));if(!ks.length)continue;
  out+=`<fieldset><legend>${f.label}</legend>${ks.map(v=>`<label><input type="checkbox" data-f="${f.key}" value="${h(v)}" ${state.f[f.key].has(v)?'checked':''}>${h(f.lab(v))}<span class="n">${cnt[v]}</span></label>`).join('')}</fieldset>`}
 const act=document.activeElement;const key=act&&act.dataset&&act.dataset.f?act.dataset.f+'|'+act.value:null;
 el.innerHTML=out;if(key){const[a,b]=key.split('|');const n=el.querySelector(`input[data-f="${a}"][value="${b}"]`);if(n)n.focus({preventScroll:true})}}
$('facets').addEventListener('change',e=>{const c=e.target;if(!c.dataset.f)return;const s=state.f[c.dataset.f];c.checked?s.add(c.value):s.delete(c.value);state.shown=STEP;render()});
function card(r){const i=r.i;
 const tags=(i.kind==='typology'?i.dom.map(d=>`<span class="tag">${h(DOM[d])}</span>`).join(''):'')+
  (i.cat?`<span class="tag">${h(cap(i.cat))}</span>${sig(i.sev)}`:'')+
  (i.ctype?`<span class="tag">${h(cap(i.ctype))}</span><span class="tag">${h(cap(i.fam))}</span>`:'')+
  `<span class="tag"><b>${h(i.meta)}</b></span>`;
 return `<button type="button" class="rc" data-o="${i.kind}:${h(i.id)}"><span class="kind k-${i.kind}">${i.kind} <span class="mono" style="letter-spacing:0;text-transform:none;opacity:.8">${h(i.id)}</span></span><h3>${hl(i.name)}</h3><p>${hl(i.text)}</p><div class="tags">${tags}</div></button>`}
let timer;
function sync(){try{const p=new URLSearchParams();if(state.q)p.set('q',state.q);if(state.kind)p.set('kind',state.kind);const s=p.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:''))}catch(e){}}
function render(){
 const res=run();const KO={typology:0,indicator:1,control:2};const so={rel:(a,b)=>b.s-a.s||(state.q?0:KO[a.i.kind]-KO[b.i.kind])||b.i.reuse-a.i.reuse||a.i.name.localeCompare(b.i.name),reuse:(a,b)=>b.i.reuse-a.i.reuse||a.i.name.localeCompare(b.i.name),name:(a,b)=>a.i.name.localeCompare(b.i.name)}[state.sort];res.sort(so);
 $('count').textContent=`${res.length} result${res.length===1?'':'s'}`;
 const pills=[];FACETS.forEach(f=>state.f[f.key].forEach(v=>pills.push(`<span class="pill">${h(f.lab(v))}<button type="button" data-r="${f.key}|${h(v)}" aria-label="Remove filter ${h(f.lab(v))}">x</button></span>`)));
 const any=pills.length;
 $('pills').innerHTML=pills.join(' ')+(any?' <button type="button" class="linkbtn note" id="clr">Clear all</button>':'');
 const box=$('results');
 box.innerHTML=res.length?res.slice(0,state.shown).map(card).join(''):'<div class="empty">No results. Try fewer words or clear a filter.</div>';
 box.style.display=res.length?'':'block';
 const more=$('more');more.hidden=res.length<=state.shown;more.textContent=`Show more (${res.length-state.shown} remaining)`;
 renderFacets();sync()}
$('pills').addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(b){const[a,v]=b.dataset.r.split('|');state.f[a].delete(v);render()}if(e.target.id==='clr'){Object.values(state.f).forEach(s=>s.clear());render()}});
$('results').addEventListener('click',e=>{const b=e.target.closest('[data-o]');if(b)openItem(b.dataset.o,true,b)});
$('q').addEventListener('input',e=>{state.q=e.target.value;state.shown=STEP;clearTimeout(timer);timer=setTimeout(render,60)});
document.querySelectorAll('.kinds button').forEach(b=>b.onclick=()=>{state.kind=b.dataset.k;document.querySelectorAll('.kinds button').forEach(x=>x.setAttribute('aria-pressed',x===b));state.shown=STEP;render()});
$('sort').onchange=e=>{state.sort=e.target.value;render()};
$('more').onclick=()=>{state.shown+=STEP;render()};
$('fbtn').onclick=e=>{const o=$('facets').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)};
const tr=$('try');['structuring','shell company','ransomware','sanctions','device','trade'].forEach(w=>{const b=document.createElement('button');b.type='button';b.className='btn sm';b.textContent=w;b.onclick=()=>{$('q').value=w;state.q=w;state.shown=STEP;render()};tr.appendChild(b)});
addEventListener('keydown',e=>{const q=$('q');
 if((e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')){e.preventDefault();if(!drawer.hidden)closeDrawer();q.focus();q.select()}
 if(e.key==='Escape'&&!drawer.hidden)closeDrawer()});

// ---- drawer
const drawer=$('drawer'),db=$('db'),scrim=$('scrim');let stack=[],opener=null,seq=0;
const inertEls=()=>[document.getElementById('top'),document.querySelector('.site-footer'),...document.querySelectorAll('#main > :not(.drawer):not(.scrim)')].filter(Boolean);
function li(kind,id,sub){const it=byKey[kind+':'+id];return `<button type="button" class="li" data-o="${kind}:${h(id)}"><span class="kind k-${kind}">${kind}</span> ${h(it?it.name:id)}<span class="s">${h(sub||(it&&it.meta)||'')}</span></button>`}
function openItem(key,push,btn){if(btn)opener=btn;if(push==='replace')stack[stack.length-1]=key;else if(push)stack.push(key);
 drawer.hidden=false;scrim.hidden=false;inertEls().forEach(e=>e.inert=true);paint()}
function ctlChips(ids){return ids.map(c=>`<button type="button" class="tag" data-o="control:${c}" title="${h(C[c].name)}">${h(C[c].name)}</button>`).join(' ')}
async function paint(){const key=stack[stack.length-1];const[kind,id]=key.split(':');const my=++seq;
 $('back').style.visibility=stack.length>1?'visible':'hidden';
 let html='';const it=byKey[key];
 try{
 if(kind==='typology'){const t=T[id];
  html=`<span class="kind k-typology">typology</span><h2>${h(t.name)}</h2><div class="tags"><span class="tag">${h(DOM[t.domain])}</span>${t.sectors.map(s=>`<span class="tag">${h(cap(s))}</span>`).join('')}<span class="tag">draft, unreviewed</span></div><p style="margin-top:10px">${h(t.desc)}</p><p><a class="btn" href="${L.typ(id)}">Open full typology page</a></p><div id="dyn"><p class="note">Loading indicators</p></div>`;
  db.innerHTML=html;
  const d=await getJSON(`data/typologies/${id}.json`);if(my!==seq)return;
  $('dyn').innerHTML=`<h3>Indicators (${d.indicators.length})</h3>`+d.indicators.map(i=>`<div class="mini"><b>${h(i.name)}</b> ${sig(i.sev)} <span class="tag">${h(cap(i.cat))}</span><div class="note">${h(i.ctx||i.desc)}</div><div class="tags" style="margin-top:6px">${ctlChips(i.controls)}</div><div style="margin-top:6px"><button type="button" class="tag" data-o="indicator:${i.ref}">indicator ${h(i.ref)}, ${usedIn(i.used)}</button></div></div>`).join('');
 }else if(kind==='indicator'){const i=I[id];
  html=`<span class="kind k-indicator">indicator</span><h2>${h(i.name)}</h2><div class="tags">${sig(i.sev)}<span class="tag">${h(cap(i.cat))}</span><span class="tag mono">${h(id)}</span></div><p style="margin-top:10px">${h(i.desc)}</p><p class="note">Defined once; ${usedIn(i.used)}.</p><p><a class="btn" href="${L.ind(id)}">Open full indicator page</a></p><div id="dyn"></div><h3>Typologies (${i.typs.length})</h3>${i.typs.map(t=>li('typology',t)).join('')}<h3>Controls linked to it (${i.ctls.length})</h3>${i.ctls.map(c=>li('control',c)).join('')}`;
  db.innerHTML=html;
  const d=await getJSON(`data/indicators/${id}.json`);if(my!==seq)return;
  if(d.fp)$('dyn').innerHTML=`<h3>Legitimate explanations (false positives)</h3><p>${h(d.fp)}</p>`;
 }else{const c=C[id];
  html=`<span class="kind k-control">control</span><h2>${h(c.name)}</h2><div class="tags"><span class="tag">${h(c.type)}</span><span class="tag">${h(cap(c.family))}</span><span class="tag">${h(cap(c.impl))}</span><span class="tag mono">${h(id)}</span></div><p style="margin-top:10px">${h(c.desc)}</p><p><b>${usedIn(c.nTyp)}</b> and linked to ${plural(c.nInd,'indicator','indicators')}. Counts show linkage, not effectiveness.</p><p><a class="btn" href="${L.ctl(id)}">Open full control page</a></p><h3>Typologies (${c.typs.length})</h3>${c.typs.map(t=>li('typology',t)).join('')}<h3>Indicators (${c.inds.length})</h3>${c.inds.map(i=>li('indicator',i)).join('')}`;
  db.innerHTML=html}
 }catch(e){db.innerHTML+=`<div class="callout warn">Could not load detail.</div>`}
 db.scrollTop=0;db.focus({preventScroll:true})}
db.addEventListener('click',e=>{const b=e.target.closest('[data-o]');if(b)openItem(b.dataset.o,true)});
function closeDrawer(){drawer.hidden=true;scrim.hidden=true;stack=[];inertEls().forEach(e=>e.inert=false);if(opener&&document.body.contains(opener))opener.focus()}
$('dx').onclick=closeDrawer;scrim.onclick=closeDrawer;
$('back').onclick=()=>{stack.pop();paint()};
render();
})();
