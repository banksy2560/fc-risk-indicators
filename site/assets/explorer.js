/* Explorer: concept tabs, facets with live counts, list, sticky record panel, pin-to-compare, CSV. Serves /explorer, /typologies, /indicators, /controls. */
(async function(){
'use strict';
const {$,$$,esc,uniq,MARK,KIND,tag,sig,kindOf,SEVRANK}=FC;
let x;try{x=await FC.load()}catch(e){return}
const {d,L,T,I,C}=x,lab=FC.lab;
const ITEMS={t:d.typologies,i:d.indicators,c:d.controls};
const mqSheet=window.matchMedia('(max-width:1100px)');
const DEFAULT_MODE=document.body.dataset.mode||'t';
const keys=o=>Object.keys(o);
/* facet definitions: [key, label, item field, values, formatter, options] */
const domV=d.domains.map(v=>v.id), famV=x.fams;
const F={
 domain:['Domain','dom',()=>domV,v=>L.domain[v]],
 stage:['Stage','stg',()=>keys(L.stage),v=>L.stage[v]],
 sector:['Sector','sec',()=>keys(L.sector),v=>L.sector[v]],
 family:['Control family','fam',()=>famV,v=>L.family[v]],
 ctype:['Control type','ctype',()=>keys(L.ctype),v=>L.ctype[v]],
 cat:['Indicator category','cats',()=>keys(L.cat),v=>L.cat[v]],
 sev:['Signal strength','sevs',()=>['high','medium','low'],v=>L.sev[v],{fixed:1,foot:'Indicative strength of a single indicator. Never combined into a score.'}],
 det:['Detection method','det',()=>keys(L.det),v=>L.det[v]],
 product:['Product','pr',()=>L.vocab.pr,v=>L.pr[v],{dim:'pr',foot:'AI-inferred. Cross-cutting items that apply across all products match every value.'}],
 channel:['Channel','ch',()=>L.vocab.ch,v=>L.ch[v],{dim:'ch',foot:'AI-inferred. Cross-cutting items that apply across all channels match every value.'}],
 rail:['Payment rail','rl',()=>L.vocab.rl,v=>L.rl[v],{dim:'rl',foot:'AI-inferred. Cross-cutting items that apply across all rails match every value.'}],
 segment:['Customer segment','sg',()=>L.vocab.sg,v=>L.sg[v],{dim:'sg',foot:'AI-inferred. Cross-cutting items that apply across all segments match every value.'}],
 evid:['Source evidence','evd',()=>['checked_link','checked','unverified'],v=>L.evid[v],{fixed:1,foot:'From the citation tags of linked typologies. No source is confirmed by a human.'}],
 status:['Review status','stt',()=>L.statusOrder,v=>L.status[v],{fixed:1,foot:'Reviewed counts are zero: nothing has been reviewed by a human yet.'}],
 impl:['Implementation','impls',()=>keys(L.impl),v=>L.impl[v]],
 eff:['Typical effectiveness','effs',()=>['high','medium','low'],v=>L.eff[v],{fixed:1,foot:'Indicative label only.'}]
};
const FAC={
 t:['domain','stage','sector','family','ctype','product','channel','rail','segment','evid','status'],
 i:['domain','cat','sev','det','ctype','family','product','channel','rail','segment','sector','evid','status'],
 c:['ctype','impl','eff','family','domain','sector','status']};
const LABEL_OVERRIDE={i:{ctype:'Control type (linked)',family:'Control family (linked)',domain:'Domain (via typologies)',sector:'Sector (via typologies)'},t:{family:'Control family (linked)',ctype:'Control type (linked)'},c:{domain:'Domain served',sector:'Sector served'}};
const flabel=(m,k)=>(LABEL_OVERRIDE[m]&&LABEL_OVERRIDE[m][k])||F[k][0];
const SORTS={t:[['name','Name'],['domain','Domain'],['n','Most indicators'],['recent','Recently added']],i:[['name','Name'],['str','Signal strength'],['reuse','Most reused']],c:[['name','Name'],['reuse','Most reused']]};
if(!d.typologies[0].added)SORTS.t=SORTS.t.filter(s=>s[0]!=='recent');
const domIdx=Object.fromEntries(domV.map((v,n)=>[v,n]));

let S={m:DEFAULT_MODE,q:'',f:{},sel:null,sort:'name'};
const find=id=>I[id]||C[id]||T[id];
let pins=[];try{pins=JSON.parse(sessionStorage.getItem('fcri-pins')||'[]').filter(p=>find(p.id)).slice(0,4)}catch(e){pins=[]}
const savePins=()=>{try{sessionStorage.setItem('fcri-pins',JSON.stringify(pins))}catch(e){}};
/* ---------- hash */
function readHash(){
 const raw=location.hash.slice(1);S.q='';S.f={};S.sort='name';S.sel=null;S.m=DEFAULT_MODE;
 if(!raw)return;
 if(!/[=&]/.test(raw)){ // citable form: #ID or #ID/SUB
  const id=decodeURIComponent(raw).split('/')[0];if(find(id)){S.sel=id;S.m=kindOf(id)}return}
 const p=new URLSearchParams(raw);
 if(['t','i','c'].includes(p.get('m')))S.m=p.get('m');
 S.q=p.get('q')||'';
 FAC[S.m].forEach(k=>{const v=p.get(k);if(v)S.f[k]=new Set(v.split(','))});
 if(p.get('sel')&&find(p.get('sel'))){S.sel=p.get('sel');if(!p.get('m'))S.m=kindOf(S.sel)}
 if(p.get('s'))S.sort=p.get('s');
}
function hashString(){
 const hasF=keys(S.f).some(k=>S.f[k].size);
 if(!S.q&&!hasF&&S.sort==='name'&&S.m===kindOf(S.sel||'x')&&S.sel)return '#'+encodeURIComponent(S.sel);
 const p=new URLSearchParams();p.set('m',S.m);if(S.q)p.set('q',S.q);
 keys(S.f).forEach(k=>{if(S.f[k].size)p.set(k,[...S.f[k]].join(','))});
 if(S.sel)p.set('sel',S.sel);if(S.sort!=='name')p.set('s',S.sort);
 return '#'+p.toString().replace(/%2C/g,',');
}
function writeHash(){
 const empty=!S.q&&!S.sel&&S.sort==='name'&&!keys(S.f).some(k=>S.f[k].size)&&S.m===DEFAULT_MODE;
 history.replaceState(null,'',empty?location.pathname+location.search:hashString());
}
/* ---------- filtering */
const field=(it,k)=>it[F[k][1]]||[];
function matchFacet(it,k,sel){
 const dim=F[k][4]&&F[k][4].dim;
 if(dim&&it.ux&&it.ux.includes(dim))return true;
 return field(it,k).some(v=>sel.has(v));
}
function queryOk(it){
 if(!S.q)return true;const h=(it.name+' '+it.id+' '+it.desc).toLowerCase();
 return S.q.toLowerCase().split(/\s+/).every(w=>h.includes(w));
}
// for each item: the facet keys it fails (empty = passes everything)
function failing(it){
 const f=[];for(const k in S.f){if(S.f[k].size&&!matchFacet(it,k,S.f[k]))f.push(k)}return f;
}
function list(){
 const a=ITEMS[S.m].filter(it=>queryOk(it)&&!failing(it).length),s=S.sort;
 const cmp={name:(p,q)=>p.name.localeCompare(q.name),
  str:(p,q)=>SEVRANK[p.sev]-SEVRANK[q.sev]||p.name.localeCompare(q.name),
  reuse:(p,q)=>q.n-p.n||p.name.localeCompare(q.name),
  n:(p,q)=>q.n-p.n||p.name.localeCompare(q.name),
  domain:(p,q)=>domIdx[p.domain]-domIdx[q.domain]||p.name.localeCompare(q.name),
  recent:(p,q)=>(q.added||'').localeCompare(p.added||'')||p.name.localeCompare(q.name)}[s]||(()=>0);
 return a.sort(cmp);
}
/* ---------- rendering */
const el={tabs:$('#tabs'),facets:$('#facets'),rows:$('#rows'),cnt:$('#cnt'),q:$('#q'),sort:$('#sort'),active:$('#active'),detail:$('#detail'),body:$('#dbody'),pins:$('#pins'),pinb:$('#pinb'),fbtn:$('#fbtn'),fback:$('#fback'),dback:$('#dback')};
function drawTabs(){el.tabs.innerHTML=['t','i','c'].map(k=>`<button role="tab" type="button" data-m="${k}" aria-selected="${S.m===k}" class="${KIND[k].cls}" tabindex="${S.m===k?0:-1}">${MARK[k]}${KIND[k].np}<span class="ct">${ITEMS[k].length}</span></button>`).join('')}
let cur=[];
function drawFacets(){
 const m=S.m,openKeys=new Set($$('details.fg[open]',el.facets).map(v=>v.dataset.k)),first=!el.facets.dataset.init;el.facets.dataset.init=1;
 const scroll=el.facets.scrollTop,items=ITEMS[m].filter(queryOk);
 const keysM=FAC[m];
 const counts={};keysM.forEach(k=>counts[k]={});
 items.forEach(it=>{const fl=failing(it);if(fl.length>1)return;
  keysM.forEach(k=>{if(fl.length===1&&fl[0]!==k)return;
   const dim=F[k][4]&&F[k][4].dim;
   if(dim&&it.ux&&it.ux.includes(dim)){F[k][2]().forEach(v=>counts[k][v]=(counts[k][v]||0)+1)}
   else field(it,k).forEach(v=>counts[k][v]=(counts[k][v]||0)+1)})});
 el.facets.innerHTML=`<button type="button" class="btn fclose" id="fclose">Close filters</button><h2>Filters <button class="linkbtn" type="button" id="clear">Clear all</button></h2>`+keysM.map((k,n)=>{
  const [,,vals,fmt,opt]=F[k];const o=opt||{};const cnt=counts[k],sel=S.f[k]||new Set();
  let vs=vals().slice();if(!o.fixed)vs.sort((a,b)=>(cnt[b]||0)-(cnt[a]||0)||String(fmt(a)).localeCompare(fmt(b)));
  const isOpen=first?n<3||sel.size:openKeys.has(k)||sel.size;
  return `<details class="fg" data-k="${k}" ${isOpen?'open':''}><summary>${esc(flabel(m,k))}${o.dim?FC.aiTag:''}${sel.size?` <span class="n" style="font:600 12px var(--mono);color:var(--ink-3)">${sel.size}</span>`:''}</summary>${vs.map(v=>`<label class="${cnt[v]?'':'zero'}"><input type="checkbox" data-f="${k}" value="${esc(v)}" ${sel.has(v)?'checked':''}> <span>${esc(fmt(v))}</span><span class="n">${cnt[v]||0}</span></label>`).join('')}${o.foot?`<p class="foot">${esc(o.foot)}</p>`:''}</details>`}).join('');
 el.facets.scrollTop=scroll;
}
function activeBadges(){
 const b=[];if(S.q)b.push(['q','',`Search: ${S.q}`]);
 FAC[S.m].forEach(k=>S.f[k]&&S.f[k].forEach(v=>b.push([k,v,`${flabel(S.m,k)}: ${F[k][3](v)}`])));
 el.active.innerHTML=b.map(([k,v,t])=>`<button type="button" data-rk="${k}" data-rv="${esc(v)}" aria-label="Remove filter ${esc(t)}">${esc(t)}</button>`).join('');
}
function drawRows(){
 cur=list();const m=S.m;
 el.cnt.textContent=`${cur.length} of ${ITEMS[m].length} ${KIND[m].np.toLowerCase()}`;
 const selIn=cur.findIndex(it=>it.id===S.sel),tab=selIn>-1?selIn:0;
 el.rows.innerHTML=cur.length?cur.map((it,n)=>{let sub='',rt='';
  if(m==='i'){sub=`<span>${lab('cat',it.cat)}</span><span>${it.used} ${it.used===1?'typology':'typologies'} &middot; ${it.nc} controls</span>`;rt=sig(it.sev,lab('sev',it.sev))}
  else if(m==='t'){sub=`<span>${esc(L.domain[it.domain])}</span><span>${it.nInd} indicators &middot; ${it.nCtl} controls</span>`;rt=`<span>${it.stg.map(s=>lab('stage',s)).join(', ')}</span>`}
  else{sub=`<span>${lab('ctype',it.type)} &middot; ${lab('impl',it.impl)}</span><span>${it.nTyp} typologies &middot; ${it.nInd} indicators</span>`;rt=`<span class="mono">${it.id}</span>`}
  const pinned=pins.some(p=>p.id===it.id);
  return `<li><button type="button" class="row ${KIND[m].cls}" data-id="${it.id}" aria-current="${S.sel===it.id}" tabindex="${n===tab?0:-1}">${MARK[m]}<span class="nm">${esc(it.name)}</span><span class="rt">${pinned?'<span class="pinned">Pinned</span>':''}${rt}</span><span class="sub">${sub}</span></button></li>`}).join(''):'<li class="empty"><p class="display" style="font-size:22px;color:var(--ink)">No matches</p><p>Loosen a filter or clear the search.</p></li>';
}
let dtok=0;
async function drawDetail(scroll){
 const my=++dtok;
 el.pins.innerHTML=pins.map(p=>`<button type="button" data-pin="${p.id}" class="${KIND[p.k].cls}" aria-current="${p.id===S.sel}" title="${esc(p.name)}">${MARK[p.k]}<span class="t">${esc(p.name)}</span></button>`).join('');
 if(!S.sel){el.body.innerHTML=`<div class="ph"><p class="display">Select a record</p><p>The panel stays open while you move through the list with the arrow keys. Use Pin to compare to keep up to four records as tabs.</p></div>`;el.pinb.hidden=true;document.title=`${KIND[S.m].np} | FC Risk Indicators`;return}
 const id=S.sel,isP=pins.some(p=>p.id===id);
 el.pinb.hidden=false;el.pinb.textContent=isP?'Unpin':'Pin to compare';el.pinb.setAttribute('aria-pressed',isP);
 el.body.innerHTML='<p class="loading">Loading record...</p>';
 try{const html=await FC.renderRecord(id);if(my!==dtok)return;el.body.innerHTML=html;document.title=`${find(id).name} (${id}) | FC Risk Indicators`;if(scroll)el.detail.scrollTop=0}
 catch(e){if(my===dtok)el.body.innerHTML='<div class="ph"><p class="display">Could not load</p><p>The record data could not be loaded.</p></div>'}
}
function draw(){drawTabs();drawFacets();activeBadges();drawRows();drawDetail();el.q.value=S.q;
 el.sort.innerHTML=SORTS[S.m].map(([v,l])=>`<option value="${v}" ${S.sort===v?'selected':''}>Sort: ${l}</option>`).join('');writeHash()}
function refreshList(){drawFacets();activeBadges();drawRows();writeHash()}
function openPane(){if(mqSheet.matches){document.body.classList.add('pane');el.dback.hidden=false;$('#closeb').focus()}}
function closePane(){document.body.classList.remove('pane');el.dback.hidden=true;const r=$(`.row[data-id="${S.sel}"]`,el.rows);r&&r.focus()}
function select(id,opts={}){
 const it=find(id);if(!it)return;
 if(it.k!==S.m){S.m=it.k;S.f={};S.q='';S.sort='name'}
 S.sel=id;
 if(!list().some(v=>v.id===id)){S.f={};S.q=''}
 drawTabs();drawFacets();activeBadges();drawRows();el.q.value=S.q;
 el.sort.innerHTML=SORTS[S.m].map(([v,l])=>`<option value="${v}" ${S.sort===v?'selected':''}>Sort: ${l}</option>`).join('');
 drawDetail(true);writeHash();
 const r=$(`.row[data-id="${id}"]`,el.rows);if(r&&opts.scroll!==false)r.scrollIntoView({block:'nearest'});
 if(opts.open!==false)openPane();
}
FC.onGo=(k,id)=>select(id);
/* ---------- events */
function setMode(m){S.m=m;S.f={};S.q='';S.sort='name';S.sel=null;document.body.classList.remove('pane');el.dback.hidden=true;draw()}
el.tabs.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b)setMode(b.dataset.m)});
el.tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const o=['t','i','c'];const i=o.indexOf(S.m);setMode(o[e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3]);$(`[data-m="${S.m}"]`,el.tabs).focus()});
el.facets.addEventListener('change',e=>{const c=e.target.closest('input[data-f]');if(!c)return;const k=c.dataset.f;S.f[k]=S.f[k]||new Set();c.checked?S.f[k].add(c.value):S.f[k].delete(c.value);
 refreshList();const again=$(`input[data-f="${k}"][value="${CSS.escape(c.value)}"]`,el.facets);again&&again.focus({preventScroll:true})});
