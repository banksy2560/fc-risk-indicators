/* Relationships: typology -> indicators -> controls flow for any typology, control reuse table, links CSV. */
(async function(){
'use strict';
const {$,$$,esc,MARK,KIND,sig,kindOf,SEVRANK}=FC;
let x;try{x=await FC.load()}catch(e){return}
const {d,L,T,I,C}=x,lab=FC.lab;
const mq=window.matchMedia('(max-width:1180px)');
let S={t:T['ML-MULE']?'ML-MULE':d.typologies[0].id,sel:null},det=null,tok=0;
const pick=$('#pick'),flow=$('#flow'),dback=$('#dback');
pick.innerHTML=d.domains.map(v=>`<optgroup label="${esc(v.label)}">${d.typologies.filter(t=>t.domain===v.id).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
const order=d.typologies.map(t=>t.id);
function readHash(){
 const raw=decodeURIComponent(location.hash.slice(1));if(!raw)return;
 if(!/[=&]/.test(raw)){const id=raw.split('/')[0],k=kindOf(id);
  if(k==='t'&&T[id]){S.t=id;S.sel=null}
  else if(k==='i'&&I[id]){S.t=I[id].typs[0];S.sel=id}
  else if(k==='c'&&C[id]){S.t=C[id].typs[0];S.sel=id}return}
 const p=new URLSearchParams(raw);if(T[p.get('t')])S.t=p.get('t');
 const s=p.get('sel');S.sel=s&&(I[s]||C[s])?s:null;
}
function writeHash(){const p=new URLSearchParams();p.set('t',S.t);if(S.sel)p.set('sel',S.sel);history.replaceState(null,'','#'+p)}
function related(){
 if(!S.sel||!det)return null;const k=kindOf(S.sel);
 if(k==='i'){const l=det.indicators.find(i=>i.ref===S.sel);return l?{i:new Set([S.sel]),c:new Set(l.controls)}:null}
 const is=det.indicators.filter(i=>i.controls.includes(S.sel)).map(i=>i.ref);return is.length?{i:new Set(is),c:new Set([S.sel])}:null;
}
async function draw(){
 const my=++tok,t=T[S.t];pick.value=S.t;
 flow.innerHTML='<p class="loading" style="grid-column:1/-1">Loading...</p>';
 try{const dd=await FC.getJSON(`data/typologies/${S.t}.json`);if(my!==tok)return;det=dd}catch(e){return}
 if(S.sel&&!related()){ // selected item is not part of this typology
  S.sel=null}
 document.title=`${t.name} - relationship flow | FC Risk Indicators`;
 paint();
}
function paint(){
 const t=T[S.t],inds=[...det.indicators].sort((a,b)=>SEVRANK[a.sev]-SEVRANK[b.sev]);
 const cover={},ctl=det.controls;det.indicators.forEach(i=>i.controls.forEach(c=>cover[c]=(cover[c]||0)+1));
 const rel=related(),kSel=S.sel?kindOf(S.sel):null;
 const groups=['preventive','detective','corrective','governance'].map(ty=>[ty,ctl.filter(c=>C[c].type===ty).sort((a,b)=>cover[b]-cover[a]||C[b].nTyp-C[a].nTyp)]).filter(g=>g[1].length);
 flow.className='flow'+(rel?' has-sel':'');
 flow.innerHTML=`<svg class="lines" id="lines" aria-hidden="true"></svg>
 <div class="col c-t"><h2>${MARK.t}Typology<span class="ct">1</span></h2><div class="nodes"><button type="button" class="node typnode c-t" id="tnode" data-k="t" data-id="${t.id}" aria-pressed="${S.sel===null}"><span class="h">${MARK.t}<span class="nm">${esc(t.name)}</span></span><p>${esc(t.desc.split('. ')[0].replace(/\.$/,''))}.</p><span class="sub"><span>${esc(L.domain[t.domain])}</span>${t.stg.map(s=>`<span>${lab('stage',s)}</span>`).join('')}</span></button></div></div>
 <div class="arr" aria-hidden="true">&rarr;</div>
 <div class="col c-i"><h2>${MARK.i}Indicators<span class="ct">${inds.length}</span></h2><div class="nodes">${inds.map(i=>`<button type="button" class="node c-i${rel&&!rel.i.has(i.ref)?' dim':''}${rel&&rel.i.has(i.ref)?' rel':''}" data-k="i" data-id="${i.ref}" aria-pressed="${S.sel===i.ref}"><span class="h">${MARK.i}<span class="nm">${esc(i.canon)}</span></span><span class="sub">${sig(i.sev,lab('sev',i.sev))}<span>${lab('cat',i.cat)}</span></span><span class="sub">${i.controls.map(c=>`<span class="mini" title="${esc(C[c].name)}">${MARK.c}${c.replace('CTL-','')}</span>`).join('')}</span></button>`).join('')}</div></div>
 <div class="arr" aria-hidden="true">&rarr;</div>
 <div class="col c-c"><h2>${MARK.c}Controls<span class="ct">${ctl.length}</span></h2>${groups.map(([ty,ids])=>`<div class="grp"><span class="eyebrow">${lab('ctype',ty)} (${ids.length})</span><div class="nodes">${ids.map(c=>`<button type="button" class="node c-c${rel&&!rel.c.has(c)?' dim':''}${rel&&rel.c.has(c)?' rel':''}" data-k="c" data-id="${c}" aria-pressed="${S.sel===c}"><span class="h">${MARK.c}<span class="nm">${esc(C[c].name)}</span></span><span class="sub"><span class="mono">${c}</span><span>covers ${cover[c]} of ${inds.length}</span><span>${C[c].nTyp} typologies</span></span></button>`).join('')}</div></div>`).join('')}</div>`;
 // reuse table
 const mx=Math.max(...d.controls.map(c=>c.nTyp));
 $('#reuseh').textContent=`Typologies using it (all ${d.counts.typologies})`;
 $('#reuse').innerHTML=ctl.map(c=>C[c]).sort((a,b)=>b.nTyp-a.nTyp||a.name.localeCompare(b.name)).map(c=>`<tr><td><button type="button" class="linkbtn c-c" style="text-decoration:none;text-align:left;display:flex;gap:7px;align-items:flex-start" data-k="c" data-id="${c.id}"><span style="color:var(--c)">${MARK.c}</span><span><strong style="font-weight:600;text-decoration:underline;text-decoration-color:var(--rule-strong)">${esc(c.name)}</strong><br><span class="mono" style="color:var(--ink-3)">${c.id}</span></span></button></td><td>${lab('ctype',c.type)}</td><td>${cover[c.id]} of ${inds.length}</td><td><div class="rbar"><span class="tr"><span class="fl" style="width:${c.nTyp/mx*100}%"></span></span><b>${c.nTyp}</b></div><details class="also"><summary>Also used in (${c.nTyp-1})</summary><div class="chips">${c.typs.filter(v=>v!==S.t).map(v=>`<a class="chip" href="relationships#t=${v}" data-k="t" data-id="${v}">${esc(T[v].name)}</a>`).join('')}</div></details></td></tr>`).join('');
 $('#ctx').textContent=`${t.name}: ${inds.length} indicators, ${ctl.length} controls`;
 drawPanel();requestAnimationFrame(lines);writeHash();
}
let ptok=0;
async function drawPanel(){
 const my=++ptok,id=S.sel||S.t;$('#pbody').innerHTML='<p class="loading">Loading record...</p>';
 try{const h=await FC.renderRecord(id);if(my===ptok)$('#pbody').innerHTML=h}catch(e){}
}
const pt=(e,side,box)=>{const r=e.getBoundingClientRect();return {x:(side==='r'?r.right:r.left)-box.left,y:r.top+r.height/2-box.top}};
function lines(){
 const svg=$('#lines');if(!svg||getComputedStyle(svg).display==='none'||!det)return;
 const box=flow.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
 const tn=$('#tnode'),im={},cm={};$$('.node[data-k="i"]',flow).forEach(n=>im[n.dataset.id]=n);$$('.node[data-k="c"]',flow).forEach(n=>cm[n.dataset.id]=n);
 const rel=related(),curve=(a,b,c)=>{const dx=(b.x-a.x)/2;return `<path class="${c}" d="M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}"/>`};
 let h='';const a=pt(tn,'r',box);
 Object.values(im).forEach(n=>h+=curve(a,pt(n,'l',box),'base'));
 if(rel)det.indicators.forEach(i=>i.controls.forEach(c=>{if(rel.i.has(i.ref)&&rel.c.has(c)&&im[i.ref]&&cm[c])h+=curve(pt(im[i.ref],'r',box),pt(cm[c],'l',box),kindOf(S.sel)==='i'?'hl':'hl2')}));
 svg.innerHTML=h;
}
function openPane(){if(mq.matches){document.body.classList.add('pane');dback.hidden=false;$('#closeb').focus()}}
function closePane(){document.body.classList.remove('pane');dback.hidden=true;const b=$(`.node[aria-pressed="true"]`,flow);b&&b.focus()}
function setSel(id){S.sel=id;paint();openPane()}
function setT(id){S.t=id;S.sel=null;draw()}
function goRecord(k,id){ // from panel, table, palette
 if(k==='t'){setT(id);return}
 const inT=det&&(k==='i'?det.indicators.some(i=>i.ref===id):det.indicators.some(i=>i.controls.includes(id)));
 if(inT){setSel(id);return}
 S.t=k==='i'?I[id].typs[0]:C[id].typs[0];S.sel=id;draw().then(openPane);
}
FC.onGo=goRecord;
pick.addEventListener('change',()=>setT(pick.value));
const step=n=>setT(order[(order.indexOf(S.t)+n+order.length)%order.length]);
$('#prev').addEventListener('click',()=>step(-1));$('#next').addEventListener('click',()=>step(1));
flow.addEventListener('click',e=>{const b=e.target.closest('.node');if(!b)return;const id=b.dataset.id;
 if(b.dataset.k==='t'){S.sel=null;paint();openPane()}else if(S.sel===id&&!document.body.classList.contains('pane')){S.sel=null;paint()}else setSel(id)});
function panelClick(e){
 const f=e.target.closest('a[data-flow]');if(f){e.preventDefault();const p=new URLSearchParams(f.getAttribute('href').split('#')[1]);if(T[p.get('t')]){S.t=p.get('t');S.sel=null;draw()}return}
 const a=e.target.closest('[data-k]');if(!a||a.closest('#flow')||e.metaKey||e.ctrlKey)return;e.preventDefault();goRecord(a.dataset.k,a.dataset.id)}
$('#pbody').addEventListener('click',panelClick);$('#reuse').addEventListener('click',panelClick);
$('#closeb').addEventListener('click',closePane);dback.addEventListener('click',closePane);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('pane')&&!$('dialog.pal').open)closePane()});
mq.addEventListener('change',()=>{if(!mq.matches){document.body.classList.remove('pane');dback.hidden=true}});
window.addEventListener('hashchange',()=>{readHash();draw()});
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>requestAnimationFrame(lines),60)});
if('ResizeObserver' in window)new ResizeObserver(()=>requestAnimationFrame(lines)).observe(flow);
$('#csv').addEventListener('click',async()=>{const r=await FC.recordCsv(S.t);FC.downloadCSV(r.name.replace('fc-typology-','fc-links-'),r.rows)});
readHash();draw().then(()=>{if(S.sel&&mq.matches)openPane()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>requestAnimationFrame(lines));
})();