el.facets.addEventListener('click',e=>{if(e.target.id==='clear'){S.f={};S.q='';el.q.value='';refreshList()}else if(e.target.id==='fclose')closeFacets()});
el.active.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.rk==='q'){S.q='';el.q.value=''}else S.f[b.dataset.rk].delete(b.dataset.rv);refreshList()});
let qt;el.q.addEventListener('input',()=>{clearTimeout(qt);qt=setTimeout(()=>{S.q=el.q.value;refreshList()},120)});
el.sort.addEventListener('change',()=>{S.sort=el.sort.value;drawRows();writeHash()});
el.rows.addEventListener('click',e=>{const b=e.target.closest('.row');if(!b)return;S.sel=b.dataset.id;$$('.row',el.rows).forEach(r=>{r.setAttribute('aria-current',r===b);r.tabIndex=r===b?0:-1});drawDetail(true);writeHash();openPane()});
el.rows.addEventListener('keydown',e=>{
 if(!['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(e.key))return;
 const rs=$$('.row',el.rows),i=rs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();
 const step=e.key==='PageDown'?10:e.key==='PageUp'?-10:e.key==='ArrowDown'?1:-1;
 const n=e.key==='Home'?0:e.key==='End'?rs.length-1:Math.max(0,Math.min(rs.length-1,i+step));
 rs.forEach(r=>r.tabIndex=-1);rs[n].tabIndex=0;rs[n].focus();
 if(!mqSheet.matches){S.sel=rs[n].dataset.id;rs.forEach(r=>r.setAttribute('aria-current',r===rs[n]));drawDetail(true);writeHash()}});
el.body.addEventListener('click',e=>{const a=e.target.closest('a[data-k]');if(a&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();select(a.dataset.id,{open:true})}});
el.pins.addEventListener('click',e=>{const b=e.target.closest('[data-pin]');if(b)select(b.dataset.pin)});
el.pinb.addEventListener('click',()=>{const i=pins.findIndex(p=>p.id===S.sel);
 if(i>-1)pins.splice(i,1);else{if(pins.length>=4){FC.toast('Four records are pinned. Unpin one to add another.');return}const it=find(S.sel);pins.push({id:S.sel,k:it.k,name:it.name})}
 savePins();drawDetail();drawRows()});
$('#closeb').addEventListener('click',closePane);el.dback.addEventListener('click',closePane);
function openFacets(){el.facets.classList.add('open');el.fback.hidden=false;el.fbtn.setAttribute('aria-expanded','true');const f=$('input,summary',el.facets);f&&f.focus()}
function closeFacets(){el.facets.classList.remove('open');el.fback.hidden=true;el.fbtn.setAttribute('aria-expanded','false');el.fbtn.focus()}
el.fbtn.addEventListener('click',()=>el.facets.classList.contains('open')?closeFacets():openFacets());
el.fback.addEventListener('click',closeFacets);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('dialog.pal').open)return;
 if(document.body.classList.contains('pane'))closePane();else if(el.facets.classList.contains('open'))closeFacets()});
mqSheet.addEventListener('change',()=>{if(!mqSheet.matches){document.body.classList.remove('pane');el.dback.hidden=true;el.fback.hidden=true;el.facets.classList.remove('open')}});
window.addEventListener('hashchange',()=>{if(location.hash===hashString())return;readHash();draw();if(S.sel)openPane()});
/* ---------- CSV (current filtered list) */
$('#csv').addEventListener('click',async()=>{
 const m=S.m,rows=[];let notes={};
 if(m==='i'){try{notes=await FC.getJSON('data/notes.json')}catch(e){}
  rows.push(['id','name','category','signal_strength (indicative, not a risk score)','detection_methods','data_sources','false_positive_notes','description','domains','typologies','controls','products (AI-inferred, inherited)','channels (AI-inferred, inherited)','payment_rails (AI-inferred, inherited)','customer_segments (AI-inferred, inherited)','source_evidence','review_status','provenance','evidence_basis','confidence']);
  cur.forEach(it=>{const n=notes[it.id]||{data:[],fp:''};rows.push([it.id,it.name,lab('cat',it.cat),it.sev,it.det.map(v=>lab('det',v)),n.data,n.fp,it.desc,it.dom.map(v=>L.domain[v]),it.typs,it.ctls,FC.expCell(it,'pr'),FC.expCell(it,'ch'),FC.expCell(it,'rl'),FC.expCell(it,'sg'),lab('evid',it.evd[0]),lab('status',it.st),lab('prov',it.pv),lab('evb',it.eb),lab('conf',it.cf)])})}
 else if(m==='t'){rows.push(['id','name','domain','stage','sectors','n_indicators','n_controls','products (AI-inferred)','channels (AI-inferred)','payment_rails (AI-inferred)','customer_segments (AI-inferred)','source_evidence','review_status','provenance','added_to_repository','description']);
  cur.forEach(it=>rows.push([it.id,it.name,L.domain[it.domain],it.stg.map(v=>lab('stage',v)),it.sec.map(v=>lab('sector',v)),it.nInd,it.nCtl,FC.expCell(it,'pr'),FC.expCell(it,'ch'),FC.expCell(it,'rl'),FC.expCell(it,'sg'),lab('evid',it.evid),lab('status',it.st),'AI-drafted',it.added?it.added.slice(0,10):'',it.desc]))}
 else{rows.push(['id','name','type','implementation','typical_effectiveness (indicative)','family','typologies_using','indicators_using','description','review_status','provenance']);
  cur.forEach(it=>rows.push([it.id,it.name,it.type,it.impl,it.eff,lab('family',it.family),it.nTyp,it.nInd,it.desc,lab('status',it.st),'AI-drafted']))}
 FC.downloadCSV(`fc-${KIND[m].np.toLowerCase()}-v0.1-draft.csv`,rows);
});
readHash();draw();
if(S.sel){if(!mqSheet.matches){const r=$(`.row[data-id="${S.sel}"]`,el.rows);r&&r.scrollIntoView({block:'nearest'})}else openPane()}
})();
